import { useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Calendar, Clock } from "lucide-react";
import { blogPosts, categories } from "@/data/blogPosts";

export default function Blogs() {
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filteredPosts = [...blogPosts]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .filter((post) => {
    return selectedCategory === "All" || post.category === selectedCategory;
  });

  return (
    <Layout>
      <SEO
        title="Developer Blog & Tutorials"
        description="Tutorials, tips, and developer resources. Learn about web scraping, cryptography, post-quantum security, and more developer topics."
        canonical="https://rosettascript.github.io/blogs"
        structuredData={{
          type: "WebPage",
        }}
        breadcrumbs={[
          { name: "Home", url: "https://rosettascript.github.io/" },
          { name: "Blog", url: "https://rosettascript.github.io/blogs" },
        ]}
      />
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent-foreground text-sm font-mono mb-4">
            <BookOpen className="h-4 w-4" />
            Developer Blog
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">
            Tutorials, Tips & Resources
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Learn how to use my tools effectively and discover best practices for 
            development, automation, and more.
          </p>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {categories.map((category) => (
            <Badge
              key={category}
              variant={selectedCategory === category ? "default" : "secondary"}
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Badge>
          ))}
        </div>

        {/* Results Count */}
        <div className="text-center mb-6">
          <p className="text-sm text-muted-foreground">
            Showing {filteredPosts.length} of {blogPosts.length} posts
          </p>
        </div>

        {/* Blog Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts.map((post, index) => (
            <Link key={post.id} to={`/blogs/${post.id}`}>
              <Card 
                className="h-full bg-card/50 border-border hover:border-primary/30 transition-all group overflow-hidden"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="aspect-video overflow-hidden">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">
                      {post.category}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors">
                    {post.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {post.excerpt}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(post.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {post.readTime}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* No Results Message */}
        {filteredPosts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No posts match your filter.</p>
            <button
              className="text-primary hover:underline mt-2"
              onClick={() => setSelectedCategory("All")}
            >
              Clear filter
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
