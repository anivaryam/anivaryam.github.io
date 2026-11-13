import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import path from "path";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isPrivateHost } from "./src/lib/related-product/url-safety";

const RELATED_PRODUCT_DEV_ROUTE = "/__related-product/page";
const RELATED_PRODUCT_MAX_PAGE_BYTES = 8_000_000;

function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) return false;
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");
  return normalized === "::1" || normalized === "127.0.0.1";
}

function isAllowedRelatedProductDevRequest(
  request: import("node:http").IncomingMessage,
): boolean {
  if (request.headers["x-related-product-dev-proxy"] !== "1") return false;

  const host = request.headers.host?.toLowerCase();
  const origin = request.headers.origin;
  if (origin && host) {
    try {
      const parsedOrigin = new URL(origin);
      const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(parsedOrigin.hostname.toLowerCase());
      return parsedOrigin.protocol === "http:"
        && localHost
        && parsedOrigin.host.toLowerCase() === host;
    } catch {
      return false;
    }
  }

  return isLoopbackAddress(request.socket.remoteAddress);
}

async function assertPublicRelatedProductTarget(target: URL): Promise<void> {
  if (
    !["http:", "https:"].includes(target.protocol)
    || target.username
    || target.password
    || isPrivateHost(target.hostname)
  ) {
    throw new Error("Only public HTTP or HTTPS pages can be fetched.");
  }

  const hostname = target.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname)) return;

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateHost(address))) {
    throw new Error("The page hostname did not resolve to public addresses.");
  }
}

async function readLimitedResponseText(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > RELATED_PRODUCT_MAX_PAGE_BYTES) {
    await response.body?.cancel();
    throw new Error("The page is too large to process.");
  }

  const reader = response.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > RELATED_PRODUCT_MAX_PAGE_BYTES) {
      await reader.cancel();
      throw new Error("The page is too large to process.");
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

function relatedProductDevFetchPlugin() {
  return {
    name: "related-product-dev-fetch",
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use(async (request, response, next) => {
        const requestUrl = new URL(request.url || "/", "http://localhost");
        if (requestUrl.pathname !== RELATED_PRODUCT_DEV_ROUTE) {
          next();
          return;
        }
        if (request.method !== "GET") {
          response.statusCode = 405;
          response.end();
          return;
        }
        if (!isAllowedRelatedProductDevRequest(request)) {
          response.statusCode = 403;
          response.end();
          return;
        }

        const rawTarget = requestUrl.searchParams.get("url");
        if (!rawTarget || rawTarget.length > 8_192) {
          response.statusCode = 400;
          response.end(JSON.stringify({ error: "A valid page URL is required." }));
          return;
        }

        let target: URL;
        try {
          target = new URL(rawTarget);
          await assertPublicRelatedProductTarget(target);
        } catch (error) {
          response.statusCode = 400;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.end(JSON.stringify({
            error: error instanceof Error ? error.message : "Invalid page URL.",
          }));
          return;
        }

        const originalOrigin = target.origin;
        const controller = new AbortController();
        const timeout = globalThis.setTimeout(() => controller.abort(), 25_000);
        try {
          let pageResponse: Response | undefined;
          for (let redirects = 0; redirects <= 5; redirects++) {
            pageResponse = await fetch(target, {
              redirect: "manual",
              signal: controller.signal,
              headers: {
                Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
                "User-Agent": "Mozilla/5.0 (compatible; RelatedProductFinderDev/1.0)",
              },
            });

            if (pageResponse.status < 300 || pageResponse.status >= 400) break;
            const location = pageResponse.headers.get("location");
            if (!location || redirects === 5) {
              throw new Error("The page returned too many redirects.");
            }

            const redirectedTarget = new URL(location, target);
            if (redirectedTarget.origin !== originalOrigin) {
              throw new Error("The page redirected to another website, which is not allowed.");
            }
            await assertPublicRelatedProductTarget(redirectedTarget);
            target = redirectedTarget;
          }

          if (!pageResponse || !pageResponse.ok) {
            response.statusCode = pageResponse?.status || 502;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(JSON.stringify({ error: "The page request failed." }));
            return;
          }

          const contents = await readLimitedResponseText(pageResponse);
          response.statusCode = 200;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.setHeader("Cache-Control", "no-store");
          response.end(JSON.stringify({ contents }));
        } catch (error) {
          response.statusCode = controller.signal.aborted ? 504 : 502;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.end(JSON.stringify({
            error: error instanceof Error ? error.message : "Could not fetch this page.",
          }));
        } finally {
          globalThis.clearTimeout(timeout);
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const base = process.env.GITHUB_PAGES_BASE || "/";
  // Ensure base ends with / and remove leading / from icon paths to avoid double slashes
  const basePath = base.endsWith("/") ? base : `${base}/`;
  
  return {
    base: basePath,
    server: {
      host: "::",
      port: 8000,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
      proxy: {
        // Proxy for web scraping (optional - uncomment to use)
        // '/api/scrape': {
        //   target: 'http://localhost:3000',
        //   changeOrigin: true,
        // },
      },
    },
    plugins: [
      wasm(),
      topLevelAwait(),
      react(),
      relatedProductDevFetchPlugin(),
      // VitePWA({
      //   registerType: "autoUpdate",
      //   workbox: {
      //     maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
      //     // Exclude static files from navigation route to prevent service worker from intercepting them
      //     // This allows sitemap.xml, robots.txt, and other static files to be served directly
      //     navigateFallbackDenylist: [
      //       /^\/_/, // Exclude files starting with underscore
      //       // Exclude common static file extensions
      //       /\.(xml|txt|json|ico|png|jpg|jpeg|svg|webmanifest|js|css|woff|woff2|ttf|eot|wasm|map)$/i,
      //     ],
      //   },
      //   devOptions: {
      //     enabled: true,
      //     type: 'module',
      //     navigateFallback: 'index.html',
      //   },
      //   manifest: {
      //     name: "RosettaScript",
      //     short_name: "RosettaScript",
      //     description: "Developer tools for converting, automating, and building. Word to HTML converters, database visualization, and more.",
      //     start_url: basePath,
      //     scope: basePath,
      //     display: "standalone",
      //     background_color: "#16181d",
      //     theme_color: "#22c55e",
      //     orientation: "portrait-primary",
      //     icons: [
      //       {
      //         src: `${basePath}icon-192.png`,
      //         sizes: "192x192",
      //         type: "image/png",
      //         purpose: "any maskable",
      //       },
      //       {
      //         src: `${basePath}icon-512.png`,
      //         sizes: "512x512",
      //         type: "image/png",
      //         purpose: "any maskable",
      //       },
      //     ],
      //     categories: ["developer tools", "utilities", "productivity"],
      //   },
      //   // Use manifest.json instead of manifest.webmanifest
      //   manifestFilename: "manifest.json",
      // }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    worker: {
      format: 'es',
      plugins: () => [wasm(), topLevelAwait()],
    },
    optimizeDeps: {
      exclude: ['ruc_wasm', '@noble/hashes'],
    },
    build: {
      minify: 'esbuild',
      sourcemap: false,
      cssCodeSplit: false,
      target: 'esnext',
      rollupOptions: {
        external: (id) => {
          // Don't try to bundle WASM modules - they're loaded dynamically
          if (id.includes('wasm/pkg/ruc_wasm') || id.includes('cpp-wasm/pkg/ruc_wasm')) {
            return false; // Let Vite handle them
          }
          return false;
        },
        output: {
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('lucide-react')) {
                return 'icons';
              }
              if (id.includes('recharts')) {
                return 'charts';
              }
              if (id.includes('react-syntax-highlighter')) {
                return 'syntax';
              }
              if (id.includes('@tanstack/react-query')) {
                return 'query';
              }
              if (id.includes('react-hook-form') || id.includes('@hookform')) {
                return 'forms';
              }
              if (id.includes('react-router')) {
                return 'router';
              }
              if (id.includes('react-markdown') || id.includes('remark-') || id.includes('rehype-')) {
                return 'markdown';
              }
              if (id.includes('date-fns') || id.includes('zod') || id.includes('papaparse')) {
                return 'utils';
              }
              if (id.includes('@radix-ui')) {
                return 'radix-ui';
              }
              return 'vendor';
            }
          },
        },
      },
    },
  };
});
