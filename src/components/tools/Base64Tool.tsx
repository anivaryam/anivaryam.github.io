import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Copy, Check, Trash2, ArrowDownUp } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Mode = "encode" | "decode";

export function Base64Tool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<Mode>("encode");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConvert = () => {
    if (!input.trim()) {
      setError("Please enter some text");
      setOutput("");
      return;
    }

    try {
      if (mode === "encode") {
        // Encode to Base64 with UTF-8 support
        const encoded = btoa(unescape(encodeURIComponent(input)));
        setOutput(encoded);
        setError(null);
        toast({
          title: "Encoded!",
          description: "Text has been encoded to Base64.",
        });
      } else {
        // Decode from Base64 with UTF-8 support
        const decoded = decodeURIComponent(escape(atob(input)));
        setOutput(decoded);
        setError(null);
        toast({
          title: "Decoded!",
          description: "Base64 has been decoded to text.",
        });
      }
    } catch {
      setError(mode === "decode" ? "Invalid Base64 string" : "Encoding failed");
      setOutput("");
    }
  };

  const handleSwap = () => {
    setInput(output);
    setOutput("");
    setMode(mode === "encode" ? "decode" : "encode");
    setError(null);
  };

  const handleCopy = async () => {
    if (!output) return;
    
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Result copied to clipboard.",
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
    setInput("");
    setOutput("");
    setError(null);
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); setOutput(""); setError(null); }}>
          <TabsList className="h-8">
            <TabsTrigger value="encode" className="text-xs px-4">Encode</TabsTrigger>
            <TabsTrigger value="decode" className="text-xs px-4">Decode</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2 ml-auto">
          <Button onClick={handleConvert} size="sm">
            {mode === "encode" ? "Encode" : "Decode"}
          </Button>
          <Button onClick={handleSwap} variant="outline" size="sm" disabled={!output}>
            <ArrowDownUp className="mr-2 h-4 w-4" />
            Swap
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
          <label className="text-sm font-medium text-muted-foreground">
            {mode === "encode" ? "Text to Encode" : "Base64 to Decode"}
          </label>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "encode" ? "Enter text to encode..." : "Enter Base64 string to decode..."}
            className="min-h-[200px] font-mono text-sm bg-background/50"
            data-lenisignore
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-muted-foreground">
              {mode === "encode" ? "Base64 Output" : "Decoded Text"}
            </label>
            <Button
              onClick={handleCopy}
              variant="ghost"
              size="sm"
              disabled={!output}
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
            <div className="min-h-[200px] p-4 bg-destructive/10 border border-destructive/30 rounded-md">
              <p className="text-sm text-destructive font-mono">{error}</p>
            </div>
          ) : (
            <pre className="min-h-[200px] p-4 bg-background/50 border border-border rounded-md overflow-auto text-sm font-mono whitespace-pre-wrap break-all" data-lenisignore>
              {output || "Result will appear here..."}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
