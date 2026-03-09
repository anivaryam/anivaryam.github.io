import { Layout } from "@/components/layout/Layout";
import { HashDecoderTool } from "@/components/tools/HashDecoderTool";
import { SEO } from "@/components/SEO";
import { UpdateNotification } from "@/components/UpdateNotification";
import { Code2, Hash, Home, Search } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function HashDecoder() {
  return (
    <Layout>
      <SEO
        title="Hash Decoder/Verifier - Verify SHA Hashes"
        description="Verify if text matches a hash value instantly. Check SHA-1, SHA-256, SHA-384, and SHA-512 hashes. Free online hash verification tool. Perfect for password verification and data integrity checks."
        canonical="https://anivaryam.github.io/tools/hash-decoder"
breadcrumbs={[
          { name: "Home", url: "https://anivaryam.github.io/" },
          { name: "Tools", url: "https://anivaryam.github.io/tools" },
          { name: "Hash Decoder", url: "https://anivaryam.github.io/tools/hash-decoder" },
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
              <BreadcrumbPage>Hash Decoder</BreadcrumbPage>
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
            Hash Decoder/Verifier
          </h1>
        </div>

        {/* Tool */}
        <div className="terminal-bg p-6 lg:p-8">
          <div className="flex items-center gap-2 pb-4 mb-6 border-b border-border">
            <div className="w-3 h-3 rounded-full bg-destructive/80" />
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--syntax-yellow))]/80" />
            <div className="w-3 h-3 rounded-full bg-primary/80" />
            <span className="ml-2 text-sm text-muted-foreground font-mono flex items-center gap-2">
              <Search className="h-4 w-4" />
              hash.verify
            </span>
          </div>
          <HashDecoderTool />
        </div>

        {/* Tool Description Section */}
        <div className="mt-8">
          <div className="prose prose-sm max-w-none text-muted-foreground">
            <h2 className="text-xl font-semibold mb-4 text-foreground">About This Tool</h2>
            <p>
              Verify if your text produces the given hash value instantly. This free online hash verifier supports SHA-1, SHA-256, SHA-384, and SHA-512 algorithms, making it perfect for password verification, data integrity checks, and cryptographic validation.
            </p>
            <p className="mt-4">
              Essential for developers implementing authentication systems, security engineers verifying data integrity, and anyone working with cryptographic hashing. All verification happens locally in your browser—your sensitive data never leaves your device, ensuring complete privacy and security.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

