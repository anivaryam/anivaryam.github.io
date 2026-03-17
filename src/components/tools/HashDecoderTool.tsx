import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Copy, Check, Trash2, Hash, CheckCircle2, XCircle, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

async function generateHash(text: string, algorithm: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest(algorithm, data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface VerificationResult {
  algorithm: string;
  hash: string;
  matches: boolean;
}

export function HashDecoderTool() {
  const [hashInput, setHashInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<string>("all");
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [loading, setLoading] = useState(false);

  const algorithms = [
    { name: "SHA-1", id: "SHA-1" },
    { name: "SHA-256", id: "SHA-256" },
    { name: "SHA-384", id: "SHA-384" },
    { name: "SHA-512", id: "SHA-512" },
  ];

  const handleVerify = async () => {
    if (!hashInput.trim()) {
      toast({
        title: "No hash provided",
        description: "Please enter a hash value to verify.",
        variant: "destructive",
      });
      return;
    }

    if (!textInput.trim()) {
      toast({
        title: "No text provided",
        description: "Please enter text to verify against the hash.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const hashToVerify = hashInput.trim().toLowerCase();
      const algorithmsToTest = selectedAlgorithm === "all" 
        ? algorithms 
        : algorithms.filter(a => a.id === selectedAlgorithm);

      const verificationResults: VerificationResult[] = await Promise.all(
        algorithmsToTest.map(async (algo) => {
          const generatedHash = await generateHash(textInput, algo.id);
          return {
            algorithm: algo.name,
            hash: generatedHash,
            matches: generatedHash.toLowerCase() === hashToVerify,
          };
        })
      );

      setResults(verificationResults);

      const matchFound = verificationResults.some(r => r.matches);
      if (matchFound) {
        toast({
          title: "Hash verified!",
          description: "The text matches the provided hash.",
        });
      } else {
        toast({
          title: "No match found",
          description: "The text does not match the hash with the selected algorithm(s).",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to verify hash.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Hash copied to clipboard.",
      });
    } catch {
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleClear = () => {
    setHashInput("");
    setTextInput("");
    setResults([]);
  };

  const matchFound = results.some(r => r.matches);

  return (
    <div className="space-y-4">
      {/* Info Alert */}
      <Alert>
        <Hash className="h-4 w-4" />
        <AlertDescription>
          This tool verifies if your text produces the given hash. Hashes cannot be reversed, 
          but you can check if a text matches a hash using the same algorithm.
        </AlertDescription>
      </Alert>

      {/* Hash Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Hash to Verify</label>
        <Textarea
          value={hashInput}
          onChange={(e) => setHashInput(e.target.value)}
          placeholder="Enter hash value (e.g., 2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae)..."
          className="min-h-[100px] font-mono text-sm bg-background/50"
          data-lenisignore
        />
      </div>

      {/* Text Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Text to Verify</label>
        <Textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Enter text to check against the hash..."
          className="min-h-[100px] font-mono text-sm bg-background/50"
          data-lenisignore
        />
      </div>

      {/* Algorithm Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Algorithm</label>
        <Select value={selectedAlgorithm} onValueChange={setSelectedAlgorithm}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select algorithm" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Try All Algorithms</SelectItem>
            {algorithms.map((algo) => (
              <SelectItem key={algo.id} value={algo.id}>
                {algo.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-2 ml-auto">
          <Button onClick={handleVerify} size="sm" disabled={loading}>
            <Search className="mr-2 h-4 w-4" />
            {loading ? "Verifying..." : "Verify Hash"}
          </Button>
          <Button onClick={handleClear} variant="ghost" size="sm">
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Verification Results</label>
        {results.length > 0 ? (
          <div className="space-y-3">
            {matchFound && (
              <Alert className="border-green-500/50 bg-green-500/10">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-500">
                  Match found! The text produces the given hash.
                </AlertDescription>
              </Alert>
            )}
            {results.map((result) => (
              <div
                key={result.algorithm}
                className={`p-4 bg-background/50 border rounded-md ${
                  result.matches 
                    ? "border-green-500/50 bg-green-500/5" 
                    : "border-border"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-primary">{result.algorithm}</span>
                    {result.matches ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {result.matches && (
                      <span className="text-xs text-green-500 font-medium">MATCH</span>
                    )}
                    <Button
                      onClick={() => handleCopy(result.hash)}
                      variant="ghost"
                      size="sm"
                      className="h-6"
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      Copy
                    </Button>
                  </div>
                </div>
                <code className="text-xs font-mono text-muted-foreground break-all block">
                  {result.hash}
                </code>
                {result.matches && (
                  <div className="mt-2 text-xs text-green-500">
                    ✓ This algorithm matches the provided hash
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 bg-background/50 border border-border rounded-md text-center text-muted-foreground">
            Enter a hash and text, then click "Verify Hash" to see results
          </div>
        )}
      </div>
    </div>
  );
}

