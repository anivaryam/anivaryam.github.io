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
        description="Match store products to a draft or suggest simple Shopify smart-collection conditions using your own LLM API key."
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
      <div className="mx-auto w-full max-w-[1800px] px-4 py-8 sm:px-6 lg:px-8">
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
            Match products to a draft for manual selection, or suggest simple Shopify smart-collection conditions from the AM’s collection links and your draft.
          </p>
        </div>

        <div className="terminal-bg mx-auto w-full rounded-xl p-4 sm:p-6">
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
            Related and unrelated products appear in separate panels, grouped under their submitted URL with links to each product. The summary shows the unique-product counts. Copy result retains the smaller-group rule: all-related or all-unrelated collections get a short status; otherwise it copies one group of product names. If fewer than ten products are unrelated, that unrelated group is copied.
          </p>
          <p className="mt-3">
            Smart collection suggestions use first-page product samples rather than scanning large collections in full. They recommend one Products source with Match all conditions: category and title rules, Active status, and inventory greater than zero. The preview checks sampled titles only, not categories, status, stock or editorial relevance. Category labels must be confirmed in Shopify, and rules can select products outside the submitted collections. Copy the suggestions for manual entry and review Shopify’s preview; this tool never creates or modifies a Shopify collection.
          </p>
        </div>
      </div>
    </Layout>
  );
}
