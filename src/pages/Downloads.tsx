import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Terminal, Database, Server, Check, Monitor, Laptop, AppWindow } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Platform detection utility
type Platform = "windows" | "macos" | "linux" | "unknown";

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "unknown";
  
  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform.toLowerCase();
  
  if (userAgent.includes("win") || platform.includes("win")) return "windows";
  if (userAgent.includes("mac") || platform.includes("mac")) return "macos";
  if (userAgent.includes("linux") || platform.includes("linux")) return "linux";
  
  return "unknown";
}

const platformIcons = {
  windows: AppWindow, // Generic window icon for Windows
  macos: Laptop, // Laptop icon for macOS
  linux: Terminal, // Terminal icon for Linux
  unknown: Monitor,
};

const platformLabels = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  unknown: "Unknown",
};

interface DownloadOption {
  platform: Platform;
  url: string;
  filename: string;
  size: string;
}

interface Tool {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  version: string;
  platform: string; // Display string
  availablePlatforms: Platform[]; // Actual available platforms
  downloads: DownloadOption[];
  features: string[];
  color: string;
}

const tools: Tool[] = [
  {
    id: "microsoft-script",
    title: "Microsoft Script",
    description: "A collection of powerful automation scripts for Windows machines. Automate repetitive tasks, manage files, and streamline your workflow.",
    icon: Terminal,
    version: "1.0.0",
    platform: "Windows",
    availablePlatforms: ["windows"],
    downloads: [
      {
        platform: "windows",
        url: "/downloads/ms-scripts-1.0.0.zip",
        filename: "ms-scripts-1.0.0.zip",
        size: "36 KB",
      },
    ],
    features: [
      "File batch operations",
      "System cleanup utilities",
      "Registry management",
      "Task scheduling helpers",
      "Network diagnostics",
    ],
    color: "text-secondary",
  },
  {
    id: "pern-script-setup",
    title: "PERN Script Setup",
    description: "Complete setup wizard for PERN stack projects. Automatically configures PostgreSQL, Express, React, and Node.js with best practices.",
    icon: Server,
    version: "1.0.0",
    platform: "Cross-platform",
    availablePlatforms: ["windows", "macos", "linux"],
    downloads: [
      {
        platform: "windows",
        url: "/downloads/pern-setup-1.0.0.zip",
        filename: "pern-setup-1.0.0.zip",
        size: "227 KB",
      },
      {
        platform: "macos",
        url: "/downloads/pern-setup-1.0.0.zip",
        filename: "pern-setup-1.0.0.zip",
        size: "227 KB",
      },
      {
        platform: "linux",
        url: "/downloads/pern-setup-1.0.0.zip",
        filename: "pern-setup-1.0.0.zip",
        size: "227 KB",
      },
    ],
    features: [
      "One-command project setup",
      "Pre-configured ESLint & Prettier",
      "Docker compose templates",
      "Database migration scripts",
      "API boilerplate code",
    ],
    color: "text-primary",
  },
  {
    id: "psql-manager",
    title: "PSQL Manager",
    description: "A visual PostgreSQL database manager. Browse tables, run queries, and visualize your database structure with an intuitive interface.",
    icon: Database,
    version: "1.0.0",
    platform: "Linux",
    availablePlatforms: ["linux"],
    downloads: [
      {
        platform: "linux",
        url: "https://github.com/rosettascript/db-manager/releases/download/v1.0.0/DBManager-1.0.0.AppImage",
        filename: "DBManager-1.0.0.AppImage",
        size: "137 MB",
      },
    ],
    features: [
      "Visual schema designer",
      "Query editor with syntax highlighting",
      "Data export (CSV, JSON, SQL)",
      "Connection manager",
      "Performance monitoring",
    ],
    color: "text-accent",
  },
];

export default function Downloads() {
  const [userPlatform, setUserPlatform] = useState<Platform>("unknown");

  useEffect(() => {
    setUserPlatform(detectPlatform());
  }, []);

  const handleDownload = (download: DownloadOption, toolTitle: string) => {
    // Create a temporary anchor element to trigger download
    const link = document.createElement("a");
    link.href = download.url;
    link.download = download.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Download Started",
      description: `${toolTitle} (${platformLabels[download.platform]}) is being downloaded...`,
    });
  };

  const getRecommendedDownload = (tool: Tool): DownloadOption | null => {
    // If user's platform is available, recommend it
    if (tool.availablePlatforms.includes(userPlatform)) {
      return tool.downloads.find(d => d.platform === userPlatform) || null;
    }
    // Otherwise, return the first available download
    return tool.downloads[0] || null;
  };

  return (
    <Layout>
      <SEO
        title="Free Downloads & Scripts"
        description="Downloadable scripts and utilities for Windows, PERN setup, and more. Free developer tools including Microsoft Script and PostgreSQL Manager."
        canonical="https://rosettascript.github.io/downloads"
        structuredData={{
          type: "WebPage",
        }}
        breadcrumbs={[
          { name: "Home", url: "https://rosettascript.github.io/" },
          { name: "Downloads", url: "https://rosettascript.github.io/downloads" },
        ]}
      />
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 text-secondary text-sm font-mono mb-4">
            <Download className="h-4 w-4" />
            Downloadable Tools
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">
            Developer Tools & Scripts
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Download my collection of productivity tools. Each tool is designed to help 
            you work more efficiently and focus on what matters.
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {tools.map((tool) => {
            const recommendedDownload = getRecommendedDownload(tool);
            const hasMultiplePlatforms = tool.downloads.length > 1;
            const userPlatformAvailable = tool.availablePlatforms.includes(userPlatform);

            return (
              <Card key={tool.id} className="bg-card/50 border-border hover:border-primary/30 transition-all flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-lg bg-muted/50 ${tool.color}`}>
                      <tool.icon className="h-8 w-8" />
                    </div>
                    <Badge variant="secondary" className="font-mono">
                      v{tool.version}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl">{tool.title}</CardTitle>
                  <CardDescription className="text-sm">
                    {tool.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="space-y-3 flex-1">
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Platform:</span> {tool.platform}
                    </div>
                    {recommendedDownload && (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Size:</span> {recommendedDownload.size}
                      </div>
                    )}
                    {userPlatformAvailable && userPlatform !== "unknown" && (
                      <div className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">
                        ✓ Available for your platform ({platformLabels[userPlatform]})
                      </div>
                    )}
                    <div className="space-y-2">
                      <span className="text-sm font-medium">Features:</span>
                      <ul className="space-y-1">
                        {tool.features.map((feature) => (
                          <li key={feature} className="text-sm text-muted-foreground flex items-start gap-2">
                            <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  
                  {/* Download Button(s) */}
                  <div className="mt-6 space-y-2">
                    {hasMultiplePlatforms ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button className="w-full">
                            <Download className="mr-2 h-4 w-4" />
                            {recommendedDownload && userPlatformAvailable
                              ? `Download for ${platformLabels[userPlatform]}`
                              : "Download"}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          {tool.downloads.map((download) => {
                            const Icon = platformIcons[download.platform];
                            return (
                              <DropdownMenuItem
                                key={download.platform}
                                onClick={() => handleDownload(download, tool.title)}
                                className="cursor-pointer"
                              >
                                <Icon className="mr-2 h-4 w-4" />
                                <span>{platformLabels[download.platform]}</span>
                                <span className="ml-auto text-xs text-muted-foreground">
                                  {download.size}
                                </span>
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      recommendedDownload && (
                        <Button
                          className="w-full"
                          onClick={() => handleDownload(recommendedDownload, tool.title)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* System Requirements */}
        <div className="mt-16 terminal-bg p-8">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            System Requirements
          </h2>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div>
              <h3 className="font-semibold mb-2 text-secondary">Microsoft Script</h3>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Windows 10 or later</li>
                <li>• PowerShell 5.1+</li>
                <li>• 50 MB free disk space</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-primary">PERN Script Setup</h3>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Node.js 18+</li>
                <li>• npm or yarn</li>
                <li>• PostgreSQL 14+</li>
                <li>• Windows, macOS, or Linux</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-accent">PSQL Manager</h3>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Linux (Windows & macOS coming soon)</li>
                <li>• 4 GB RAM minimum</li>
                <li>• 150 MB free disk space</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
