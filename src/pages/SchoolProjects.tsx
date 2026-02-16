import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Download, Cpu, Waves, Clipboard } from "lucide-react";

const projects = [
  {
    id: "logic-gates-calculator",
    title: "Logic Gates Calculator - Proteus",
    description: "4-bit calculator implementation using logic gates in Proteus. Available in two versions: with memory and without memory.",
    category: "Electronics",
    difficulty: "Intermediate",
    technologies: ["Proteus", "Logic Gates", "Digital Circuits"],
    icon: Cpu,
    color: "text-primary",
    downloads: [
      {
        name: "With Memory",
        file: "/downloads/4-Bit Calculator-w-memory.pdsprj",
      },
      {
        name: "Without Memory",
        file: "/downloads/4-Bit Calculator-without-memory.pdsprj",
      },
    ],
  },
  {
    id: "audio-bandpass-filter",
    title: "Audio Bandpass Filter - Matlab",
    description: "Matlab implementation of an audio bandpass filter for signal processing applications.",
    category: "Signal Processing",
    difficulty: "Intermediate",
    technologies: ["Matlab", "Signal Processing", "Audio Filtering"],
    icon: Waves,
    color: "text-secondary",
    downloads: [
      {
        name: "Matlab Script",
        file: "/downloads/audio_bandpass_filter.m",
      },
    ],
  },
  {
    id: "copy-paste-listener",
    title: "Copy Paste Listener - Python",
    description: "Windows utility tool built with Python that monitors clipboard activity. Useful for tracking copy-paste operations.",
    category: "Utility",
    difficulty: "Beginner",
    technologies: ["Python", "Windows", "Clipboard"],
    icon: Clipboard,
    color: "text-accent",
    downloads: [
      {
        name: "Windows Executable",
        file: "/downloads/copy-paste-listener.exe",
      },
    ],
  },
];

export default function SchoolProjects() {
  const handleDownload = (file: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = file;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Layout>
      <SEO
        title="School Projects"
        description="Ready-to-use project templates for students. Logic gates calculator, audio bandpass filter, and other educational projects with source code."
        canonical="https://rosettascript.github.io/school-projects"
        structuredData={{
          type: "WebPage",
        }}
        breadcrumbs={[
          { name: "Home", url: "https://rosettascript.github.io/" },
          { name: "School Projects", url: "https://rosettascript.github.io/school-projects" },
        ]}
      />
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--syntax-orange))]/10 text-[hsl(var(--syntax-orange))] text-sm font-mono mb-4">
            <GraduationCap className="h-4 w-4" />
            School Projects
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold mb-4">
            Project Templates for Students
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Ready-to-use project templates for your school assignments. Each template includes 
            documentation, source code, and setup instructions.
          </p>
        </div>


        {/* Projects Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Card key={project.id} className="bg-card/50 border-border hover:border-primary/30 transition-all flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <div className={`p-2 rounded-lg bg-muted/50 ${project.color}`}>
                    <project.icon className="h-6 w-6" />
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      project.difficulty === "Beginner"
                        ? "border-primary/50 text-primary"
                        : project.difficulty === "Intermediate"
                        ? "border-secondary/50 text-secondary"
                        : "border-accent/50 text-accent-foreground"
                    }
                  >
                    {project.difficulty}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{project.title}</CardTitle>
                <CardDescription className="text-sm">
                  {project.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="space-y-3 flex-1">
                  <Badge variant="secondary" className="text-xs">
                    {project.category}
                  </Badge>
                  <div className="flex flex-wrap gap-1">
                    {project.technologies.map((tech) => (
                      <span
                        key={tech}
                        className="text-xs px-2 py-1 bg-muted/50 rounded text-muted-foreground"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 mt-4">
                  {project.downloads.map((download, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="w-full"
                      onClick={() => handleDownload(download.file, download.name)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download {download.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-16 terminal-bg p-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-[hsl(var(--syntax-orange))]" />
            How to Use These Templates
          </h2>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div>
              <h3 className="font-semibold mb-2 text-primary">1. Download</h3>
              <p className="text-muted-foreground">
                Click the download button to get the project template as a ZIP file.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-secondary">2. Extract & Read</h3>
              <p className="text-muted-foreground">
                Extract the files and read the README for setup instructions.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-accent">3. Customize</h3>
              <p className="text-muted-foreground">
                Modify the code to fit your requirements and make it your own.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
