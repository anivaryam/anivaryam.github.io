import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { JsonFormatterTool } from "@/components/tools/JsonFormatterTool";
import { UpdateNotification } from "@/components/UpdateNotification";
import { Code2, Braces, Home } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function JsonFormatter() {
  return (
    <Layout>
      <SEO
        title="JSON Formatter & Validator - Free Online"
        description="Format, minify, and validate JSON data with customizable indentation and syntax highlighting. Free online JSON formatter. Detect errors and make JSON readable instantly."
        canonical="https://rosettascript.github.io/tools/json-formatter"
        structuredData={{
          type: "SoftwareApplication",
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Web Browser",
          offers: {
            price: "0",
            priceCurrency: "USD",
          },
        }}
breadcrumbs={[
          { name: "Home", url: "https://rosettascript.github.io/" },
          { name: "Tools", url: "https://rosettascript.github.io/tools" },
          { name: "JSON Formatter", url: "https://rosettascript.github.io/tools/json-formatter" },
        ]}
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
              <BreadcrumbPage>JSON Formatter</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 text-secondary text-sm font-mono mb-4">
            <Code2 className="h-4 w-4" />
            Online Tools
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">
            JSON Formatter & Validator
          </h1>
        </div>

        {/* Tool */}
        <div className="terminal-bg p-6 lg:p-8">
          <div className="flex items-center gap-2 pb-4 mb-6 border-b border-border">
            <div className="w-3 h-3 rounded-full bg-destructive/80" />
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--syntax-yellow))]/80" />
            <div className="w-3 h-3 rounded-full bg-primary/80" />
            <span className="ml-2 text-sm text-muted-foreground font-mono flex items-center gap-2">
              <Braces className="h-4 w-4" />
              formatter.json
            </span>
          </div>
          <JsonFormatterTool />
        </div>

        {/* Tool Description Section */}
        <div className="mt-8">
          <div className="prose prose-sm max-w-none text-muted-foreground">
            <h2 className="text-xl font-semibold mb-4 text-foreground">About This Tool</h2>
            <p className="mb-4">
              Format, minify, and validate JSON data instantly with this free online JSON formatter. Transform messy, unformatted JSON into beautifully indented, readable code with customizable spacing and syntax highlighting.
            </p>
            <p>
              Perfect for web developers working with APIs, frontend developers debugging JSON responses, and backend engineers validating data structures. This tool detects syntax errors, validates JSON structure, and provides clear error messages to help you fix issues quickly. All processing happens in your browser—your data never leaves your device.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
