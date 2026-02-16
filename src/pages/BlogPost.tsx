import { useParams, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { ArrowLeft, Calendar, Clock, Share2, User } from "lucide-react";
import { getBlogPost } from "@/data/blogPosts";

export default function BlogPost() {
  const { id } = useParams();
  const post = id ? getBlogPost(id) : null;

  if (!post) {
    return (
      <Layout>
        <SEO 
          title="Post Not Found" 
          description="The blog post you're looking for doesn't exist."
        />
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold mb-4">Post Not Found</h1>
          <p className="text-muted-foreground mb-8">The blog post you're looking for doesn't exist.</p>
          <Button asChild>
            <Link to="/blogs">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Blog
            </Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const canonicalUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/blogs/${post.id}`
    : `https://rosettascript.github.io/blogs/${post.id}`;

  return (
    <Layout>
      <SEO
        title={post.title}
        description={post.excerpt}
        canonical={canonicalUrl}
        ogType="article"
        ogImage={post.image}
        article={{
          publishedTime: post.date,
          author: post.author,
          tags: post.tags,
        }}
        structuredData={{
          type: "Article",
        }}
        breadcrumbs={[
          { name: "Home", url: "https://rosettascript.github.io/" },
          { name: "Blog", url: "https://rosettascript.github.io/blogs" },
          { name: post.title, url: canonicalUrl },
        ]}
      />
      
      <article className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Breadcrumb */}
        <BreadcrumbNav
          items={[
            { label: "Blog", href: "/blogs" },
            { label: post.title },
          ]}
          className="mb-8"
        />

        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="secondary">{post.category}</Badge>
            {post.tags?.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">{post.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {post.author && (
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {post.author}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {new Date(post.date).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {post.readTime}
            </span>
          </div>
        </header>

        {/* Featured Image */}
        <div className="aspect-video rounded-lg overflow-hidden mb-8">
          <img
            src={post.image.replace("w=600", "w=1200").replace("h=400", "h=600")}
            alt={post.title}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Content */}
        <MarkdownRenderer content={post.content} />

        {/* Share */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <span className="text-sm text-muted-foreground">Share this article</span>
            <div className="flex gap-2">
              <CopyButton
                text={shareUrl}
                variant="outline"
                size="sm"
                successMessage="Link copied!"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Copy Link
              </CopyButton>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-8">
          <Button asChild variant="ghost">
            <Link to="/blogs">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to all posts
            </Link>
          </Button>
        </div>
      </article>
    </Layout>
  );
}
