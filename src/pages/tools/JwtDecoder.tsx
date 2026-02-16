import { Layout } from "@/components/layout/Layout";
import { JwtDecoderTool } from "@/components/tools/JwtDecoderTool";
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

export default function JwtDecoder() {
  return (
    <Layout>
      <SEO
        title="JWT Decoder - Decode JSON Web Tokens"
        description="Decode and inspect JWT tokens instantly. View header, payload, and signature. Check expiration times and token claims. Free online JWT decoder. Perfect for debugging authentication tokens."
        canonical="https://rosettascript.github.io/tools/jwt-decoder"
breadcrumbs={[
          { name: "Home", url: "https://rosettascript.github.io/" },
          { name: "Tools", url: "https://rosettascript.github.io/tools" },
          { name: "JWT Decoder", url: "https://rosettascript.github.io/tools/jwt-decoder" },
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
              <BreadcrumbPage>JWT Decoder</BreadcrumbPage>
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
            JWT Decoder
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
              jwt.decode
            </span>
          </div>
          <JwtDecoderTool />
        </div>

        {/* Tool Description Section */}
        <div className="mt-8">
          <div className="prose prose-sm max-w-none text-muted-foreground">
            <h2 className="text-xl font-semibold mb-4 text-foreground">About This Tool</h2>
            <p className="mb-4">
              Decode and inspect JSON Web Tokens (JWT) instantly with this free online JWT decoder. View the header, payload, and signature in a readable format. Timestamps are automatically converted to human-readable dates, making it easy to check token expiration and claims.
            </p>
            <p>
              Essential for developers debugging authentication flows, API developers inspecting token contents, and security engineers analyzing JWT structure. Perfect for understanding token claims, verifying expiration times, and troubleshooting authentication issues. All decoding happens in your browser—your tokens never leave your device.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
