import { useState, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Copy, Check, Trash2, ArrowDownUp, Eye, Code, Palette } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "next-themes";
import { prefixCss, removeInlineStylesFromHtml } from "@/lib/listicle-template";

// Simple HTML sanitizer to prevent XSS
function sanitizeHtml(html: string): string {
  return html
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

type OutputTab = "css" | "html" | "preview";

export function ListicleTemplateTool() {
  const { theme } = useTheme();
  const [templateName, setTemplateName] = useState("qck__article-template__content");
  const [inputCss, setInputCss] = useState("");
  const [inputHtml, setInputHtml] = useState("");
  const [outputTab, setOutputTab] = useState<OutputTab>("css");
  const [removeInlineStyles, setRemoveInlineStyles] = useState(true);
  const [copied, setCopied] = useState(false);

  const scopePrefix = useRef('listicle-preview-' + Math.random().toString(36).substr(2, 9)).current;

  const output = useMemo(() => {
    let css = inputCss;
    let html = inputHtml;

    if (templateName && css) {
      css = prefixCss(css, templateName);
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
      ? css.replace(/([^{}]+)\{/g, `#${scopePrefix} $1{`)
      : '';

    const wrappedHtml = html && templateName
      ? `<div class="${templateName}">${html}</div>`
      : html;

    const previewHtml = wrappedHtml 
      ? `<div id="${scopePrefix}"><style>${baseStyles}${scopedCss}</style>${wrappedHtml}</div>` 
      : '';

    return { css, html, previewHtml };
  }, [inputCss, inputHtml, templateName, removeInlineStyles, scopePrefix]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: "Copied!",
        description: `${outputTab === 'css' ? 'CSS' : 'HTML'} copied to clipboard.`,
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
    setInputCss("");
    setInputHtml("");
  };

  const handleCopyOutput = () => {
    const text = outputTab === "css" ? output.css : outputTab === "html" ? output.html : output.previewHtml;
    handleCopy(text);
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
                This prefix will be added before all CSS class selectors
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Examples</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground font-mono">
            <div>
              <div className="text-xs text-foreground mb-1">Input:</div>
              <code className="text-xs">.className {'{ color: red; }'}</code>
            </div>
            <div>
              <div className="text-xs text-foreground mb-1">Output:</div>
              <code className="text-xs">.qck__article-template__content .className {'{ color: red; }'}</code>
            </div>
          </CardContent>
        </Card>
      </div>

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
            placeholder="<body style=&quot;margin: 0;&quot;>
  <div class=&quot;container&quot; style=&quot;padding: 20px;&quot;>
    <h1 style=&quot;font-size: 24px;&quot;>Title</h1>
  </div>
</body>"
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
          <Button size="sm" onClick={handleCopyOutput} disabled={!output.css && !output.html}>
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
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(output.previewHtml) }} />
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
    </div>
  );
}
