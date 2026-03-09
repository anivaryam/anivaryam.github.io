import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { ColorConverterTool } from "@/components/tools/ColorConverterTool";
import { UpdateNotification } from "@/components/UpdateNotification";
import { Code2, Palette, Home } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function ColorConverter() {
  return (
    <Layout>
      <SEO
        title="Color Converter - HEX, RGB, HSL Online"
        description="Convert colors between HEX, RGB, and HSL formats instantly with live color preview. Free online color converter. Perfect for web developers and designers working with CSS."
        canonical="https://anivaryam.github.io/tools/color-converter"
breadcrumbs={[
          { name: "Home", url: "https://anivaryam.github.io/" },
          { name: "Tools", url: "https://anivaryam.github.io/tools" },
          { name: "Color Converter", url: "https://anivaryam.github.io/tools/color-converter" },
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
              <BreadcrumbPage>Color Converter</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--syntax-orange))]/10 text-[hsl(var(--syntax-orange))] text-sm font-mono mb-4">
            <Code2 className="h-4 w-4" />
            Online Tools
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">
            Color Converter Tool
          </h1>
        </div>

        {/* Tool */}
        <div className="terminal-bg p-6 lg:p-8">
          <div className="flex items-center gap-2 pb-4 mb-6 border-b border-border">
            <div className="w-3 h-3 rounded-full bg-destructive/80" />
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--syntax-yellow))]/80" />
            <div className="w-3 h-3 rounded-full bg-primary/80" />
            <span className="ml-2 text-sm text-muted-foreground font-mono flex items-center gap-2">
              <Palette className="h-4 w-4" />
              colors.css
            </span>
          </div>
          <ColorConverterTool />
        </div>

        {/* Tool Description Section */}
        <div className="mt-8">
          <div className="prose prose-sm max-w-none text-muted-foreground">
            <h2 className="text-xl font-semibold mb-4 text-foreground">About This Tool</h2>
            <p>
              Convert colors between HEX, RGB, and HSL formats instantly with live color preview. Use the color picker or enter values manually to see real-time conversions. Perfect for web developers and designers working with CSS, color palettes, and design systems.
            </p>
            <p className="mt-4">
              Essential for frontend developers converting design specs to CSS, designers creating consistent color systems, and anyone working with web colors. All conversions happen instantly in your browser with visual feedback, making it easy to find the perfect color format for your project.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
