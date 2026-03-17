import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Copy, Check, Trash2, Search, Download, FileJson } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

type ExtractionMode = "field" | "path" | "array";

export function JsonExtractorTool() {
  const [inputJson, setInputJson] = useState("");
  const [extractionKey, setExtractionKey] = useState("");
  const [mode, setMode] = useState<ExtractionMode>("field");
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Extract data based on mode
  const extractData = () => {
    if (!inputJson.trim()) {
      setError("Please enter JSON data");
      setResults([]);
      return;
    }

    if (!extractionKey.trim()) {
      setError("Please enter a field name or path to extract");
      setResults([]);
      return;
    }

    try {
      const parsed = JSON.parse(inputJson);
      let extracted: any[] = [];

      if (mode === "field") {
        // Extract all values with the given field name
        extracted = extractField(parsed, extractionKey.trim());
      } else if (mode === "path") {
        // Extract using JSONPath-like syntax
        extracted = extractPath(parsed, extractionKey.trim());
      } else if (mode === "array") {
        // Extract all values from arrays
        extracted = extractArrayValues(parsed, extractionKey.trim());
      }

      if (extracted.length === 0) {
        setError(`No data found matching "${extractionKey}"`);
        setResults([]);
        return;
      }

      setResults(extracted);
      setError(null);
      toast({
        title: "Extraction successful!",
        description: `Found ${extracted.length} value(s).`,
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Invalid JSON";
      setError(errorMessage);
      setResults([]);
    }
  };

  // Extract field from object/array recursively
  const extractField = (obj: any, fieldName: string, results: any[] = []): any[] => {
    if (Array.isArray(obj)) {
      obj.forEach(item => extractField(item, fieldName, results));
    } else if (obj !== null && typeof obj === "object") {
      if (fieldName in obj) {
        results.push(obj[fieldName]);
      }
      Object.values(obj).forEach(value => {
        if (value !== null && typeof value === "object") {
          extractField(value, fieldName, results);
        }
      });
    }
    return results;
  };

  // Extract using path syntax (e.g., "users.name" or "data.items[].title")
  const extractPath = (obj: any, path: string): any[] => {
    const parts = path.split(".");
    const current: any = obj;
    const results: any[] = [];

    // Handle array notation like "items[]"
    const pathParts: string[] = [];
    parts.forEach(part => {
      if (part.endsWith("[]")) {
        pathParts.push(part.slice(0, -2));
        pathParts.push("[*]");
      } else {
        pathParts.push(part);
      }
    });

    const extractFromPath = (data: any, remainingParts: string[]): void => {
      if (remainingParts.length === 0) {
        if (data !== undefined && data !== null) {
          results.push(data);
        }
        return;
      }

      const [first, ...rest] = remainingParts;

      if (first === "[*]") {
        // Handle array wildcard
        if (Array.isArray(data)) {
          data.forEach(item => extractFromPath(item, rest));
        }
      } else if (first in data) {
        extractFromPath(data[first], rest);
      } else if (Array.isArray(data)) {
        // If current is array, search in each item
        data.forEach(item => {
          if (item !== null && typeof item === "object" && first in item) {
            extractFromPath(item[first], rest);
          }
        });
      }
    };

    extractFromPath(obj, pathParts);
    return results;
  };

  // Extract all values from arrays with a specific field
  const extractArrayValues = (obj: any, fieldName: string, results: any[] = []): any[] => {
    if (Array.isArray(obj)) {
      obj.forEach(item => {
        if (item !== null && typeof item === "object" && fieldName in item) {
          results.push(item[fieldName]);
        } else if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
          results.push(item);
        }
      });
    } else if (obj !== null && typeof obj === "object") {
      Object.values(obj).forEach(value => {
        if (Array.isArray(value)) {
          extractArrayValues(value, fieldName, results);
        } else if (value !== null && typeof value === "object") {
          extractArrayValues(value, fieldName, results);
        }
      });
    }
    return results;
  };

  // Get combined results as text
  const getCombinedText = (): string => {
    return results
      .map((result, index) => {
        if (typeof result === "object") {
          return JSON.stringify(result);
        }
        return String(result);
      })
      .join("\n");
  };

  // Get results as JSON
  const getResultsJSON = (): string => {
    return JSON.stringify(results, null, 2);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Data copied to clipboard.",
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

  const handleDownloadJSON = () => {
    try {
      const json = getResultsJSON();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `extracted-data-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Downloaded!",
        description: "JSON file downloaded successfully.",
      });
    } catch {
      toast({
        title: "Download failed",
        description: "Could not download JSON file.",
        variant: "destructive",
      });
    }
  };

  const handleClear = () => {
    setInputJson("");
    setExtractionKey("");
    setResults([]);
    setError(null);
  };

  return (
    <div className="space-y-4">
      {/* Mode Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Extraction Mode</Label>
        <Tabs value={mode} onValueChange={(v) => { setMode(v as ExtractionMode); setResults([]); setError(null); }}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="field">Field Name</TabsTrigger>
            <TabsTrigger value="path">Path</TabsTrigger>
            <TabsTrigger value="array">Array Values</TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-xs text-muted-foreground">
          {mode === "field" && "Extract all values with a specific field name (e.g., 'name', 'email')"}
          {mode === "path" && "Extract using path syntax (e.g., 'users.name', 'data.items[].title')"}
          {mode === "array" && "Extract all values from arrays"}
        </p>
      </div>

      {/* Input Section */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">JSON Input</Label>
          <Textarea
            value={inputJson}
            onChange={(e) => setInputJson(e.target.value)}
            placeholder='{"users": [{"name": "John", "email": "john@example.com"}, {"name": "Jane", "email": "jane@example.com"}]}'
            className="min-h-[200px] font-mono text-sm bg-background/50"
            data-lenisignore
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Search className="h-3 w-3" />
            {mode === "field" && "Field Name to Extract"}
            {mode === "path" && "Path to Extract"}
            {mode === "array" && "Field Name (optional)"}
          </Label>
          <Input
            value={extractionKey}
            onChange={(e) => setExtractionKey(e.target.value)}
            placeholder={
              mode === "field" ? "name, email, title, etc."
              : mode === "path" ? "users.name, data.items[].title"
              : "Leave empty to extract all array values"
            }
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {mode === "field" && (
              <>Examples: <code className="bg-muted px-1 rounded">name</code>, <code className="bg-muted px-1 rounded">email</code>, <code className="bg-muted px-1 rounded">id</code></>
            )}
            {mode === "path" && (
              <>Examples: <code className="bg-muted px-1 rounded">users.name</code>, <code className="bg-muted px-1 rounded">data.items[].title</code></>
            )}
            {mode === "array" && (
              <>Extracts all values from arrays. If field name provided, extracts that field from array objects.</>
            )}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={extractData} disabled={!inputJson.trim() || !extractionKey.trim()} className="flex-1">
            <Search className="mr-2 h-4 w-4" />
            Extract
          </Button>
          <Button onClick={handleClear} variant="ghost">
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      {/* Results Section */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Extracted Data ({results.length} {results.length === 1 ? "value" : "values"})
            </h3>
            <Badge variant="secondary">{extractionKey || "all"}</Badge>
          </div>

          <Tabs defaultValue="list" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="list">List View</TabsTrigger>
              <TabsTrigger value="text">Combined Text</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>

            {/* List View */}
            <TabsContent value="list" className="mt-4">
              <div className="space-y-2 max-h-[500px] overflow-y-auto" data-lenisignore>
                {results.map((result, index) => (
                  <Card key={index} className="bg-card/50">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">Value #{index + 1}</CardTitle>
                        <Button
                          onClick={() => handleCopy(typeof result === "object" ? JSON.stringify(result) : String(result))}
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
                    </CardHeader>
                    <CardContent>
                      <div className="bg-background/50 p-3 rounded-md border border-border">
                        <pre className="text-sm font-mono whitespace-pre-wrap break-words">
                          {typeof result === "object" ? JSON.stringify(result, null, 2) : String(result)}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Combined Text */}
            <TabsContent value="text" className="mt-4">
              <Card className="bg-card/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Combined Text</CardTitle>
                    <Button
                      onClick={() => handleCopy(getCombinedText())}
                      variant="outline"
                      size="sm"
                      className="h-7"
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      Copy All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-background/50 p-4 rounded-md border border-border">
                    <pre className="text-sm font-mono whitespace-pre-wrap break-words max-h-[500px] overflow-auto" data-lenisignore>
                      {getCombinedText()}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* JSON View */}
            <TabsContent value="json" className="mt-4">
              <Card className="bg-card/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <FileJson className="h-4 w-4" />
                      JSON Export
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleCopy(getResultsJSON())}
                        variant="outline"
                        size="sm"
                        className="h-7"
                      >
                        <Copy className="mr-1 h-3 w-3" />
                        Copy JSON
                      </Button>
                      <Button
                        onClick={handleDownloadJSON}
                        variant="outline"
                        size="sm"
                        className="h-7"
                      >
                        <Download className="mr-1 h-3 w-3" />
                        Download
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-background/50 p-4 rounded-md border border-border">
                    <pre className="text-xs font-mono overflow-x-auto max-h-[500px] overflow-y-auto" data-lenisignore>
                      {getResultsJSON()}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {!results.length && !error && (
        <div className="text-center py-8 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">Enter JSON data and specify what to extract</p>
        </div>
      )}
    </div>
  );
}

