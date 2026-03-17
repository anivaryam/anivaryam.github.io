import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Copy, Check, Trash2, Hash } from "lucide-react";

interface HashResult {
  algorithm: string;
  hash: string;
}

async function generateHash(text: string, algorithm: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest(algorithm, data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function HashGeneratorTool() {
  const [input, setInput] = useState("");
  const [hashes, setHashes] = useState<HashResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!input.trim()) {
      toast({
        title: "No input",
        description: "Please enter some text to hash.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const algorithms = [
        { name: "SHA-1", id: "SHA-1" },
        { name: "SHA-256", id: "SHA-256" },
        { name: "SHA-384", id: "SHA-384" },
        { name: "SHA-512", id: "SHA-512" },
      ];

      const results: HashResult[] = await Promise.all(
        algorithms.map(async (algo) => ({
          algorithm: algo.name,
          hash: await generateHash(input, algo.id),
        }))
      );

      setHashes(results);
      toast({
        title: "Hashes generated!",
        description: `Generated ${results.length} hash values.`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to generate hashes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (hash: string, index: number) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedIndex(index);
      toast({
        title: "Copied!",
        description: "Hash copied to clipboard.",
      });
      setTimeout(() => setCopiedIndex(null), 2000);
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
    setHashes([]);
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-2 ml-auto">
          <Button onClick={handleGenerate} size="sm" disabled={loading}>
            <Hash className="mr-2 h-4 w-4" />
            {loading ? "Generating..." : "Generate Hashes"}
          </Button>
          <Button onClick={handleClear} variant="ghost" size="sm">
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      {/* Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Input Text</label>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter text to hash..."
          className="min-h-[150px] font-mono text-sm bg-background/50"
          data-lenisignore
        />
      </div>

      {/* Output */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Hash Results</label>
        {hashes.length > 0 ? (
          <div className="space-y-3">
            {hashes.map((result, index) => (
              <div
                key={result.algorithm}
                className="p-4 bg-background/50 border border-border rounded-md"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-primary">{result.algorithm}</span>
                  <Button
                    onClick={() => handleCopy(result.hash, index)}
                    variant="ghost"
                    size="sm"
                    className="h-6"
                  >
                    {copiedIndex === index ? (
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
                <code className="text-xs font-mono text-muted-foreground break-all">
                  {result.hash}
                </code>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 bg-background/50 border border-border rounded-md text-center text-muted-foreground">
            Enter text and click "Generate Hashes" to see results
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-xs text-muted-foreground">
        <p>
          Note: MD5 is not available in the Web Crypto API due to security concerns. 
          Use SHA-256 or higher for secure hashing.
        </p>
      </div>
    </div>
  );
}
