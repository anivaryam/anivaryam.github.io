import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { FAQ } from "@/components/FAQ";

export default function FAQPage() {
  return (
    <Layout>
      <SEO
        title="FAQ - Frequently Asked Questions"
        description="Find answers to common questions about RosettaScript's free developer tools, privacy, usage, and more. Learn how to use Word to HTML converter, JSON formatter, and other tools."
        canonicalUrl="https://rosettascript.github.io/faq"
      />
      
      <div className="container mx-auto px-4 py-8">
        <BreadcrumbNav
          items={[
            { label: "FAQ" },
          ]}
          className="mb-8"
        />
        
        <FAQ />
      </div>
    </Layout>
  );
}
