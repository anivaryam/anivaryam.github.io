import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Terminal,
  Github,
  Linkedin,
  Mail,
  MapPin,
  ExternalLink,
  Code2,
  Server,
  Database,
  Layers,
  Cpu,
  ArrowRight,
  Globe,
  Lock,
  Network,
  Package,
} from "lucide-react";
import { XIcon } from "@/components/icons/XIcon";

const projects = {
  oss: [
    {
      name: "tunnel",
      description:
        "Self-hosted ngrok alternative — expose local services to the internet via a relay. Named tunnels, path/subdomain routing, HTTP/TCP/UDP, request inspector, Cloudflare Worker integration, signed releases.",
      tech: ["Go", "WebSocket", "Cloudflare Workers", "HTTP/TCP/UDP"],
      icon: Network,
      github: "https://github.com/anivaryam/tunnel",
    },
    {
      name: "proc-compose",
      description:
        "Local process orchestrator for dev stacks and single-container deploys. YAML-defined services, systemd user units, readiness probes (http/tcp/log), auto-restart, TUI monitor, Railway/Render/Fly.io compatible.",
      tech: ["Go", "systemd", "YAML", "TUI"],
      icon: Layers,
      github: "https://github.com/anivaryam/proc-compose",
    },
    {
      name: "env-vault",
      description:
        "Encrypted .env file manager with AEAD + Argon2id KDF. Seal/open .env files, single-value access, diff checking, CI-friendly via ENV_VAULT_KEY env var.",
      tech: ["Go", "Argon2id", "HMAC-SHA256", "AEAD"],
      icon: Lock,
      github: "https://github.com/anivaryam/env-vault",
    },
    {
      name: "merge-port",
      description:
        "Local reverse proxy that merges a client dev server and API server into a single port — no CORS, no proxy config. Simple, route, and discovery modes with WebSocket pass-through.",
      tech: ["Go", "HTTP", "WebSocket", "TCP"],
      icon: Network,
      github: "https://github.com/anivaryam/merge-port",
    },
    {
      name: "brokit",
      description:
        "Package manager for the anivaryam tool family. Install, update, and manage env-vault, tunnel, merge-port, proc-compose, proxy-relay — all from a single command across Linux/macOS/Windows.",
      tech: ["Go", "GitHub Releases API", "Cross-platform"],
      icon: Package,
      github: "https://github.com/anivaryam/brokit",
    },
    {
      name: "proxy-relay",
      description:
        "Lightweight authenticated SOCKS5 + HTTP CONNECT proxy for cross-region traffic routing. Single port, token auth, protocol auto-detection, Railway-deployable.",
      tech: ["Go", "SOCKS5", "HTTP CONNECT", "Docker"],
      icon: Globe,
      github: "https://github.com/anivaryam/proxy-relay",
    },
  ],
  apps: [
    {
      name: "deck",
      description:
        "Terminal-aesthetic web frontend for the Claude Agent SDK. Real Fastify backend, WebSocket streaming, live Claude sessions with token auth. The app you may be reading this on.",
      tech: ["React 19", "TanStack Router", "Fastify", "SQLite", "Claude SDK", "Tailwind v4"],
      icon: Terminal,
    },
    {
      name: "litter-box",
      description:
        "Drop any HTML into a sandboxed iframe and it renders — up to 4 panels at once. Exports ESM, CJS, React binding, and global script. Available on npm.",
      tech: ["TypeScript", "Web Components", "Shadow DOM", "Vitest", "Playwright"],
      icon: Code2,
      github: "https://github.com/anivaryam/litter-box",
    },
    {
      name: "lowband-call",
      description:
        "Messenger-style group video app for up to 4 people, built for slow internet. 250 kbps video preset, audio-only mode, screen sharing, PiP, DataChannel text chat — pure P2P WebRTC.",
      tech: ["WebRTC", "WebSocket", "Node.js", "DataChannel"],
      icon: Globe,
    },
    {
      name: "HR Management System",
      description:
        "Full-stack HR platform: attendance, leave, overtime, payroll, benefits, ID cards, reports, multi-level approvals. Express API + React SPA + Flutter kiosk tablet app, deployed on Railway + Supabase.",
      tech: ["Express", "TypeScript", "React", "Vite", "Flutter", "PostgreSQL", "Supabase", "JWT"],
      icon: Layers,
    },
    {
      name: "Municipality Centralized System",
      description:
        "Digital governance platform for a municipality — population registry with PostgreSQL + PostGIS, Auth.js MFA, Redis, MinIO, Drizzle ORM. Least-privilege RLS, Testcontainers for integration tests.",
      tech: ["Next.js", "PostgreSQL", "PostGIS", "Auth.js", "Drizzle", "Redis", "MinIO"],
      icon: Server,
    },
    {
      name: "AI Visibility Check",
      description:
        "Keyword intelligence platform for tracking brand/content visibility across AI search models. React + Vite frontend, Express API, OpenAI GPT-4o, PostgreSQL.",
      tech: ["React", "Vite", "Express", "TypeScript", "OpenAI", "PostgreSQL", "Bun"],
      icon: Cpu,
    },
  ],
};

const skills = [
  {
    category: "Frontend",
    icon: Code2,
    items: ["TypeScript", "React 18/19", "Next.js 14/15", "Vite", "Tailwind CSS", "shadcn/ui", "TanStack Query", "react-hook-form", "Zod"],
  },
  {
    category: "Backend",
    icon: Server,
    items: ["Node.js", "Express", "Fastify", "Go", "REST APIs", "WebSocket", "WebRTC", "Inngest"],
  },
  {
    category: "Data",
    icon: Database,
    items: ["PostgreSQL", "Supabase", "PostGIS", "Redis", "SQLite", "Drizzle ORM", "Prisma", "RLS"],
  },
  {
    category: "Infrastructure",
    icon: Layers,
    items: ["Linux", "Docker", "AWS", "Railway", "Vercel", "systemd", "Cloudflare Workers", "MinIO"],
  },
  {
    category: "AI / ML",
    icon: Cpu,
    items: ["Anthropic Claude SDK", "OpenAI GPT-4o", "HuggingFace Transformers", "MCP", "Agent orchestration"],
  },
  {
    category: "Testing & Tooling",
    icon: Terminal,
    items: ["Vitest", "Playwright", "Supertest", "Testcontainers", "GitHub Actions", "cosign"],
  },
];

const experience = [
  {
    role: "Automation & Backend Developer",
    company: "QCK",
    period: "Sep 2025 – May 2026",
    note: "US-based e-commerce SEO & dev agency (fully remote)",
    highlights: [
      "Built qckbot — AI-powered in-dashboard assistant for SEO workflows",
      "Multi-tenant SEO + content dashboard with Inngest jobs, OpenTelemetry, and per-tenant rate limiting",
      "Draft generation pipeline, Google Docs/Sheets integration, competitor discovery",
    ],
  },
  {
    role: "Founder / Software Engineer",
    company: "apphorialabs / cg3tech",
    period: "2023 – Present",
    note: "Software labs & engineering services (self-owned)",
    highlights: [
      "Built and maintain a suite of open-source Go CLI tools (tunnel, proc-compose, env-vault, merge-port, brokit)",
      "Developed full-stack systems for government, HR, and AI visibility use cases",
      "Self-hosted infra: proc-compose + tunnel relay at systems.apphorialabs.com",
    ],
  },
  {
    role: "Software Developer Intern",
    company: "DOST Philippines",
    period: "Jun – Aug 2024",
    note: "Department of Science and Technology",
    highlights: [
      "Software development internship at a national government agency",
    ],
  },
];

export default function Portfolio() {
  return (
    <Layout>
      <SEO
        title="Kim Galicia — Software & Systems Engineer"
        description="Portfolio of Kim Galicia — software and systems engineer from the Philippines. Go, TypeScript, React, PostgreSQL, Linux. Builder of open-source tools and full-stack systems."
        canonical="https://anivaryam.github.io/portfolio"
        structuredData={{ type: "WebPage" }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none" />
        <div className="container mx-auto px-4 py-20 lg:py-32 relative z-10">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-mono">
              <Terminal className="h-4 w-4" />
              Available for work
            </div>
            <h1 className="text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
              Kim Galicia
            </h1>
            <p className="text-xl text-primary font-medium font-mono">
              Software &amp; Systems Engineer
            </p>
            <p className="text-lg text-muted-foreground max-w-2xl">
              I build backend systems, developer tooling, and full-stack applications — mostly in Go and TypeScript. Based in Pasig City, Metro Manila. BS Computer Engineering graduate with a focus on reliability, security, and clean architecture.
            </p>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              Pasig City, Metro Manila, Philippines (UTC+8)
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild size="lg">
                <a href="#projects">
                  View Projects
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="https://github.com/anivaryam" target="_blank" rel="noopener noreferrer">
                  <Github className="mr-2 h-4 w-4" />
                  GitHub
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="https://linkedin.com/in/x6galixia" target="_blank" rel="noopener noreferrer">
                  <Linkedin className="mr-2 h-4 w-4" />
                  LinkedIn
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="mailto:anivaryam.dev@gmail.com">
                  <Mail className="mr-2 h-4 w-4" />
                  Email
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-20 border-b border-border">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-3 gap-12 items-start">
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h2 className="text-3xl font-bold mb-6">About</h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>
                    Software-oriented Computer Engineering graduate with 3+ years of experience building, operating, and optimizing backend systems on Linux. Strong background in systems programming, networking fundamentals, and cloud infrastructure — with hands-on experience designing reliable, secure, and scalable services.
                  </p>
                  <p>
                    Daily Arch Linux user with deep understanding of OS internals, process management, networking behavior, and production debugging. I lean toward simplicity, end-to-end ownership, and documenting for operators.
                  </p>
                  <p>
                    Outside of client and employer work, I run <span className="text-foreground font-medium">apphorialabs</span> (software labs / OSS umbrella) and <span className="text-foreground font-medium">cg3tech</span> (software & systems engineering services), where I build and ship open-source tooling under <a href="https://github.com/anivaryam" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">github.com/anivaryam</a>.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Experience</h3>
                <div className="space-y-6">
                  {experience.map((job) => (
                    <div key={job.company} className="flex gap-4">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <div>
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-semibold">{job.role}</span>
                          <span className="text-primary font-medium">@ {job.company}</span>
                        </div>
                        <div className="text-sm text-muted-foreground mb-2">
                          {job.period} · {job.note}
                        </div>
                        <ul className="space-y-1">
                          {job.highlights.map((h) => (
                            <li key={h} className="text-sm text-muted-foreground flex gap-2">
                              <span className="text-primary mt-1 flex-shrink-0">›</span>
                              {h}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex flex-col items-center lg:items-start gap-4">
                <img
                  src="/author-profile.png"
                  alt="Kim Galicia"
                  className="w-36 h-36 rounded-2xl object-cover border-2 border-border"
                />
                <div>
                  <p className="font-semibold text-lg">Kim Galicia</p>
                  <p className="text-primary text-sm font-mono">Software & Systems Engineer</p>
                  <p className="text-muted-foreground text-sm mt-1">BS Computer Engineering<br />Eastern Samar State University, 2021–2025</p>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wider">Links</p>
                <div className="space-y-2">
                  <a href="https://github.com/anivaryam" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                    <Github className="h-4 w-4" />
                    github.com/anivaryam
                  </a>
                  <a href="https://linkedin.com/in/x6galixia" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                    <Linkedin className="h-4 w-4" />
                    linkedin.com/in/x6galixia
                  </a>
                  <a href="https://x.com/anivaryam" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                    <XIcon size={16} className="h-4 w-4" />
                    @anivaryam
                  </a>
                  <a href="mailto:anivaryam.dev@gmail.com" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                    <Mail className="h-4 w-4" />
                    anivaryam.dev@gmail.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Projects */}
      <section id="projects" className="py-20 border-b border-border">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-2">Projects</h2>
          <p className="text-muted-foreground mb-12">Open-source tools and applications I've built.</p>

          {/* OSS Tools */}
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <Terminal className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-semibold">Open-Source CLI Tools</h3>
              <Badge variant="secondary" className="font-mono text-xs">Go</Badge>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.oss.map((project) => (
                <Card key={project.name} className="bg-card/50 border-border hover:border-primary/40 transition-all group flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors w-fit">
                        <project.icon className="h-5 w-5 text-primary" />
                      </div>
                      {project.github && (
                        <a
                          href={project.github}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={`${project.name} on GitHub`}
                        >
                          <Github className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                    <CardTitle className="text-base font-mono group-hover:text-primary transition-colors">
                      {project.name}
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      {project.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 mt-auto">
                    <div className="flex flex-wrap gap-1">
                      {project.tech.map((t) => (
                        <Badge key={t} variant="outline" className="text-xs font-mono">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-4">
              <Button asChild variant="outline" size="sm">
                <a href="https://github.com/anivaryam" target="_blank" rel="noopener noreferrer">
                  <Github className="mr-2 h-4 w-4" />
                  All repos on GitHub
                  <ExternalLink className="ml-2 h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>

          {/* Apps */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Layers className="h-5 w-5 text-secondary" />
              <h3 className="text-xl font-semibold">Applications & Systems</h3>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.apps.map((project) => (
                <Card key={project.name} className="bg-card/50 border-border hover:border-secondary/40 transition-all group flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="p-2 rounded-lg bg-secondary/10 group-hover:bg-secondary/20 transition-colors w-fit">
                        <project.icon className="h-5 w-5 text-secondary" />
                      </div>
                      {project.github && (
                        <a
                          href={project.github}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={`${project.name} on GitHub`}
                        >
                          <Github className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                    <CardTitle className="text-base group-hover:text-secondary transition-colors">
                      {project.name}
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      {project.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 mt-auto">
                    <div className="flex flex-wrap gap-1">
                      {project.tech.map((t) => (
                        <Badge key={t} variant="outline" className="text-xs font-mono">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Skills */}
      <section id="skills" className="py-20 border-b border-border">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-2">Skills</h2>
          <p className="text-muted-foreground mb-12">Technologies I work with regularly.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {skills.map((group) => (
              <div key={group.category} className="p-5 bg-card/50 rounded-lg border border-border hover:border-primary/30 transition-all">
                <div className="flex items-center gap-2 mb-4">
                  <group.icon className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">{group.category}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <Badge key={item} variant="secondary" className="text-xs">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold mb-2">Get in Touch</h2>
            <p className="text-muted-foreground mb-8">
              Open to freelance contracts, full-time remote roles, and interesting collaborations. Reach out via email or any of the links below.
            </p>
            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              <a
                href="mailto:anivaryam.dev@gmail.com"
                className="flex items-center gap-3 p-4 bg-card/50 rounded-lg border border-border hover:border-primary/50 transition-all group"
              >
                <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-xs text-muted-foreground">anivaryam.dev@gmail.com</p>
                </div>
              </a>
              <a
                href="https://github.com/anivaryam"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-card/50 rounded-lg border border-border hover:border-primary/50 transition-all group"
              >
                <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                  <Github className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">GitHub</p>
                  <p className="text-xs text-muted-foreground">github.com/anivaryam</p>
                </div>
              </a>
              <a
                href="https://linkedin.com/in/x6galixia"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-card/50 rounded-lg border border-border hover:border-primary/50 transition-all group"
              >
                <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                  <Linkedin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">LinkedIn</p>
                  <p className="text-xs text-muted-foreground">linkedin.com/in/x6galixia</p>
                </div>
              </a>
              <a
                href="https://x.com/anivaryam"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-card/50 rounded-lg border border-border hover:border-primary/50 transition-all group"
              >
                <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                  <XIcon size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">X (Twitter)</p>
                  <p className="text-xs text-muted-foreground">@anivaryam</p>
                </div>
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              Also check out my{" "}
              <Link to="/tools" className="text-primary hover:underline">free developer tools</Link>
              {" "}at this same domain.
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
}
