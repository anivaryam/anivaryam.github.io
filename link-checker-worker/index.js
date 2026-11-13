/**
 * Link Checker Worker
 * Checks if URLs return 404 or other error status codes
 */

import { isPrivateHost } from '../src/lib/related-product/url-safety.ts';

// CORS headers - allow all origins
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const PRODUCT_PAGE_FETCH_ORIGIN = 'https://anivaryam.github.io';
const MAX_PRODUCT_PAGE_URL_LENGTH = 8192;
const MAX_PRODUCT_PAGE_BYTES = 8_000_000;
const MAX_PRODUCT_PAGE_REDIRECTS = 5;
const PRODUCT_PAGE_TIMEOUT_MS = 20_000;

class ProductPageFetchError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function getPublicPageUrl(input) {
  if (typeof input !== 'string' || input.length === 0 || input.length > MAX_PRODUCT_PAGE_URL_LENGTH) {
    throw new ProductPageFetchError('A valid public page URL is required.', 400);
  }

  let url;
  try {
    url = new URL(input);
  } catch {
    throw new ProductPageFetchError('A valid public page URL is required.', 400);
  }

  if (
    !['http:', 'https:'].includes(url.protocol)
    || url.username
    || url.password
    || isPrivateHost(url.hostname)
  ) {
    throw new ProductPageFetchError('Only public HTTP or HTTPS pages can be fetched.', 400);
  }

  url.hash = '';
  return url;
}

async function readLimitedPageText(response) {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_PRODUCT_PAGE_BYTES) {
    await response.body?.cancel();
    throw new ProductPageFetchError('The page is too large to process.', 413);
  }

  const reader = response.body?.getReader();
  if (!reader) return '';

  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_PRODUCT_PAGE_BYTES) {
      await reader.cancel();
      throw new ProductPageFetchError('The page is too large to process.', 413);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function fetchProductPage(request, env, payload) {
  if (request.headers.get('Origin') !== PRODUCT_PAGE_FETCH_ORIGIN) {
    return jsonResponse({ error: 'This page-fetch endpoint only accepts requests from the site.' }, 403);
  }

  let target;
  try {
    target = getPublicPageUrl(payload.url);
  } catch (error) {
    return jsonResponse({ error: error.message }, error.status || 400);
  }

  const limiter = env?.RELATED_PRODUCT_FETCH_LIMITER;
  if (limiter) {
    const clientIp = request.headers.get('CF-Connecting-IP');
    if (!clientIp) {
      return jsonResponse({ error: 'The request could not be rate-limited.' }, 503);
    }
    try {
      const { success } = await limiter.limit({ key: clientIp });
      if (!success) {
        return jsonResponse({ error: 'Page-fetch rate limit reached. Try again shortly.' }, 429);
      }
    } catch {
      return jsonResponse({ error: 'Page-fetch service is temporarily unavailable.' }, 503);
    }
  }

  const originalOrigin = target.origin;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PRODUCT_PAGE_TIMEOUT_MS);

  try {
    let upstreamResponse;
    for (let redirects = 0; redirects <= MAX_PRODUCT_PAGE_REDIRECTS; redirects++) {
      upstreamResponse = await fetch(target, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
      });

      if (upstreamResponse.status < 300 || upstreamResponse.status >= 400) break;
      const location = upstreamResponse.headers.get('location');
      if (!location || redirects === MAX_PRODUCT_PAGE_REDIRECTS) {
        throw new ProductPageFetchError('The page returned too many redirects.', 502);
      }

      const redirectedTarget = new URL(location, target);
      if (redirectedTarget.origin !== originalOrigin || isPrivateHost(redirectedTarget.hostname)) {
        throw new ProductPageFetchError('The page redirected outside the provided site.', 403);
      }
      target = redirectedTarget;
    }

    if (!upstreamResponse?.ok) {
      await upstreamResponse?.body?.cancel();
      const status = upstreamResponse?.status || 502;
      return jsonResponse({ error: `The page returned HTTP ${status}.` }, status);
    }

    const contents = await readLimitedPageText(upstreamResponse);
    return jsonResponse({ contents });
  } catch (error) {
    const status = controller.signal.aborted
      ? 504
      : error instanceof ProductPageFetchError
        ? error.status
        : 502;
    const message = controller.signal.aborted
      ? 'The page request timed out.'
      : error instanceof ProductPageFetchError
        ? error.message
        : 'The page could not be fetched.';
    return jsonResponse({ error: message }, status);
  } finally {
    clearTimeout(timeoutId);
  }
}

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
      const payload = await request.json();

      if (payload?.action === 'fetch-page') {
        return addCorsHeaders(await fetchProductPage(request, env, payload));
      }

      const { links, timeout = 10000 } = payload;

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
              // A working page may not implement HEAD. An HTTP response is
              // not a thrown network error, so retry these statuses explicitly.
              if (method === 'HEAD' && (response.status === 405 || response.status === 501)) {
                method = 'GET';
                response = await fetch(url, { method, signal: controller.signal, redirect: 'follow' });
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
      const brokenLinks = results.filter((r) => !r.ok && !r.blocked && r.status >= 400 && r.status < 500);
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
