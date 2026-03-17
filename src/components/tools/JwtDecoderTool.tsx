import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Copy, Check, Trash2 } from "lucide-react";

interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
}

function decodeBase64Url(str: string): string {
  // Replace URL-safe characters
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  // Pad with = if necessary
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return decodeURIComponent(
    atob(padded)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
}

function formatTimestamp(value: unknown): string | null {
  if (typeof value === "number") {
    // JWT timestamps are in seconds
    const date = new Date(value * 1000);
    if (!isNaN(date.getTime())) {
      return date.toLocaleString();
    }
  }
  return null;
}

export function JwtDecoderTool() {
  const [input, setInput] = useState("");
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const result = useMemo(() => {
    if (!input.trim()) {
      return { decoded: null, error: null };
    }

    try {
      const parts = input.trim().split(".");
      if (parts.length !== 3) {
        return { decoded: null, error: "Invalid JWT format. Expected 3 parts separated by dots." };
      }

      const [headerB64, payloadB64, signature] = parts;

      const header = JSON.parse(decodeBase64Url(headerB64));
      const payload = JSON.parse(decodeBase64Url(payloadB64));

      return {
        decoded: { header, payload, signature } as DecodedJwt,
        error: null,
      };
    } catch (err) {
      return { decoded: null, error: `Failed to decode JWT: ${(err as Error).message}` };
    }
  }, [input]);

  const handleCopy = async (section: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedSection(section);
      toast({
        title: "Copied!",
        description: `${section} copied to clipboard.`,
      });
      setTimeout(() => setCopiedSection(null), 2000);
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
  };

  const renderPayloadValue = (key: string, value: unknown) => {
    const timestamp = formatTimestamp(value);
    const isExpired = key === "exp" && typeof value === "number" && value * 1000 < Date.now();
    
    return (
      <div className="flex items-center gap-2">
        <span className="text-foreground">{JSON.stringify(value)}</span>
        {timestamp && (
          <span className={`text-xs ${isExpired ? "text-destructive" : "text-muted-foreground"}`}>
            ({timestamp}{isExpired ? " - EXPIRED" : ""})
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-2 ml-auto">
          <Button onClick={handleClear} variant="ghost" size="sm">
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      {/* Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">JWT Token</label>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste your JWT token here..."
          className="min-h-[100px] font-mono text-sm bg-background/50"
          data-lenisignore
        />
      </div>

      {/* Error */}
      {result.error && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-md">
          <p className="text-sm text-destructive font-mono">{result.error}</p>
        </div>
      )}

      {/* Decoded Output */}
      {result.decoded && (
        <div className="space-y-4">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-primary">Header</label>
              <Button
                onClick={() => handleCopy("Header", JSON.stringify(result.decoded!.header, null, 2))}
                variant="ghost"
                size="sm"
                className="h-6"
              >
                {copiedSection === "Header" ? (
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
            <pre className="p-4 bg-background/50 border border-border rounded-md overflow-auto text-sm font-mono" data-lenisignore>
              {JSON.stringify(result.decoded.header, null, 2)}
            </pre>
          </div>

          {/* Payload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-primary">Payload</label>
              <Button
                onClick={() => handleCopy("Payload", JSON.stringify(result.decoded!.payload, null, 2))}
                variant="ghost"
                size="sm"
                className="h-6"
              >
                {copiedSection === "Payload" ? (
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
            <div className="p-4 bg-background/50 border border-border rounded-md overflow-auto" data-lenisignore>
              <table className="w-full text-sm font-mono">
                <tbody>
                  {Object.entries(result.decoded.payload).map(([key, value]) => (
                    <tr key={key} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4 text-muted-foreground align-top whitespace-nowrap">{key}</td>
                      <td className="py-2">{renderPayloadValue(key, value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Signature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-primary">Signature</label>
              <Button
                onClick={() => handleCopy("Signature", result.decoded!.signature)}
                variant="ghost"
                size="sm"
                className="h-6"
              >
                {copiedSection === "Signature" ? (
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
            <pre className="p-4 bg-background/50 border border-border rounded-md overflow-auto text-sm font-mono text-muted-foreground break-all" data-lenisignore>
              {result.decoded.signature}
            </pre>
            <p className="text-xs text-muted-foreground">
              Note: This tool only decodes JWTs. Signature verification requires the secret key.
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!result.decoded && !result.error && (
        <div className="p-8 bg-background/50 border border-border rounded-md text-center text-muted-foreground">
          Paste a JWT token above to decode it
        </div>
      )}
    </div>
  );
}
