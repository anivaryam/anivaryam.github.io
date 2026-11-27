import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import path from "path";

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
