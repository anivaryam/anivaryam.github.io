import { Link } from "react-router-dom";
import { Terminal, Github, Mail } from "lucide-react";
import { XIcon } from "@/components/icons/XIcon";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Terminal className="h-5 w-5 text-primary" />
              </div>
              <span className="font-mono font-bold text-lg">
                <span className="text-primary">Anivaryam</span>
              </span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Developer tools made simple. Convert, automate, and build with ease.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-4 text-foreground">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/tools" className="text-muted-foreground hover:text-primary transition-colors">
                  Online Tools
                </Link>
              </li>
              <li>
                <Link to="/downloads" className="text-muted-foreground hover:text-primary transition-colors">
                  Downloads
                </Link>
              </li>
              <li>
                <Link to="/blogs" className="text-muted-foreground hover:text-primary transition-colors">
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold mb-4 text-foreground">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/school-projects" className="text-muted-foreground hover:text-primary transition-colors">
                  School Projects
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-muted-foreground hover:text-primary transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link to="/issues" className="text-muted-foreground hover:text-primary transition-colors">
                  Issues
                </Link>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="font-semibold mb-4 text-foreground">Connect</h4>
            <div className="flex gap-3">
              <a href="https://github.com/anivaryam" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <Github className="h-5 w-5" />
              </a>
              <a href="https://x.com/anivaryam" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <XIcon size={20} className="h-5 w-5" />
              </a>
              <a href="mailto:anivaryam.dev@gmail.com" className="p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Anivaryam. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
