import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import Lenis from "lenis";
import { Copy, Check, FileText, Code, Braces, ShoppingBag, Newspaper, ChevronDown, ChevronUp, X, Eye, CheckCircle2, AlertCircle, Maximize2, Hash, Link, AlertTriangle, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { convertWordToHtml, getUnformattedHtml, convertToHtml, type OutputMode, type FeatureFlags } from "@/lib/word-to-html/converter";
import DOMPurify from 'dompurify';
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

interface ContentBlock {
  type: 'heading' | 'content' | 'image' | 'disclaimer' | 'sources' | 'readmore';
  html: string;
  preview: string;
  id: string;
}

const parseHtmlIntoBlocks = (html: string): ContentBlock[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const blocks: ContentBlock[] = [];
  let blockId = 0;

  const container = doc.body;
  const children = Array.from(container.childNodes);

  let currentContentHtml = '';
  let skipIndices = new Set<number>();

  children.forEach((node, index) => {
    if (skipIndices.has(index)) {
      return;
    }

    const element = node as HTMLElement;

    if (node.nodeType === 3 && !(node.textContent?.trim())) {
      return;
    }

    const tagName = element.tagName?.toLowerCase();

    if (tagName === 'p' && element.textContent?.includes('Disclaimer:')) {
      if (currentContentHtml.trim()) {
        blocks.push({
          type: 'content',
          html: currentContentHtml,
          preview: currentContentHtml.replace(/<[^>]*>/g, '').substring(0, 100) + '...',
          id: `block-${blockId++}`,
        });
        currentContentHtml = '';
      }
      blocks.push({
        type: 'disclaimer',
        html: element.outerHTML,
        preview: element.textContent?.substring(0, 60) || 'Disclaimer',
        id: `block-${blockId++}`,
      });
    }
    else if (tagName === 'p' && element.textContent?.includes('Read more:')) {
      if (currentContentHtml.trim()) {
        blocks.push({
          type: 'content',
          html: currentContentHtml,
          preview: currentContentHtml.replace(/<[^>]*>/g, '').substring(0, 100) + '...',
          id: `block-${blockId++}`,
        });
        currentContentHtml = '';
      }
      blocks.push({
        type: 'readmore',
        html: element.outerHTML,
        preview: element.textContent?.substring(0, 60) || 'Read more',
        id: `block-${blockId++}`,
      });
    }
    else if (tagName === 'p' && element.textContent?.includes('Sources:')) {
      if (currentContentHtml.trim()) {
        blocks.push({
          type: 'content',
          html: currentContentHtml,
          preview: currentContentHtml.replace(/<[^>]*>/g, '').substring(0, 100) + '...',
          id: `block-${blockId++}`,
        });
        currentContentHtml = '';
      }
      let sourcesHtml = element.outerHTML;
      let nextIndex = index + 1;
      while (nextIndex < children.length) {
        const nextNode = children[nextIndex];
        if (nextNode.nodeType === 3) {
          if (!nextNode.textContent?.trim()) {
            skipIndices.add(nextIndex);
            nextIndex++;
            continue;
          } else {
            break;
          }
        }
        const nextElement = nextNode as HTMLElement;
        const nextTagName = nextElement.tagName?.toLowerCase();
        if (nextTagName === 'ol' || nextTagName === 'ul') {
          sourcesHtml += nextElement.outerHTML;
          skipIndices.add(nextIndex);
          nextIndex++;
          break;
        } else {
          break;
        }
      }
      blocks.push({
        type: 'sources',
        html: sourcesHtml,
        preview: 'Sources',
        id: `block-${blockId++}`,
      });
    }
    else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName) && element.textContent?.includes('Sources')) {
      if (currentContentHtml.trim()) {
        blocks.push({
          type: 'content',
          html: currentContentHtml,
          preview: currentContentHtml.replace(/<[^>]*>/g, '').substring(0, 100) + '...',
          id: `block-${blockId++}`,
        });
        currentContentHtml = '';
      }
      let sourcesHtml = element.outerHTML;
      let nextIndex = index + 1;
      while (nextIndex < children.length) {
        const nextNode = children[nextIndex];
        if (nextNode.nodeType === 3) {
          if (!nextNode.textContent?.trim()) {
            skipIndices.add(nextIndex);
            nextIndex++;
            continue;
          } else {
            break;
          }
        }
        const nextElement = nextNode as HTMLElement;
        const nextTagName = nextElement.tagName?.toLowerCase();
        if (nextTagName === 'ol' || nextTagName === 'ul') {
          sourcesHtml += nextElement.outerHTML;
          skipIndices.add(nextIndex);
          nextIndex++;
          break;
        } else {
          break;
        }
      }
      blocks.push({
        type: 'sources',
        html: sourcesHtml,
        preview: 'Sources',
        id: `block-${blockId++}`,
      });
    }
    else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      if (currentContentHtml.trim()) {
        blocks.push({
          type: 'content',
          html: currentContentHtml,
          preview: currentContentHtml.replace(/<[^>]*>/g, '').substring(0, 100) + '...',
          id: `block-${blockId++}`,
        });
        currentContentHtml = '';
      }
      blocks.push({
        type: 'heading',
        html: element.outerHTML,
        preview: element.textContent?.substring(0, 60) || 'Heading',
        id: `block-${blockId++}`,
      });
    }
    else if (tagName === 'img') {
      if (currentContentHtml.trim()) {
        blocks.push({
          type: 'content',
          html: currentContentHtml,
          preview: currentContentHtml.replace(/<[^>]*>/g, '').substring(0, 100) + '...',
          id: `block-${blockId++}`,
        });
        currentContentHtml = '';
      }
      const imgElement = element as HTMLImageElement;
      const altText = imgElement.getAttribute('alt') || 'No alt text';
      let linkHref = '';
      const parent = (element as HTMLImageElement).parentElement;
      if (parent && parent.tagName?.toLowerCase() === 'a') {
        linkHref = parent.getAttribute('href') || '';
      }
      const imageMetaHtml = `<div style="padding: 12px; border: 1px solid #ccc; border-radius: 4px; background: #f9f9f9;">
          <p style="margin: 0 0 8px 0; font-size: 0.9em;"><strong>Alt image text:</strong> ${altText}</p>
          ${linkHref ? `<p style="margin: 0; font-size: 0.9em;"><strong>Link:</strong> <a href="${linkHref}" target="_blank">${linkHref}</a></p>` : ''}
        </div>`;
      blocks.push({
        type: 'image',
        html: imageMetaHtml,
        preview: `Alt: ${altText}${linkHref ? ` | Link: ${linkHref}` : ''}`,
        id: `block-${blockId++}`,
      });
    }
    else if (tagName === 'p' && (element.textContent?.toLowerCase().includes('alt image text:') || element.textContent?.toLowerCase().includes('alt text:') || element.textContent?.toLowerCase().startsWith('link:') || element.textContent?.toLowerCase().startsWith('link to:'))) {
      if (currentContentHtml.trim()) {
        blocks.push({
          type: 'content',
          html: currentContentHtml,
          preview: currentContentHtml.replace(/<[^>]*>/g, '').substring(0, 100) + '...',
          id: `block-${blockId++}`,
        });
        currentContentHtml = '';
      }
      let imageBlockHtml = element.outerHTML;
      let nextIndex = index + 1;
      while (nextIndex < children.length) {
        const nextNode = children[nextIndex];
        if (nextNode.nodeType === 3) {
          if (!nextNode.textContent?.trim()) {
            skipIndices.add(nextIndex);
            nextIndex++;
            continue;
          } else {
            break;
          }
        }
        const nextElement = nextNode as HTMLElement;
        const nextTagName = nextElement.tagName?.toLowerCase();
        if (nextTagName === 'p') {
          const text = nextElement.textContent?.trim().toLowerCase() || '';
          if (text === '' || text.includes('alt image text:') || text.includes('alt text:') || text.startsWith('link:') || text.startsWith('link to:')) {
            imageBlockHtml += nextElement.outerHTML;
            skipIndices.add(nextIndex);
            nextIndex++;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      const altMatch = imageBlockHtml.match(/Alt (?:image )?text:\s*(.+?)(?:<\/|$)/i);
      const altText = altMatch ? altMatch[1].replace(/<[^>]*>/g, '').trim() : 'No alt text';
      const linkMatch = imageBlockHtml.match(/href=["']([^"']+)["']/);
      const linkHref = linkMatch ? linkMatch[1] : '';
      blocks.push({
        type: 'image',
        html: imageBlockHtml,
        preview: `Alt: ${altText}${linkHref ? ` | Link: ${linkHref}` : ''}`,
        id: `block-${blockId++}`,
      });
    }
    else if (tagName === 'p' || tagName === 'ul' || tagName === 'ol' || tagName === 'blockquote') {
      if (tagName === 'p' && !element.textContent?.trim()) {
        return;
      }
      currentContentHtml += element.outerHTML;
    }
  });

  if (currentContentHtml.trim()) {
    blocks.push({
      type: 'content',
      html: currentContentHtml,
      preview: currentContentHtml.replace(/<[^>]*>/g, '').substring(0, 100) + '...',
      id: `block-${blockId++}`,
    });
  }

  return blocks;
};

export function WordToHtmlConverter() {
  const { theme } = useTheme();
  const [inputHtml, setInputHtml] = useState("");
  const [outputFormat, setOutputFormat] = useState<OutputMode>("regular");
  const [copied, setCopied] = useState(false);
  const [checkingLinks, setCheckingLinks] = useState(false);
  const [showValidationWarnings, setShowValidationWarnings] = useState(true);
  const [linkCheckResult, setLinkCheckResult] = useState<{ total: number; good: number; broken: number; serverErrors: number; blocked: number; goodLinks: { url: string; status: number }[]; brokenLinks: { url: string; status: number }[]; serverErrors: { url: string; status: number }[]; blockedLinks: { url: string; error: string; errorMessage: string }[] } | null>(null);
  const [showLinkResults, setShowLinkResults] = useState(false);
  const [showBlogsFeatures, setShowBlogsFeatures] = useState(false);
  const [showShoppablesFeatures, setShowShoppablesFeatures] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showValidationDetails, setShowValidationDetails] = useState(false);
  const [showMaximizedOutput, setShowMaximizedOutput] = useState(false);
  const [maximizedPreviewMode, setMaximizedPreviewMode] = useState(false);
  const [showHeadingVisualizer, setShowHeadingVisualizer] = useState(false);
  const [showCSSInput, setShowCSSInput] = useState(false);
  const [customCSS, setCustomCSS] = useState("");
  const [wrapWithStyleTags, setWrapWithStyleTags] = useState(true);
  const [cssInputHeight, setCssInputHeight] = useState(100);
  const [outputView, setOutputView] = useState<'code' | 'preview' | 'blocks'>('code');
  const [copiedBlockId, setCopiedBlockId] = useState<string | null>(null);

  // Feature flags - initial state for Regular mode (will be updated by useEffect when mode changes)
  const [features, setFeatures] = useState<FeatureFlags>({
    headingStrong: false,
    keyTakeaways: false,
    h1Removal: false,
    linkAttributes: false,
    relativePaths: false,
    spacing: false,
    olHeaderConversion: false,
    sourcesNormalize: false,
    removeSourcesLinks: false,
  });
  
  // Initialize features based on output format
  // Regular mode: all features off by default (user can enable if needed)
  // Blogs mode: features on by default
  // Shoppables mode: uses its own specific defaults
  // Reset to defaults when switching modes
  useEffect(() => {
    if (outputFormat === 'regular') {
      setFeatures({
        headingStrong: false,
        keyTakeaways: false,
        h1Removal: false,
        linkAttributes: false,
        relativePaths: false,
        spacing: false,
        olHeaderConversion: false,
        sourcesNormalize: false,
        removeSourcesLinks: false,
      });
    } else if (outputFormat === 'blogs') {
      setFeatures({
        headingStrong: true,
        keyTakeaways: true,
        h1Removal: true,
        linkAttributes: true,
        relativePaths: false,
        spacing: true,
        olHeaderConversion: true,
        sourcesNormalize: true,
        removeSourcesLinks: true,
      });
    } else if (outputFormat === 'shoppables') {
      setFeatures({
        headingStrong: true,
        keyTakeaways: false,
        h1Removal: false,
        linkAttributes: true,
        relativePaths: false,
        spacing: false,
        olHeaderConversion: true,
        sourcesNormalize: true,
        removeSourcesLinks: true,
        brBeforeReadMore: false,
        brBeforeSources: false,
      });
    }
  }, [outputFormat]);

  const inputAreaRef = useRef<HTMLDivElement>(null);
  const outputPreviewRef = useRef<HTMLDivElement>(null);
  const codeAreaRef = useRef<HTMLDivElement>(null);
  const modalCodeAreaRef = useRef<HTMLDivElement>(null);
  const cssTextareaRef = useRef<HTMLTextAreaElement>(null);
  const cssResizeHandleRef = useRef<HTMLDivElement>(null);

  // Initialize Lenis smooth scroll for input and output containers
  useEffect(() => {
    const lenisInstances: Lenis[] = [];

    // Initialize Lenis for input area
    if (inputAreaRef.current) {
      const inputLenis = new Lenis({
        wrapper: inputAreaRef.current,
        content: inputAreaRef.current,
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });
      lenisInstances.push(inputLenis);
    }

    // Initialize Lenis for output preview
    if (outputPreviewRef.current) {
      const outputLenis = new Lenis({
        wrapper: outputPreviewRef.current,
        content: outputPreviewRef.current,
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });
      lenisInstances.push(outputLenis);
    }

    // Initialize Lenis for code area
    if (codeAreaRef.current) {
      const codeLenis = new Lenis({
        wrapper: codeAreaRef.current,
        content: codeAreaRef.current,
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });
      lenisInstances.push(codeLenis);
    }

    // Animation loop for Lenis
    function raf(time: number) {
      lenisInstances.forEach((lenis) => lenis.raf(time));
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Cleanup
    return () => {
      lenisInstances.forEach((lenis) => lenis.destroy());
    };
  }, []);

  // Handle CSS textarea resizing via drag handle
  useEffect(() => {
    if (!showCSSInput) return; // Only set up when CSS input is visible

    const handleRef = cssResizeHandleRef.current;
    const textareaRef = cssTextareaRef.current;
    if (!handleRef || !textareaRef) return;

    let isResizing = false;
    let startY = 0;
    let startHeight = 0;
    const maxHeight = window.innerHeight * 0.5;

    const handleMouseDown = (e: MouseEvent) => {
      isResizing = true;
      startY = e.clientY;
      startHeight = textareaRef.offsetHeight;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ns-resize';
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const delta = e.clientY - startY;
      const newHeight = Math.max(80, Math.min(startHeight + delta, maxHeight));
      setCssInputHeight(newHeight);
    };

    const handleMouseUp = () => {
      isResizing = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    const handleTouchStart = (e: TouchEvent) => {
      isResizing = true;
      startY = e.touches[0].clientY;
      startHeight = textareaRef.offsetHeight;
      document.body.style.userSelect = 'none';
      e.preventDefault();
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isResizing) return;
      const delta = e.touches[0].clientY - startY;
      const newHeight = Math.max(80, Math.min(startHeight + delta, maxHeight));
      setCssInputHeight(newHeight);
      e.preventDefault();
    };

    const handleTouchEnd = () => {
      isResizing = false;
      document.body.style.userSelect = '';
    };

    handleRef.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    handleRef.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      handleRef.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      handleRef.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [showCSSInput]);

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
  const conversionResult = useMemo(() => {
    if (!inputHtml || !inputHtml.trim()) {
      return { formatted: '', unformatted: '' };
    }
    try {
      const cleanedHtml = cleanWordHtml(inputHtml);
      return convertToHtml(cleanedHtml, outputFormat, features);
    } catch (error) {
      console.error('Conversion error:', error);
      return { formatted: '', unformatted: '' };
    }
  }, [inputHtml, outputFormat, features]);
  const outputHtml = conversionResult.formatted;
  const previewHtml = conversionResult.unformatted;

  // Function to combine custom CSS with HTML output
  const getHtmlWithCSS = (html: string): string => {
    if (!customCSS.trim()) {
      return html;
    }
    if (wrapWithStyleTags) {
      return `<style>\n${customCSS}\n</style>\n${html}`;
    } else {
      return `${customCSS}\n${html}`;
    }
  };


  const contentBlocks = useMemo(() => parseHtmlIntoBlocks(outputHtml), [outputHtml]);

  // Function to extract all links from HTML
  const extractLinks = (html: string): string[] => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const anchors = doc.querySelectorAll('a[href]');
    const links: string[] = [];
    anchors.forEach((anchor) => {
      const href = anchor.getAttribute('href');
      // Filter out dangerous URL protocols that could lead to XSS attacks
      const isUnsafeProtocol = 
        href.startsWith('javascript:') ||
        href.startsWith('data:') ||
        href.startsWith('vbscript:');
      if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !isUnsafeProtocol) {
        links.push(href);
      }
    });
    return [...new Set(links)]; // Remove duplicates
  };

  // Function to check links using Cloudflare Worker API
  const checkLinks = async () => {
    if (!previewHtml) return;
    
    const links = extractLinks(previewHtml);
    if (links.length === 0) {
      toast({
        title: "No links found",
        description: "There are no links to check in the output",
      });
      return;
    }

    setCheckingLinks(true);
    setLinkCheckResult(null);

    try {
      const response = await fetch('https://link-checker.rosettascript.workers.dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links }),
      });
      
      const result = await response.json();
      setLinkCheckResult(result);
      
      // Build detailed feedback message
      let feedbackTitle = "";
      let feedbackDesc = "";
      
      if (result.good === result.total) {
        feedbackTitle = "✅ All links valid";
        feedbackDesc = `${result.good} link${result.good > 1 ? 's' : ''} checked successfully`;
      } else {
        const issues = result.broken + result.serverErrors + result.blocked;
        feedbackTitle = `⚠️ ${issues} issue${issues > 1 ? 's' : ''} found`;
        
        // Build detailed list
        const details = [];
        if (result.good > 0) {
          details.push(`✅ ${result.good} valid: ${result.goodLinks.map((l: { url: string }) => l.url).join(', ')}`);
        }
        if (result.broken > 0) {
          details.push(`❌ ${result.broken} 404 (not found): ${result.brokenLinks.map((l: { url: string }) => l.url).join(', ')}`);
        }
        if (result.serverErrors > 0) {
          details.push(`⚠️ ${result.serverErrors} server error (500+): ${result.serverErrorLinks.map((l: { url: string }) => l.url).join(', ')}`);
        }
        if (result.blocked > 0) {
          details.push(`🚫 ${result.blocked} blocked (CORS/bot protection): ${result.blockedLinks.map((l: { url: string }) => l.url).join(', ')}`);
        }
        feedbackDesc = details.join('\n\n');
      }
      
      // Show detailed results in dialog
      setShowLinkResults(true);
    } catch (error) {
      console.error('Link check error:', error);
      toast({
        title: "Error checking links",
        description: "Failed to check links. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCheckingLinks(false);
    }
  };

  // Open all blocked links in new tabs
  const openAllBlockedLinks = () => {
    if (!linkCheckResult?.blockedLinks) return;
    linkCheckResult.blockedLinks.forEach((link) => {
      window.open(link.url, '_blank', 'noopener,noreferrer');
    });
  };

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

  // Process validation results to add warning attributes to HTML elements
  const previewHtmlWithWarnings = useMemo(() => {
    if (!previewHtml || !validationResults || !showValidationWarnings) {
      return previewHtml;
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(previewHtml, 'text/html');
      
      // Map warnings to elements - process all failed validations
      validationResults.results.forEach(result => {
        // Only process failed validations
        if (result.passed) return;
        
        // Heading strong - flag based on mode
        if (result.ruleId === 'heading-strong') {
          const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
          
          if (outputFormat === 'regular') {
            // Regular mode: headings should NOT be wrapped in <strong>
            headings.forEach(h => {
              if (h.querySelector('strong')) {
                h.setAttribute('data-warning', 'Heading should not be wrapped in <strong>');
              }
            });
          } else {
            // Blogs/shoppables: headings SHOULD be wrapped in <strong>
            headings.forEach(h => {
              if (!h.querySelector('strong') && !h.querySelector('b')) {
                h.setAttribute('data-warning', 'Heading should be wrapped in <strong>');
              }
            });
          }
        }
        
        // OL bold labels - flag all li with colon but no strong EXCEPT Sources section
        if (result.ruleId === 'ol-bold-labels') {
          // Find Sources section to exclude (same logic as validator)
          let sourcesOl: Element | null = null;
          const paragraphs = doc.querySelectorAll('p');
          for (const p of Array.from(paragraphs)) {
            const text = p.textContent?.trim().toLowerCase() || '';
            if (text === 'sources' || text === 'sources:' || text.startsWith('sources:')) {
              let nextSibling = p.nextElementSibling;
              while (nextSibling && nextSibling.tagName.toLowerCase() !== 'ol') {
                nextSibling = nextSibling.nextElementSibling;
              }
              if (nextSibling) {
                sourcesOl = nextSibling;
              }
              break;
            }
          }
          
          const olItems = doc.querySelectorAll('ol > li');
          olItems.forEach(li => {
            // Skip list items in the Sources section
            if (sourcesOl && sourcesOl.contains(li)) {
              return;
            }
            const text = li.textContent || '';
            if (text.includes(':') && !li.querySelector('strong')) {
              li.setAttribute('data-warning', 'Missing bold label before colon');
            }
          });
        }
        
        // Remove sources links - flag all links in sources
        if (result.ruleId === 'remove-sources-links') {
          const paragraphs = doc.querySelectorAll('p');
          let inSources = false;
          paragraphs.forEach(p => {
            const text = p.textContent?.trim().toLowerCase() || '';
            if (text === 'sources' || text === 'sources:' || text.startsWith('sources:')) {
              inSources = true;
            }
            if (inSources) {
              const links = p.querySelectorAll('a');
              links.forEach(a => {
                a.setAttribute('data-warning', 'Link in Sources section');
              });
            }
          });
          // Check next ol after sources
          paragraphs.forEach(p => {
            const text = p.textContent?.trim().toLowerCase() || '';
            if (text === 'sources' || text === 'sources:' || text.startsWith('sources:')) {
              let next = p.nextElementSibling;
              while (next && next.tagName.toLowerCase() !== 'ol') {
                next = next.nextElementSibling;
              }
              if (next) {
                const links = next.querySelectorAll('a');
                links.forEach(a => {
                  a.setAttribute('data-warning', 'Link in Sources section');
                });
              }
            }
          });
        }
        
        // List normalization - only flag list items with specific issues
        if (result.ruleId === 'list-normalization') {
          const details = result.details || [];
          const sourcesOl = (() => {
            let sourcesOl: Element | null = null;
            const paragraphs = doc.querySelectorAll('p');
            for (const p of Array.from(paragraphs)) {
              const text = p.textContent?.trim().toLowerCase() || '';
              if (text === 'sources' || text === 'sources:' || text.startsWith('sources:')) {
                let nextSibling = p.nextElementSibling;
                while (nextSibling && nextSibling.tagName.toLowerCase() !== 'ol') {
                  nextSibling = nextSibling.nextElementSibling;
                }
                if (nextSibling) {
                  sourcesOl = nextSibling;
                }
                break;
              }
            }
            return sourcesOl;
          })();
          
          const listItems = doc.querySelectorAll('li');
          listItems.forEach(li => {
            if (sourcesOl && sourcesOl.contains(li)) {
              return;
            }
            const liText = li.textContent || '';
            details.forEach((detail: string) => {
              if (detail.includes(liText.substring(0, 30))) {
                li.setAttribute('data-warning', detail);
              }
            });
          });
        }
        
        // Sources normalization - flag sources section and list
        if (result.ruleId === 'sources-normalization') {
          const paragraphs = doc.querySelectorAll('p');
          paragraphs.forEach(p => {
            const text = p.textContent?.trim().toLowerCase() || '';
            if (text === 'sources' || text === 'sources:') {
              p.setAttribute('data-warning', 'Sources section formatting issue');
              // Also flag the next ol after sources
              let next = p.nextElementSibling;
              while (next && next.tagName.toLowerCase() !== 'ol') {
                next = next.nextElementSibling;
              }
              if (next) {
                next.setAttribute('data-warning', 'Sources list formatting issue');
              }
            }
          });
        }
        
        // Key takeaways - flag key takeaways heading AND the list below it (only if failed)
        if (result.ruleId === 'key-takeaways' && !result.passed) {
          const headings = doc.querySelectorAll('h2, h3');
          headings.forEach(h => {
            const text = h.textContent?.toLowerCase() || '';
            if (text.includes('key takeaways')) {
              h.setAttribute('data-warning', result.message);
              let next = h.nextElementSibling;
              while (next && next.tagName.toLowerCase() !== 'ul' && next.tagName.toLowerCase() !== 'ol') {
                next = next.nextElementSibling;
              }
              if (next) {
                next.setAttribute('data-warning', result.message);
              }
            }
          });
        }
        
        // Link attributes - flag links missing proper attributes (only if failed)
        if (result.ruleId === 'link-attributes' && !result.passed) {
          const links = doc.querySelectorAll('a[href]');
          links.forEach(a => {
            const target = a.getAttribute('target');
            const rel = a.getAttribute('rel');
            const missing: string[] = [];
            if (target !== '_blank') missing.push('target="_blank"');
            if (!rel?.includes('noopener') || !rel?.includes('noreferrer')) missing.push('rel="noopener noreferrer"');
            if (missing.length > 0) {
              a.setAttribute('data-warning', `Link missing: ${missing.join(', ')}`);
            }
          });
        }
        
        // Spacing rules - parse details and highlight the target element (not spacing elements)
        if (result.ruleId === 'spacing-rules') {
          const details = result.details || [];
          
          details.forEach((message: string) => {
            // Parse message formats:
            // - 'Missing spacing before heading: "..."'
            // - 'Missing spacing before Sources: section'
            // - 'Missing spacing before Disclaimer: section'
            // - 'Missing spacing before Alt Image Text: paragraph'
            // - 'Missing spacing before "...'
            
            // Handle heading messages: 'Missing spacing before heading: "..."'
            const headingMatch = message.match(/Missing spacing before heading: "([^"]+)"/);
            if (headingMatch) {
              const headingText = headingMatch[1];
              const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
              headings.forEach(h => {
                if (h.textContent?.includes(headingText)) {
                  h.setAttribute('data-warning', message);
                }
              });
              return;
            }
            
            // Handle section/paragraph messages: 'Missing spacing before "X:" section' or 'Missing spacing before "X:" paragraph'
            const sectionMatch = message.match(/Missing spacing before "([^"]+):?"?\s*(section|paragraph)?"?$/i);
            if (sectionMatch) {
              const targetText = sectionMatch[1].toLowerCase();
              const paragraphs = doc.querySelectorAll('p');
              paragraphs.forEach(p => {
                const text = p.textContent?.trim().toLowerCase() || '';
                if (text === targetText || text.startsWith(targetText + ':') || text.startsWith(targetText + ' ')) {
                  p.setAttribute('data-warning', message);
                }
              });
              return;
            }
            
            // Handle read also/read more messages: 'Missing spacing before "..."'
            const readMoreMatch = message.match(/Missing spacing before "([^"]+\.\.\.)"/);
            if (readMoreMatch) {
              const readMoreText = readMoreMatch[1].toLowerCase();
              const paragraphs = doc.querySelectorAll('p');
              paragraphs.forEach(p => {
                const text = p.textContent?.trim().toLowerCase() || '';
                if (text.includes(readMoreText.replace('...', ''))) {
                  p.setAttribute('data-warning', message);
                }
              });
            }
          });
        }
        
        // OL header conversion - only flag <ol> elements that are header lists (only if failed)
        if (result.ruleId === 'ol-header-conversion' && !result.passed) {
          const olElements = doc.querySelectorAll('ol');
          olElements.forEach(ol => {
            const listItems = ol.querySelectorAll(':scope > li');
            const isHeaderList = Array.from(listItems).every((li) => {
              const strongTag = li.querySelector(':scope > strong');
              if (strongTag) {
                const headingChildren = Array.from(strongTag.children).filter((node) =>
                  /^h[1-6]$/i.test(node.tagName)
                );
                return headingChildren.length === 1;
              }
              const directHeading = li.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6');
              if (directHeading) {
                const strongInHeading = directHeading.querySelector(':scope > strong');
                return strongInHeading !== null;
              }
              return false;
            });
            if (isHeaderList) {
              ol.setAttribute('data-warning', result.message);
            }
          });
        }
        
        // H1 after key takeaways - flag h1 elements
        if (result.ruleId === 'h1-after-key-takeaways') {
          const h1Elements = doc.querySelectorAll('h1');
          h1Elements.forEach(h1 => {
            h1.setAttribute('data-warning', 'H1 should not appear after Key Takeaways');
          });
        }
        
        // Relative paths - only flag links with absolute URLs in href
        if (result.ruleId === 'relative-paths') {
          const links = doc.querySelectorAll('a[href]');
          links.forEach(a => {
            const href = a.getAttribute('href');
            // Only flag if href itself is absolute (not the link text)
            if (href && (href.includes('://') || href.startsWith('//'))) {
              a.setAttribute('data-warning', 'Link should use relative path');
            }
          });
        }
      });
      
      return doc.body.innerHTML;
    } catch (error) {
      console.error('Error adding warning attributes:', error);
      return previewHtml;
    }
  }, [previewHtml, validationResults, showValidationWarnings]);

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

              {/* Custom CSS Input Section - Positioned after output format */}
              {showCSSInput && (
                <div className="mt-3 p-3 bg-muted/20 border border-border/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2 flex-shrink-0">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Custom CSS</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCustomCSS("")}
                      disabled={!customCSS.trim()}
                      className="h-6 w-6 p-0"
                      title="Clear CSS"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Checkbox
                      id="wrap-style-tags"
                      checked={wrapWithStyleTags}
                      onCheckedChange={(checked) => setWrapWithStyleTags(checked as boolean)}
                      className="h-4 w-4"
                    />
                    <label htmlFor="wrap-style-tags" className="text-xs text-muted-foreground cursor-pointer">
                      Wrap with &lt;style&gt;&lt;/style&gt;
                    </label>
                  </div>
                  <div className="relative border border-border/50 rounded overflow-hidden bg-background/80">
                    <textarea
                      ref={cssTextareaRef}
                      data-lenisignore
                      value={customCSS}
                      onChange={(e) => setCustomCSS(e.target.value)}
                      placeholder="Paste your custom CSS here... (e.g., body { font-size: 16px; } h1 { color: blue; })"
                      className="w-full p-2 text-xs bg-background/80 overflow-y-auto overflow-x-hidden resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                      style={{
                        color: 'hsl(var(--foreground))',
                        fontSize: '0.75rem',
                        lineHeight: '1.5',
                        fontFamily: 'var(--font-mono)',
                        height: `${cssInputHeight}px`,
                      }}
                    />
                    {/* Resize Handle */}
                    <div
                      ref={cssResizeHandleRef}
                      className="h-1.5 bg-border/30 hover:bg-primary/50 cursor-ns-resize transition-colors w-full flex items-center justify-center"
                      title="Drag to resize"
                    >
                      <div className="w-8 h-0.5 bg-muted-foreground/30 rounded-full" />
                    </div>
                  </div>
                </div>
              )}

              {/* Feature toggles for all modes - Regular shows disabled/unchecked by default */}
              {(outputFormat === 'regular' || outputFormat === 'blogs' || outputFormat === 'shoppables') && (
                <Collapsible open={outputFormat === 'shoppables' ? showShoppablesFeatures : showBlogsFeatures} onOpenChange={outputFormat === 'shoppables' ? setShowShoppablesFeatures : setShowBlogsFeatures}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-sm font-medium hover:bg-muted/30 rounded-md transition-colors">
                    <span>
                      {outputFormat === 'regular' ? 'Features:' : 
                       outputFormat === 'blogs' ? 'Blogs Features:' : 'Shoppables Features:'}
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${(outputFormat === 'shoppables' ? showShoppablesFeatures : showBlogsFeatures) ? 'rotate-180' : ''}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2">
                    {outputFormat === 'regular' && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Enable features manually for Regular mode output
                      </p>
                    )}
                    {/* Checkboxes for Regular mode - only show specific features */}
                    {outputFormat === 'regular' && (
                      <>
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
                      </>
                    )}
                    {/* Checkboxes for Blogs and Shoppables modes - show all features */}
                    {(outputFormat === 'blogs' || outputFormat === 'shoppables') && (
                      <>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <Checkbox
                            checked={features.headingStrong !== false}
                            onCheckedChange={(checked) => setFeatures({ ...features, headingStrong: checked as boolean })}
                          />
                          <span className="text-sm">Heading Strong Tags</span>
                        </label>
                        {/* Only show Key Takeaways and H1 Removal for Blogs mode, not Shoppables */}
                        {outputFormat === 'blogs' && (
                          <>
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
                          </>
                        )}
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
                      </>
                    )}
                    {outputFormat === 'shoppables' && (
                      <>
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
                      </>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Feature toggles for Shoppables mode - REMOVED, now unified above */}
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
        <div className="relative flex flex-col bg-card/50 border border-border/50 rounded-xl p-3 md:p-4 backdrop-blur-sm min-w-0 max-w-full lg:h-[calc(100vh-280px)] lg:min-h-[400px] lg:max-h-[700px]">
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
              {/* View Toggle - Code/Preview/Blocks */}
              <div className="flex items-center bg-muted/50 rounded-md p-0.5 mr-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setOutputView('code');
                    setShowPreview(false);
                  }}
                  className={`h-7 w-7 p-0 rounded ${
                    outputView === 'code' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/30'
                  }`}
                  title="Code"
                >
                  <Code className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setOutputView('preview');
                    setShowPreview(true);
                  }}
                  className={`h-7 w-7 p-0 rounded ${
                    outputView === 'preview' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/30'
                  }`}
                  title="Preview"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setOutputView('blocks');
                    setShowPreview(false);
                  }}
                  disabled={contentBlocks.length === 0}
                  className={`h-7 w-7 p-0 rounded ${
                    outputView === 'blocks' ? 'bg-primary text-primary-foreground' : contentBlocks.length === 0 ? 'text-muted-foreground/50 cursor-not-allowed' : 'text-muted-foreground hover:bg-muted/30'
                  }`}
                  title={contentBlocks.length === 0 ? "No blocks to display" : "Copy blocks"}
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                </Button>
              </div>
              {/* Heading Visualizer Toggle - for Preview and Blocks */}
              {(outputView === 'preview' || outputView === 'blocks') && (
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
              {/* Validation Warnings Toggle */}
              {showPreview && validationResults && validationResults.summary.failed > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowValidationWarnings(!showValidationWarnings)}
                  className={`h-7 w-7 p-0 ml-1 ${
                    showValidationWarnings ? 'bg-yellow-500 text-white' : 'text-muted-foreground hover:bg-muted/30'
                  }`}
                  title={showValidationWarnings ? 'Hide Validation Warnings' : 'Show Validation Warnings'}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                </Button>
              )}
              {/* Custom CSS Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCSSInput(!showCSSInput)}
                className={`h-8 w-8 p-0 ml-1 ${
                  showCSSInput ? 'bg-primary text-primary-foreground' : customCSS.trim() ? 'bg-green-500/20 text-green-500 border-green-500/30' : 'text-muted-foreground hover:bg-muted/30'
                }`}
                title={showCSSInput ? 'Hide CSS Input' : 'Add Custom CSS'}
              >
                <Braces className="h-4 w-4" />
              </Button>
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
                    if (showPreview && previewHtml) {
                      // Copy as rich text (HTML) for preview mode
                      const blob = new Blob([previewHtml], { type: 'text/html' });
                      await navigator.clipboard.write([
                        new ClipboardItem({ 'text/html': blob })
                      ]);
                      toast({
                        title: "Copied!",
                        description: "Formatted HTML copied to clipboard",
                      });
                    } else {
                      // Copy as plain text for code mode (includes CSS if provided)
                      const htmlWithCSS = getHtmlWithCSS(outputHtml);
                      await navigator.clipboard.writeText(htmlWithCSS);
                      toast({
                        title: "Copied!",
                        description: customCSS.trim() ? "HTML with CSS copied to clipboard" : "HTML copied to clipboard",
                      });
                    }
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
                disabled={!outputHtml}
                className="h-8 w-8 p-0"
                title={showPreview ? "Copy Formatted HTML" : customCSS.trim() ? "Copy HTML with CSS" : "Copy HTML"}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              {/* Check Links Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={checkLinks}
                disabled={!previewHtml || checkingLinks}
                className="h-8 w-8 p-0"
                title="Check Links"
              >
                {checkingLinks ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : linkCheckResult && linkCheckResult.broken > 0 ? (
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                ) : linkCheckResult && linkCheckResult.broken === 0 ? (
                  <Link className="h-4 w-4 text-green-500" />
                ) : (
                  <Link className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          {/* Output Container - matches original structure */}
          <div className="relative flex-1 min-h-[200px] max-h-[50vh] lg:max-h-[calc(100vh-380px)] w-full overflow-hidden">
            {/* Preview Area - matches .output-area from original */}
            {/* Using h-full instead of absolute to properly calculate scroll height */}
            <div
              ref={outputPreviewRef}
              className={`h-full pl-8 pr-4 pt-4 pb-4 border border-border/50 rounded-lg overflow-y-auto overflow-x-auto bg-background/80 output-preview ${
                outputView === 'preview' ? 'block' : 'hidden'
              }`}
              style={{
                fontSize: '0.875rem',
                lineHeight: '1.75',
                fontFamily: 'var(--font-sans)',
              }}
              dangerouslySetInnerHTML={{ 
                __html: previewHtmlWithWarnings || '<p style="color: hsl(var(--muted-foreground));">// Preview will appear here...</p>' 
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
              /* Validation warning styles */
              .output-preview [data-warning] {
                outline: 3px dashed hsl(var(--destructive)) !important;
                outline-offset: 2px !important;
                position: relative;
                cursor: help;
                background-color: hsl(var(--destructive) / 0.15) !important;
              }
              .output-preview [data-warning]:hover::after {
                content: attr(data-warning);
                position: absolute;
                bottom: 100%;
                left: 50%;
                transform: translateX(-50%);
                background: hsl(var(--destructive)) !important;
                color: white !important;
                padding: 0.25rem 0.5rem;
                border-radius: 0.25rem;
                font-size: 0.75rem;
                white-space: nowrap;
                z-index: 9999;
                pointer-events: none;
              }
              /* Links with warnings need explicit styling */
              .output-preview a[data-warning] {
                outline: 3px dashed hsl(var(--destructive)) !important;
                background-color: hsl(var(--destructive) / 0.15) !important;
                text-decoration: underline !important;
                text-decoration-color: hsl(var(--destructive)) !important;
              }
            `}</style>
            {/* Code Area */}
            <div
              ref={codeAreaRef}
              data-lenisignore
              className={`h-full border border-border/50 rounded-lg overflow-y-auto overflow-x-auto bg-background/80 p-4 ${
                outputView === 'code' ? 'block' : 'hidden'
              }`}
              style={{
                fontSize: '0.875rem',
                lineHeight: '1.75',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <SyntaxHighlighter
                language="html"
                style={theme === 'dark' ? oneDark : oneLight}
                customStyle={{
                  margin: 0,
                  padding: 0,
                  background: 'transparent',
                  height: 'auto',
                  overflow: 'visible',
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
                {getHtmlWithCSS(outputHtml) || "// Output will appear here..."}
              </SyntaxHighlighter>
            </div>
            {/* Blocks View - Detailed Preview */}
            <div
              className={`h-full border border-border/50 rounded-lg overflow-y-auto bg-background/80 ${
                outputView === 'blocks' ? 'block' : 'hidden'
              }`}
              data-lenisignore
            >
              {contentBlocks.length > 0 ? (
                <div className="divide-y divide-border/30 output-preview">
                  {(() => {
                    const visibleBlocks = contentBlocks;
                    return visibleBlocks.map((block, index) => {
                    const handleCopyFormatted = async () => {
                      try {
                        const blockHtml = block.html; // Formatted HTML without CSS wrapper
                        // Try to copy as rich HTML first (for WordPress visual editor)
                        try {
                          const blob = new Blob([blockHtml], { type: 'text/html' });
                          await navigator.clipboard.write([
                            new ClipboardItem({ 'text/html': blob })
                          ]);
                        } catch (richHtmlError) {
                          // Fallback to plain text if rich HTML copy fails
                          await navigator.clipboard.writeText(blockHtml);
                        }
                        setCopiedBlockId(`${block.id}-formatted`);
                        setTimeout(() => setCopiedBlockId(null), 2000);
                        toast({
                          title: "Copied!",
                          description: `Block ${index + 1} (formatted) copied`,
                        });
                      } catch (error) {
                        toast({
                          title: "Error",
                          description: "Failed to copy block",
                          variant: "destructive",
                        });
                      }
                    };

                    const handleCopyHTML = async () => {
                      try {
                        const blockHtml = getHtmlWithCSS(block.html); // HTML with CSS
                        await navigator.clipboard.writeText(blockHtml);
                        setCopiedBlockId(`${block.id}-html`);
                        setTimeout(() => setCopiedBlockId(null), 2000);
                        toast({
                          title: "Copied!",
                          description: `Block ${index + 1} (HTML) copied`,
                        });
                      } catch (error) {
                        toast({
                          title: "Error",
                          description: "Failed to copy block",
                          variant: "destructive",
                        });
                      }
                    };

                    const typeLabel = {
                      'heading': 'Heading',
                      'content': 'Content',
                      'image': 'Image',
                      'disclaimer': 'Disclaimer',
                      'sources': 'Sources',
                      'readmore': 'Read More'
                    }[block.type] || block.type;

                    return (
                      <div
                        key={block.id}
                        className="group hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex gap-4 p-4 items-start">
                          {/* Block Number - Left Side */}
                          <div className="flex flex-col items-center pt-1 flex-shrink-0">
                            <div className="w-8 h-8 rounded-full border border-border/50 flex items-center justify-center text-xs font-semibold text-muted-foreground">
                              {index + 1}
                            </div>
                            {index < visibleBlocks.length - 1 && (
                              <div className="w-0.5 h-8 bg-border/20 my-2" />
                            )}
                          </div>

                          {/* Preview Content */}
                          <div className="flex-1 min-w-0">
                            {/* Type Badge */}
                            <span className="inline-block text-xs font-medium text-muted-foreground border border-border/50 px-2 py-1 rounded mb-3">
                              {typeLabel}
                            </span>

                            {/* Actual HTML Preview - styled like output-preview */}
                            <div
                              className="text-sm leading-relaxed max-w-none"
                              style={{
                                color: 'hsl(var(--foreground) / 0.9)',
                              }}
                            >
                              {block.type === 'heading' && (
                                <div
                                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block.html) }}
                                  style={{
                                    fontSize: '1.5em',
                                    fontWeight: 'bold',
                                    margin: '1em 0 0.5em 0',
                                    color: 'hsl(var(--foreground))',
                                  }}
                                />
                              )}
                              {block.type === 'content' && (
                                <div
                                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block.html) }}
                                  style={{
                                    fontSize: '0.9375rem',
                                    lineHeight: '1.6',
                                    margin: '0.5em 0',
                                  }}
                                />
                              )}
                              {block.type === 'image' && (
                                <div
                                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block.html) }}
                                  style={{
                                    fontSize: '0.9375rem',
                                    lineHeight: '1.6',
                                  }}
                                />
                              )}
                              {block.type === 'disclaimer' && (
                                <div
                                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block.html) }}
                                  style={{
                                    fontSize: '0.875rem',
                                    lineHeight: '1.6',
                                    margin: '0.5em 0',
                                    fontStyle: 'italic',
                                    color: 'hsl(var(--muted-foreground))',
                                  }}
                                />
                              )}
                              {block.type === 'sources' && (
                                <div
                                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block.html) }}
                                  style={{
                                    fontSize: '0.9375rem',
                                    lineHeight: '1.6',
                                  }}
                                />
                              )}
                              {block.type === 'readmore' && (
                                <div
                                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block.html) }}
                                  style={{
                                    fontSize: '0.9375rem',
                                    lineHeight: '1.6',
                                    margin: '0.5em 0',
                                  }}
                                />
                              )}
                            </div>
                          </div>

                          {/* Copy Buttons - Right Side */}
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex-shrink-0 ml-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCopyFormatted}
                              className="h-8 px-2 text-xs"
                              title="Copy as formatted HTML"
                            >
                              {copiedBlockId === `${block.id}-formatted` ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                "Formatted"
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCopyHTML}
                              className="h-8 px-2 text-xs"
                              title="Copy as HTML code with CSS"
                            >
                              {copiedBlockId === `${block.id}-html` ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                "HTML"
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                    });
                  })()}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-muted-foreground">No content blocks to display</p>
                </div>
              )}
            </div>
            <style>{`
              .output-preview p {
                margin: 0.5em 0;
                color: hsl(var(--foreground) / 0.9);
              }
              .output-preview ul, .output-preview ol {
                margin: 0.5em 0;
                padding-left: 2em;
                color: hsl(var(--foreground) / 0.9);
              }
              .output-preview li {
                margin: 0.25em 0;
                color: hsl(var(--foreground) / 0.9);
              }
              .output-preview a {
                color: hsl(var(--primary)) !important;
                text-decoration: underline;
                text-decoration-color: hsl(var(--primary) / 0.5);
              }
              .output-preview a:hover {
                color: hsl(var(--primary) / 0.8) !important;
                text-decoration-color: hsl(var(--primary));
              }
              .output-preview strong, .output-preview b {
                font-weight: bold;
              }
              .output-preview em, .output-preview i {
                font-style: italic;
              }
            `}</style>
          </div>
        </div>

      </div>

      {/* Maximized Output Modal */}
      <Dialog open={showMaximizedOutput} onOpenChange={setShowMaximizedOutput}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-[95vh] flex flex-col p-0">
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
                      if (maximizedPreviewMode && previewHtml) {
                        // Copy as rich text (HTML) for preview mode
                        const blob = new Blob([previewHtml], { type: 'text/html' });
                        await navigator.clipboard.write([
                          new ClipboardItem({ 'text/html': blob })
                        ]);
                        toast({
                          title: "Copied!",
                          description: "Formatted HTML copied to clipboard",
                        });
                      } else {
                        // Copy as plain text for code mode (includes CSS if provided)
                        const htmlWithCSS = getHtmlWithCSS(outputHtml);
                        await navigator.clipboard.writeText(htmlWithCSS);
                        toast({
                          title: "Copied!",
                          description: customCSS.trim() ? "HTML with CSS copied to clipboard" : "HTML copied to clipboard",
                        });
                      }
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }
                  }}
                  disabled={!outputHtml}
                  className="h-8 w-8 p-0"
                  title={maximizedPreviewMode ? "Copy Formatted HTML" : customCSS.trim() ? "Copy HTML with CSS" : "Copy HTML"}
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
          <div 
            data-lenisignore 
            className="flex-1 overflow-y-auto overflow-x-auto"
            onWheel={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
          >
            {maximizedPreviewMode ? (
              /* Preview in Modal */
              <div 
                className="pl-8 pr-6 pt-6 pb-6 bg-background/80 output-preview"
                style={{
                  fontSize: '1rem',
                  lineHeight: '1.75',
                  fontFamily: 'var(--font-sans)',
                }}
                dangerouslySetInnerHTML={{ 
                  __html: previewHtmlWithWarnings || '<p style="color: hsl(var(--muted-foreground));">// Preview will appear here...</p>' 
                }}
              />
            ) : (
              /* Code in Modal */
              <div ref={modalCodeAreaRef} className="w-full p-4">
                <SyntaxHighlighter
                    language="html"
                    style={theme === 'dark' ? oneDark : oneLight}
                    customStyle={{
                      margin: 0,
                      padding: '1.5rem',
                      background: 'hsl(var(--background) / 0.8)',
                      height: 'auto',
                      minHeight: '100%',
                      overflow: 'visible',
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
                    {getHtmlWithCSS(outputHtml) || "// Output will appear here..."}
                  </SyntaxHighlighter>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Link Check Results Dialog */}
      <Dialog open={showLinkResults} onOpenChange={setShowLinkResults}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {linkCheckResult?.good === linkCheckResult?.total ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
              Link Check Results
            </DialogTitle>
          </DialogHeader>
          
          {linkCheckResult && (
            <div className="space-y-4 mt-4">
              {/* Summary */}
              <div className="flex gap-4 text-sm">
                {linkCheckResult.good > 0 && (
                  <span className="text-green-600 font-medium">✅ {linkCheckResult.good} valid</span>
                )}
                {linkCheckResult.broken > 0 && (
                  <span className="text-red-600 font-medium">❌ {linkCheckResult.broken} 404</span>
                )}
                {linkCheckResult.serverErrors > 0 && (
                  <span className="text-orange-600 font-medium">⚠️ {linkCheckResult.serverErrors} server error</span>
                )}
                {linkCheckResult.blocked > 0 && (
                  <span className="text-gray-500 font-medium">🚫 {linkCheckResult.blocked} blocked</span>
                )}
              </div>
              
              {/* Valid Links */}
              {linkCheckResult.goodLinks.length > 0 && (
                <div>
                  <h4 className="font-medium text-green-600 mb-2">✅ Working Links</h4>
                  <ul className="space-y-1">
                    {linkCheckResult.goodLinks.map((link, i) => (
                      <li key={i}>
                        <a 
                          href={link.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-green-700 hover:underline text-sm break-all"
                        >
                          {link.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Broken Links (404) */}
              {linkCheckResult.brokenLinks.length > 0 && (
                <div>
                  <h4 className="font-medium text-red-600 mb-2">❌ Not Found (404)</h4>
                  <ul className="space-y-1">
                    {linkCheckResult.brokenLinks.map((link, i) => (
                      <li key={i}>
                        <a 
                          href={link.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-red-700 hover:underline text-sm break-all"
                        >
                          {link.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Server Errors */}
              {linkCheckResult.serverErrors.length > 0 && (
                <div>
                  <h4 className="font-medium text-orange-600 mb-2">⚠️ Server Errors (5xx)</h4>
                  <ul className="space-y-1">
                    {linkCheckResult.serverErrors.map((link, i) => (
                      <li key={i}>
                        <a 
                          href={link.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-orange-700 hover:underline text-sm break-all"
                        >
                          {link.url}
                        </a>
                        <span className="text-xs text-orange-500 ml-2">Status: {link.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Blocked Links */}
              {linkCheckResult.blockedLinks.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-600">🚫 Blocked (CORS/Bot Protection)</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={openAllBlockedLinks}
                      title="Open all blocked links"
                      className="h-6 px-2"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">These links couldn't be checked because the website blocks automated requests.</p>
                  <ul className="space-y-1">
                    {linkCheckResult.blockedLinks.map((link, i) => (
                      <li key={i}>
                        <a 
                          href={link.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-gray-600 hover:underline text-sm break-all"
                        >
                          {link.url}
                        </a>
                        <span className="text-xs text-gray-500 ml-2">{link.errorMessage}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
