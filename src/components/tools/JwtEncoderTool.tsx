import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Copy, Check, Trash2, KeyRound } from "lucide-react";

function encodeBase64Url(str: string): string {
  // Convert string to base64
  const base64 = btoa(unescape(encodeURIComponent(str)));
  // Convert to base64url by replacing characters
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function generateHMACSignature(
  data: string,
  secret: string,
  algorithm: "HS256" | "HS384" | "HS512"
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  // Map algorithm to Web Crypto API algorithm
  const hashAlgo = algorithm === "HS256" ? "SHA-256" : algorithm === "HS384" ? "SHA-384" : "SHA-512";
  const cryptoAlgo = { name: "HMAC", hash: hashAlgo };

  // Import the key
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    cryptoAlgo,
    false,
    ["sign"]
  );

  // Sign the data
  const signature = await crypto.subtle.sign(cryptoAlgo, key, messageData);

  // Convert to base64url
  const signatureArray = Array.from(new Uint8Array(signature));
  const base64 = btoa(String.fromCharCode(...signatureArray));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function JwtEncoderTool() {
  const [headerJson, setHeaderJson] = useState('{\n  "alg": "HS256",\n  "typ": "JWT"\n}');
  const [payloadJson, setPayloadJson] = useState('{\n  "sub": "1234567890",\n  "name": "John Doe",\n  "iat": 1516239022\n}');
  const [secret, setSecret] = useState("");
  const [algorithm, setAlgorithm] = useState<"HS256" | "HS384" | "HS512">("HS256");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullToken, setFullToken] = useState<string | null>(null);

  const result = useMemo(() => {
    setError(null);

    if (!headerJson.trim() || !payloadJson.trim()) {
      return { token: null, error: null };
    }

    try {
      // Parse and validate JSON
      const header = JSON.parse(headerJson);
      const payload = JSON.parse(payloadJson);

      // Validate header
      if (!header.alg) {
        setError("Header must include 'alg' (algorithm) field");
        return { token: null, error: "Header must include 'alg' (algorithm) field" };
      }

      // Update algorithm from header if it's a supported HMAC algorithm
      const headerAlg = header.alg;
      if (headerAlg === "HS256" || headerAlg === "HS384" || headerAlg === "HS512") {
        if (headerAlg !== algorithm) {
          setAlgorithm(headerAlg);
        }
      } else if (headerAlg !== algorithm) {
        // If header has different algorithm, warn but continue with selected algorithm
        header.alg = algorithm;
      }

      // Encode header and payload
      const encodedHeader = encodeBase64Url(JSON.stringify(header));
      const encodedPayload = encodeBase64Url(JSON.stringify(payload));

      // Create the unsigned token (header.payload)
      const unsignedToken = `${encodedHeader}.${encodedPayload}`;

      // Return unsigned token (signature will be added when secret is provided)
      return { token: unsignedToken, header, payload, encodedHeader, encodedPayload, error: null };
    } catch (err) {
      const errorMsg = `Invalid JSON: ${(err as Error).message}`;
      setError(errorMsg);
      return { token: null, error: errorMsg };
    }
  }, [headerJson, payloadJson, algorithm]);

  const handleGenerate = async () => {
    if (!secret.trim()) {
      toast({
        title: "Secret required",
        description: "Please enter a secret key to sign the JWT.",
        variant: "destructive",
      });
      return;
    }

    if (!result.token) {
      toast({
        title: "Invalid input",
        description: "Please check your header and payload JSON.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Generate signature
      const signature = await generateHMACSignature(result.token, secret, algorithm);
      const generatedToken = `${result.token}.${signature}`;
      setFullToken(generatedToken);

      // Copy to clipboard
      await navigator.clipboard.writeText(generatedToken);
      setCopied(true);
      toast({
        title: "JWT generated!",
        description: "JWT token has been copied to clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to generate JWT",
        description: `Error: ${(err as Error).message}`,
        variant: "destructive",
      });
    }
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard.`,
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
    setHeaderJson('{\n  "alg": "HS256",\n  "typ": "JWT"\n}');
    setPayloadJson('{\n  "sub": "1234567890",\n  "name": "John Doe",\n  "iat": 1516239022\n}');
    setSecret("");
    setError(null);
    setFullToken(null);
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

      {/* Algorithm Selection */}
      <div className="space-y-2">
        <Label htmlFor="algorithm">Algorithm</Label>
        <Select
          value={algorithm}
          onValueChange={(value) => {
            const newAlg = value as "HS256" | "HS384" | "HS512";
            setAlgorithm(newAlg);
            // Update header JSON to reflect the new algorithm
            try {
              const header = JSON.parse(headerJson);
              header.alg = newAlg;
              setHeaderJson(JSON.stringify(header, null, 2));
            } catch {
              // If header JSON is invalid, just update the algorithm
            }
          }}
        >
          <SelectTrigger id="algorithm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="HS256">HS256 (HMAC SHA-256)</SelectItem>
            <SelectItem value="HS384">HS384 (HMAC SHA-384)</SelectItem>
            <SelectItem value="HS512">HS512 (HMAC SHA-512)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          The algorithm in the header will be automatically updated when you change this selection.
        </p>
      </div>

      {/* Header Input */}
      <div className="space-y-2">
        <Label htmlFor="header">Header (JSON)</Label>
        <Textarea
          id="header"
          value={headerJson}
          onChange={(e) => setHeaderJson(e.target.value)}
          placeholder='{"alg": "HS256", "typ": "JWT"}'
          className="min-h-[120px] font-mono text-sm bg-background/50"
          data-lenisignore
        />
      </div>

      {/* Payload Input */}
      <div className="space-y-2">
        <Label htmlFor="payload">Payload (JSON)</Label>
        <Textarea
          id="payload"
          value={payloadJson}
          onChange={(e) => setPayloadJson(e.target.value)}
          placeholder='{"sub": "1234567890", "name": "John Doe"}'
          className="min-h-[120px] font-mono text-sm bg-background/50"
          data-lenisignore
        />
      </div>

      {/* Secret Input */}
      <div className="space-y-2">
        <Label htmlFor="secret">Secret Key</Label>
        <Input
          id="secret"
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Enter your secret key..."
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          The secret key is used to sign the JWT. Keep it secure and never share it.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-md">
          <p className="text-sm text-destructive font-mono">{error}</p>
        </div>
      )}

      {/* Generate Button */}
      {result.token && !error && (
        <Button onClick={handleGenerate} className="w-full" disabled={!secret.trim()}>
          <KeyRound className="mr-2 h-4 w-4" />
          Generate JWT Token
        </Button>
      )}

      {/* Output */}
      {result.token && !error && (
        <div className="space-y-4">
          {/* Encoded Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-primary">Encoded Header</Label>
              <Button
                onClick={() => handleCopy(result.encodedHeader!, "Encoded header")}
                variant="ghost"
                size="sm"
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
            <pre className="p-4 bg-background/50 border border-border rounded-md overflow-auto text-sm font-mono break-all" data-lenisignore>
              {result.encodedHeader}
            </pre>
          </div>

          {/* Encoded Payload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-primary">Encoded Payload</Label>
              <Button
                onClick={() => handleCopy(result.encodedPayload!, "Encoded payload")}
                variant="ghost"
                size="sm"
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
            <pre className="p-4 bg-background/50 border border-border rounded-md overflow-auto text-sm font-mono break-all" data-lenisignore>
              {result.encodedPayload}
            </pre>
          </div>

          {/* Unsigned Token */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-primary">Unsigned Token (Header.Payload)</Label>
              <Button
                onClick={() => handleCopy(result.token!, "Unsigned token")}
                variant="ghost"
                size="sm"
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
            <pre className="p-4 bg-background/50 border border-border rounded-md overflow-auto text-sm font-mono break-all" data-lenisignore>
              {result.token}
            </pre>
            <p className="text-xs text-muted-foreground">
              Enter a secret key above and click "Generate JWT Token" to create a signed token.
            </p>
          </div>

          {/* Full Signed Token */}
          {fullToken && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-primary">Full Signed JWT Token</Label>
                <Button
                  onClick={() => handleCopy(fullToken, "Full JWT token")}
                  variant="ghost"
                  size="sm"
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
              <pre className="p-4 bg-primary/5 border border-primary/30 rounded-md overflow-auto text-sm font-mono break-all" data-lenisignore>
                {fullToken}
              </pre>
              <p className="text-xs text-muted-foreground">
                This is your complete, signed JWT token ready to use.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!result.token && !error && (
        <div className="p-8 bg-background/50 border border-border rounded-md text-center text-muted-foreground">
          Enter header and payload JSON above to generate a JWT token
        </div>
      )}
    </div>
  );
}

