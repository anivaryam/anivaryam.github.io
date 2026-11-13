import { Layout } from "@/components/layout/Layout";
import { RelatedProductFinderTool } from "@/components/tools/RelatedProductFinderTool";
import { SEO } from "@/components/SEO";
import { UpdateNotification } from "@/components/UpdateNotification";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Code2, Home, PackageSearch } from "lucide-react";
import { Link } from "react-router-dom";

export default function RelatedProductFinder() {
  return (
    <Layout>
      <SEO
        title="Related Product Finder - Match Store Products to a Draft"
        description="Compare products from store collection pages with a content draft using your own LLM API key. Choose a model and get only the relevant minority product list."
        canonical="https://anivaryam.github.io/tools/related-product-finder"
        breadcrumbs={[
          { name: "Home", url: "https://anivaryam.github.io/" },
          { name: "Tools", url: "https://anivaryam.github.io/tools" },
          { name: "Related Product Finder", url: "https://anivaryam.github.io/tools/related-product-finder" },
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
              <BreadcrumbPage>Related Product Finder</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="mx-auto mb-8 max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 font-mono text-sm text-primary">
            <Code2 className="h-4 w-4" />
            Online Tools
          </div>
          <h1 className="mb-4 text-3xl font-bold lg:text-4xl">Related Product Finder</h1>
          <p className="text-muted-foreground">
            Find the products that best match your draft across one or more store collections. The tool stays within the provided stores and deduplicates products shared across URLs.
          </p>
        </div>

        <div className="terminal-bg mx-auto max-w-5xl rounded-xl p-4 sm:p-6 lg:p-8">
          <div className="mb-6 flex items-center gap-2 border-b border-border pb-4">
            <div className="h-3 w-3 rounded-full bg-destructive/80" />
            <div className="h-3 w-3 rounded-full bg-[hsl(var(--syntax-yellow))]/80" />
            <div className="h-3 w-3 rounded-full bg-primary/80" />
            <span className="ml-2 flex items-center gap-2 font-mono text-sm text-muted-foreground">
              <PackageSearch className="h-4 w-4" />
              related-product-finder
            </span>
          </div>
          <RelatedProductFinderTool />
        </div>

        <div className="mx-auto mt-8 max-w-5xl text-sm leading-relaxed text-muted-foreground">
          <h2 className="mb-3 text-xl font-semibold text-foreground">How it works</h2>
          <p>
            Enter collection or product-page URLs, paste the full draft, connect an OpenAI-compatible provider, and explicitly select an available model. The tool reads Shopify product feeds when available and otherwise follows product listings and same-site pagination. It removes duplicate product names across submitted URLs. JavaScript-only “load more” collections are stopped rather than returning a partial result.
          </p>
          <p className="mt-3">
            Results follow the smaller-group rule: all-related or all-unrelated collections get a short status; otherwise only one product group is listed, without URLs. If fewer than ten products are unrelated, only that unrelated group is shown.
          </p>
        </div>
      </div>
    </Layout>
  );
}
