import { useRef, useState, type ChangeEvent } from "react";
import { Download, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  mergeImageLibrary,
  parseImageLibraryJson,
  parseShopifyImages,
  type ImageLibraryEntry,
} from "@/lib/word-to-html/image-library";

interface ImageLibraryPanelProps {
  library: ImageLibraryEntry[];
  onChange: (library: ImageLibraryEntry[]) => void;
}

export function ImageLibraryPanel({ library, onChange }: ImageLibraryPanelProps) {
  const [shopifyHtml, setShopifyHtml] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);
  const sorted = [...library].sort((a, b) => a.host.localeCompare(b.host) || a.alt.localeCompare(b.alt));

  // Saved images are never duplicated: the toast says which ones were new
  const addImages = (entries: ImageLibraryEntry[], skipped: number) => {
    const merged = mergeImageLibrary(library, entries);
    onChange(merged.library);
    const unchanged = entries.length - merged.added - merged.updated;
    const details = [
      merged.updated > 0 && `${merged.updated} replaced with a newer upload`,
      unchanged > 0 && `${unchanged} already saved`,
      skipped > 0 && `${skipped} skipped: an image needs alt text and a link with the store domain`,
    ].filter(Boolean);
    toast({
      title: `${merged.added} new image${merged.added === 1 ? "" : "s"} saved`,
      description: details.length > 0 ? `${details.join(". ")}.` : undefined,
    });
  };

  const saveImages = () => {
    const { entries, skipped } = parseShopifyImages(shopifyHtml);
    addImages(entries, skipped);
    setShopifyHtml("");
  };

  const exportLibrary = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(library, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "word-to-html-image-library.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const importLibrary = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    addImages(parseImageLibraryJson(await file.text()), 0);
  };

  return (
    <div className="mt-2 p-2 bg-muted/20 border border-border/50 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Image Library ({library.length})
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={exportLibrary} disabled={library.length === 0} className="h-6 w-6 p-0" title="Export saved images">
            <Download className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => importInputRef.current?.click()} className="h-6 w-6 p-0" title="Import saved images">
            <Upload className="h-3 w-3" />
          </Button>
          <input ref={importInputRef} type="file" accept="application/json,.json" onChange={importLibrary} className="hidden" aria-label="Import saved images" />
        </div>
      </div>
      <textarea
        data-lenisignore
        aria-label="Shopify HTML"
        value={shopifyHtml}
        onChange={(e) => setShopifyHtml(e.target.value)}
        placeholder={'<div style="text-align: center;"><a href="https://store.com/collections/..."><img src="https://cdn.shopify.com/..." alt="..."></a></div>'}
        spellCheck={false}
        rows={3}
        className="w-full p-2 text-xs bg-background/80 border border-border/50 rounded resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
        style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-mono)' }}
      />
      <Button variant="outline" size="sm" onClick={saveImages} disabled={!shopifyHtml.trim()} className="mt-1 h-7 text-xs">
        Save images
      </Button>
      <p className="text-xs text-muted-foreground mt-2">
        Paste HTML from the Shopify editor with uploaded images. An "Alt Image Text:" paragraph followed by a "Link to:" paragraph is replaced by the saved image with the same alt text from the same store. Saved in this browser only.
      </p>
      {sorted.length > 0 && (
        <ul data-lenisignore className="mt-2 max-h-48 overflow-y-auto space-y-1">
          {sorted.map(entry => (
            <li key={`${entry.host} ${entry.alt}`} className="flex items-center gap-2 text-xs">
              <img src={entry.src} alt="" loading="lazy" className="h-8 w-8 object-cover rounded flex-shrink-0 bg-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate" title={entry.alt}>{entry.alt}</p>
                <p className="truncate text-muted-foreground">{entry.host}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange(library.filter(saved => saved !== entry))}
                className="h-6 w-6 p-0 flex-shrink-0"
                title={`Remove "${entry.alt}"`}
              >
                <X className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
