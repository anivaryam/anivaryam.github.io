import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Terminal, Github, Bug, AlertCircle, Lightbulb, ExternalLink } from "lucide-react";

const issueTypes = [
  {
    icon: Bug,
    title: "Report a Bug",
    description: "Found something that's not working as expected? Let me know so I can fix it.",
    color: "text-destructive",
    action: "Report Bug",
  },
  {
    icon: Lightbulb,
    title: "Feature Request",
    description: "Have an idea for a new tool or feature? I'd love to hear your suggestions.",
    color: "text-primary",
    action: "Request Feature",
  },
  {
    icon: AlertCircle,
    title: "General Issue",
    description: "Something else on your mind? Open a general issue to discuss.",
    color: "text-secondary",
    action: "Open Issue",
  },
];

export default function Issues() {
  const githubIssuesUrl = "https://github.com/anivaryam/anivaryam.github.io/issues";

  return (
    <Layout>
      <SEO
        title="Report Issues & Share Feedback"
        description="Report bugs, request features, and share feedback for Anivaryam. Help me improve my developer tools through GitHub Issues."
        canonical="https://anivaryam.github.io/issues"
        structuredData={{
          type: "WebPage",
        }}
        breadcrumbs={[
          { name: "Home", url: "https://anivaryam.github.io/" },
          { name: "Issues", url: "https://anivaryam.github.io/issues" },
        ]}
      />
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-mono mb-4">
            <Terminal className="h-4 w-4" />
            Issues & Feedback
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">
            Report Issues & Share Feedback
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Your feedback helps me improve Anivaryam. Whether you've found a bug, have a feature request, 
            or just want to share your thoughts, I'm here to listen.
          </p>
        </div>

        {/* Issue Types */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {issueTypes.map((type) => (
            <Card key={type.title} className="bg-card/50 border-border">
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg bg-muted/50 flex items-center justify-center mb-4 ${type.color}`}>
                  <type.icon className="h-6 w-6" />
                </div>
                <CardTitle>{type.title}</CardTitle>
                <CardDescription>{type.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  asChild
                  variant="outline"
                  className="w-full"
                >
                  <a
                    href={githubIssuesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    {type.action}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* GitHub Issues Section */}
        <div className="terminal-bg p-8 mb-16">
          <div className="flex items-center gap-2 pb-4 mb-6 border-b border-border">
            <div className="w-3 h-3 rounded-full bg-destructive/80" />
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--syntax-yellow))]/80" />
            <div className="w-3 h-3 rounded-full bg-primary/80" />
            <span className="ml-2 text-sm text-muted-foreground font-mono">issues.md</span>
          </div>
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">GitHub Issues</h2>
            <p className="text-muted-foreground">
              I use GitHub Issues to track bugs, feature requests, and other discussions. This helps me 
              organize feedback and collaborate with the community effectively.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <Button
                asChild
                size="lg"
                className="flex items-center gap-2"
              >
                <a
                  href={githubIssuesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="h-5 w-5" />
                  View All Issues
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="flex items-center gap-2"
              >
                <a
                  href={`${githubIssuesUrl}/new`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <AlertCircle className="h-5 w-5" />
                  Create New Issue
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>

        {/* Guidelines */}
        <Card className="bg-card/50 border-border">
          <CardHeader>
            <CardTitle>Before You Submit</CardTitle>
            <CardDescription>Help me help you by following these guidelines</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="text-primary mt-1">•</span>
                <span>
                  <strong className="text-foreground">Search existing issues</strong> to see if your issue has already been reported
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary mt-1">•</span>
                <span>
                  <strong className="text-foreground">Provide clear details</strong> about the issue, including steps to reproduce if it's a bug
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary mt-1">•</span>
                <span>
                  <strong className="text-foreground">Include relevant information</strong> such as browser version, OS, and any error messages
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary mt-1">•</span>
                <span>
                  <strong className="text-foreground">Be respectful</strong> and constructive in your feedback
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

