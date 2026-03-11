import { useState, useRef, useEffect, useMemo } from "react";
import { Copy, Check, FileText, Code, ShoppingBag, Newspaper, ChevronDown, ChevronUp, X, Eye, CheckCircle2, AlertCircle, Maximize2, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { convertWordToHtml, getUnformattedHtml, convertToHtml, type OutputMode, type FeatureFlags } from "@/lib/word-to-html/converter";
import { cleanWordHtml } from "@/lib/word-to-html/word-html-cleaner";
import { validateMode, type ValidationResults } from "@/lib/word-to-html/validator";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "next-themes";

// Custom theme matching the website's color scheme
const customTheme = {
  'code[class*="language-"]': {
    color: 'hsl(var(--foreground))',
    background: 'transparent',
    textShadow: 'none',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.875rem',
    lineHeight: '1.75',
  },
  'pre[class*="language-"]': {
    color: 'hsl(var(--foreground))',
    background: 'hsl(var(--background) / 0.8)',
    textShadow: 'none',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.875rem',
    lineHeight: '1.75',
    padding: '1rem',
    margin: 0,
    overflow: 'auto',
    height: '100%',
  },
  '.token.comment': {
    color: 'hsl(var(--muted-foreground))',
    fontStyle: 'italic',
  },
  '.token.prolog': {
    color: 'hsl(var(--muted-foreground))',
  },
  '.token.doctype': {
    color: 'hsl(var(--muted-foreground))',
  },
  '.token.cdata': {
    color: 'hsl(var(--muted-foreground))',
  },
  '.token.punctuation': {
    color: 'hsl(var(--foreground) / 0.7)',
  },
  '.token.property': {
    color: 'hsl(var(--syntax-blue))',
  },
  '.token.tag': {
    color: 'hsl(var(--syntax-orange))',
  },
  '.token.boolean': {
    color: 'hsl(var(--syntax-purple))',
  },
  '.token.number': {
    color: 'hsl(var(--syntax-purple))',
  },
  '.token.constant': {
    color: 'hsl(var(--syntax-purple))',
  },
  '.token.symbol': {
    color: 'hsl(var(--syntax-purple))',
  },
  '.token.deleted': {
    color: 'hsl(var(--destructive))',
  },
  '.token.selector': {
    color: 'hsl(var(--syntax-green))',
  },
  '.token.attr-name': {
    color: 'hsl(var(--syntax-yellow))',
  },
  '.token.string': {
    color: 'hsl(var(--syntax-green))',
  },
  '.token.char': {
    color: 'hsl(var(--syntax-green))',
  },
  '.token.builtin': {
    color: 'hsl(var(--syntax-cyan))',
  },
  '.token.inserted': {
    color: 'hsl(var(--syntax-green))',
  },
  '.token.entity': {
    color: 'hsl(var(--syntax-orange))',
    cursor: 'help',
  },
  '.token.url': {
    color: 'hsl(var(--syntax-cyan))',
  },
  '.token.operator': {
    color: 'hsl(var(--foreground) / 0.7)',
  },
  '.token.atrule': {
    color: 'hsl(var(--syntax-blue))',
  },
  '.token.attr-value': {
    color: 'hsl(var(--syntax-green))',
  },
  '.token.keyword': {
    color: 'hsl(var(--syntax-purple))',
  },
  '.token.function': {
    color: 'hsl(var(--syntax-blue))',
  },
  '.token.class-name': {
    color: 'hsl(var(--syntax-yellow))',
  },
  '.token.regex': {
    color: 'hsl(var(--syntax-cyan))',
  },
  '.token.important': {
    color: 'hsl(var(--syntax-orange))',
    fontWeight: 'bold',
  },
  '.token.variable': {
    color: 'hsl(var(--syntax-orange))',
  },
} as any;

export function WordToHtmlConverter() {
  const { theme } = useTheme();
  const [inputHtml, setInputHtml] = useState("");
  const [outputFormat, setOutputFormat] = useState<OutputMode>("regular");
  const [copied, setCopied] = useState(false);
  const [showBlogsFeatures, setShowBlogsFeatures] = useState(false);
  const [showShoppablesFeatures, setShowShoppablesFeatures] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showValidationDetails, setShowValidationDetails] = useState(false);
  const [showMaximizedOutput, setShowMaximizedOutput] = useState(false);
  const [maximizedPreviewMode, setMaximizedPreviewMode] = useState(false);
  const [showHeadingVisualizer, setShowHeadingVisualizer] = useState(false);
  
  // Feature flags
  const [features, setFeatures] = useState<FeatureFlags>({
    headingStrong: true,
    keyTakeaways: true,
    h1Removal: true,
    linkAttributes: true,
    relativePaths: false,
    spacing: undefined, // undefined allows blogs mode to be checked by default (undefined !== false) and shoppables to be unchecked (undefined === true is false)
    olHeaderConversion: true,
    sourcesNormalize: true,
    removeSourcesLinks: true,
  });

  const inputAreaRef = useRef<HTMLDivElement>(null);

  // Auto-focus the input area when component mounts
  // The container is focused first to establish focus context, then the input gets focus
  useEffect(() => {
    let focusTimeout: ReturnType<typeof setTimeout>;
    let restoreTimeout: ReturnType<typeof setTimeout>;
    let hasUserInteracted = false;
    
    // Track user interaction to avoid re-focusing after user clicks away
    const handleUserInteraction = () => {
      hasUserInteracted = true;
    };
    document.addEventListener('mousedown', handleUserInteraction, { once: true, capture: true });
    document.addEventListener('keydown', handleUserInteraction, { once: true, capture: true });
    
    // Focus the input after container has been focused (container focus happens in parent component)
    const focusInput = () => {
      if (inputAreaRef.current && !hasUserInteracted) {
        inputAreaRef.current.focus();
        
        // Re-focus if lost within 300ms (unless user interacted)
        restoreTimeout = setTimeout(() => {
          if (inputAreaRef.current && document.activeElement !== inputAreaRef.current && !hasUserInteracted) {
            inputAreaRef.current.focus();
          }
        }, 300);
      }
    };
    
    // Wait for container to be focused first, then focus input
    // Container focus happens in parent component, so we wait a bit longer
    requestAnimationFrame(() => {
      setTimeout(focusInput, 250);
    });
    
    return () => {
      clearTimeout(focusTimeout);
      clearTimeout(restoreTimeout);
      document.removeEventListener('mousedown', handleUserInteraction, { capture: true });
      document.removeEventListener('keydown', handleUserInteraction, { capture: true });
    };
  }, []);

  // Handle paste events - allow natural paste, then process
  useEffect(() => {
    const inputArea = inputAreaRef.current;
    if (!inputArea) return;

    const handlePaste = (e: ClipboardEvent) => {
      // Allow the paste to happen naturally in the contenteditable div
      // Then process it after a short delay to ensure content is inserted
      // This matches the original behavior
      setTimeout(() => {
        const content = inputArea.innerHTML;
        if (content.trim()) {
          setInputHtml(content);
        }
      }, 10);
    };

    const handleInput = () => {
      // Process input changes immediately
      const content = inputArea.innerHTML;
      setInputHtml(content);
    };

    inputArea.addEventListener('paste', handlePaste);
    inputArea.addEventListener('input', handleInput);
    
    return () => {
      inputArea.removeEventListener('paste', handlePaste);
      inputArea.removeEventListener('input', handleInput);
    };
  }, []);

  const clearInput = () => {
    if (inputAreaRef.current) {
      inputAreaRef.current.innerHTML = '';
      setInputHtml('');
    }
  };

  // Convert HTML following the exact same flow as the original
  // This matches: handleInput/handlePaste -> cleanWordHtml -> convertToHtml
  const getConversionResult = () => {
    if (!inputHtml || !inputHtml.trim()) {
      return { formatted: '', unformatted: '' };
    }

    try {
      // Step 1: Clean Word HTML first (preserves formatting)
      // This matches: const cleanedHtml = cleanWordHtml(inputArea.innerHTML);
      const cleanedHtml = cleanWordHtml(inputHtml);
      
      // Step 2-4: Convert using the main conversion function
      // This matches: convertToHtml(cleanedHtml);
      return convertToHtml(cleanedHtml, outputFormat, features);
    } catch (error) {
      console.error('Conversion error:', error);
      return { formatted: '', unformatted: '' };
    }
  };

  const conversionResult = getConversionResult();
  const outputHtml = conversionResult.formatted;
  const previewHtml = conversionResult.unformatted;

  // Run validation when output changes
  const validationResults = useMemo<ValidationResults | null>(() => {
    if (!previewHtml || !previewHtml.trim()) {
      return null;
    }
    try {
      return validateMode(previewHtml, outputFormat, features);
    } catch (error) {
      console.error('Validation error:', error);
      return null;
    }
  }, [previewHtml, outputFormat, features]);

  return (
    <div className="flex flex-col gap-3 md:gap-4 w-full max-w-full">
      {/* Main grid: Sidebar | Input | Output */}
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_1fr] gap-3 md:gap-4 w-full max-w-full min-w-0">
        {/* Sidebar Container: Toolbar + Validation */}
        <div className="flex flex-col gap-3 md:gap-4 min-w-0 lg:min-w-[200px] lg:max-w-[280px] lg:w-auto lg:h-full lg:overflow-y-auto">
          {/* Mode Selection Toolbar */}
          <div className="bg-card/50 border border-border/50 rounded-xl p-3 md:p-4 backdrop-blur-sm">
            <div className="space-y-3 md:space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Output Format:</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-muted/30 transition-colors">
                    <input
                      type="radio"
                      name="outputMode"
                      value="regular"
                      checked={outputFormat === 'regular'}
                      onChange={(e) => setOutputFormat(e.target.value as OutputMode)}
                      className="accent-primary"
                    />
                    <span className={`text-sm ${outputFormat === 'regular' ? 'text-primary font-medium' : 'text-foreground'}`}>
                      Regular
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-muted/30 transition-colors">
                    <input
                      type="radio"
                      name="outputMode"
                      value="blogs"
                      checked={outputFormat === 'blogs'}
                      onChange={(e) => setOutputFormat(e.target.value as OutputMode)}
                      className="accent-primary"
                    />
                    <span className={`text-sm ${outputFormat === 'blogs' ? 'text-primary font-medium' : 'text-foreground'}`}>
                      Blogs
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-muted/30 transition-colors">
                    <input
                      type="radio"
                      name="outputMode"
                      value="shoppables"
                      checked={outputFormat === 'shoppables'}
                      onChange={(e) => setOutputFormat(e.target.value as OutputMode)}
                      className="accent-primary"
                    />
                    <span className={`text-sm ${outputFormat === 'shoppables' ? 'text-primary font-medium' : 'text-foreground'}`}>
                      Shoppables
                    </span>
                  </label>
                </div>
              </div>

              {/* Feature toggles for Blogs mode */}
              {outputFormat === 'blogs' && (
                <Collapsible open={showBlogsFeatures} onOpenChange={setShowBlogsFeatures}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-sm font-medium hover:bg-muted/30 rounded-md transition-colors">
                    <span>Blogs Features:</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showBlogsFeatures ? 'rotate-180' : ''}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={features.headingStrong !== false}
                onCheckedChange={(checked) => setFeatures({ ...features, headingStrong: checked as boolean })}
              />
              <span className="text-sm">Heading Strong Tags</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={features.keyTakeaways !== false}
                onCheckedChange={(checked) => setFeatures({ ...features, keyTakeaways: checked as boolean })}
              />
              <span className="text-sm">Key Takeaways Formatting</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={features.h1Removal !== false}
                onCheckedChange={(checked) => setFeatures({ ...features, h1Removal: checked as boolean })}
              />
              <span className="text-sm">Remove H1 after Key Takeaways</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={features.linkAttributes !== false}
                onCheckedChange={(checked) => setFeatures({ ...features, linkAttributes: checked as boolean })}
              />
              <span className="text-sm">Link Attributes</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={features.spacing !== false}
                onCheckedChange={(checked) => setFeatures({ ...features, spacing: checked as boolean })}
              />
              <span className="text-sm">Spacing Rules</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={features.relativePaths === true}
                onCheckedChange={(checked) => setFeatures({ ...features, relativePaths: checked as boolean })}
              />
              <span className="text-sm">Relative Paths</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={features.olHeaderConversion !== false}
                onCheckedChange={(checked) => setFeatures({ ...features, olHeaderConversion: checked as boolean })}
              />
              <span className="text-sm">OL Header Conversion</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={features.sourcesNormalize !== false}
                onCheckedChange={(checked) => setFeatures({ ...features, sourcesNormalize: checked as boolean })}
              />
              <span className="text-sm">Normalize Sources</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={features.removeSourcesLinks !== false}
                onCheckedChange={(checked) => setFeatures({ ...features, removeSourcesLinks: checked as boolean })}
              />
              <span className="text-sm">Remove Links in Sources</span>
            </label>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Feature toggles for Shoppables mode */}
              {outputFormat === 'shoppables' && (
                <Collapsible open={showShoppablesFeatures} onOpenChange={setShowShoppablesFeatures}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-sm font-medium hover:bg-muted/30 rounded-md transition-colors">
                    <span>Shoppables Features:</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showShoppablesFeatures ? 'rotate-180' : ''}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <Checkbox
                        checked={features.headingStrong !== false}
                        onCheckedChange={(checked) => setFeatures({ ...features, headingStrong: checked as boolean })}
                      />
                      <span className="text-sm">Heading Strong Tags</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <Checkbox
                        checked={features.linkAttributes !== false}
                        onCheckedChange={(checked) => setFeatures({ ...features, linkAttributes: checked as boolean })}
                      />
                      <span className="text-sm">Link Attributes</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <Checkbox
                        checked={features.relativePaths === true}
                        onCheckedChange={(checked) => setFeatures({ ...features, relativePaths: checked as boolean })}
                      />
                      <span className="text-sm">Relative Paths</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <Checkbox
                        checked={features.olHeaderConversion !== false}
                        onCheckedChange={(checked) => setFeatures({ ...features, olHeaderConversion: checked as boolean })}
                      />
                      <span className="text-sm">OL Header Conversion</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <Checkbox
                        checked={features.spacing === true}
                        onCheckedChange={(checked) => setFeatures({ ...features, spacing: checked as boolean })}
                      />
                      <span className="text-sm">Spacing Rules</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <Checkbox
                        checked={features.brBeforeReadMore === true}
                        onCheckedChange={(checked) => setFeatures({ ...features, brBeforeReadMore: checked as boolean })}
                      />
                      <span className="text-sm">Add BR Before Read More</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <Checkbox
                        checked={features.brBeforeSources === true}
                        onCheckedChange={(checked) => setFeatures({ ...features, brBeforeSources: checked as boolean })}
                      />
                      <span className="text-sm">Add BR Before Sources</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <Checkbox
                        checked={features.sourcesNormalize !== false}
                        onCheckedChange={(checked) => setFeatures({ ...features, sourcesNormalize: checked as boolean })}
                      />
                      <span className="text-sm">Normalize Sources</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <Checkbox
                        checked={features.removeSourcesLinks !== false}
                        onCheckedChange={(checked) => setFeatures({ ...features, removeSourcesLinks: checked as boolean })}
                      />
                      <span className="text-sm">Remove Links in Sources</span>
                    </label>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </div>

          {/* Validation Panel */}
          {validationResults && (
            <div className="bg-card/50 border border-border/50 rounded-xl p-3 md:p-4 backdrop-blur-sm mt-3 md:mt-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded bg-primary/10">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Validation</span>
              </div>
          <div className="space-y-3">
            {/* Summary */}
            <div className={`p-3 rounded-lg border ${
              validationResults.summary.failed === 0
                ? 'bg-green-500/10 border-green-500/30'
                : validationResults.summary.passed > 0
                ? 'bg-yellow-500/10 border-yellow-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              <div className={`font-semibold mb-1 ${
                validationResults.summary.failed === 0
                  ? 'text-green-500'
                  : validationResults.summary.passed > 0
                  ? 'text-yellow-500'
                  : 'text-red-500'
              }`}>
                {outputFormat.toUpperCase()} Mode Validation
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Total: {validationResults.summary.total}</span>
                <span className="text-green-500">Passed: {validationResults.summary.passed}</span>
                {validationResults.summary.failed > 0 && (
                  <span className="text-red-500">Failed: {validationResults.summary.failed}</span>
                )}
                <span>
                  Success Rate: {validationResults.summary.total > 0 
                    ? ((validationResults.summary.passed / validationResults.summary.total) * 100).toFixed(1)
                    : 0}%
                </span>
              </div>
            </div>

            {/* Details Toggle */}
            <Collapsible open={showValidationDetails} onOpenChange={setShowValidationDetails}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-sm font-medium hover:bg-muted/30 rounded transition-colors">
                <span>Details</span>
                {showValidationDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {validationResults.results.map((result, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded border-l-3 ${
                      result.passed
                        ? 'bg-green-500/5 border-l-green-500'
                        : 'bg-red-500/5 border-l-red-500'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full ${
                        result.passed ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <span className="font-medium text-sm">{result.feature}</span>
                    </div>
                    <div className="text-xs text-muted-foreground ml-4 mb-1">
                      {result.message}
                    </div>
                    {result.details && result.details.length > 0 && (
                      <div className="text-xs font-mono text-muted-foreground ml-4 mt-1">
                        {result.details.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>
            </div>
          )}
        </div>

        {/* Input Section */}
        <div className="flex flex-col bg-card/50 border border-border/50 rounded-xl p-3 md:p-4 backdrop-blur-sm min-w-0 max-w-full lg:h-[calc(100vh-280px)] lg:min-h-[400px] lg:max-h-[700px]">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-muted">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Input</span>
            </div>
            {inputHtml && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearInput}
                className="h-8 w-8 p-0"
                title="Clear"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div
            ref={inputAreaRef}
            contentEditable
            tabIndex={0}
            data-placeholder="Paste your Word document content here..."
            className="flex-1 min-h-[200px] max-h-[50vh] lg:max-h-[calc(100vh-380px)] p-4 text-sm bg-background/80 border border-border/50 rounded-lg overflow-y-auto overflow-x-hidden resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 input-editable"
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'hsl(var(--foreground))',
              fontSize: '0.875rem',
              lineHeight: '1.75',
              fontFamily: 'var(--font-sans)',
            }}
          />
          <style>{`
            [contenteditable][data-placeholder]:empty:before {
              content: attr(data-placeholder);
              color: hsl(var(--muted-foreground) / 0.4);
              pointer-events: none;
            }
            .input-editable,
            .input-editable *,
            .input-editable p,
            .input-editable div,
            .input-editable span,
            .input-editable h1,
            .input-editable h2,
            .input-editable h3,
            .input-editable h4,
            .input-editable h5,
            .input-editable h6,
            .input-editable li,
            .input-editable td,
            .input-editable th {
              color: hsl(var(--foreground)) !important;
            }
            .input-editable {
              -webkit-text-fill-color: hsl(var(--foreground)) !important;
            }
          `}</style>
        </div>

        {/* Output Section */}
        <div className="flex flex-col bg-card/50 border border-border/50 rounded-xl p-3 md:p-4 backdrop-blur-sm min-w-0 max-w-full lg:h-[calc(100vh-280px)] lg:min-h-[400px] lg:max-h-[700px]">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-primary/10">
                <Code className="h-4 w-4 text-primary" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Output</span>
            </div>

            <div className="flex items-center gap-1">
              {/* View Toggle - matches original toggle-group */}
              <div className="flex items-center bg-muted/50 rounded-md p-0.5 mr-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(false)}
                  className={`h-7 w-7 p-0 rounded ${
                    !showPreview ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/30'
                  }`}
                  title="Code"
                >
                  <Code className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(true)}
                  className={`h-7 w-7 p-0 rounded ${
                    showPreview ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/30'
                  }`}
                  title="Preview"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </div>
              {/* Heading Visualizer Toggle */}
              {showPreview && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHeadingVisualizer(!showHeadingVisualizer)}
                  className={`h-7 w-7 p-0 ml-1 ${
                    showHeadingVisualizer ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/30'
                  }`}
                  title={showHeadingVisualizer ? 'Hide Heading Labels' : 'Show Heading Labels'}
                >
                  <Hash className="h-3.5 w-3.5" />
                </Button>
              )}
              {/* Maximize Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMaximizedPreviewMode(showPreview);
                  setShowMaximizedOutput(true);
                }}
                disabled={!outputHtml}
                className="h-8 w-8 p-0"
                title="Maximize Output"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              {/* Copy Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (outputHtml) {
                    await navigator.clipboard.writeText(outputHtml);
                    setCopied(true);
                    toast({
                      title: "Copied!",
                      description: "HTML copied to clipboard",
                    });
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
                disabled={!outputHtml}
                className="h-8 w-8 p-0"
                title="Copy HTML"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          {/* Output Container - matches original structure */}
          <div className="relative flex-1 min-h-[200px] max-h-[50vh] lg:max-h-[calc(100vh-380px)] w-full overflow-hidden">
            <div className="absolute inset-0 h-full w-full">
              {/* Preview Area - matches .output-area from original */}
              <div 
                className={`absolute inset-0 pl-8 pr-4 pt-4 pb-4 border border-border/50 rounded-lg overflow-y-auto overflow-x-auto bg-background/80 output-preview ${
                  showPreview ? 'block' : 'hidden'
                }`}
                style={{
                  fontSize: '0.875rem',
                  lineHeight: '1.75',
                  fontFamily: 'var(--font-sans)',
                }}
                dangerouslySetInnerHTML={{ 
                  __html: previewHtml || '<p style="color: hsl(var(--muted-foreground));">// Preview will appear here...</p>' 
                }}
              />
              <style>{`
                .output-preview p {
                  margin: 0.5em 0;
                  color: hsl(var(--foreground) / 0.9);
                }
                .output-preview h1 {
                  margin: 1em 0 0.5em 0;
                  font-weight: bold;
                  font-size: 2em;
                  line-height: 1.2;
                  color: hsl(var(--foreground));
                  position: relative;
                  overflow-wrap: break-word;
                }
                .output-preview h1::before {
                  content: "H1";
                  position: absolute;
                  top: -0.25rem;
                  left: -2rem;
                  background: hsl(var(--destructive));
                  color: white;
                  font-size: 0.6rem;
                  font-weight: bold;
                  padding: 0.125rem 0.25rem;
                  border-radius: 0.25rem;
                  font-family: var(--font-mono);
                  pointer-events: none;
                  user-select: none;
                  display: ${showHeadingVisualizer ? 'block' : 'none'};
                }
                .output-preview h2 {
                  margin: 1em 0 0.5em 0;
                  font-weight: bold;
                  font-size: 1.5em;
                  line-height: 1.3;
                  color: hsl(var(--foreground));
                  position: relative;
                  overflow-wrap: break-word;
                }
                .output-preview h2::before {
                  content: "H2";
                  position: absolute;
                  top: -0.25rem;
                  left: -2rem;
                  background: hsl(var(--syntax-orange));
                  color: hsl(var(--foreground));
                  font-size: 0.6rem;
                  font-weight: bold;
                  padding: 0.125rem 0.25rem;
                  border-radius: 0.25rem;
                  font-family: var(--font-mono);
                  pointer-events: none;
                  user-select: none;
                  display: ${showHeadingVisualizer ? 'block' : 'none'};
                }
                .output-preview h3 {
                  margin: 1em 0 0.5em 0;
                  font-weight: bold;
                  font-size: 1.25em;
                  line-height: 1.4;
                  color: hsl(var(--foreground));
                  position: relative;
                  overflow-wrap: break-word;
                }
                .output-preview h3::before {
                  content: "H3";
                  position: absolute;
                  top: -0.25rem;
                  left: -2rem;
                  background: hsl(var(--syntax-yellow));
                  color: hsl(var(--foreground));
                  font-size: 0.6rem;
                  font-weight: bold;
                  padding: 0.125rem 0.25rem;
                  border-radius: 0.25rem;
                  font-family: var(--font-mono);
                  pointer-events: none;
                  user-select: none;
                  display: ${showHeadingVisualizer ? 'block' : 'none'};
                }
                .output-preview h4 {
                  margin: 1em 0 0.5em 0;
                  font-weight: bold;
                  font-size: 1.1em;
                  line-height: 1.4;
                  color: hsl(var(--foreground));
                  position: relative;
                  overflow-wrap: break-word;
                }
                .output-preview h4::before {
                  content: "H4";
                  position: absolute;
                  top: -0.25rem;
                  left: -2rem;
                  background: hsl(var(--syntax-green));
                  color: hsl(var(--foreground));
                  font-size: 0.6rem;
                  font-weight: bold;
                  padding: 0.125rem 0.25rem;
                  border-radius: 0.25rem;
                  font-family: var(--font-mono);
                  pointer-events: none;
                  user-select: none;
                  display: ${showHeadingVisualizer ? 'block' : 'none'};
                }
                .output-preview h5 {
                  margin: 1em 0 0.5em 0;
                  font-weight: bold;
                  font-size: 1em;
                  line-height: 1.5;
                  color: hsl(var(--foreground));
                  position: relative;
                  overflow-wrap: break-word;
                }
                .output-preview h5::before {
                  content: "H5";
                  position: absolute;
                  top: -0.25rem;
                  left: -2rem;
                  background: hsl(var(--syntax-blue));
                  color: white;
                  font-size: 0.6rem;
                  font-weight: bold;
                  padding: 0.125rem 0.25rem;
                  border-radius: 0.25rem;
                  font-family: var(--font-mono);
                  pointer-events: none;
                  user-select: none;
                  display: ${showHeadingVisualizer ? 'block' : 'none'};
                }
                .output-preview h6 {
                  margin: 1em 0 0.5em 0;
                  font-weight: bold;
                  font-size: 0.9em;
                  line-height: 1.5;
                  color: hsl(var(--foreground));
                  position: relative;
                  overflow-wrap: break-word;
                }
                .output-preview h6::before {
                  content: "H6";
                  position: absolute;
                  top: -0.25rem;
                  left: -2rem;
                  background: hsl(var(--syntax-purple));
                  color: white;
                  font-size: 0.6rem;
                  font-weight: bold;
                  padding: 0.125rem 0.25rem;
                  border-radius: 0.25rem;
                  font-family: var(--font-mono);
                  pointer-events: none;
                  user-select: none;
                  display: ${showHeadingVisualizer ? 'block' : 'none'};
                }
                .output-preview strong,
                .output-preview b {
                  font-weight: bold;
                  color: hsl(var(--foreground));
                }
                .output-preview ul {
                  margin: 0.5em 0;
                  padding-left: 2em;
                  color: hsl(var(--foreground) / 0.9);
                  list-style-type: disc;
                  display: block;
                }
                .output-preview ol {
                  margin: 0.5em 0;
                  padding-left: 2em;
                  color: hsl(var(--foreground) / 0.9);
                  list-style-type: decimal;
                  display: block;
                }
                .output-preview li {
                  display: list-item;
                  margin: 0.25em 0;
                  color: hsl(var(--foreground) / 0.9);
                }
                .output-preview ul ul {
                  list-style-type: circle;
                  margin-top: 0.25em;
                  margin-bottom: 0.25em;
                }
                .output-preview ul ul ul {
                  list-style-type: square;
                }
                .output-preview ol ol {
                  list-style-type: lower-alpha;
                  margin-top: 0.25em;
                  margin-bottom: 0.25em;
                }
                .output-preview ol ol ol {
                  list-style-type: lower-roman;
                }
                .output-preview table {
                  border-collapse: collapse;
                  width: 100%;
                  margin: 1em 0;
                }
                .output-preview table td,
                .output-preview table th {
                  border: 1px solid hsl(var(--border));
                  padding: 8px;
                }
                .output-preview table th {
                  background-color: hsl(var(--muted));
                  font-weight: bold;
                  color: hsl(var(--foreground));
                }
                .output-preview img {
                  max-width: 100%;
                  height: auto;
                }
                .output-preview a {
                  color: hsl(var(--primary)) !important;
                  text-decoration: underline;
                  text-decoration-color: hsl(var(--primary) / 0.5);
                  transition: color 0.2s, text-decoration-color 0.2s;
                }
                .output-preview a:hover {
                  color: hsl(var(--primary) / 0.8) !important;
                  text-decoration-color: hsl(var(--primary));
                }
                .output-preview a:visited {
                  color: hsl(var(--primary) / 0.7) !important;
                }
                .output-preview * {
                  color: hsl(var(--foreground)) !important;
                }
                .output-preview a * {
                  color: inherit !important;
                }
              `}</style>
              {/* Code Area */}
              <div 
                className={`absolute inset-0 border border-border/50 rounded-lg overflow-hidden ${
                  !showPreview ? 'block' : 'hidden'
                }`}
              >
                <style>{`
                  .syntax-highlighter-wrapper pre[class*="language-"] {
                    margin: 0 !important;
                    padding: 1rem !important;
                    background: hsl(var(--background) / 0.8) !important;
                    height: 100% !important;
                    overflow: auto !important;
                    font-family: var(--font-mono) !important;
                    font-size: 0.875rem !important;
                    line-height: 1.75 !important;
                  }
                  .syntax-highlighter-wrapper code[class*="language-"] {
                    font-family: var(--font-mono) !important;
                    font-size: 0.875rem !important;
                    line-height: 1.75 !important;
                    color: hsl(var(--foreground)) !important;
                  }
                  /* Ensure all text is visible with proper contrast */
                  .syntax-highlighter-wrapper code[class*="language-"] * {
                    color: inherit !important;
                  }
                  .syntax-highlighter-wrapper .token.comment {
                    color: hsl(var(--muted-foreground)) !important;
                    font-style: italic !important;
                  }
                  .syntax-highlighter-wrapper .token.tag {
                    color: hsl(var(--syntax-orange)) !important;
                  }
                  .syntax-highlighter-wrapper .token.attr-name {
                    color: hsl(var(--syntax-yellow)) !important;
                  }
                  .syntax-highlighter-wrapper .token.attr-value {
                    color: hsl(var(--syntax-green)) !important;
                  }
                  .syntax-highlighter-wrapper .token.string {
                    color: hsl(var(--syntax-green)) !important;
                  }
                  .syntax-highlighter-wrapper .token.punctuation {
                    color: hsl(var(--foreground) / 0.7) !important;
                  }
                  .syntax-highlighter-wrapper .token.property {
                    color: hsl(var(--syntax-blue)) !important;
                  }
                  .syntax-highlighter-wrapper .token.keyword {
                    color: hsl(var(--syntax-purple)) !important;
                  }
                  .syntax-highlighter-wrapper .token.number,
                  .syntax-highlighter-wrapper .token.boolean {
                    color: hsl(var(--syntax-purple)) !important;
                  }
                  /* Ensure text content inside tags is visible */
                  .syntax-highlighter-wrapper .token.plain {
                    color: hsl(var(--foreground)) !important;
                  }
                  .syntax-highlighter-wrapper .token.script {
                    color: hsl(var(--foreground)) !important;
                  }
                  .syntax-highlighter-wrapper .token.script .token.string {
                    color: hsl(var(--syntax-green)) !important;
                  }
                  /* Ensure default text color is always visible */
                  .syntax-highlighter-wrapper pre[class*="language-"] {
                    color: hsl(var(--foreground)) !important;
                  }
                  /* Fix for plain text content inside tags - ensure it's visible */
                  .syntax-highlighter-wrapper .token.plain,
                  .syntax-highlighter-wrapper .token.tag > .token.plain {
                    color: hsl(var(--foreground)) !important;
                  }
                  /* Ensure text between tags is visible */
                  .syntax-highlighter-wrapper .token.tag + .token.plain,
                  .syntax-highlighter-wrapper .token.tag ~ .token.plain {
                    color: hsl(var(--foreground)) !important;
                  }
                `}</style>
                <div className="syntax-highlighter-wrapper h-full">
                  <SyntaxHighlighter
                    language="html"
                    style={theme === 'dark' ? oneDark : oneLight}
                    customStyle={{
                      margin: 0,
                      padding: '1rem',
                      background: 'hsl(var(--background) / 0.8)',
                      height: '100%',
                      overflow: 'auto',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.875rem',
                      lineHeight: '1.75',
                    }}
                    codeTagProps={{
                      style: {
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.875rem',
                        lineHeight: '1.75',
                      },
                    }}
                  >
                    {outputHtml || "// Output will appear here..."}
                  </SyntaxHighlighter>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Maximized Output Modal */}
      <Dialog open={showMaximizedOutput} onOpenChange={setShowMaximizedOutput}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 pr-14 border-b border-border flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Code className="h-5 w-5 text-primary" />
                Output - {maximizedPreviewMode ? 'Preview' : 'Code'}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {/* View Toggle in Modal */}
                <div className="flex items-center bg-muted/50 rounded-md p-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMaximizedPreviewMode(false)}
                    className={`h-7 w-7 p-0 rounded ${
                      !maximizedPreviewMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/30'
                    }`}
                    title="Code"
                  >
                    <Code className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMaximizedPreviewMode(true)}
                    className={`h-7 w-7 p-0 rounded ${
                      maximizedPreviewMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/30'
                    }`}
                    title="Preview"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {maximizedPreviewMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHeadingVisualizer(!showHeadingVisualizer)}
                    className={`h-7 w-7 p-0 ml-1 ${
                      showHeadingVisualizer ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/30'
                    }`}
                    title={showHeadingVisualizer ? 'Hide Heading Labels' : 'Show Heading Labels'}
                  >
                    <Hash className="h-3.5 w-3.5" />
                  </Button>
                )}
                {/* Copy Button in Modal */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (outputHtml) {
                      await navigator.clipboard.writeText(outputHtml);
                      setCopied(true);
                      toast({
                        title: "Copied!",
                        description: "HTML copied to clipboard",
                      });
                      setTimeout(() => setCopied(false), 2000);
                    }
                  }}
                  disabled={!outputHtml}
                  className="h-8 w-8 p-0"
                  title="Copy HTML"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden p-6">
            {maximizedPreviewMode ? (
              /* Preview in Modal */
              <div 
                className="h-full w-full pl-8 pr-6 pt-6 pb-6 border border-border/50 rounded-lg overflow-y-auto overflow-x-auto bg-background/80 output-preview"
                style={{
                  fontSize: '1rem',
                  lineHeight: '1.75',
                  fontFamily: 'var(--font-sans)',
                }}
                dangerouslySetInnerHTML={{ 
                  __html: previewHtml || '<p style="color: hsl(var(--muted-foreground));">// Preview will appear here...</p>' 
                }}
              />
            ) : (
              /* Code in Modal */
              <div className="h-full w-full overflow-hidden">
                <style>{`
                  .syntax-highlighter-modal-wrapper pre[class*="language-"] {
                    margin: 0 !important;
                    padding: 1.5rem !important;
                    background: hsl(var(--background) / 0.8) !important;
                    height: 100% !important;
                    overflow: auto !important;
                    font-family: var(--font-mono) !important;
                    font-size: 0.875rem !important;
                    line-height: 1.75 !important;
                  }
                  .syntax-highlighter-modal-wrapper code[class*="language-"] {
                    font-family: var(--font-mono) !important;
                    font-size: 0.875rem !important;
                    line-height: 1.75 !important;
                    color: hsl(var(--foreground)) !important;
                  }
                `}</style>
                <div className="syntax-highlighter-modal-wrapper h-full border border-border/50 rounded-lg overflow-hidden">
                  <SyntaxHighlighter
                    language="html"
                    style={theme === 'dark' ? oneDark : oneLight}
                    customStyle={{
                      margin: 0,
                      padding: '1.5rem',
                      background: 'hsl(var(--background) / 0.8)',
                      height: '100%',
                      overflow: 'auto',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.875rem',
                      lineHeight: '1.75',
                    }}
                    codeTagProps={{
                      style: {
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.875rem',
                        lineHeight: '1.75',
                      },
                    }}
                  >
                    {outputHtml || "// Output will appear here..."}
                  </SyntaxHighlighter>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
