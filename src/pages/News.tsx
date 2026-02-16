import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Newspaper, ChevronLeft, ChevronRight } from "lucide-react";
import { newsArticles, newsCategories, formatNewsDate } from "@/data/news";

const ITEMS_PER_PAGE = 10;

export default function News() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    // Add structured data (JSON-LD) for SEO - CollectionPage
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": "News & Updates",
      "description": "Latest news, announcements, and feature highlights from RosettaScript",
      "url": typeof window !== "undefined"
        ? window.location.href
        : "https://rosettascript.github.io/news",
      "mainEntity": {
        "@type": "ItemList",
        "numberOfItems": newsArticles.length,
        "itemListElement": newsArticles.map((article, index) => ({
          "@type": "ListItem",
          "position": index + 1,
          "item": {
            "@type": "NewsArticle",
            "headline": article.title,
            "description": article.excerpt,
            "url": typeof window !== "undefined"
              ? `${window.location.origin}/news/${article.slug}`
              : `https://rosettascript.github.io/news/${article.slug}`,
            "datePublished": article.date,
            "image": article.image
          }
        }))
      }
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-news-list', 'true');
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);

    return () => {
      const scriptToRemove = document.querySelector('script[type="application/ld+json"][data-news-list]');
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, []);

  const filteredArticles = newsArticles.filter((article) => {
    return selectedCategory === "All" || article.category === selectedCategory;
  });

  const totalPages = Math.ceil(filteredArticles.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedArticles = filteredArticles.slice(startIndex, endIndex);

  // Reset to page 1 when category changes
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  return (
    <Layout>
      <SEO
        title="Latest News & Updates"
        description="Latest updates, announcements, and feature highlights from RosettaScript. Stay informed about new tools, bug fixes, and improvements."
        canonical="https://rosettascript.github.io/news"
        structuredData={{
          type: "WebPage",
        }}
        breadcrumbs={[
          { name: "Home", url: "https://rosettascript.github.io/" },
          { name: "News", url: "https://rosettascript.github.io/news" },
        ]}
      />
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-mono mb-4">
            <Newspaper className="h-4 w-4" />
            News & Updates
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">
            Latest News & Announcements
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Stay informed about new features, updates, bug fixes, and important announcements.
          </p>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {newsCategories.map((category) => (
            <Badge
              key={category}
              variant={selectedCategory === category ? "default" : "secondary"}
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
              onClick={() => handleCategoryChange(category)}
            >
              {category}
            </Badge>
          ))}
        </div>

        {/* Results Count */}
        <div className="text-center mb-6">
          <p className="text-sm text-muted-foreground">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredArticles.length)} of {filteredArticles.length} articles
          </p>
        </div>

        {/* News Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {paginatedArticles.map((article, index) => (
            <Link key={article.id} to={`/news/${article.slug}`}>
              <Card 
                className="h-full bg-card/50 border-border hover:border-primary/30 transition-all group overflow-hidden"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="aspect-video overflow-hidden">
                  <img
                    src={article.image}
                    alt={article.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">
                      {article.category}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors">
                    {article.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-3">
                    {article.excerpt}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatNewsDate(article.date)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className="min-w-[40px]"
                >
                  {page}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}

