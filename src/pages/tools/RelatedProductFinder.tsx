import { Layout } from "@/components/layout/Layout";
import { RelatedProductFinderTool } from "@/components/tools/RelatedProductFinderTool";
import { SEO } from "@/components/SEO";
import { UpdateNotification } from "@/components/UpdateNotification";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Code2, Home } from "lucide-react";
import { Link } from "react-router-dom";

export default function RelatedProductFinder() {
  return (
    <Layout>
      <SEO
        title="Related Product Finder - Match Store Products to a Draft"
        description="Match store products to a draft and suggest simple Shopify smart-collection conditions together using your own LLM API key."
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

        <div className="mb-6 max-w-4xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 font-mono text-sm text-primary">
            <Code2 className="h-4 w-4" />
            Online Tools
          </div>
          <h1 className="mb-4 text-3xl font-bold lg:text-4xl">Related Product Finder</h1>
          <p className="text-muted-foreground">
            Match products and suggest Shopify smart-collection conditions in one workspace. Copy a name, a condition, or all final outputs.
          </p>
        </div>

        <div className="terminal-bg mx-auto w-full rounded-xl p-4 sm:p-6">
          <RelatedProductFinderTool />
        </div>

        <div className="mx-auto mt-8 max-w-5xl text-sm leading-relaxed text-muted-foreground">
          <h2 className="mb-3 text-xl font-semibold text-foreground">How it works</h2>
          <p>
            Enter collection or product-page URLs, paste the full draft, connect an OpenAI-compatible provider, and explicitly select an available model. The tool reads Shopify product feeds when available and otherwise follows product listings and same-site pagination. It removes duplicate product names across submitted URLs. JavaScript-only “load more” collections are stopped rather than returning a partial result.
          </p>
          <p className="mt-3">
            Smart suggestions, related products and unrelated products appear together. Copy icons beside each product name, condition and condition value copy just that output; product-panel copy buttons copy names one per line. Source links and review diagnostics are available in expandable details. The summary shows unique-product counts. Its Copy result button retains the smaller-group rule: all-related or all-unrelated collections get a short status; otherwise it copies one group with source links. If fewer than ten products are unrelated, that unrelated group is copied.
          </p>
          <p className="mt-3">
            Product matching assesses editorial relevance. Smart suggestions independently use a bounded sample of up to 40 collected products per submitted URL, not a full-store scan. If a complete collection is unavailable, smart suggestions can still use first-page samples or the draft and URL paths; this never becomes a complete product-matching result. Matching supports multiple stores, but smart suggestions require URLs from one store. The review details separate sampled titles from actual Shopify matches, which remain unverified. Category conditions are off by default; enable them in Smart collection settings only when useful, optionally supplying a client’s allowed labels. Even supplied labels do not verify product assignments. You can choose Match all or any, toggle subcategories when category is enabled, and change or omit status and inventory. Other defaults remain Match all, subcategories on, Active status and stock greater than zero. Match any lets a single condition qualify a product. No title rules means title matching is not evaluated. Rules apply store-wide, not just to submitted URLs. New check clears client categories and restores defaults. Copy rules for manual entry and check Shopify’s preview; this tool never creates or modifies a Shopify collection.
          </p>
          <p className="mt-3">
            Every run automatically reviews both matches and nonmatches using your chosen verifier model from the connected provider. One correction and one final recheck are allowed; this adds provider requests. Manual decisions change only when both passes agree, while uncertain or conflicting decisions keep their original label. Smart corrections revise validated conditions without changing your client settings, then recalculate the title preview; unresolved corrections retain the original rules. Applied changes are shown with before/after values. Failure or cancellation retains the original output marked verification incomplete. No manual verification button is needed. The draft and collected product details are sent, not product URL fields. AI agreement—even from another model—is not proof of correctness and cannot verify unseen products, Shopify categories, status, stock or actual collection counts.
          </p>
        </div>
      </div>
    </Layout>
  );
}
