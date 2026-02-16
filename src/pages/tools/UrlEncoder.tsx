import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { UrlEncoderTool } from "@/components/toolsUrlEncoderTool";
import { UpdateNotification } from "@/components/UpdateNotification";
import { Code2, Link as LinkIcon, Home } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function UrlEncoder() {
  return (
    <Layout>
      <SEO
        title="URL Encoder/Decoder - Free Online Tool"
        description="Encode special characters for URLs or decode URL-encoded strings instantly. Free online URL encoder and decoder. Handle percent encoding and query parameters. No signup required."
        canonical="https://rosettascript.github.io/tools/url-encoder"
breadcrumbs={[
          { name: "Home", url: "https://rosettascript.github.io/" },
          { name: "Tools", url: "https://rosettascript.github.io/tools" },
          { name: "URL Encoder", url: "https://rosettascript.github.io/tools/url-encoder" },
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
              <BreadcrumbPage>URL Encoder/Decoder</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--syntax-cyan))]/10 text-[hsl(var(--syntax-cyan))] text-sm font-mono mb-4">
            <Code2 className="h-4 w-4" />
            Online Tools
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">
            URL Encoder/Decoder
          </h1>
        </div>

        {/* Tool */}
        <div className="terminal-bg p-6 lg:p-8">
          <div className="flex items-center gap-2 pb-4 mb-6 border-b border-border">
            <div className="w-3 h-3 rounded-full bg-destructive/80" />
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--syntax-yellow))]/80" />
            <div className="w-3 h-3 rounded-full bg-primary/80" />
            <span className="ml-2 text-sm text-muted-foreground font-mono flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              url-encoder.txt
            </span>
          </div>
          <UrlEncoderTool />
        </div>

        {/* Tool Description Section */}
        <div className="mt-8">
          <div className="prose prose-sm max-w-none text-muted-foreground">
            <h2 className="text-xl font-semibold mb-4 text-foreground">About This Tool</h2>
            <p>
              Encode special characters for safe URL usage or decode URL-encoded strings back to readable text instantly. This free online URL encoder handles percent encoding, query parameters, and ensures proper URL formatting for web development.
            </p>
            <p className="mt-4">
              Essential for web developers working with APIs, handling form data, and building URLs dynamically. Whether you're encoding query parameters, preparing data for GET requests, or decoding URL-encoded strings from web services, this tool processes everything securely in your browser without any data uploads.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
