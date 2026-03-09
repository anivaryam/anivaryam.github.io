import { Layout } from "@/components/layout/Layout";
import { RegexTesterTool } from "@/components/tools/RegexTesterTool";
import { SEO } from "@/components/SEO";
import { UpdateNotification } from "@/components/UpdateNotification";
import { Code2, Regex, Home } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function RegexTester() {
  return (
    <Layout>
      <SEO
        title="Regex Tester - Test Regular Expressions"
        description="Test and debug regular expressions with live matching, syntax highlighting, and capture group extraction. Free online regex tester. Perfect for developers validating patterns and testing regex."
        canonical="https://anivaryam.github.io/tools/regex-tester"
breadcrumbs={[
          { name: "Home", url: "https://anivaryam.github.io/" },
          { name: "Tools", url: "https://anivaryam.github.io/tools" },
          { name: "Regex Tester", url: "https://anivaryam.github.io/tools/regex-tester" },
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
              <BreadcrumbPage>Regex Tester</BreadcrumbPage>
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
            Regex Tester
          </h1>
        </div>

        {/* Tool */}
        <div className="terminal-bg p-6 lg:p-8">
          <div className="flex items-center gap-2 pb-4 mb-6 border-b border-border">
            <div className="w-3 h-3 rounded-full bg-destructive/80" />
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--syntax-yellow))]/80" />
            <div className="w-3 h-3 rounded-full bg-primary/80" />
            <span className="ml-2 text-sm text-muted-foreground font-mono flex items-center gap-2">
              <Regex className="h-4 w-4" />
              regex.test
            </span>
          </div>
          <RegexTesterTool />
        </div>

        {/* Tool Description Section */}
        <div className="mt-8">
          <div className="prose prose-sm max-w-none text-muted-foreground">
            <h2 className="text-xl font-semibold mb-4 text-foreground">About This Tool</h2>
            <p>
              Test and debug regular expressions with live matching, syntax highlighting, and capture group extraction. This free online regex tester helps you validate patterns, test complex expressions, and debug regex issues instantly.
            </p>
            <p className="mt-4">
              Perfect for developers validating input patterns, data scientists extracting information from text, and anyone working with text processing. View capture groups, match positions, and see exactly how your regex pattern matches against test strings—all in real-time as you type.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
