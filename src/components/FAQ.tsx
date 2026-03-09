import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, HelpCircle, Lightbulb, Lock, Smartphone, Wrench, Settings, Package } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { faqData, faqCategories, type FAQItem } from "@/data/faq";
import { faqSchema } from "@/data/faqSchema";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

// Icon mapping for categories (using Lucide icons for consistency and SEO)
const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  general: Lightbulb,
  privacy: Lock,
  usage: Smartphone,
  tools: Wrench,
  technical: Settings,
  downloads: Package,
};

export function FAQ() {
  const [searchQuery, setSearchQuery] = useState("");
  const [openCategories, setOpenCategories] = useState<string[]>([]);

  // Filter FAQs based on search query
  const filteredFAQs = useMemo(() => {
    if (!searchQuery.trim()) {
      return faqData;
    }

    const query = searchQuery.toLowerCase();
    return faqData.filter(
      (faq) =>
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Group FAQs by category
  const groupedFAQs = useMemo(() => {
    const grouped: Record<string, FAQItem[]> = {};
    
    filteredFAQs.forEach((faq) => {
      if (!grouped[faq.category]) {
        grouped[faq.category] = [];
      }
      grouped[faq.category].push(faq);
    });

    return grouped;
  }, [filteredFAQs]);

  // Auto-open categories that have matching FAQs
  useEffect(() => {
    if (searchQuery.trim()) {
      const matchingCategories = Object.keys(groupedFAQs);
      setOpenCategories(matchingCategories);
    } else {
      setOpenCategories([]);
    }
  }, [searchQuery, groupedFAQs]);

  // Inject JSON-LD schema
  useEffect(() => {
    const scriptId = "faq-schema";
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.type = "application/ld+json";
      // Lazy-load: append to body instead of head for better performance
      document.body.appendChild(script);
    }

    // Update dateModified to current date dynamically
    const updatedSchema = {
      ...faqSchema,
      dateModified: new Date().toISOString().split("T")[0],
    };

    script.textContent = JSON.stringify(updatedSchema);
  }, []);

  const visibleCategories = faqCategories.filter(
    (cat) => groupedFAQs[cat.id] && groupedFAQs[cat.id].length > 0
  );

  return (
    <section className="py-12 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <HelpCircle className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-3xl font-bold mb-6">
              Frequently Asked Questions
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Find answers to common questions about Anivaryam's free developer tools, privacy, usage, and more.
            </p>
          </div>

          {/* Search Bar */}
          <div className="mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search FAQs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 text-base"
                aria-label="Search frequently asked questions"
              />
            </div>
            {searchQuery && (
              <p className="text-sm text-muted-foreground mt-2">
                Found {filteredFAQs.length} {filteredFAQs.length === 1 ? "question" : "questions"}
              </p>
            )}
          </div>

          {/* FAQ Accordion */}
          {visibleCategories.length > 0 ? (
            <Accordion
              type="multiple"
              value={openCategories}
              onValueChange={setOpenCategories}
              className="space-y-4"
            >
              {visibleCategories.map((category) => {
                const categoryFAQs = groupedFAQs[category.id];
                if (!categoryFAQs || categoryFAQs.length === 0) return null;

                return (
                  <Card key={category.id} className="overflow-hidden">
                    <AccordionItem value={category.id} className="border-0">
                      <AccordionTrigger className="px-6 py-4 hover:no-underline">
                        <div className="flex items-center gap-3">
                          {(() => {
                            const IconComponent = categoryIcons[category.id] || HelpCircle;
                            return (
                              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center" aria-hidden="true">
                                <IconComponent className="h-5 w-5 text-primary" />
                              </div>
                            );
                          })()}
                          <div className="text-left">
                            <h3 className="text-lg font-semibold">{category.name}</h3>
                            <p className="text-sm text-muted-foreground font-normal">
                              {categoryFAQs.length} {categoryFAQs.length === 1 ? "question" : "questions"}
                            </p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6">
                        <div className="space-y-4 pt-2">
                          {categoryFAQs.map((faq, index) => (
                            <div
                              key={`${category.id}-${index}`}
                              className="border-l-2 border-primary/20 pl-4 py-2"
                            >
                              <h4 className="font-semibold text-base mb-2 text-foreground">
                                {faq.question}
                              </h4>
                              <div className="text-muted-foreground prose prose-sm dark:prose-invert max-w-none">
                                <MarkdownRenderer content={faq.answer} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Card>
                );
              })}
            </Accordion>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                No FAQs found matching "{searchQuery}". Try a different search term.
              </p>
            </Card>
          )}

          {/* Footer CTA */}
          <div className="mt-12 text-center">
            <p className="text-muted-foreground mb-4">
              Still have questions? We're here to help!
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Badge variant="outline" asChild>
                <Link to="/issues" className="cursor-pointer">
                  Report an Issue
                </Link>
              </Badge>
              <Badge variant="outline" asChild>
                <Link to="/blogs" className="cursor-pointer">
                  Read Our Blog
                </Link>
              </Badge>
              <Badge variant="outline" asChild>
                <a
                  href="https://github.com/anivaryam/anivaryam.github.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cursor-pointer"
                >
                  View on GitHub
                </a>
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

