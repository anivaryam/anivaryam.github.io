/**
 * Link Checker Worker
 * Checks if URLs return 404 or other error status codes
 */

// CORS headers - allow all origins
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: CORS_HEADERS,
      });
    }

    // Add CORS to all responses
    const addCorsHeaders = (response) => {
      const newHeaders = new Headers(response.headers);
      Object.entries(CORS_HEADERS).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    };

    // Only allow POST requests
    if (request.method !== 'POST') {
      return addCorsHeaders(new Response('Method not allowed', { status: 405 }));
    }

    try {
      const { links, timeout = 10000 } = await request.json();

      if (!Array.isArray(links)) {
        return addCorsHeaders(new Response('Invalid request: links must be an array', { status: 400 }));
      }

      // Check each link
      const results = await Promise.all(
        links.map(async (url) => {
          // Check if it's a Shopify site
          const isShopifyProduct = (url.includes('shopify.com') || 
                           url.includes('myshopify.com')) &&
                           (url.includes('/products/') || url.includes('/collections/'));
          
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            let response;
            let method = 'HEAD';
            
            // For Shopify product/collection pages, use GET to check properly
            if (isShopifyProduct) {
              method = 'GET';
              response = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
                redirect: 'follow',
              });
            } else {
              try {
                response = await fetch(url, {
                  method: 'HEAD',
                  signal: controller.signal,
                  redirect: 'follow',
                });
              } catch (headError) {
                // Fallback to GET
                method = 'GET';
                response = await fetch(url, {
                  method: 'GET',
                  signal: controller.signal,
                  redirect: 'follow',
                });
              }
            }

            clearTimeout(timeoutId);

            // Check for Shopify blocking (403) - treat as blocked, not broken
            if (response.status === 403) {
              return {
                url,
                status: 403,
                ok: false,
                method,
                blocked: true,
                error: 'Access blocked (403) - likely Shopify bot protection',
              };
            }

            // For Shopify products/collections with 200: check if it's bot protection
            if (isShopifyProduct && response.ok) {
              const text = await response.clone().text();
              
              // Check for bot protection - small page with protection text
              const hasBotProtection = 
                text.includes('Checking your browser') ||
                text.includes('before continuing') ||
                text.includes('One more step') ||
                (text.length > 0 && text.length < 3000);
              
              if (hasBotProtection) {
                return {
                  url,
                  status: 0,
                  ok: false,
                  method,
                  blocked: true,
                  error: 'Shopify bot protection',
                };
              }
              // Valid link
              return {
                url,
                status: response.status,
                ok: response.ok,
                method,
                blocked: false,
              };
            }

            return {
              url,
              status: response.status,
              ok: response.ok,
              method,
              blocked: false,
            };
          } catch (error) {
            let errorType = 'unknown';
            let errorMessage = error.message;

            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('TypeError')) {
              errorType = 'blocked';
              errorMessage = 'Request blocked - likely CORS or bot protection';
            } else if (error.name === 'AbortError') {
              errorType = 'timeout';
              errorMessage = 'Request timed out';
            }

            return {
              url,
              status: 0,
              ok: false,
              error: errorType,
              errorMessage,
              blocked: errorType === 'blocked',
            };
          }
        })
      );

      // Filter links by status
      const goodLinks = results.filter((r) => r.ok && !r.blocked);
      const brokenLinks = results.filter((r) => !r.ok && !r.blocked && r.status >= 400);
      const serverErrors = results.filter((r) => !r.ok && !r.blocked && r.status >= 500);
      const blockedLinks = results.filter((r) => r.blocked || r.status === 0);

      return addCorsHeaders(
        new Response(
          JSON.stringify({
            total: results.length,
            good: goodLinks.length,
            broken: brokenLinks.length,
            serverErrors: serverErrors.length,
            blocked: blockedLinks.length,
            results,
            goodLinks,
            brokenLinks,
            serverErrorLinks: serverErrors,
            blockedLinks,
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );
    } catch (error) {
      return addCorsHeaders(new Response(`Error: ${error.message}`, { status: 500 }));
    }
  },
};
