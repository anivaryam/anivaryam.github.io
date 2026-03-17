import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Copy, Check, Trash2, GitCompare } from "lucide-react";
import { diffChars, diffWords, diffLines } from "diff";

type DiffMode = "chars" | "words" | "lines";

export function TextDiffTool() {
  const [text1, setText1] = useState("");
  const [text2, setText2] = useState("");
  const [diffMode, setDiffMode] = useState<DiffMode>("words");
  const [copied, setCopied] = useState(false);

  const getDiff = () => {
    if (!text1 && !text2) return null;

    switch (diffMode) {
      case "chars":
        return diffChars(text1, text2);
      case "words":
        return diffWords(text1, text2);
      case "lines":
        return diffLines(text1, text2);
      default:
        return diffWords(text1, text2);
    }
  };

  const diff = getDiff();

  const handleCopy = async () => {
    if (!diff) return;
    
    const diffText = diff
      .map((part) => {
        if (part.added) return `+${part.value}`;
        if (part.removed) return `-${part.value}`;
        return part.value;
      })
      .join("");

    try {
      await navigator.clipboard.writeText(diffText);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Diff copied to clipboard.",
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
    setText1("");
    setText2("");
  };

  const renderDiff = () => {
    if (!diff) return null;

    return diff.map((part, index) => {
      if (part.added) {
        return (
          <span key={index} className="bg-green-600/20 dark:bg-green-500/30 text-green-700 dark:text-green-300 px-1 rounded">
            {part.value}
          </span>
        );
      }
      if (part.removed) {
        return (
          <span key={index} className="bg-red-600/20 dark:bg-red-500/30 text-red-700 dark:text-red-300 px-1 rounded line-through">
            {part.value}
          </span>
        );
      }
      return <span key={index}>{part.value}</span>;
    });
  };

  return (
    <div className="space-y-6">
      {/* Mode Selection */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Compare by:</span>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={diffMode === "chars" ? "default" : "outline"}
              size="sm"
              onClick={() => setDiffMode("chars")}
            >
              Characters
            </Button>
            <Button
              variant={diffMode === "words" ? "default" : "outline"}
              size="sm"
              onClick={() => setDiffMode("words")}
            >
              Words
            </Button>
            <Button
              variant={diffMode === "lines" ? "default" : "outline"}
              size="sm"
              onClick={() => setDiffMode("lines")}
            >
              Lines
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button
            onClick={handleCopy}
            variant="outline"
            size="sm"
            disabled={!diff}
          >
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy Diff
              </>
            )}
          </Button>
          <Button onClick={handleClear} variant="ghost" size="sm">
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      {/* Input Areas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Text 1 (Original)</label>
          <Textarea
            value={text1}
            onChange={(e) => setText1(e.target.value)}
            placeholder="Enter original text..."
            className="min-h-[300px] font-mono text-sm bg-background/50"
            data-lenisignore
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Text 2 (Modified)</label>
          <Textarea
            value={text2}
            onChange={(e) => setText2(e.target.value)}
            placeholder="Enter modified text..."
            className="min-h-[300px] font-mono text-sm bg-background/50"
            data-lenisignore
          />
        </div>
      </div>

      {/* Diff Output */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <label className="text-sm font-medium text-muted-foreground">Difference</label>
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-green-600/20 dark:bg-green-500/30 text-green-700 dark:text-green-300 px-2 py-1 rounded font-medium">Added</span>
            <span className="bg-red-600/20 dark:bg-red-500/30 text-red-700 dark:text-red-300 px-2 py-1 rounded font-medium">Removed</span>
          </div>
        </div>
        <div className="min-h-[300px] p-4 bg-background/50 border border-border rounded-md overflow-auto" data-lenisignore>
          {diff ? (
            <pre className="text-sm font-mono whitespace-pre-wrap">
              {renderDiff()}
            </pre>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <GitCompare className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>Enter two texts above to see the difference</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

