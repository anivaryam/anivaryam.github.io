import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { ImageExtractorTool } from "@/components/tools/ImageExtractorTool";
import { UpdateNotification } from "@/components/UpdateNotification";
import { Images, Home } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function ImageExtractorPage() {
  return (
    <Layout>
      <SEO
        title="Image Extractor — Pull Images from Google Docs & Word"
        description="Paste content from Google Docs or Word and extract all images grouped by their original layout. Apply compress, format, resize, and strip-EXIF transforms before downloading. All in your browser."
        canonical="https://anivaryam.github.io/tools/image-extractor"
        breadcrumbs={[
          { name: "Home", url: "https://anivaryam.github.io/" },
          { name: "Tools", url: "https://anivaryam.github.io/tools" },
          { name: "Image Extractor", url: "https://anivaryam.github.io/tools/image-extractor" },
        ]}
        structuredData={{
          type: "SoftwareApplication",
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Web Browser",
          offers: { price: "0", priceCurrency: "USD" },
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
              <BreadcrumbPage>Image Extractor</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent-foreground text-sm font-mono mb-4">
            <Images className="h-4 w-4" />
            Online Tools
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4 text-foreground">
            Image Extractor
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm">
            Paste a draft from Google Docs or Word and instantly extract every image, grouped by its source layout. Apply compress, format, resize, or strip-EXIF transforms before downloading — entirely in your browser.
          </p>
        </div>

        <div className="max-w-7xl mx-auto">
          <ImageExtractorTool />
        </div>
      </div>
    </Layout>
  );
}
