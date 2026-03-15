import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { FAQ } from "@/components/FAQ";
import { JsonLDScript } from "@/components/JsonLDScript";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LenisContainer } from "@/components/LenisContainer";
import { 
  Terminal, 
  Code2, 
  Download, 
  BookOpen, 
  GraduationCap, 
  ArrowRight,
  Sparkles,
  Zap,
  Shield,
  Newspaper,
  Calendar,
  Clock
} from "lucide-react";
import { getLatestNews, formatNewsDate } from "@/data/news";
import { getLatestBlogPosts } from "@/data/blogPosts";

const features = [
  {
    icon: Code2,
    title: "Online Tools",
    description: "Access 20+ powerful developer tools completely free. Format JSON, convert Word to HTML, encode/decode Base64, generate UUIDs and hashes, test regex patterns, scrape websites, and much more. All tools run directly in your browser with no sign-up required.",
    link: "/tools",
    color: "text-primary",
  },
  {
    icon: Download,
    title: "Downloads",
    description: "Download ready-to-use scripts and utilities for your development workflow. Get Windows automation scripts, PERN stack setup templates, PostgreSQL database managers, and other time-saving tools. Everything is free and open source.",
    link: "/downloads",
    color: "text-secondary",
  },
  {
    icon: BookOpen,
    title: "Blog",
    description: "Learn from comprehensive tutorials, tips, and developer guides. Discover how to build modern applications, implement encryption, scrape websites effectively, and optimize your development process. New articles published regularly.",
    link: "/blogs",
    color: "text-accent",
  },
  {
    icon: GraduationCap,
    title: "School Projects",
    description: "Find ready-to-use project templates perfect for students and educators. Get started quickly with pre-configured project structures, documentation, and examples. Perfect for assignments, capstone projects, and learning new technologies.",
    link: "/school-projects",
    color: "text-[hsl(var(--syntax-orange))]",
  },
];

const highlights = [
  {
    icon: Zap,
    title: "Fast & Efficient",
    description: "Optimized tools that save you hours of work",
  },
  {
    icon: Shield,
    title: "No Account Needed",
    description: "Use all tools instantly without signing up",
  },
  {
    icon: Sparkles,
    title: "Developer Focused",
    description: "Built by a developer, for developers",
  },
];

const codeSnippet = `// Welcome to Anivaryam
const tools = {
  formatters: ["JSON", "Code", "Text"],
  converters: ["Word → HTML", "Base64", "URL", "Color"],
  generators: ["UUID", "Hash", "QR Code", "Timestamp"],
  utilities: ["Regex Tester", "Image Tool", "Web Scraper"],
  downloads: ["Windows Scripts", "PERN Setup", "PSQL Manager"]
};

export default tools;`;

export default function Index() {
  return (
    <Layout>
      <SEO
        title="Free Developer Tools - Conversion & Formatting"
        description="Free online developer tools for Word to HTML conversion, text formatting, code cleanup, and automation. No signup, fast & privacy-friendly."
        canonical="https://anivaryam.github.io/"
        structuredData={{
          type: "WebSite",
        }}
      />
      <JsonLDScript />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none" />
        <div className="container mx-auto px-4 py-12 lg:py-20 relative z-10">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-mono">
                <Terminal className="h-4 w-4" />
                Developer Tools Made Simple
                <a 
                  href="https://github.com/anivaryam/anivaryam.github.io" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-2 px-2 py-0.5 bg-muted hover:bg-muted/80 rounded-full text-xs flex items-center gap-1 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  <span>Star</span>
                </a>
              </div>
              <h1 className="text-4xl lg:text-5xl font-bold leading-tight">
                Free Online Developer Tools for Text, Code & Document Conversion
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg w-full">
                Anivaryam offers 20+ free online developer tools for converting, cleaning, formatting, and automating text and code. Whether you need a <Link to="/tools/word-to-html" className="text-primary hover:underline">Word to HTML converter</Link>, <Link to="/tools/json-formatter" className="text-primary hover:underline">JSON formatter</Link>, <Link to="/tools/base64" className="text-primary hover:underline">Base64 encoder</Link>, or more, these tools run entirely in your browser without signup or cost. These tools help developers, content editors, and technical writers save time while maintaining quality.
              </p>
              <div className="flex flex-col sm:flex-row flex-wrap gap-4">
                <Button asChild size="lg" className="glow-primary w-full sm:w-auto">
                  <Link to="/tools">
                    Try Online Tools
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                  <Link to="/downloads">
                    <Download className="mr-2 h-4 w-4" />
                    Download Tools
                  </Link>
                </Button>
                <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl+K</kbd>
                  <span>to search</span>
                </div>
              </div>
            </div>

            {/* Code Preview */}
            <div className="terminal-bg p-1 w-full max-w-full overflow-hidden rounded-lg">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
                <div className="w-3 h-3 rounded-full bg-destructive/80" />
                <div className="w-3 h-3 rounded-full bg-[hsl(var(--syntax-yellow))]/80" />
                <div className="w-3 h-3 rounded-full bg-primary/80" />
                <span className="ml-2 text-xs text-muted-foreground font-mono hidden sm:inline">tools.ts</span>
              </div>
              <pre className="p-4 overflow-x-auto max-w-full text-xs sm:text-sm">
                <code className="text-sm font-mono block min-w-0">
                  {codeSnippet.split("\n").map((line, i) => (
                    <div key={i} className="flex min-w-0">
                      <span className="w-8 flex-shrink-0 text-muted-foreground select-none">{i + 1}</span>
                      <span className={`flex-1 min-w-0 break-words ${
                        line.startsWith("//") ? "text-muted-foreground" :
                        line.includes("const") ? "text-secondary" :
                        line.includes(":") ? "text-[hsl(var(--syntax-orange))]" :
                        line.includes("export") ? "text-accent" :
                        "text-foreground"
                      }`}>
                        {line}
                      </span>
                    </div>
                  ))}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* SEO Content Section - Popular Tools */}
      <section className="py-12 content-visibility-auto">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-6 text-center">Popular Online Developer Tools</h2>
          <p className="text-muted-foreground max-w-3xl mx-auto mb-8 text-center">
            My collection of free developer tools covers everything from document conversion to code formatting. Each tool runs entirely in your browser—no server uploads, no data storage, complete privacy.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Link to="/tools/word-to-html" className="p-4 bg-card/50 rounded-lg border border-border hover:border-primary/50 transition-all group">
              <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">Word to HTML Converter</h3>
              <p className="text-sm text-muted-foreground">Clean up Word-generated HTML and convert documents to semantic, SEO-friendly HTML code.</p>
            </Link>
            <Link to="/tools/json-formatter" className="p-4 bg-card/50 rounded-lg border border-border hover:border-primary/50 transition-all group">
              <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">JSON Formatter & Validator</h3>
              <p className="text-sm text-muted-foreground">Format, validate, and beautify JSON data with syntax highlighting and error detection.</p>
            </Link>
            <Link to="/tools/base64" className="p-4 bg-card/50 rounded-lg border border-border hover:border-primary/50 transition-all group">
              <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">Base64 Encode/Decode</h3>
              <p className="text-sm text-muted-foreground">Encode images or text to Base64, or decode Base64 strings back to readable format.</p>
            </Link>
            <Link to="/tools/text-diff" className="p-4 bg-card/50 rounded-lg border border-border hover:border-primary/50 transition-all group">
              <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">Text Cleanup & Case Converter</h3>
              <p className="text-sm text-muted-foreground">Normalize text, convert cases, and clean up formatting issues in your content.</p>
            </Link>
            <Link to="/tools/hash-generator" className="p-4 bg-card/50 rounded-lg border border-border hover:border-primary/50 transition-all group">
              <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">Hash Generator</h3>
              <p className="text-sm text-muted-foreground">Generate SHA-1, SHA-256, SHA-384, and SHA-512 hashes for passwords and data integrity.</p>
            </Link>
            <Link to="/tools/regex-tester" className="p-4 bg-card/50 rounded-lg border border-border hover:border-primary/50 transition-all group">
              <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">Regex Tester</h3>
              <p className="text-sm text-muted-foreground">Test and debug regular expressions with live matching and capture group extraction.</p>
            </Link>
            <Link to="/tools/web-scraper" className="p-4 bg-card/50 rounded-lg border border-border hover:border-primary/50 transition-all group">
              <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">Web Scraper</h3>
              <p className="text-sm text-muted-foreground">Extract data from websites using CSS selectors. Free, fast, and runs in your browser.</p>
            </Link>
            <Link to="/tools/json-extractor" className="p-4 bg-card/50 rounded-lg border border-border hover:border-primary/50 transition-all group">
              <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">JSON Data Extractor</h3>
              <p className="text-sm text-muted-foreground">Extract specific fields from JSON structures using path syntax or field names.</p>
            </Link>
          </div>
        </div>
      </section>

      {/* News & Blog Posts Section - MOVED UP */}
      <section className="py-12 content-visibility-auto">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-5 gap-8">
            {/* Blog Posts - Main Content */}
            {getLatestBlogPosts(3).length > 0 && (
              <div className="lg:col-span-4">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent-foreground text-sm font-mono mb-4">
                    <BookOpen className="h-4 w-4" />
                    Latest Blog Posts
                  </div>
                  <h2 className="text-3xl font-bold mb-3">Learn & Explore</h2>
                  <p className="text-muted-foreground max-w-2xl mx-auto">
                    Discover tutorials, tips, and guides to help you build better and work smarter
                  </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {getLatestBlogPosts(3).map((post, index) => (
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

                <div className="text-center">
                  <Button asChild variant="outline" size="lg">
                    <Link to="/blogs">
                      View All Blog Posts
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            )}

            {/* News Sidebar */}
            {getLatestNews(2).length > 0 && (
              <div className="lg:col-span-1">
                <div className="sticky top-24 h-full">
                  <div className="mb-6">
                    <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-mono mb-2">
                      <Newspaper className="h-3 w-3" />
                      Latest News
                    </div>
                    <h2 className="text-xl font-bold mb-2">Stay Updated</h2>
                    <p className="text-xs text-muted-foreground mb-4">
                      Latest updates and announcements
                    </p>
                  </div>

                  <div className="space-y-3" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                    <LenisContainer className="overflow-y-auto">
                    {getLatestNews(2).map((article, index) => (
                      <Link key={article.id} to={`/news/${article.slug}`} className="block">
                        <Card 
                          className="bg-card/50 border-border hover:border-primary/30 transition-all group overflow-hidden"
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
                          <CardHeader className="p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="secondary" className="text-xs">
                                {article.category}
                              </Badge>
                            </div>
                            <CardTitle className="text-sm line-clamp-2 group-hover:text-primary transition-colors">
                              {article.title}
                            </CardTitle>
                            <CardDescription className="line-clamp-2 text-xs">
                              {article.excerpt}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="p-3 pt-0">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span className="text-[10px]">{formatNewsDate(article.date)}</span>
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                    </LenisContainer>
                  </div>

                  <div className="mt-6">
                    <Button asChild variant="outline" size="sm" className="w-full text-xs">
                      <Link to="/news">
                        View All News
                        <ArrowRight className="ml-2 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SEO Content Section - Who It's For */}
      <section className="py-12 content-visibility-auto">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-6 text-center">Who These Tools Are For</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="p-4 bg-card/50 rounded-lg border border-border hover:border-primary/50 transition-all group">
              <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">Web Developers</h3>
              <p className="text-sm text-muted-foreground">
                Format JSON, encode data, generate UUIDs, test regex patterns, and convert between formats quickly.
              </p>
            </div>
            <div className="p-4 bg-card/50 rounded-lg border border-border hover:border-primary/50 transition-all group">
              <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">Content Editors</h3>
              <p className="text-sm text-muted-foreground">
                Convert Word documents to clean HTML, format text, and prepare content for web publishing.
              </p>
            </div>
            <div className="p-4 bg-card/50 rounded-lg border border-border hover:border-primary/50 transition-all group">
              <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">Technical Writers</h3>
              <p className="text-sm text-muted-foreground">
                Clean up HTML from documentation tools, format code snippets, and ensure consistent formatting.
              </p>
            </div>
            <div className="p-4 bg-card/50 rounded-lg border border-border hover:border-primary/50 transition-all group">
              <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">SEO Specialists</h3>
              <p className="text-sm text-muted-foreground">
                Convert documents to SEO-friendly HTML, clean up messy markup, and optimize content structure.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Use Anivaryam - Moved from above */}
      <section className="py-12 content-visibility-auto">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-6 text-center">Why Use Anivaryam Developer Tools</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="p-4 bg-card/50 rounded-lg border border-border hover:border-primary/50 transition-all group">
              <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">No Signup Required</h3>
              <p className="text-sm text-muted-foreground">
                All my developer tools are completely free and require no account creation. Start using any tool instantly—no email, no passwords, no barriers.
              </p>
            </div>
            <div className="p-4 bg-card/50 rounded-lg border border-border hover:border-primary/50 transition-all group">
              <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">Runs Locally in Browser</h3>
              <p className="text-sm text-muted-foreground">
                Every tool processes data entirely in your browser. Your content never leaves your device, ensuring complete privacy and security for sensitive documents and code.
              </p>
            </div>
            <div className="p-4 bg-card/50 rounded-lg border border-border hover:border-primary/50 transition-all group">
              <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">Privacy-Focused</h3>
              <p className="text-sm text-muted-foreground">
                I don't store, track, or analyze your data. All processing happens client-side, making these tools perfect for handling confidential information and proprietary code.
              </p>
            </div>
            <div className="p-4 bg-card/50 rounded-lg border border-border hover:border-primary/50 transition-all group">
              <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">Open Source</h3>
              <p className="text-sm text-muted-foreground">
                Anivaryam is an open-source project built by a developer, for developers. You can review the code, contribute improvements, or use it as a reference for your own projects.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-6 text-center">Everything You Need</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Explore my collection of online tools, downloadable utilities, educational resources, and developer guides
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {features.map((feature) => (
              <Link key={feature.title} to={feature.link} className="p-4 bg-card/50 rounded-lg border border-border hover:border-primary/50 transition-all group">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className={`h-6 w-6 ${feature.color} group-hover:scale-110 transition-transform`} />
                </div>
                <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="py-12 content-visibility-auto">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {highlights.map((highlight) => (
              <Card 
                key={highlight.title} 
                className="text-center p-5 bg-card/50 border-border hover:border-primary/30 transition-all group"
              >
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <highlight.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mt-3">{highlight.title}</h3>
                <p className="text-muted-foreground text-sm mt-1">{highlight.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* SEO Content Section - Explore All Tools */}
      <section className="py-12 content-visibility-auto">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-6 text-center">Explore All Free Developer Tools</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-8 text-center">
            Browse my complete collection of 20+ free online developer tools. From document conversion and code formatting to data encoding and web scraping—find the perfect tool for your workflow.
          </p>
          <div className="text-center">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/tools">
                View All Developer Tools
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <FAQ injectSchema={false} />

      {/* CTA Section */}
      <section className="py-12 bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-3">Ready to Get Started?</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Explore my 20+ online tools, download utilities, read my blog, or check out school project templates.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/tools">
                Browse All Tools
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <Link to="/blogs">
                Read Blog
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
