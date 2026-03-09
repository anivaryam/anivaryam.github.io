import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, Sparkles, ArrowRight } from "lucide-react";
import { BUILD_VERSION } from "@/config/version";

const STORAGE_KEY = "anivaryam_last_seen_version";
const DISMISSED_KEY = `anivaryam_dismissed_${BUILD_VERSION}`;

const PATCH_NOTES = {
  "0.0.3": {
    version: "heading-hierarchy-preview",
    bugFixes: [],
    newFeatures: [
      "Added visual heading hierarchy indicators to the Word-to-HTML converter preview",
    ]
  }
};

export function UpdateNotification() {
  const [showNotification, setShowNotification] = useState(false);
  const [patchVersion, setPatchVersion] = useState<string | null>(null);

  useEffect(() => {
    // Check if user has seen this version
    const lastSeenVersion = localStorage.getItem(STORAGE_KEY);
    const dismissed = localStorage.getItem(DISMISSED_KEY);

    // Show notification if:
    // 1. User hasn't seen this version yet, OR
    // 2. The version has changed since last visit
    if (lastSeenVersion !== BUILD_VERSION && !dismissed) {
      setShowNotification(true);
      // Find the patch notes for current version
      if (PATCH_NOTES[BUILD_VERSION as keyof typeof PATCH_NOTES]) {
        setPatchVersion(BUILD_VERSION);
      }
    }

    // Update last seen version
    localStorage.setItem(STORAGE_KEY, BUILD_VERSION);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setShowNotification(false);
  };

  const patchNotes = patchVersion ? PATCH_NOTES[patchVersion as keyof typeof PATCH_NOTES] : null;

  return (
    <Dialog open={showNotification} onOpenChange={setShowNotification}>
      <DialogContent className="max-w-2xl border-primary/50 bg-background">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <RefreshCw className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle className="text-xl font-semibold">
              New Update Available - Patch {patchVersion || BUILD_VERSION}
            </DialogTitle>
          </div>
          <DialogDescription className="text-base">
            Hard refresh this page (Ctrl+Shift+R or Cmd+Shift+R) to see the latest changes.
          </DialogDescription>
        </DialogHeader>

        {patchNotes && (
          <div className="space-y-4 py-4">
            {/* Bug Fixes Section */}
            {patchNotes.bugFixes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Bug Fixes</span>
                </div>
                <ul className="space-y-1.5 ml-6 list-disc text-sm text-muted-foreground">
                  {patchNotes.bugFixes.map((fix, index) => (
                    <li key={index}>{fix}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* New Features Section */}
            {patchNotes.newFeatures.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>New Features</span>
                </div>
                <ul className="space-y-1.5 ml-6 list-disc text-sm text-muted-foreground">
                  {patchNotes.newFeatures.map((feature, index) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between items-center gap-2 pt-4 border-t">
          {patchNotes && (
            <Button
              variant="ghost"
              asChild
              className="text-primary hover:text-primary"
            >
              <Link to={`/news/${patchNotes.version}`} onClick={handleDismiss}>
                Read Full Release Notes
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleDismiss}
            className="border-primary/50 ml-auto"
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

