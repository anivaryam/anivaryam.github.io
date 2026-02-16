import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { UuidGeneratorTool } from "@/components/tools/UuidGeneratorTool";
import { UpdateNotification } from "@/components/UpdateNotification";
import { Code2, Fingerprint, Home } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function UuidGenerator() {
  return (
    <Layout>
      <SEO
        title="UUID Generator - Free Online UUID v4"
        description="Generate random UUID v4 identifiers instantly. Free online UUID generator. Create single or multiple UUIDs with optional hyphen formatting. Essential for database IDs and API keys."
        canonical="https://rosettascript.github.io/tools/uuid-generator"
breadcrumbs={[
          { name: "Home", url: "https://rosettascript.github.io/" },
          { name: "Tools", url: "https://rosettascript.github.io/tools" },
          { name: "UUID Generator", url: "https://rosettascript.github.io/tools/uuid-generator" },
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
              <BreadcrumbPage>UUID Generator</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--syntax-yellow))]/10 text-[hsl(var(--syntax-yellow))] text-sm font-mono mb-4">
            <Code2 className="h-4 w-4" />
            Online Tools
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">
            UUID Generator Tool
          </h1>
        </div>

        {/* Tool */}
        <div className="terminal-bg p-6 lg:p-8">
          <div className="flex items-center gap-2 pb-4 mb-6 border-b border-border">
            <div className="w-3 h-3 rounded-full bg-destructive/80" />
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--syntax-yellow))]/80" />
            <div className="w-3 h-3 rounded-full bg-primary/80" />
            <span className="ml-2 text-sm text-muted-foreground font-mono flex items-center gap-2">
              <Fingerprint className="h-4 w-4" />
              generator.uuid
            </span>
          </div>
          <UuidGeneratorTool />
        </div>

        {/* Tool Description Section */}
        <div className="mt-8">
          <div className="prose prose-sm max-w-none text-muted-foreground">
            <h2 className="text-xl font-semibold mb-4 text-foreground">About This Tool</h2>
            <p>
              Generate random UUID v4 identifiers instantly with this free online UUID generator. Create single or multiple UUIDs at once with optional hyphen formatting. Perfect for database IDs, API keys, session tokens, and unique identifiers.
            </p>
            <p className="mt-4">
              Essential for backend developers creating unique identifiers, frontend developers generating client-side IDs, and anyone working with distributed systems. All UUIDs are generated using cryptographically secure random number generation, ensuring uniqueness and security for your applications.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
