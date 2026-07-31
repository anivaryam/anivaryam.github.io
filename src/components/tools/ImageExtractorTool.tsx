import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, GitMerge, X } from "lucide-react";
import { extractImages, downloadImage, type ExtractedImage } from "@/lib/image-extractor/extractor";
import { groupImages, type ImageGroup, type LayoutHint } from "@/lib/image-extractor/grouping";
import { ImageCombinerModal } from "./ImageCombinerModal";
import { ImageExtractorZipDrop } from "./ImageExtractorZipDrop";

const ENABLE_ZIP_UPLOAD = true;

export function ImageExtractorTool() {
  const { toast } = useToast();
  const inputAreaRef = useRef<HTMLDivElement>(null);
  const [inputHtml, setInputHtml] = useState("");
  const [images, setImages] = useState<Record<string, ExtractedImage>>({});
  const [groups, setGroups] = useState<ImageGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [combineOpenGroupId, setCombineOpenGroupId] = useState<string | null>(null);
  const draggedImageId = useRef<string | null>(null);

  useEffect(() => {
    const el = inputAreaRef.current;
    if (!el) return;
    const onPaste = (e: ClipboardEvent) => {
      const target = e.currentTarget as HTMLDivElement;
      const html = e.clipboardData?.getData("text/html");
      if (html) {
        e.preventDefault();
        target.innerHTML = html;
        setInputHtml(target.innerHTML);
        return;
      }
      const text = e.clipboardData?.getData("text/plain");
      if (text) {
        e.preventDefault();
        target.innerHTML = text;
        setInputHtml(target.innerHTML);
        return;
      }
      setTimeout(() => {
        const content = target.innerHTML;
        if (content.trim()) setInputHtml(content);
      }, 100);
    };
    const onInput = () => setInputHtml(el.innerHTML);
    el.addEventListener("paste", onPaste);
    el.addEventListener("input", onInput);
    return () => {
      el.removeEventListener("paste", onPaste);
      el.removeEventListener("input", onInput);
    };
  }, []);

  // Extract + group on inputHtml change (debounced) — using v2 separator algorithm.
  useEffect(() => {
    if (!inputHtml.trim()) {
      setImages({});
      setGroups([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const extracted = await extractImages(inputHtml);
        const byId: Record<string, ExtractedImage> = {};
        for (const e of extracted) byId[e.id] = e;
        setImages(byId);
        const parser = new DOMParser();
        const sourceDoc = parser.parseFromString(inputHtml, "text/html");
        const newGroups = groupImages(extracted, sourceDoc);
        setGroups(newGroups);
        toast({
          title: `Extracted ${extracted.length} image${extracted.length === 1 ? "" : "s"}`,
          description: `Grouped into ${newGroups.length} group${newGroups.length === 1 ? "" : "s"}.`,
        });
      } catch (e) {
        toast({
          title: "Extraction failed",
          description: e instanceof Error ? e.message : String(e),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [inputHtml, toast]);

  useEffect(() => {
    const el = inputAreaRef.current;
    if (el && el.innerHTML !== inputHtml) {
      el.innerHTML = inputHtml;
    }
  }, [inputHtml]);

  const clearAll = () => {
    if (inputAreaRef.current) inputAreaRef.current.innerHTML = "";
    setInputHtml("");
    setImages({});
    setGroups([]);
    setSelectedIds(new Set());
  };

  // Per-image original download (no transforms).
  const downloadOriginal = (img: ExtractedImage) => {
    if (!img.blob) {
      toast({ title: "Cannot download", description: img.fetchError ?? "No image data", variant: "destructive" });
      return;
    }
    downloadImage(img.blob, img.filename);
  };

  // Drag-drop between groups (preserved from v1, with v1 fix for empty groups).
  const onDragStart = (e: React.DragEvent, imgId: string) => {
    draggedImageId.current = imgId;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", imgId);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const onDropGroup = (e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    const imgId = e.dataTransfer.getData("text/plain") || draggedImageId.current;
    if (!imgId) return;
    let sourceGroupId: string | null = null;
    for (const g of groups) {
      if (g.imageIds.includes(imgId)) {
        sourceGroupId = g.id;
        break;
      }
    }
    if (!sourceGroupId || sourceGroupId === targetGroupId) return;
    setGroups((prev) =>
      prev.flatMap((g) => {
        if (g.id === sourceGroupId) {
          const next = { ...g, imageIds: g.imageIds.filter((id) => id !== imgId) };
          return next.imageIds.length === 0 ? [] : [next];
        }
        if (g.id === targetGroupId) {
          return [{ ...g, imageIds: [...g.imageIds, imgId] }];
        }
        return [g];
      }),
    );
    draggedImageId.current = null;
  };

  const toggleSelected = (imgId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(imgId)) next.delete(imgId);
      else next.add(imgId);
      return next;
    });
  };

  const splitSelected = (sourceGroupId: string) => {
    const source = groups.find((g) => g.id === sourceGroupId);
    if (!source) {
      toast({ title: "Split failed", description: "Source group not found.", variant: "destructive" });
      return;
    }
    const toSplit = source.imageIds.filter((id) => selectedIds.has(id));
    if (toSplit.length === 0) {
      toast({ title: "Split failed", description: "No selected images in this group.", variant: "destructive" });
      return;
    }
    const remaining = source.imageIds.filter((id) => !toSplit.includes(id));
    const newGroup: ImageGroup = {
      id: `g${Date.now()}`,
      label: `Group ${groups.length + 1}`,
      imageIds: toSplit,
      layoutHint: "horizontal",
    };
    setGroups((prev) => {
      const updated = prev
        .map((g) => (g.id === sourceGroupId ? { ...g, imageIds: remaining } : g))
        .filter((g) => g.imageIds.length > 0);
      return [...updated, newGroup];
    });
    setSelectedIds(new Set());
    toast({
      title: `Split into ${newGroup.label}`,
      description: `${toSplit.length} image(s) moved.`,
    });
  };

  const mergeInto = (sourceGroupId: string, targetGroupId: string) => {
    if (sourceGroupId === targetGroupId) return;
    const source = groups.find((g) => g.id === sourceGroupId);
    if (!source) return;
    setGroups((prev) =>
      prev.flatMap((g) => {
        if (g.id === targetGroupId) {
          return [{ ...g, imageIds: [...g.imageIds, ...source.imageIds] }];
        }
        if (g.id === sourceGroupId) return [];
        return [g];
      }),
    );
  };

  // Compute the images for the open Combine modal (lazily).
  const combineGroup = combineOpenGroupId
    ? groups.find((g) => g.id === combineOpenGroupId) ?? null
    : null;
  const combineImages = combineGroup
    ? combineGroup.imageIds.map((id) => images[id]).filter((i): i is ExtractedImage => !!i)
    : [];

  return (
    <div className="space-y-4">
      {ENABLE_ZIP_UPLOAD && (
        <ImageExtractorZipDrop onHtmlLoaded={setInputHtml} />
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* LEFT: paste area */}
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Input</CardTitle>
          {inputHtml && (
            <Button variant="ghost" size="sm" onClick={clearAll} title="Clear">
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <div
            ref={inputAreaRef}
            contentEditable
            data-lenis-prevent
            data-placeholder="Paste content from Google Docs / Word here..."
            className="flex-1 min-h-[300px] max-h-[60vh] p-4 text-sm bg-background text-foreground border border-border rounded-lg overflow-auto focus:outline-none focus:ring-2 focus:ring-primary/20 input-editable"
            style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
          />
          {loading && (
            <p className="mt-2 text-xs text-muted-foreground">Extracting images…</p>
          )}
        </CardContent>
      </Card>

      {/* RIGHT: extracted groups */}
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Extracted</CardTitle>
          <span className="text-xs text-muted-foreground">
            {Object.keys(images).length} image{Object.keys(images).length === 1 ? "" : "s"} ·{" "}
            {groups.length} group{groups.length === 1 ? "" : "s"}
          </span>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-4 min-h-[300px] max-h-[60vh] overflow-auto" data-lenis-prevent>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Paste content with images to see them grouped here.
            </p>
          ) : (
            <div className="space-y-4">
              {groups.map((g, gIdx) => (
                <div
                  key={g.id}
                  onDragOver={onDragOver}
                  onDrop={(e) => onDropGroup(e, g.id)}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <span className="text-xs font-medium">
                      {g.label} · <span className="text-muted-foreground">{g.layoutHint}</span>
                    </span>
                    <div className="flex items-center gap-2">
                        {g.imageIds.length > 1 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCombineOpenGroupId(g.id)}
                            className="h-7 px-2 text-xs"
                          >
                            Image Combiner
                          </Button>
                        )}
                      {gIdx > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => mergeInto(g.id, groups[gIdx - 1]!.id)}
                          title="Merge into previous group"
                          className="h-6 px-2"
                        >
                          <GitMerge className="h-3 w-3" />
                        </Button>
                      )}
                      {g.imageIds.some((id) => selectedIds.has(id)) && g.imageIds.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => splitSelected(g.id)}
                          className="h-6 px-2 text-xs"
                        >
                          Split selected
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {g.imageIds.map((id) => {
                      const img = images[id];
                      if (!img) return null;
                      const isSelected = selectedIds.has(id);
                      return (
                        <div
                          key={id}
                          draggable
                          onDragStart={(e) => onDragStart(e, id)}
                          className={`relative group border rounded overflow-hidden bg-muted ${isSelected ? "border-primary ring-2 ring-primary/30" : "border-border/50"}`}
                        >
                          {img.blob ? (
                            <img
                              src={URL.createObjectURL(img.blob)}
                              alt={img.alt}
                              className="w-full h-24 object-contain"
                              onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                            />
                          ) : (
                            <div className="w-full h-24 flex items-center justify-center text-xs text-destructive">
                              {img.fetchError ?? "Failed"}
                            </div>
                          )}
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelected(id)}
                            className="absolute top-1 right-1 bg-background/80 backdrop-blur"
                            aria-label={`Select ${img.filename}`}
                          />
                          <button
                            onClick={() => downloadOriginal(img)}
                            className="absolute bottom-1 right-1 bg-background/80 backdrop-blur p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Download original"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <span className="absolute bottom-1 left-1 text-[10px] bg-background/80 backdrop-blur px-1 py-0.5 rounded truncate max-w-[80%]">
                            {img.filename}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Combiner modal — mounts when a group's "Image Combiner" button is clicked. */}
      <ImageCombinerModal
        groupId={combineGroup?.id ?? ""}
        images={combineImages}
        open={!!combineOpenGroupId}
        onOpenChange={(o) => { if (!o) setCombineOpenGroupId(null); }}
      />

      {/* Layout fix: pasted images must render inline-by-default; color inherits theme. */}
      <style>{`
        .input-editable,
        .input-editable * {
          color: inherit !important;
        }
        .input-editable img,
        .input-editable table,
        .input-editable p {
          display: inline-block !important;
          vertical-align: middle;
          max-width: 100%;
        }
      `}</style>
      </div>
    </div>
  );
}
