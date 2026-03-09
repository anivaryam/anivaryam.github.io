import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { WordToHtmlConverter } from "@/components/tools/WordToHtmlConverter";
import { UpdateNotification } from "@/components/UpdateNotification";
import { Code2, FileText, Home } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function WordToHtml() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus the container on mount, which will help establish focus context
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);
  return (
    <Layout>
      <SEO
        title="Word to HTML Converter - Clean HTML Online"
        description="Convert Word documents to clean, semantic HTML code. Free online Word to HTML converter with blog and shoppable modes. No signup required."
        canonical="https://anivaryam.github.io/tools/word-to-html"
breadcrumbs={[
          { name: "Home", url: "https://anivaryam.github.io/" },
          { name: "Tools", url: "https://anivaryam.github.io/tools" },
          { name: "Word to HTML", url: "https://anivaryam.github.io/tools/word-to-html" },
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
        {/* Update Notification */}
        <UpdateNotification />
        
        {/* Breadcrumb */}
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
              <BreadcrumbPage>Word to HTML</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header - Compact */}
        <div className="text-center mb-3">
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-mono mb-2">
            <Code2 className="h-3 w-3" />
            Online Tools
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold">
            Word to HTML Converter
          </h1>
        </div>
      </div>

      {/* Converter Tool - Full Width */}
      <div className="w-full mb-8 px-4 lg:px-6 xl:px-8">
        <div
          ref={containerRef}
          tabIndex={-1}
          className="terminal-bg p-3 md:p-4 lg:p-6 max-w-[1920px] w-full max-w-full mx-auto outline-none"
        >
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-border">
            <div className="w-3 h-3 rounded-full bg-destructive/80" />
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--syntax-yellow))]/80" />
            <div className="w-3 h-3 rounded-full bg-primary/80" />
            <span className="ml-2 text-sm text-muted-foreground font-mono flex items-center gap-2">
              <FileText className="h-4 w-4" />
              converter.html
            </span>
          </div>
          <WordToHtmlConverter />
        </div>
      </div>

      {/* Tool Description Section */}
      <div className="container mx-auto px-4 py-8">
        <div className="prose prose-sm max-w-none text-muted-foreground">
          <h2 className="text-xl font-semibold mb-4 text-foreground">About This Tool</h2>
          <p className="mb-4">
            Convert Word documents to clean, semantic HTML code instantly. This free online Word to HTML converter transforms messy Word-generated markup into SEO-friendly, well-structured HTML that works perfectly for web content, blogs, and e-commerce sites.
          </p>
          <p>
            Whether you're a content editor preparing articles for publication, an SEO specialist optimizing web content, or a web developer cleaning up client documents, this tool helps you convert Word content to professional HTML without the bloat. Simply paste from Microsoft Word and get properly formatted HTML with advanced features for regular content, blog posts, and shoppable product descriptions.
          </p>
        </div>
      </div>

      {/* Format Info */}
      <div className="container mx-auto px-4 mb-12">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-6 bg-card/50 rounded-lg border border-border">
            <h3 className="font-semibold mb-2 text-primary">Regular Output</h3>
            <p className="text-sm text-muted-foreground">
              Clean, semantic HTML with proper heading hierarchy and paragraph tags. 
              Perfect for general web content.
            </p>
          </div>
          <div className="p-6 bg-card/50 rounded-lg border border-border">
            <h3 className="font-semibold mb-2 text-secondary">Blogs Output</h3>
            <p className="text-sm text-muted-foreground">
              Advanced blog formatting with heading strong tags, key takeaways processing, 
              link attributes, spacing rules, and more. Customize features to match your needs.
            </p>
          </div>
          <div className="p-6 bg-card/50 rounded-lg border border-border">
            <h3 className="font-semibold mb-2 text-accent">Shoppables Output</h3>
            <p className="text-sm text-muted-foreground">
              E-commerce optimized HTML with heading formatting, link attributes, 
              and source normalization. Perfect for product content conversion.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
