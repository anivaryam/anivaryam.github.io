import { useParams, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, User, Share2 } from "lucide-react";
import { getNewsArticle, formatNewsDate } from "@/data/news";
import { useEffect } from "react";

export default function NewsArticle() {
  const { slug } = useParams();
  const article = slug ? getNewsArticle(slug) : null;

  useEffect(() => {
    // Add structured data (JSON-LD) for SEO
    if (article) {
      const structuredData = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": article.title,
        "description": article.excerpt,
        "image": article.image,
        "datePublished": article.date,
        "dateModified": article.date,
        "author": {
          "@type": "Organization",
          "name": article.author || "Anivaryam"
        },
        "publisher": {
          "@type": "Organization",
          "name": "Anivaryam",
          "logo": {
            "@type": "ImageObject",
            "url": typeof window !== "undefined" 
              ? `${window.location.origin}/icon-512.png`
              : "https://anivaryam.github.io/icon-512.png"
          }
        },
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": typeof window !== "undefined"
            ? window.location.href
            : `https://anivaryam.github.io/news/${article.slug}`
        },
        "articleSection": article.category,
        "keywords": article.tags?.join(", ") || ""
      };

      // Remove existing structured data script if any
      const existingScript = document.querySelector('script[type="application/ld+json"][data-news-article]');
      if (existingScript) {
        existingScript.remove();
      }

      // Add new structured data script
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-news-article', 'true');
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);

      return () => {
        const scriptToRemove = document.querySelector('script[type="application/ld+json"][data-news-article]');
        if (scriptToRemove) {
          scriptToRemove.remove();
        }
      };
    }
  }, [article]);

  if (!article) {
    return (
      <Layout>
        <SEO 
          title="Article Not Found" 
          description="The news article you're looking for doesn't exist."
        />
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold mb-4">Article Not Found</h1>
          <p className="text-muted-foreground mb-8">The news article you're looking for doesn't exist.</p>
          <Button asChild>
            <Link to="/news">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to News
            </Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const canonicalUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/news/${article.slug}`
    : `https://anivaryam.github.io/news/${article.slug}`;

  return (
    <Layout>
      <SEO
        title={article.title}
        description={article.excerpt}
        canonical={canonicalUrl}
        ogType="article"
        ogImage={article.image}
        article={{
          publishedTime: article.date,
          author: article.author,
          tags: article.tags,
        }}
        breadcrumbs={[
          { name: "Home", url: "https://anivaryam.github.io/" },
          { name: "News", url: "https://anivaryam.github.io/news" },
          { name: article.title, url: canonicalUrl },
        ]}
      />
      
      <article className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Breadcrumb */}
        <BreadcrumbNav
          items={[
            { label: "News", href: "/news" },
            { label: article.title },
          ]}
          className="mb-8"
        />

        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="secondary">{article.category}</Badge>
            {article.tags?.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">{article.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
            {article.author && (
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {article.author}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatNewsDate(article.date)}
            </span>
          </div>
        </header>

        {/* Featured Image */}
        <div className="mb-8 rounded-lg overflow-hidden">
          <img
            src={article.image}
            alt={article.title}
            className="w-full h-auto"
          />
        </div>

        {/* Content */}
        <div className="prose prose-invert max-w-none mb-8">
          <MarkdownRenderer content={article.content} />
        </div>

        {/* Share Section */}
        <div className="border-t pt-8 mt-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <Button asChild variant="outline">
              <Link to="/news">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to News
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: article.title,
                    text: article.excerpt,
                    url: shareUrl,
                  });
                } else {
                  navigator.clipboard.writeText(shareUrl);
                  alert("Link copied to clipboard!");
                }
              }}
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      </article>
    </Layout>
  );
}

