import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Copy, Check, Trash2, Globe, Loader2, ExternalLink, FileStack, Download, FileJson } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface ScrapeResult {
  text: string;
  html: string;
  attributes: Record<string, string>;
  pageUrl?: string;
  pageNumber?: number;
}

export function WebScraperTool() {
  const [url, setUrl] = useState("");
  const [selector, setSelector] = useState("");
  const [results, setResults] = useState<ScrapeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  // Pagination state
  const [enablePagination, setEnablePagination] = useState(false);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(3);
  const [paginationProgress, setPaginationProgress] = useState({ current: 0, total: 0 });

  // Helper function to check if URL is internal/private (SSRF protection)
  const isInternalUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      // Block localhost variants
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') {
        return true;
      }
      
      // Block private IP ranges
      if (hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
        // 172.16-31.x.x
        if (hostname.startsWith('172.') && hostname.length >= 7) {
          const secondOctet = parseInt(hostname.split('.')[1]);
          if (secondOctet >= 16 && secondOctet <= 31) return true;
        }
        return true;
      }
      
      // Block link-local
      if (hostname.startsWith('169.254.')) return true;
      
      // Block .local domains
      if (hostname.endsWith('.local')) return true;
      
      return false;
    } catch {
      return true; // Invalid URLs treated as internal
    }
  };

  // Helper function to fetch HTML from a URL
  const fetchHtml = async (targetUrl: string): Promise<string> => {
    // SSRF protection - block internal URLs
    if (isInternalUrl(targetUrl)) {
      throw new Error('Cannot access internal or private URLs');
    }
    const proxies = [
      // AllOrigins - returns { contents: string }
      async (url: string) => {
        const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
        const data = await response.json();
        return data.contents || null;
      },
      // CORS Proxy - returns HTML directly
      async (url: string) => {
        const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
        if (!response.ok) throw new Error('Proxy failed');
        return await response.text();
      },
      // CORS Anywhere alternative
      async (url: string) => {
        const response = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`);
        if (!response.ok) throw new Error('Proxy failed');
        return await response.text();
      },
    ];

    let html: string | null = null;
    let lastError: Error | null = null;

    // Try each proxy until one works
    for (const proxy of proxies) {
      try {
        html = await proxy(targetUrl);
        if (html) break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Proxy request failed');
        continue;
      }
    }

    if (!html) {
      throw new Error(
        lastError?.message || 
        "Failed to fetch website. All CORS proxies failed."
      );
    }

    return html;
  };

  // Helper function to scrape a single page
  const scrapePage = async (pageUrl: string, pageNumber?: number): Promise<ScrapeResult[]> => {
    const html = await fetchHtml(pageUrl);

    // Parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Check for parsing errors
    const parserError = doc.querySelector("parsererror");
    if (parserError) {
      throw new Error("Failed to parse HTML");
    }

    // Query elements using the selector
    const elements = doc.querySelectorAll(selector);

    // Extract data from elements
    const extractedResults: ScrapeResult[] = Array.from(elements).map((el) => {
      const text = el.textContent?.trim() || "";
      const html = el.innerHTML;
      const attributes: Record<string, string> = {};
      
      // Extract all attributes
      Array.from(el.attributes).forEach((attr) => {
        attributes[attr.name] = attr.value;
      });

      return { 
        text, 
        html, 
        attributes,
        pageUrl: pageNumber !== undefined ? pageUrl : undefined,
        pageNumber: pageNumber !== undefined ? pageNumber : undefined,
      };
    });

    return extractedResults;
  };

  const handleScrape = async () => {
    if (!url.trim()) {
      setError("Please enter a website URL");
      return;
    }

    if (!selector.trim()) {
      setError("Please enter a CSS selector (e.g., h1, .title, #content)");
      return;
    }

    // Validate pagination settings
    if (enablePagination) {
      if (startPage < 1 || endPage < 1) {
        setError("Page numbers must be greater than 0");
        return;
      }
      if (startPage > endPage) {
        setError("Start page must be less than or equal to end page");
        return;
      }
      if (endPage - startPage > 50) {
        setError("Cannot scrape more than 50 pages at once");
        return;
      }
    }

    // Validate URL
    let baseUrl = url.trim();
    if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
      baseUrl = "https://" + baseUrl;
    }

    try {
      new URL(baseUrl);
    } catch {
      setError("Please enter a valid URL");
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      if (enablePagination) {
        // Pagination mode: scrape multiple pages
        const allResults: ScrapeResult[] = [];
        const totalPages = endPage - startPage + 1;
        setPaginationProgress({ current: 0, total: totalPages });

        for (let page = startPage; page <= endPage; page++) {
          try {
            // Replace {page} or page= in URL with current page number
            let pageUrl = baseUrl;
            if (pageUrl.includes("{page}")) {
              pageUrl = pageUrl.replace(/{page}/g, page.toString());
            } else if (pageUrl.includes("page=")) {
              pageUrl = pageUrl.replace(/page=\d+/, `page=${page}`);
            } else {
              // Try common pagination patterns
              const separator = pageUrl.includes("?") ? "&" : "?";
              pageUrl = `${pageUrl}${separator}page=${page}`;
            }

            const pageResults = await scrapePage(pageUrl, page);
            allResults.push(...pageResults);
            
            setPaginationProgress({ current: page - startPage + 1, total: totalPages });
            
            // Small delay between requests to avoid overwhelming the proxy
            if (page < endPage) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } catch (err) {
            console.warn(`Failed to scrape page ${page}:`, err);
            // Continue with other pages even if one fails
          }
        }

        if (allResults.length === 0) {
          setError("No elements found on any page matching the selector");
          setLoading(false);
          return;
        }

        setResults(allResults);
        toast({
          title: "Pagination scraping successful!",
          description: `Found ${allResults.length} element(s) across ${totalPages} page(s).`,
        });
      } else {
        // Single page mode
        const pageResults = await scrapePage(baseUrl);
        
        if (pageResults.length === 0) {
          setError(`No elements found matching selector: "${selector}"`);
          setLoading(false);
          return;
        }

        setResults(pageResults);
        toast({
          title: "Scraping successful!",
          description: `Found ${pageResults.length} element(s).`,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to scrape website";
      setError(errorMessage);
      toast({
        title: "Scraping failed",
        description: errorMessage.length > 100 ? errorMessage.substring(0, 100) + "..." : errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setPaginationProgress({ current: 0, total: 0 });
    }
  };

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      toast({
        title: "Copied!",
        description: "Result copied to clipboard.",
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

  // Generate combined JSON
  const getCombinedJSON = (): string => {
    const jsonData = {
      metadata: {
        url: url,
        selector: selector,
        totalElements: results.length,
        scrapedAt: new Date().toISOString(),
        pagination: enablePagination ? {
          enabled: true,
          startPage,
          endPage,
        } : { enabled: false },
      },
      results: results.map((result, index) => ({
        index: index + 1,
        text: result.text,
        html: result.html,
        attributes: result.attributes,
        ...(result.pageNumber !== undefined && {
          pageNumber: result.pageNumber,
          pageUrl: result.pageUrl,
        }),
      })),
    };
    return JSON.stringify(jsonData, null, 2);
  };

  // Generate combined text
  const getCombinedText = (): string => {
    return results
      .map((result, index) => {
        const prefix = result.pageNumber !== undefined 
          ? `[Page ${result.pageNumber}] ` 
          : '';
        return `${prefix}${result.text}`;
      })
      .filter(text => text.trim())
      .join('\n\n');
  };

  const handleCopyJSON = async () => {
    try {
      const json = getCombinedJSON();
      await navigator.clipboard.writeText(json);
      toast({
        title: "Copied!",
        description: "JSON data copied to clipboard.",
      });
    } catch {
      toast({
        title: "Failed to copy",
        description: "Could not copy JSON to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleCopyCombinedText = async () => {
    try {
      const combinedText = getCombinedText();
      await navigator.clipboard.writeText(combinedText);
      toast({
        title: "Copied!",
        description: "Combined text copied to clipboard.",
      });
    } catch {
      toast({
        title: "Failed to copy",
        description: "Could not copy text to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadJSON = () => {
    try {
      const json = getCombinedJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scraped-data-${new Date().toISOString().split('T')[0]}.json`;
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
    setUrl("");
    setSelector("");
    setResults([]);
    setError(null);
    setEnablePagination(false);
    setStartPage(1);
    setEndPage(3);
    setPaginationProgress({ current: 0, total: 0 });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleScrape();
    }
  };

  return (
    <div className="space-y-4">
      {/* Input Section */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            Website URL
            <ExternalLink className="h-3 w-3" />
          </label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="https://example.com"
            className="font-mono text-sm"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            CSS Selector
          </label>
          <Input
            value={selector}
            onChange={(e) => setSelector(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="h1, .title, #content, article, p.description"
            className="font-mono text-sm"
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">
            Examples: <code className="bg-muted px-1 rounded">h1</code>,{" "}
            <code className="bg-muted px-1 rounded">.class-name</code>,{" "}
            <code className="bg-muted px-1 rounded">#id-name</code>,{" "}
            <code className="bg-muted px-1 rounded">article p</code>
          </p>
        </div>

        {/* Pagination Settings */}
        <div className="space-y-3 p-4 border border-border rounded-md bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="pagination" className="flex items-center gap-2">
                <FileStack className="h-4 w-4" />
                Enable Pagination
              </Label>
              <p className="text-xs text-muted-foreground">
                Scrape multiple pages automatically
              </p>
            </div>
            <Switch
              id="pagination"
              checked={enablePagination}
              onCheckedChange={setEnablePagination}
              disabled={loading}
            />
          </div>

          {enablePagination && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="start-page" className="text-xs">
                  Start Page
                </Label>
                <Input
                  id="start-page"
                  type="number"
                  min="1"
                  value={startPage}
                  onChange={(e) => setStartPage(parseInt(e.target.value) || 1)}
                  disabled={loading}
                  className="h-8"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-page" className="text-xs">
                  End Page
                </Label>
                <Input
                  id="end-page"
                  type="number"
                  min="1"
                  value={endPage}
                  onChange={(e) => setEndPage(parseInt(e.target.value) || 1)}
                  disabled={loading}
                  className="h-8"
                />
              </div>
            </div>
          )}

          {enablePagination && (
            <p className="text-xs text-muted-foreground pt-2 border-t border-border">
              <strong>URL Pattern:</strong> Use <code className="bg-muted px-1 rounded">{`{page}`}</code> in your URL, 
              or the tool will automatically append <code className="bg-muted px-1 rounded">?page=</code> or <code className="bg-muted px-1 rounded">&page=</code>
              <br />
              <strong>Example:</strong> <code className="bg-muted px-1 rounded">https://example.com/products?page={`{page}`}</code>
            </p>
          )}
        </div>

        {/* Pagination Progress */}
        {loading && enablePagination && paginationProgress.total > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Scraping pages...</span>
              <span>
                {paginationProgress.current} / {paginationProgress.total}
              </span>
            </div>
            <Progress 
              value={(paginationProgress.current / paginationProgress.total) * 100} 
              className="h-2"
            />
          </div>
        )}

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={handleScrape} 
            disabled={loading || !url.trim() || !selector.trim()}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scraping...
              </>
            ) : (
              <>
                <Globe className="mr-2 h-4 w-4" />
                Scrape
              </>
            )}
          </Button>
          <Button onClick={handleClear} variant="ghost" disabled={loading}>
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
              Results ({results.length} {results.length === 1 ? "element" : "elements"})
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{selector}</Badge>
            </div>
          </div>

          {/* Combined Results Tabs */}
          <Tabs defaultValue="individual" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="individual">Individual</TabsTrigger>
              <TabsTrigger value="combined-text">Combined Text</TabsTrigger>
              <TabsTrigger value="json">JSON Export</TabsTrigger>
            </TabsList>

            {/* Individual Results Tab */}
            <TabsContent value="individual" className="space-y-3 mt-4">

              <div className="space-y-3">
                {results.map((result, index) => (
              <Card key={index} className="bg-card/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-medium">
                        Element #{index + 1}
                      </CardTitle>
                      {result.pageNumber !== undefined && (
                        <Badge variant="outline" className="text-xs">
                          Page {result.pageNumber}
                        </Badge>
                      )}
                    </div>
                    <Button
                      onClick={() => handleCopy(result.text, index)}
                      variant="ghost"
                      size="sm"
                      className="h-7"
                    >
                      {copiedIndex === index ? (
                        <>
                          <Check className="mr-1 h-3 w-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1 h-3 w-3" />
                          Copy Text
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Text Content:</p>
                    <p className="text-sm bg-background/50 p-3 rounded-md border border-border font-mono break-words">
                      {result.text || <span className="text-muted-foreground italic">(empty)</span>}
                    </p>
                  </div>

                  {Object.keys(result.attributes).length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Attributes:</p>
                      <div className="bg-background/50 p-3 rounded-md border border-border">
                        <pre className="text-xs font-mono overflow-x-auto" data-lenisignore>
                          {JSON.stringify(result.attributes, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  <details className="group">
                    <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground">
                      HTML Content (click to expand)
                    </summary>
                    <div className="mt-2 bg-background/50 p-3 rounded-md border border-border">
                      <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words" data-lenisignore>
                        {result.html}
                      </pre>
                    </div>
                  </details>
                </CardContent>
                </Card>
              ))}
              </div>
            </TabsContent>

            {/* Combined Text Tab */}
            <TabsContent value="combined-text" className="mt-4">
              <Card className="bg-card/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      Combined Text ({results.length} {results.length === 1 ? "element" : "elements"})
                    </CardTitle>
                    <Button
                      onClick={handleCopyCombinedText}
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
                    <pre className="text-sm font-mono whitespace-pre-wrap break-words max-h-[600px] overflow-auto" data-lenisignore>
                      {getCombinedText() || <span className="text-muted-foreground italic">No text content found</span>}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* JSON Export Tab */}
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
                        onClick={handleCopyJSON}
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
                    <pre className="text-xs font-mono overflow-x-auto max-h-[600px] overflow-y-auto" data-lenisignore>
                      {getCombinedJSON()}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {!loading && results.length === 0 && !error && (
        <div className="text-center py-8 text-muted-foreground">
          <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">Enter a URL and CSS selector to start scraping</p>
        </div>
      )}
    </div>
  );
}

