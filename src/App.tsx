import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useEffect, lazy, Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const Index = lazy(() => import("./pages/Index"));
const Tools = lazy(() => import("./pages/Tools"));
const WordToHtml = lazy(() => import("./pages/tools/WordToHtml"));
const JsonFormatter = lazy(() => import("./pages/tools/JsonFormatter"));
const Base64 = lazy(() => import("./pages/tools/Base64"));
const UrlEncoder = lazy(() => import("./pages/tools/UrlEncoder"));
const ColorConverter = lazy(() => import("./pages/tools/ColorConverter"));
const UuidGenerator = lazy(() => import("./pages/tools/UuidGenerator"));
const RegexTester = lazy(() => import("./pages/tools/RegexTester"));
const HashGenerator = lazy(() => import("./pages/tools/HashGenerator"));
const HashDecoder = lazy(() => import("./pages/tools/HashDecoder"));
const JwtDecoder = lazy(() => import("./pages/tools/JwtDecoder"));
const JwtEncoder = lazy(() => import("./pages/tools/JwtEncoder"));
const TimestampConverter = lazy(() => import("./pages/tools/TimestampConverter"));
const WebScraper = lazy(() => import("./pages/tools/WebScraper"));
const JsonExtractor = lazy(() => import("./pages/tools/JsonExtractor"));
const QrCodeGenerator = lazy(() => import("./pages/tools/QrCodeGenerator"));
const TextDiff = lazy(() => import("./pages/tools/TextDiff"));
const CsvToJson = lazy(() => import("./pages/tools/CsvToJson"));
const ImageTool = lazy(() => import("./pages/tools/ImageTool"));
const RandomUniverseCipher = lazy(() => import("./pages/tools/RandomUniverseCipher"));
const ListicleTemplate = lazy(() => import("./pages/tools/ListicleTemplate"));
const Downloads = lazy(() => import("./pages/Downloads"));
const Blogs = lazy(() => import("./pages/Blogs"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const News = lazy(() => import("./pages/News"));
const NewsArticle = lazy(() => import("./pages/NewsArticle"));
const SchoolProjects = lazy(() => import("./pages/SchoolProjects"));
const About = lazy(() => import("./pages/About"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Issues = lazy(() => import("./pages/Issues"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// Component to handle GitHub Pages 404.html redirect pattern
const RedirectHandler = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Strip trailing slash from URL on page load (GitHub Pages adds trailing slashes)
    // This ensures URL consistency between static HTML and rendered HTML
    if (location.pathname !== '/' && location.pathname.endsWith('/')) {
      const newPath = location.pathname.slice(0, -1);
      window.history.replaceState(null, '', newPath + location.search + location.hash);
      navigate(newPath, { replace: true });
      return;
    }

    // Handle GitHub Pages SPA redirect pattern from 404.html
    // The 404.html redirects to /?/path, we need to extract and navigate to /path
    if (location.search && location.search.startsWith('?/')) {
      // Extract the path from the query string (format: ?/path&other=params)
      const search = location.search.slice(2); // Remove the '?/'
      // Split by & to separate path from query params, then decode ~and~ back to &
      let path = search.split('&')[0].replace(/~and~/g, '&');
      
      // Ensure path starts with /
      if (path && !path.startsWith('/')) {
        path = '/' + path;
      }
      
      // Only redirect if we have a valid path
      if (path) {
        // Preserve hash if present
        const hash = location.hash || '';
        // Remove the query parameter and navigate to the actual path
        const newPath = path + hash;
        window.history.replaceState(null, '', newPath);
        navigate(path, { replace: true });
      }
    }
  }, [location, navigate]);

  return null;
};

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="flex flex-col items-center gap-4">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-muted-foreground animate-pulse">Loading...</p>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <RedirectHandler />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/tools" element={<Tools />} />
              <Route path="/tools/word-to-html" element={<WordToHtml />} />
              <Route path="/tools/json-formatter" element={<JsonFormatter />} />
              <Route path="/tools/base64" element={<Base64 />} />
              <Route path="/tools/url-encoder" element={<UrlEncoder />} />
              <Route path="/tools/color-converter" element={<ColorConverter />} />
              <Route path="/tools/uuid-generator" element={<UuidGenerator />} />
              <Route path="/tools/regex-tester" element={<RegexTester />} />
              <Route path="/tools/hash-generator" element={<HashGenerator />} />
              <Route path="/tools/hash-decoder" element={<HashDecoder />} />
              <Route path="/tools/jwt-decoder" element={<JwtDecoder />} />
              <Route path="/tools/jwt-encoder" element={<JwtEncoder />} />
              <Route path="/tools/timestamp-converter" element={<TimestampConverter />} />
              <Route path="/tools/web-scraper" element={<WebScraper />} />
              <Route path="/tools/json-extractor" element={<JsonExtractor />} />
              <Route path="/tools/qr-code-generator" element={<QrCodeGenerator />} />
              <Route path="/tools/text-diff" element={<TextDiff />} />
              <Route path="/tools/csv-to-json" element={<CsvToJson />} />
              <Route path="/tools/image-tool" element={<ImageTool />} />
              <Route path="/tools/random-universe-cipher" element={<RandomUniverseCipher />} />
              <Route path="/tools/listicle-template" element={<ListicleTemplate />} />
              <Route path="/downloads" element={<Downloads />} />
              <Route path="/blogs" element={<Blogs />} />
              <Route path="/blogs/:id" element={<BlogPost />} />
              <Route path="/news" element={<News />} />
              <Route path="/news/:slug" element={<NewsArticle />} />
              <Route path="/school-projects" element={<SchoolProjects />} />
              <Route path="/about" element={<About />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/issues" element={<Issues />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
