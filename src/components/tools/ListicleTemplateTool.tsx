import { useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Copy, Check, Trash2, Eye, Code, Palette, Zap } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "next-themes";
import { prefixCss, removeInlineStylesFromHtml, stripComments, restoreComments } from "@/lib/listicle-template";

// Simple HTML sanitizer to prevent XSS
function sanitizeHtml(html: string): string {
  return html
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

// Extract body content from a full HTML document, stripping doctype/head/body tags
// and unwrapping the outermost .container div if present
function extractBodyContent(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return trimmed;

  // Only process if it looks like a full HTML document
  if (!/<html[\s>]/i.test(trimmed) && !/^<!doctype/i.test(trimmed)) {
    return trimmed;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(trimmed, 'text/html');
  const body = doc.body;
  if (!body) return trimmed;

  // Unwrap outermost <div class="container"> if it's the sole child
  const children = Array.from(body.children);
  if (children.length === 1) {
    const first = children[0] as HTMLElement;
    if (first.tagName === 'DIV' && first.classList.contains('container')) {
      return first.innerHTML.trim();
    }
  }

  return body.innerHTML.trim();
}

// Extract CSS from <style> tags and body HTML from a full HTML document
function extractFromDocument(html: string): { css: string; bodyHtml: string } {
  const trimmed = html.trim();
  if (!trimmed) return { css: '', bodyHtml: '' };

  const parser = new DOMParser();
  const doc = parser.parseFromString(trimmed, 'text/html');

  // Extract all <style> tag contents
  const styleElements = Array.from(doc.querySelectorAll('style'));
  const css = styleElements.map(el => el.textContent || '').join('\n\n').trim();

  // Extract body HTML with container unwrapping
  const body = doc.body;
  let bodyHtml = '';
  if (body) {
    const children = Array.from(body.children);
    if (children.length === 1) {
      const first = children[0] as HTMLElement;
      if (first.tagName === 'DIV' && first.classList.contains('container')) {
        bodyHtml = first.innerHTML.trim();
      } else {
        bodyHtml = body.innerHTML.trim();
      }
    } else {
      bodyHtml = body.innerHTML.trim();
    }
  }

  return { css, bodyHtml };
}

type OutputTab = "css" | "html" | "preview";
type Mode = "quick" | "advanced";

export function ListicleTemplateTool() {
  const { theme } = useTheme();
  const [mode, setMode] = useState<Mode>("quick");
  const [templateName, setTemplateName] = useState("qck__article-template__content");
  const [inputCss, setInputCss] = useState("");
  const [inputHtml, setInputHtml] = useState("");
  const [quickInput, setQuickInput] = useState("");
  const [outputTab, setOutputTab] = useState<OutputTab>("css");
  const [removeInlineStyles, setRemoveInlineStyles] = useState(true);
  const [shopifyMode, setShopifyMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedQuick, setCopiedQuick] = useState(false);

  const scopePrefix = useRef('listicle-preview-' + Math.random().toString(36).substring(2, 11)).current;

  // Advanced mode output
  const output = useMemo(() => {
    let css = inputCss;
    // Extract body content from full HTML documents (strips DOCTYPE/head/body/container)
    let html = extractBodyContent(inputHtml);

    if (templateName && css) {
      css = prefixCss(css, templateName, shopifyMode);
    }

    if (removeInlineStyles && html) {
      html = removeInlineStylesFromHtml(html);
    }

    const baseStyles = `
      #${scopePrefix} { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background: #f8f9fa; }
      #${scopePrefix} h1 { font-size: 2em; font-weight: bold; margin: 0.67em 0; color: #1a1a1a; }
      #${scopePrefix} h2 { font-size: 1.5em; font-weight: bold; margin: 0.83em 0; color: #2c3e50; }
      #${scopePrefix} h3 { font-size: 1.17em; font-weight: bold; margin: 1em 0; color: #34495e; }
      #${scopePrefix} p { margin: 1em 0; }
      #${scopePrefix} div { padding: 16px; }
      #${scopePrefix} .container { max-width: 800px; margin: 0 auto; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    `;

    const scopedCss = css
      ? (() => {
          const { stripped, comments } = stripComments(css);
          // Prefix selectors under #scopePrefix. Use multiline anchor + negative lookahead
          // to skip @-rule lines (e.g. @media, @keyframes) so they stay valid.
          const scoped = stripped.replace(/^(\s*)(?!@)([^{}]+)\{/gm, `$1#${scopePrefix} $2{`);
          return restoreComments(scoped, comments);
        })()
      : '';

    // Wrap with template class for preview only — HTML output stays unwrapped
    const wrappedHtml = html && templateName
      ? `<div class="${templateName}">${html}</div>`
      : html;

    // Sanitize HTML and guard against </style> injection in CSS before assembling.
    const safeHtml = wrappedHtml ? sanitizeHtml(wrappedHtml) : '';
    const safeCss = (baseStyles + scopedCss).replace(/<\/style\s*>/gi, '');
    const previewHtml = safeHtml
      ? `<div id="${scopePrefix}"><style>${safeCss}</style>${safeHtml}</div>`
      : '';

    return { css, html, previewHtml };
  }, [inputCss, inputHtml, templateName, removeInlineStyles, shopifyMode, scopePrefix]);

  // Quick Convert mode output
  const quickOutput = useMemo(() => {
    if (!quickInput.trim()) return '';

    const { css: extractedCss, bodyHtml } = extractFromDocument(quickInput);

    let css = extractedCss;
    let html = bodyHtml;

    if (templateName && css) {
      css = prefixCss(css, templateName, shopifyMode);
    }

    if (removeInlineStyles && html) {
      html = removeInlineStylesFromHtml(html);
    }

    const parts: string[] = [];
    if (css) parts.push(`<style>\n${css}\n</style>`);
    if (html) parts.push(html);

    return parts.join('\n\n');
  }, [quickInput, templateName, removeInlineStyles, shopifyMode]);

  const handleCopy = async (text: string, onSuccess: () => void) => {
    try {
      await navigator.clipboard.writeText(text);
      onSuccess();
      toast({ title: "Copied!", description: "Output copied to clipboard." });
    } catch {
      toast({ title: "Failed to copy", description: "Could not copy to clipboard.", variant: "destructive" });
    }
  };

  const handleCopyAdvanced = () => {
    const text = outputTab === "css" ? output.css : outputTab === "html" ? output.html : output.previewHtml;
    handleCopy(text, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCopyQuick = () => {
    handleCopy(quickOutput, () => {
      setCopiedQuick(true);
      setTimeout(() => setCopiedQuick(false), 2000);
    });
  };

  const handleClear = () => {
    if (mode === "quick") {
      setQuickInput("");
    } else {
      setInputCss("");
      setInputHtml("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Template Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Class Prefix</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="qck__article-template__content"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Added before every CSS selector in the output
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="remove-inline"
                checked={removeInlineStyles}
                onCheckedChange={(checked) => setRemoveInlineStyles(checked as boolean)}
              />
              <Label htmlFor="remove-inline" className="text-sm font-normal cursor-pointer">
                Remove inline styles from HTML
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="shopify-mode"
                checked={shopifyMode}
                onCheckedChange={(checked) => setShopifyMode(checked as boolean)}
              />
              <div>
                <Label htmlFor="shopify-mode" className="text-sm font-normal cursor-pointer">
                  Shopify mode
                </Label>
                <p className="text-xs text-muted-foreground">
                  Skip global reset rules (<code className="font-mono">*</code>, <code className="font-mono">body</code>, <code className="font-mono">html</code>, <code className="font-mono">:root</code>) that conflict with Shopify's base styles
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {mode === "quick" ? "Quick Convert" : "Advanced"}
            </CardTitle>
            <CardDescription className="text-xs">
              {mode === "quick"
                ? "Paste a full HTML document. CSS is auto-extracted from <style> tags, prefixed, and combined with the cleaned body into one output."
                : "Separate CSS and HTML inputs. HTML fields accept full documents — DOCTYPE, head, body tags are stripped and the outer .container div is unwrapped."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground font-mono">
            {mode === "quick" ? (
              <>
                <div>
                  <div className="text-xs text-foreground mb-1">Input:</div>
                  <code className="text-xs">{"<style>.className { color: red; }</style>"}</code>
                </div>
                <div>
                  <div className="text-xs text-foreground mb-1">Output:</div>
                  <code className="text-xs">{"<style>"}</code><br />
                  <code className="text-xs">&nbsp;&nbsp;{".qck__article-template__content .className { color: red; }"}</code><br />
                  <code className="text-xs">{"</style>"}</code><br />
                  <code className="text-xs">{"<h1>Article title</h1>"}</code>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="text-xs text-foreground mb-1">Input:</div>
                  <code className="text-xs">.className {'{ color: red; }'}</code>
                </div>
                <div>
                  <div className="text-xs text-foreground mb-1">Output:</div>
                  <code className="text-xs">.qck__article-template__content .className {'{ color: red; }'}</code>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mode toggle */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList>
          <TabsTrigger value="quick" className="gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            Quick Convert
          </TabsTrigger>
          <TabsTrigger value="advanced" className="gap-1.5">
            <Code className="h-3.5 w-3.5" />
            Advanced
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "quick" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="quick-input">Full HTML Document</Label>
            <Textarea
              id="quick-input"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder={`Paste your full HTML document here.

What gets processed automatically:
  - CSS extracted from <style> tags → prefixed with template class
  - DOCTYPE, <html>, <head>, <body> tags stripped
  - Outer .container div unwrapped
  - Inline styles removed (if enabled in settings)

Output is one combined block:
  <style>/* prefixed css */</style>

  <!-- clean body html -->`}
              className="font-mono min-h-[300px] text-sm"
              data-lenisignore
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleClear}>
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
            <Button size="sm" onClick={handleCopyQuick} disabled={!quickOutput}>
              {copiedQuick ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              Copy Output
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-auto" data-lenisignore>
                <SyntaxHighlighter
                  language="html"
                  style={theme === "dark" ? oneDark : oneLight}
                  customStyle={{
                    margin: 0,
                    padding: "1rem",
                    background: "transparent",
                    fontSize: "0.875rem",
                  }}
                  showLineNumbers
                >
                  {quickOutput || ""}
                </SyntaxHighlighter>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="input-css">CSS Input</Label>
              <Textarea
                id="input-css"
                value={inputCss}
                onChange={(e) => setInputCss(e.target.value)}
                placeholder=".className {
  color: red;
  margin: 10px;
}

.other-class, .another-class {
  padding: 20px;
}"
                className="font-mono min-h-[300px] text-sm"
                data-lenisignore
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="input-html">HTML Input (optional)</Label>
              <Textarea
                id="input-html"
                value={inputHtml}
                onChange={(e) => setInputHtml(e.target.value)}
                placeholder="Paste a full HTML document or just the body content.
Full documents are automatically cleaned:
  - DOCTYPE, <html>, <head>, <body> tags removed
  - Outer .container div unwrapped
  - Inline styles removed (if enabled above)"
                className="font-mono min-h-[300px] text-sm"
                data-lenisignore
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Tabs value={outputTab} onValueChange={(v) => setOutputTab(v as OutputTab)}>
                <TabsList>
                  <TabsTrigger value="css" className="gap-1">
                    <Code className="h-3 w-3" />
                    CSS
                  </TabsTrigger>
                  <TabsTrigger value="html" className="gap-1">
                    <Code className="h-3 w-3" />
                    HTML
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="gap-1">
                    <Eye className="h-3 w-3" />
                    Preview
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleClear}>
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
              <Button size="sm" onClick={handleCopyAdvanced} disabled={!(outputTab === "css" ? output.css : outputTab === "html" ? output.html : output.previewHtml)}>
                {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                Copy {outputTab === "css" ? "CSS" : outputTab === "html" ? "HTML" : "Output"}
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {outputTab === "preview" ? (
                <div className="p-4 bg-white dark:bg-gray-900 max-h-[1200px] overflow-auto" data-lenisignore>
                  {output.previewHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: output.previewHtml }} />
                  ) : (
                    <p className="text-muted-foreground text-sm">No HTML output to preview. Paste HTML in the HTML Input field above, and optionally add CSS to see the styled preview.</p>
                  )}
                </div>
              ) : (
                <div className="max-h-[400px] overflow-auto" data-lenisignore>
                  <SyntaxHighlighter
                    language={outputTab === "css" ? "css" : "html"}
                    style={theme === "dark" ? oneDark : oneLight}
                    customStyle={{
                      margin: 0,
                      padding: "1rem",
                      background: "transparent",
                      fontSize: "0.875rem",
                    }}
                    showLineNumbers
                  >
                    {outputTab === "css" ? output.css : output.html || ""}
                  </SyntaxHighlighter>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
