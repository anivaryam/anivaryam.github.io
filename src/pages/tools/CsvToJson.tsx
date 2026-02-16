import { Layout } from "@/components/layout/Layout";
import { CsvToJsonTool } from "@/components/toolsCsvToJsonTool";
import { Code2, FileText, Home } from "lucide-react";
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

export default function CsvToJson() {
  return (
    <Layout>
      <SEO
        title="CSV to JSON Converter - Free Online"
        description="Convert CSV to JSON and JSON to CSV instantly. Customizable delimiter and header options. Free online CSV to JSON converter. Perfect for data migration and API integration."
        canonical="https://rosettascript.github.io/tools/csv-to-json"
breadcrumbs={[
          { name: "Home", url: "https://rosettascript.github.io/" },
          { name: "Tools", url: "https://rosettascript.github.io/tools" },
          { name: "CSV to JSON", url: "https://rosettascript.github.io/tools/csv-to-json" },
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
              <BreadcrumbPage>CSV to JSON</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-mono mb-4">
            <Code2 className="h-4 w-4" />
            Online Tools
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">
            CSV to JSON Converter
          </h1>
        </div>

        <div className="terminal-bg p-6 lg:p-8">
          <div className="flex items-center gap-2 pb-4 mb-6 border-b border-border">
            <div className="w-3 h-3 rounded-full bg-destructive/80" />
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--syntax-yellow))]/80" />
            <div className="w-3 h-3 rounded-full bg-primary/80" />
            <span className="ml-2 text-sm text-muted-foreground font-mono flex items-center gap-2">
              <FileText className="h-4 w-4" />
              converter.ts
            </span>
          </div>
          <CsvToJsonTool />
        </div>

        {/* Tool Description Section */}
        <div className="mt-8">
          <div className="prose prose-sm max-w-none text-muted-foreground">
            <h2 className="text-xl font-semibold mb-4 text-foreground">About This Tool</h2>
            <p>
              Convert CSV to JSON and JSON to CSV instantly with this free online converter. Customize delimiter and header options to match your data format. Perfect for data migration, API integration, and converting between spreadsheet and JSON formats.
            </p>
            <p className="mt-4">
              Essential for developers importing CSV data into applications, data analysts converting spreadsheet data to JSON for APIs, and anyone working with data format conversion. Handle comma-separated, tab-separated, or custom delimiters with full control over header row handling. All conversion happens instantly in your browser.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

