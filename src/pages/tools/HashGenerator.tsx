import { Layout } from "@/components/layout/Layout";
import { HashGeneratorTool } from "@/components/tools/HashGeneratorTool";
import { SEO } from "@/components/SEO";
import { UpdateNotification } from "@/components/UpdateNotification";
import { Code2, Hash, Home } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function HashGenerator() {
  return (
    <Layout>
      <SEO
        title="Hash Generator - SHA-1, SHA-256, SHA-512"
        description="Generate SHA-1, SHA-256, SHA-384, and SHA-512 hash values from text instantly. Free online cryptographic hash generator. Perfect for password hashing and data integrity verification."
        canonical="https://rosettascript.github.io/tools/hash-generator"
breadcrumbs={[
          { name: "Home", url: "https://rosettascript.github.io/" },
          { name: "Tools", url: "https://rosettascript.github.io/tools" },
          { name: "Hash Generator", url: "https://rosettascript.github.io/tools/hash-generator" },
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
              <BreadcrumbPage>Hash Generator</BreadcrumbPage>
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
            Hash Generator
          </h1>
        </div>

        {/* Tool */}
        <div className="terminal-bg p-6 lg:p-8">
          <div className="flex items-center gap-2 pb-4 mb-6 border-b border-border">
            <div className="w-3 h-3 rounded-full bg-destructive/80" />
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--syntax-yellow))]/80" />
            <div className="w-3 h-3 rounded-full bg-primary/80" />
            <span className="ml-2 text-sm text-muted-foreground font-mono flex items-center gap-2">
              <Hash className="h-4 w-4" />
              hash.gen
            </span>
          </div>
          <HashGeneratorTool />
        </div>

        {/* Tool Description Section */}
        <div className="mt-8">
          <div className="prose prose-sm max-w-none text-muted-foreground">
            <h2 className="text-xl font-semibold mb-4 text-foreground">About This Tool</h2>
            <p>
              Generate cryptographic hash values from text instantly using SHA-1, SHA-256, SHA-384, and SHA-512 algorithms. This free online hash generator creates secure, one-way hash values perfect for password hashing, data integrity verification, and cryptographic operations.
            </p>
            <p className="mt-4">
              Essential for developers implementing authentication systems, security engineers verifying data integrity, and anyone working with cryptographic hashing. All hashing happens locally in your browser—your sensitive data never leaves your device, ensuring complete privacy and security.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
