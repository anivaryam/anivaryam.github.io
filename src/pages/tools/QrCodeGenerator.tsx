import { Layout } from "@/components/layout/Layout";
import { QrCodeGeneratorTool } from "@/components/toolsQrCodeGeneratorTool";
import { Code2, QrCode, Home } from "lucide-react";
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

export default function QrCodeGenerator() {
  return (
    <Layout>
      <SEO
        title="QR Code Generator - Free Online Creator"
        description="Generate QR codes for WiFi, email, SMS, phone, contacts, events, files, and more instantly. Customizable size, downloadable PNG format. Free online QR code generator. Perfect for marketing and events."
        canonical="https://rosettascript.github.io/tools/qr-code-generator"
breadcrumbs={[
          { name: "Home", url: "https://rosettascript.github.io/" },
          { name: "Tools", url: "https://rosettascript.github.io/tools" },
          { name: "QR Code Generator", url: "https://rosettascript.github.io/tools/qr-code-generator" },
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
              <BreadcrumbPage>QR Code Generator</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-mono mb-4">
            <Code2 className="h-4 w-4" />
            Online Tools
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">
            QR Code Generator
          </h1>
        </div>

        <div className="terminal-bg p-6 lg:p-8">
          <div className="flex items-center gap-2 pb-4 mb-6 border-b border-border">
            <div className="w-3 h-3 rounded-full bg-destructive/80" />
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--syntax-yellow))]/80" />
            <div className="w-3 h-3 rounded-full bg-primary/80" />
            <span className="ml-2 text-sm text-muted-foreground font-mono flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              qrcode.ts
            </span>
          </div>
          <QrCodeGeneratorTool />
        </div>

        {/* Tool Description Section */}
        <div className="mt-8">
          <div className="prose prose-sm max-w-none text-muted-foreground">
            <h2 className="text-xl font-semibold mb-4 text-foreground">About This Tool</h2>
            <p className="mb-4">
              Generate QR codes for WiFi, email, SMS, phone, contacts, events, files, and more instantly with this free online QR code generator. Customize the size, choose from multiple QR code types, and download as PNG for use in marketing materials, websites, or print.
            </p>
            <p>
              Perfect for marketers creating QR codes for campaigns, event organizers sharing WiFi credentials, businesses adding contact information to materials, and developers embedding QR codes in applications. All QR code generation happens instantly in your browser—no server uploads required.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

