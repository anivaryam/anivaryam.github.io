import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { ImageResizerTool } from "@/components/tools/ImageResizerTool";
import { UpdateNotification } from "@/components/UpdateNotification";
import { ImageDown, Home } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function ImageResizerPage() {
  return (
    <Layout>
      <SEO
        title="Image Resizer for SEO Content — Resize to Client Specs"
        description="Resize images to exact client and placement specs (blog hero, thumbnail, inline, vCTA). Check dimensions, resize with fill/fit/exact modes, and download. All in your browser."
        canonical="https://anivaryam.github.io/tools/image-resizer"
        breadcrumbs={[
          { name: "Home", url: "https://anivaryam.github.io/" },
          { name: "Tools", url: "https://anivaryam.github.io/tools" },
          { name: "Image Resizer", url: "https://anivaryam.github.io/tools/image-resizer" },
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
              <BreadcrumbPage>Image Resizer</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent-foreground text-sm font-mono mb-4">
            <ImageDown className="h-4 w-4" />
            Online Tools
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">
            Image Resizer
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm">
            Upload an image, pick a client and placement preset, check if dimensions are correct, and resize to spec in one click.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <ImageResizerTool />
        </div>
      </div>
    </Layout>
  );
}
