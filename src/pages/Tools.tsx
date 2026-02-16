import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Code2, FileCode, ArrowRight, Braces, Binary, Link as LinkIcon, Palette, Fingerprint, Regex, Hash, KeyRound, Clock, Globe, Search, QrCode, GitCompare, FileText, Image, Lock, LayoutTemplate } from "lucide-react";
import { Link } from "react-router-dom";

const tools = [
  {
    id: "word-to-html",
    title: "Word to HTML Converter",
    description: "Convert text content to clean HTML code with multiple output formats including regular, blog, and shoppable options. Perfect for content creators.",
    icon: FileCode,
    path: "/tools/word-to-html",
    color: "text-primary",
  },
  {
    id: "json-formatter",
    title: "JSON Formatter & Validator",
    description: "Format, minify, and validate JSON data with customizable indentation and syntax highlighting. Beautify messy JSON, detect errors, and optimize data structures.",
    icon: Braces,
    path: "/tools/json-formatter",
    color: "text-secondary",
  },
  {
    id: "base64",
    title: "Base64 Encoder/Decoder",
    description: "Encode text to Base64 or decode Base64 strings back to plain text with UTF-8 support. Essential for data encoding, API development, and secure transmission.",
    icon: Binary,
    path: "/tools/base64",
    color: "text-accent",
  },
  {
    id: "url-encoder",
    title: "URL Encoder/Decoder",
    description: "Encode special characters for URLs or decode URL-encoded strings for readable text. Handle percent encoding, query parameters, and ensure proper URL formatting.",
    icon: LinkIcon,
    path: "/tools/url-encoder",
    color: "text-[hsl(var(--syntax-cyan))]",
  },
  {
    id: "color-converter",
    title: "Color Converter Tool",
    description: "Convert colors between HEX, RGB, and HSL formats with a live color preview. Perfect for web developers and designers working with color palettes and CSS.",
    icon: Palette,
    path: "/tools/color-converter",
    color: "text-[hsl(var(--syntax-orange))]",
  },
  {
    id: "uuid-generator",
    title: "UUID Generator Tool",
    description: "Generate random UUID v4 identifiers instantly. Create single or multiple UUIDs with optional hyphen formatting. Essential for database IDs and API keys.",
    icon: Fingerprint,
    path: "/tools/uuid-generator",
    color: "text-[hsl(var(--syntax-yellow))]",
  },
  {
    id: "regex-tester",
    title: "Regular Expression Tester",
    description: "Test and debug regular expressions with live matching, syntax highlighting, and capture group extraction. Build, validate, and optimize regex patterns easily.",
    icon: Regex,
    path: "/tools/regex-tester",
    color: "text-[hsl(var(--syntax-purple))]",
  },
  {
    id: "hash-generator",
    title: "Hash Generator Tool",
    description: "Generate SHA-1, SHA-256, SHA-384, and SHA-512 hash values from text input. Create secure hashes for passwords, data integrity, and cryptographic operations.",
    icon: Hash,
    path: "/tools/hash-generator",
    color: "text-[hsl(var(--syntax-green))]",
  },
  {
    id: "hash-decoder",
    title: "Hash Decoder & Verifier",
    description: "Verify if text matches a hash value. Check SHA-1, SHA-256, SHA-384, and SHA-512 hashes. Validate password hashes and verify data integrity with ease.",
    icon: Search,
    path: "/tools/hash-decoder",
    color: "text-[hsl(var(--syntax-blue))]",
  },
  {
    id: "jwt-decoder",
    title: "JWT Token Decoder",
    description: "Decode and inspect JSON Web Tokens instantly. View header, payload, signature, and expiration times. Essential for debugging authentication tokens and APIs.",
    icon: KeyRound,
    path: "/tools/jwt-decoder",
    color: "text-[hsl(var(--syntax-cyan))]",
  },
  {
    id: "jwt-encoder",
    title: "JWT Token Encoder",
    description: "Encode and create JSON Web Tokens with ease. Generate signed tokens with HS256, HS384, and HS512 algorithms. Perfect for testing authentication flows and APIs.",
    icon: KeyRound,
    path: "/tools/jwt-encoder",
    color: "text-[hsl(var(--syntax-cyan))]",
  },
  {
    id: "timestamp-converter",
    title: "Timestamp Converter Tool",
    description: "Convert between Unix timestamps and human-readable dates instantly. Supports seconds and milliseconds precision. Essential for working with APIs and databases.",
    icon: Clock,
    path: "/tools/timestamp-converter",
    color: "text-[hsl(var(--syntax-orange))]",
  },
  {
    id: "web-scraper",
    title: "Free Web Scraper Tool",
    description: "Extract data from websites using CSS selectors. Simple, fast, and free web scraping tool. No coding required. Perfect for data collection and research.",
    icon: Globe,
    path: "/tools/web-scraper",
    color: "text-[hsl(var(--syntax-cyan))]",
  },
  {
    id: "json-extractor",
    title: "JSON Data Extractor",
    description: "Extract specific data from JSON structures. Get field values, use path syntax, or extract array values. Perfect for parsing API responses and nested JSON data.",
    icon: Search,
    path: "/tools/json-extractor",
    color: "text-[hsl(var(--syntax-green))]",
  },
  {
    id: "qr-code-generator",
    title: "QR Code Generator Tool",
    description: "Generate QR codes for WiFi, email, SMS, phone, contacts, events, files, and more. Customize size and download as PNG. Create professional QR codes easily.",
    icon: QrCode,
    path: "/tools/qr-code-generator",
    color: "text-[hsl(var(--syntax-cyan))]",
  },
  {
    id: "text-diff",
    title: "Text Diff Comparison Tool",
    description: "Compare two texts and see differences instantly. Compare by characters, words, or lines. Perfect for code reviews, document comparison, and version control.",
    icon: GitCompare,
    path: "/tools/text-diff",
    color: "text-[hsl(var(--syntax-purple))]",
  },
  {
    id: "csv-to-json",
    title: "CSV to JSON Converter",
    description: "Convert CSV to JSON and JSON to CSV formats. Customizable delimiter and header options. Perfect for data migration, API integration, and data conversion.",
    icon: FileText,
    path: "/tools/csv-to-json",
    color: "text-[hsl(var(--syntax-green))]",
  },
  {
    id: "image-tool",
    title: "Image Compression Tool",
    description: "Compress, convert formats (PNG/JPEG/WebP), resize images, and generate favicons. All processing in your browser for privacy. Optimize images for web use.",
    icon: Image,
    path: "/tools/image-tool",
    color: "text-[hsl(var(--syntax-pink))]",
  },
  {
    id: "random-universe-cipher",
    title: "Random Universe Cipher",
    description: "256-bit quantum-resistant symmetric encryption cipher. Encrypt and decrypt text and files with password-based authentication.",
    icon: Lock,
    path: "/tools/random-universe-cipher",
    color: "text-[hsl(var(--syntax-purple))]",
  },
  {
    id: "listicle-template",
    title: "Listicle CSS Template Tool",
    description: "Prefix CSS class selectors with template names and remove inline styles. Perfect for listicle articles and content templates.",
    icon: LayoutTemplate,
    path: "/tools/listicle-template",
    color: "text-[hsl(var(--syntax-pink))]",
  },
];

export default function Tools() {
  return (
    <Layout>
      <SEO
        title="Free Online Developer Tools - 20+ Tools"
        description="Browse 20+ free online developer tools. Word to HTML converter, JSON formatter, Base64 encoder, hash generator, web scraper, and more. No signup required."
        canonical="https://rosettascript.github.io/tools"
        structuredData={{
          type: "WebPage",
        }}
        breadcrumbs={[
          { name: "Home", url: "https://rosettascript.github.io/" },
          { name: "Tools", url: "https://rosettascript.github.io/tools" },
        ]}
      />
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-mono mb-4">
            <Code2 className="h-4 w-4" />
            Online Tools
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">
            Free Online Developer Tools
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-4">
            Browse my complete collection of 20+ free online developer tools designed to streamline your workflow. From document conversion and code formatting to data encoding and web scraping—find the perfect tool for your needs.
          </p>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            All tools run entirely in your browser with no signup required. Your data stays private, processing happens locally, and everything is completely free. Perfect for web developers, content editors, technical writers, and SEO specialists.
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool, index) => (
            <Link key={tool.id} to={tool.path}>
              <Card 
                className="h-full bg-card/50 border-border hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5 group cursor-pointer"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardHeader>
                  <tool.icon className={`h-10 w-10 ${tool.color} mb-2 group-hover:scale-110 transition-transform`} />
                  <CardTitle className="text-lg">{tool.title}</CardTitle>
                  <CardDescription>{tool.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-sm text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                    Open Tool <ArrowRight className="h-4 w-4" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Info */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground text-sm">
            Have a tool suggestion? Let me know!
          </p>
        </div>
      </div>
    </Layout>
  );
}
