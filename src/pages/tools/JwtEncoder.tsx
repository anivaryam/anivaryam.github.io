import { Layout } from "@/components/layout/Layout";
import { JwtEncoderTool } from "@/components/tools/JwtEncoderTool";
import { SEO } from "@/components/SEO";
import { UpdateNotification } from "@/components/UpdateNotification";
import { Code2, KeyRound, Home } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function JwtEncoder() {
  return (
    <Layout>
      <SEO
        title="JWT Encoder - Encode JSON Web Tokens"
        description="Encode and create JWT tokens instantly. Generate signed JSON Web Tokens with HS256, HS384, and HS512 algorithms. Free online JWT encoder. Perfect for testing authentication flows."
        canonical="https://rosettascript.github.io/tools/jwt-encoder"
breadcrumbs={[
          { name: "Home", url: "https://rosettascript.github.io/" },
          { name: "Tools", url: "https://rosettascript.github.io/tools" },
          { name: "JWT Encoder", url: "https://rosettascript.github.io/tools/jwt-encoder" },
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
              <BreadcrumbPage>JWT Encoder</BreadcrumbPage>
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
            JWT Encoder
          </h1>
        </div>

        {/* Tool */}
        <div className="terminal-bg p-6 lg:p-8">
          <div className="flex items-center gap-2 pb-4 mb-6 border-b border-border">
            <div className="w-3 h-3 rounded-full bg-destructive/80" />
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--syntax-yellow))]/80" />
            <div className="w-3 h-3 rounded-full bg-primary/80" />
            <span className="ml-2 text-sm text-muted-foreground font-mono flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              jwt.encode
            </span>
          </div>
          <JwtEncoderTool />
        </div>

        {/* Tool Description Section */}
        <div className="mt-8">
          <div className="prose prose-sm max-w-none text-muted-foreground">
            <h2 className="text-xl font-semibold mb-4 text-foreground">About This Tool</h2>
            <p className="mb-4">
              Encode and create JSON Web Tokens (JWT) instantly with this free online JWT encoder. Generate signed tokens with HMAC algorithms (HS256, HS384, HS512) for testing authentication flows, API development, and token generation.
            </p>
            <p>
              Essential for developers testing authentication systems, API developers creating test tokens, and anyone working with JWT-based authentication. All token generation and signing happens securely in your browser—your secrets never leave your device, ensuring complete privacy and security.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

