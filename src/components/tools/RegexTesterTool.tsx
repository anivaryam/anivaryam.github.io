import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Copy, Check, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface Match {
  match: string;
  index: number;
  groups: string[];
}

export function RegexTesterTool() {
  const [pattern, setPattern] = useState("");
  const [testString, setTestString] = useState("");
  const [flags, setFlags] = useState({ g: true, i: false, m: false, s: false });
  const [copied, setCopied] = useState(false);

  const flagString = useMemo(() => {
    return Object.entries(flags)
      .filter(([, enabled]) => enabled)
      .map(([flag]) => flag)
      .join("");
  }, [flags]);

  const results = useMemo(() => {
    if (!pattern || !testString) {
      return { matches: [], error: null, highlightedText: testString };
    }

    try {
      const regex = new RegExp(pattern, flagString);
      const matches: Match[] = [];
      let match;

      if (flags.g) {
        while ((match = regex.exec(testString)) !== null) {
          matches.push({
            match: match[0],
            index: match.index,
            groups: match.slice(1),
          });
          if (match[0].length === 0) regex.lastIndex++;
        }
      } else {
        match = regex.exec(testString);
        if (match) {
          matches.push({
            match: match[0],
            index: match.index,
            groups: match.slice(1),
          });
        }
      }

      // Create highlighted text
      let highlightedText = testString;
      if (matches.length > 0) {
        const parts: { text: string; isMatch: boolean }[] = [];
        let lastIndex = 0;
        
        matches.forEach((m) => {
          if (m.index > lastIndex) {
            parts.push({ text: testString.slice(lastIndex, m.index), isMatch: false });
          }
          parts.push({ text: m.match, isMatch: true });
          lastIndex = m.index + m.match.length;
        });
        
        if (lastIndex < testString.length) {
          parts.push({ text: testString.slice(lastIndex), isMatch: false });
        }

        highlightedText = parts
          .map((p) => (p.isMatch ? `<mark>${escapeHtml(p.text)}</mark>` : escapeHtml(p.text)))
          .join("");
      }

      return { matches, error: null, highlightedText };
    } catch (err) {
      return { matches: [], error: (err as Error).message, highlightedText: testString };
    }
  }, [pattern, testString, flagString, flags.g]);

  const handleCopy = async () => {
    if (!pattern) return;

    try {
      await navigator.clipboard.writeText(`/${pattern}/${flagString}`);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Regex pattern copied to clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleClear = () => {
    setPattern("");
    setTestString("");
  };

  return (
    <div className="space-y-4">
      {/* Pattern Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-muted-foreground">
            Regular Expression
          </label>
          <div className="flex gap-2">
            <Button onClick={handleCopy} variant="ghost" size="sm" disabled={!pattern}>
              {copied ? (
                <>
                  <Check className="mr-1 h-3 w-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3 w-3" />
                  Copy
                </>
              )}
            </Button>
            <Button onClick={handleClear} variant="ghost" size="sm">
              <Trash2 className="mr-1 h-3 w-3" />
              Clear
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground font-mono">/</span>
          <Input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="Enter regex pattern..."
            className="font-mono bg-background/50"
          />
          <span className="text-muted-foreground font-mono">/</span>
          <span className="text-primary font-mono w-12">{flagString}</span>
        </div>
      </div>

      {/* Flags */}
      <div className="flex flex-wrap gap-4">
        {[
          { key: "g", label: "Global", desc: "Find all matches" },
          { key: "i", label: "Case Insensitive", desc: "Ignore case" },
          { key: "m", label: "Multiline", desc: "^ and $ match line starts/ends" },
          { key: "s", label: "Dotall", desc: ". matches newlines" },
        ].map(({ key, label, desc }) => (
          <div key={key} className="flex items-center gap-2">
            <Checkbox
              id={`flag-${key}`}
              checked={flags[key as keyof typeof flags]}
              onCheckedChange={(checked) =>
                setFlags((prev) => ({ ...prev, [key]: checked === true }))
              }
            />
            <Label htmlFor={`flag-${key}`} className="text-sm cursor-pointer">
              <span className="font-mono text-primary">{key}</span> - {label}
              <span className="text-muted-foreground text-xs ml-1">({desc})</span>
            </Label>
          </div>
        ))}
      </div>

      {/* Error Display */}
      {results.error && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-md">
          <p className="text-sm text-destructive font-mono">{results.error}</p>
        </div>
      )}

      {/* Test String */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Test String</label>
          <Textarea
            value={testString}
            onChange={(e) => setTestString(e.target.value)}
            placeholder="Enter text to test against..."
            className="min-h-[200px] font-mono text-sm bg-background/50"
            data-lenisignore
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Matches ({results.matches.length})
          </label>
          <div
            className="min-h-[200px] p-4 bg-background/50 border border-border rounded-md overflow-auto text-sm font-mono whitespace-pre-wrap" data-lenisignore
            dangerouslySetInnerHTML={{
              __html: results.highlightedText || "Matches will be highlighted here...",
            }}
            style={{
              ["--tw-prose-mark-bg" as string]: "hsl(var(--primary) / 0.3)",
            }}
          />
        </div>
      </div>

      {/* Match Details */}
      {results.matches.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Match Details</label>
          <div className="bg-background/50 border border-border rounded-md p-4 max-h-[200px] overflow-auto" data-lenisignore>
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">Match</th>
                  <th className="text-left p-2">Index</th>
                  <th className="text-left p-2">Groups</th>
                </tr>
              </thead>
              <tbody>
                {results.matches.map((m, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="p-2 text-muted-foreground">{i + 1}</td>
                    <td className="p-2 text-primary">{m.match}</td>
                    <td className="p-2">{m.index}</td>
                    <td className="p-2 text-muted-foreground">
                      {m.groups.length > 0 ? m.groups.join(", ") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
