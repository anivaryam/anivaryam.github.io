import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Terminal, Target, Heart, Zap, Mail, Github, Linkedin, Phone } from "lucide-react";
import { XIcon } from "@/components/icons/XIcon";

const values = [
  {
    icon: Zap,
    title: "Simplicity",
    description: "I believe developer tools should be simple and intuitive. No steep learning curves, just solutions that work.",
    color: "text-primary",
  },
  {
    icon: Target,
    title: "Efficiency",
    description: "Every tool I build is designed to save you time. Focus on building, not configuring.",
    color: "text-secondary",
  },
  {
    icon: Heart,
    title: "Community",
    description: "I'm a developer helping developers. All my tools are free to use and many are open source.",
    color: "text-accent",
  },
];

const stats = [
  { value: "10K+", label: "Downloads" },
  { value: "19+", label: "Tools & Scripts" },
  { value: "5K+", label: "Happy Developers" },
  { value: "100%", label: "Free to Use" },
];

export default function About() {
  return (
    <Layout>
      <SEO
        title="About Anivaryam"
        description="Learn more about Anivaryam and my mission. Developer tools made simple, built by a developer for developers. Free, open-source, and community-driven."
        canonical="https://anivaryam.github.io/about"
        structuredData={{
          type: "WebPage",
        }}
        breadcrumbs={[
          { name: "Home", url: "https://anivaryam.github.io/" },
          { name: "About", url: "https://anivaryam.github.io/about" },
        ]}
      />
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-mono mb-4">
            <Terminal className="h-4 w-4" />
            About Anivaryam
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">
            Developer Tools Made Simple
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Anivaryam was born from a simple idea: developers shouldn't waste time on repetitive 
            tasks. I build tools that let you focus on what matters—creating amazing software.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center p-6 bg-card/50 rounded-lg border border-border">
              <div className="text-3xl font-bold text-primary mb-1">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Mission */}
        <div className="terminal-bg p-8 mb-16">
          <div className="flex items-center gap-2 pb-4 mb-6 border-b border-border">
            <div className="w-3 h-3 rounded-full bg-destructive/80" />
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--syntax-yellow))]/80" />
            <div className="w-3 h-3 rounded-full bg-primary/80" />
            <span className="ml-2 text-sm text-muted-foreground font-mono">mission.md</span>
          </div>
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">My Mission</h2>
            <p className="text-muted-foreground">
              I'm on a mission to democratize developer tools. Whether you're a student working on 
              your first project or a seasoned developer automating workflows, Anivaryam provides 
              the tools you need—completely free.
            </p>
            <p className="text-muted-foreground">
              My tools range from simple converters and formatters to advanced encryption and data processing 
              utilities, all designed with the same philosophy: powerful functionality with a clean, intuitive interface.
            </p>
          </div>
        </div>

        {/* Values */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">What I Stand For</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {values.map((value) => (
              <Card key={value.title} className="bg-card/50 border-border">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg bg-muted/50 flex items-center justify-center mb-4 ${value.color}`}>
                    <value.icon className="h-6 w-6" />
                  </div>
                  <CardTitle>{value.title}</CardTitle>
                  <CardDescription>{value.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>

        {/* Author */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">About Kim Galicia</h2>
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <img src="/author-profile.png" alt="Kim Galicia" className="w-32 h-32 rounded-full object-cover flex-shrink-0" />
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold">Kim Galicia</h3>
                <p className="text-primary font-medium">Software / Systems Engineer</p>
                <p className="text-muted-foreground text-sm">Maypangdan, Borongan City, Philippines</p>
              </div>
              <p className="text-muted-foreground">
                Software-oriented Computer Engineering graduate with 3+ years of experience building, operating, and optimizing backend systems on Linux. Strong background in systems programming concepts, networking fundamentals, and cloud infrastructure, with hands-on experience designing reliable, secure, and scalable services. Daily Arch Linux user with deep understanding of OS internals, process management, networking behavior, and production debugging.
              </p>
              <div>
                <h4 className="font-semibold mb-2">Key Skills</h4>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">Linux</span>
                  <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">Backend Systems</span>
                  <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">AWS</span>
                  <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">PostgreSQL</span>
                  <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">Redis</span>
                  <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">Docker</span>
                  <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">Networking</span>
                  <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">System Administration</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="grid lg:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl font-bold mb-4">Get in Touch</h2>
            <p className="text-muted-foreground mb-6">
              Have questions, suggestions, or just want to say hi? I'd love to hear from you.
            </p>
            <div className="space-y-4">
              <a href="mailto:anivaryam.dev@gmail.com" className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors">
                <Mail className="h-5 w-5" />
                anivaryam.dev@gmail.com
              </a>
              <a href="https://github.com/anivaryam" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors">
                <Github className="h-5 w-5" />
                github.com/anivaryam
              </a>
              <a href="https://x.com/anivaryam" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors">
                <XIcon size={20} className="h-5 w-5" />
                @anivaryam
              </a>
              <a href="https://linkedin.com/in/x6galixia" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors">
                <Linkedin className="h-5 w-5" />
                linkedin.com/in/x6galixia
              </a>
              <a href="tel:+639776611597" className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors">
                <Phone className="h-5 w-5" />
                +63 977 661 1597
              </a>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
