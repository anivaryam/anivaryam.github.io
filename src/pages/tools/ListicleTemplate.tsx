import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { ListicleTemplateTool } from "@/components/tools/ListicleTemplateTool";
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

export default function ListicleTemplate() {
  return (
    <Layout>
      <SEO
        title="Listicle CSS Template Tool - Prefix CSS Classes"
        description="Add template prefix to CSS classes and remove inline styles. Perfect for listicle articles and content templates."
        canonical="https://rosettascript.github.io/tools/listicle-template/"
        breadcrumbs={[
          { name: "Home", url: "https://rosettascript.github.io/" },
          { name: "Tools", url: "https://rosettascript.github.io/tools/" },
          { name: "Listicle CSS Template", url: "https://rosettascript.github.io/tools/listicle-template/" },
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
      <div className="container mx-auto px-4 pt-4 pb-2">
        <UpdateNotification />
        
        <Breadcrumb className="mb-3">
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
              <BreadcrumbPage>Listicle CSS Template</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="text-center mb-3">
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-mono mb-2">
            <Code2 className="h-3 w-3" />
            Online Tools
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold">
            Listicle CSS Template Tool
          </h1>
        </div>
      </div>

      <div className="w-full mb-8 px-4 lg:px-6 xl:px-8">
        <div className="terminal-bg p-3 md:p-4 lg:p-6 max-w-[1920px] w-full max-w-full mx-auto">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-border">
            <div className="w-3 h-3 rounded-full bg-destructive/80" />
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--syntax-yellow))]/80" />
            <div className="w-3 h-3 rounded-full bg-primary/80" />
            <span className="ml-2 text-sm text-muted-foreground font-mono flex items-center gap-2">
              <Palette className="h-4 w-4" />
              listicle.html
            </span>
          </div>
          <ListicleTemplateTool />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="prose prose-sm max-w-none text-muted-foreground">
          <h2 className="text-xl font-semibold mb-4 text-foreground">About This Tool</h2>
          <p>
            This tool helps you prepare CSS for listicle-style content templates. It prefixes all CSS class selectors with a template namespace and removes inline styles from common HTML elements.
          </p>
          <p>
            Perfect for content management systems where you need to scope CSS to specific article templates without affecting other pages.
          </p>
        </div>
      </div>
    </Layout>
  );
}
