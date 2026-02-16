import { Layout } from "@/components/layout/Layout";
import { WebScraperTool } from "@/components/toolsWebScraperTool";
import { Code2, Globe, Home } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SEO } from "@/components/SEO";
import { UpdateNotification } from "@/components/UpdateNotification";

export default function WebScraper() {
  return (
    <Layout>
      <SEO
        title="Free Web Scraper - Extract Data Online"
        description="Extract data from any website using CSS selectors. Free online web scraper tool. No coding required, runs entirely in your browser. Perfect for data collection and research."
        canonical="https://rosettascript.github.io/tools/web-scraper"
breadcrumbs={[
          { name: "Home", url: "https://rosettascript.github.io/" },
          { name: "Tools", url: "https://rosettascript.github.io/tools" },
          { name: "Web Scraper", url: "https://rosettascript.github.io/tools/web-scraper" },
        ]}
        structuredData={{
          type: "SoftwareApplication",
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Web Browser",
          offers: {
            price: "0",
            priceCurrency: "USD",
          },
        }}
      />
      <div className="container mx-auto px-4 py-12">
        {/* Update Notification */}
        <UpdateNotification />
        
        {/* Breadcrumb */}
        <Breadcrumb className="mb-8">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/" className="flex items-center gap-1">
                  <Home className="h-4 w-4" />
                  Home
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/tools">Tools</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Web Scraper</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-mono mb-4">
            <Code2 className="h-4 w-4" />
            Online Tools
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">
            Free Web Scraper Tool
          </h1>
        </div>

        {/* Tool */}
        <div className="terminal-bg p-6 lg:p-8">
          <div className="flex items-center gap-2 pb-4 mb-6 border-b border-border">
            <div className="w-3 h-3 rounded-full bg-destructive/80" />
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--syntax-yellow))]/80" />
            <div className="w-3 h-3 rounded-full bg-primary/80" />
            <span className="ml-2 text-sm text-muted-foreground font-mono flex items-center gap-2">
              <Globe className="h-4 w-4" />
              scraper.ts
            </span>
          </div>
          <WebScraperTool />
        </div>

        {/* Tool Description Section */}
        <div className="mt-8">
          <div className="prose prose-sm max-w-none text-muted-foreground">
            <h2 className="text-xl font-semibold mb-4 text-foreground">About This Tool</h2>
            <p>
              Extract data from any website using CSS selectors with this free online web scraper. No coding knowledge required—simply enter a URL, specify what elements to extract using CSS selectors, and get structured data instantly.
            </p>
            <p className="mt-4">
              Perfect for researchers collecting data, developers testing web scraping logic, marketers analyzing competitor content, and anyone who needs to extract structured information from websites. All scraping happens in your browser, ensuring privacy and security. No server uploads, no data storage, completely free.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

