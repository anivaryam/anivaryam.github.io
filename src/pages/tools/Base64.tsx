import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Base64Tool } from "@/components/tools/Base64Tool";
import { UpdateNotification } from "@/components/UpdateNotification";
import { Code2, Binary, Home } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function Base64() {
  return (
    <Layout>
      <SEO
        title="Base64 Encoder/Decoder - Free Online"
        description="Encode text to Base64 or decode Base64 strings back to plain text with UTF-8 support. Free online Base64 encoder and decoder. Essential for data encoding and API development."
        canonical="https://rosettascript.github.io/toolsbase64"
breadcrumbs={[
          { name: "Home", url: "https://rosettascript.github.io/" },
          { name: "Tools", url: "https://rosettascript.github.io/tools" },
          { name: "Base64 Encoder/Decoder", url: "https://rosettascript.github.io/toolsbase64" },
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
              <BreadcrumbPage>Base64 Encoder/Decoder</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent-foreground text-sm font-mono mb-4">
            <Code2 className="h-4 w-4" />
            Online Tools
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">
            Base64 Encoder/Decoder
          </h1>
        </div>

        {/* Tool */}
        <div className="terminal-bg p-6 lg:p-8">
          <div className="flex items-center gap-2 pb-4 mb-6 border-b border-border">
            <div className="w-3 h-3 rounded-full bg-destructive/80" />
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--syntax-yellow))]/80" />
            <div className="w-3 h-3 rounded-full bg-primary/80" />
            <span className="ml-2 text-sm text-muted-foreground font-mono flex items-center gap-2">
              <Binary className="h-4 w-4" />
              base64.txt
            </span>
          </div>
          <Base64Tool />
        </div>

        {/* Tool Description Section */}
        <div className="mt-8">
          <div className="prose prose-sm max-w-none text-muted-foreground">
            <h2 className="text-xl font-semibold mb-4 text-foreground">About This Tool</h2>
            <p>
              Encode text to Base64 or decode Base64 strings back to plain text instantly. This free online Base64 converter supports full UTF-8 character encoding, making it perfect for encoding images, API data, and text content.
            </p>
            <p className="mt-4">
              Essential for web developers working with APIs, data transmission, and embedding binary data in JSON or XML. Whether you're encoding images for data URIs, preparing data for API requests, or decoding Base64 strings from web services, this tool handles it all securely in your browser without any data uploads.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
