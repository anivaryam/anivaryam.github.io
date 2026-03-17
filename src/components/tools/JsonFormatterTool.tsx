import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Copy, Check, Trash2, Minimize2, Maximize2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type IndentType = "2" | "4" | "tab";

export function JsonFormatterTool() {
  const [inputJson, setInputJson] = useState("");
  const [outputJson, setOutputJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [indent, setIndent] = useState<IndentType>("2");

  const getIndentString = (type: IndentType) => {
    switch (type) {
      case "2": return 2;
      case "4": return 4;
      case "tab": return "\t";
      default: return 2;
    }
  };

  const formatJson = () => {
    if (!inputJson.trim()) {
      setError("Please enter some JSON to format");
      setOutputJson("");
      return;
    }

    try {
      const parsed = JSON.parse(inputJson);
      const formatted = JSON.stringify(parsed, null, getIndentString(indent));
      setOutputJson(formatted);
      setError(null);
      toast({
        title: "JSON Formatted",
        description: "Your JSON has been formatted successfully.",
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Invalid JSON";
      setError(errorMessage);
      setOutputJson("");
    }
  };

  const minifyJson = () => {
    if (!inputJson.trim()) {
      setError("Please enter some JSON to minify");
      setOutputJson("");
      return;
    }

    try {
      const parsed = JSON.parse(inputJson);
      const minified = JSON.stringify(parsed);
      setOutputJson(minified);
      setError(null);
      toast({
        title: "JSON Minified",
        description: "Your JSON has been minified successfully.",
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Invalid JSON";
      setError(errorMessage);
      setOutputJson("");
    }
  };

  const handleCopy = async () => {
    if (!outputJson) return;
    
    try {
      await navigator.clipboard.writeText(outputJson);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "JSON copied to clipboard.",
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
    setInputJson("");
    setOutputJson("");
    setError(null);
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Indent:</span>
          <Tabs value={indent} onValueChange={(v) => setIndent(v as IndentType)}>
            <TabsList className="h-8">
              <TabsTrigger value="2" className="text-xs px-3">2 spaces</TabsTrigger>
              <TabsTrigger value="4" className="text-xs px-3">4 spaces</TabsTrigger>
              <TabsTrigger value="tab" className="text-xs px-3">Tab</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex gap-2 ml-auto">
          <Button onClick={formatJson} size="sm">
            <Maximize2 className="mr-2 h-4 w-4" />
            Format
          </Button>
          <Button onClick={minifyJson} variant="outline" size="sm">
            <Minimize2 className="mr-2 h-4 w-4" />
            Minify
          </Button>
          <Button onClick={handleClear} variant="ghost" size="sm">
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      {/* Input/Output */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Input JSON</label>
          <Textarea
            value={inputJson}
            onChange={(e) => setInputJson(e.target.value)}
            placeholder='{"example": "Paste your JSON here..."}'
            className="min-h-[300px] font-mono text-sm bg-background/50"
            data-lenisignore
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-muted-foreground">Output</label>
            <Button
              onClick={handleCopy}
              variant="ghost"
              size="sm"
              disabled={!outputJson}
              className="h-6"
            >
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
          </div>
          {error ? (
            <div className="min-h-[300px] p-4 bg-destructive/10 border border-destructive/30 rounded-md">
              <p className="text-sm text-destructive font-mono">{error}</p>
            </div>
          ) : (
            <pre className="min-h-[300px] p-4 bg-background/50 border border-border rounded-md overflow-auto text-sm font-mono whitespace-pre-wrap" data-lenisignore>
              {outputJson || "Formatted JSON will appear here..."}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
