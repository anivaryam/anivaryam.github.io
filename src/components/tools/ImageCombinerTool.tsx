import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import {
  Upload, X, GripVertical, Image as ImageIcon, Plus, Loader2, Combine, Trash2, ChevronUp,
} from "lucide-react";
import {
  combineImages,
  loadImageFromFile,
  getImageDimensions,
  generateId,
  formatFileSize,
  type LayoutMode,
  type SizingMode,
  type OutputFormat,
} from "@/lib/image-combiner/combiner";

interface ImageEntry {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  name: string;
}

type BgMode = "white" | "transparent" | "custom";

const MAX_IMAGES = 20;

type Preset = {
  label: string;
  layout: LayoutMode;
  sizing: SizingMode;
  gap: number;
  outerPadding: number;
  bgMode: BgMode;
  maxWidth?: number;
};

const PRESETS: Preset[] = [
  { label: "Social", layout: "horizontal", sizing: "fit-to-row", gap: 4, outerPadding: 8, bgMode: "white" },
  { label: "Banner", layout: "horizontal", sizing: "max-width", gap: 0, outerPadding: 0, bgMode: "transparent", maxWidth: 1200 },
  { label: "Gallery", layout: "grid-3", sizing: "fit-to-row", gap: 8, outerPadding: 16, bgMode: "white" },
  { label: "Compact", layout: "grid-4", sizing: "keep-original", gap: 2, outerPadding: 4, bgMode: "white" },
];

function LayoutPreviewSvg({ layout }: { layout: LayoutMode }) {
  const cell = (w: number, h: number) => (
    <svg width={`${w}px`} height={`${h}px`} viewBox={`0 0 ${w} ${h}`} className="flex-shrink-0">
      <rect width={w} height={h} rx="1" fill="currentColor" opacity="0.5" />
    </svg>
  );

  if (layout === "horizontal") {
    return (
      <div className="flex gap-0.5 items-center mr-2">
        {cell(12, 8)}
        {cell(12, 8)}
        {cell(12, 8)}
      </div>
    );
  }
  if (layout === "vertical") {
    return (
      <div className="flex flex-col gap-0.5 items-center mr-2">
        {cell(8, 10)}
        {cell(8, 10)}
        {cell(8, 10)}
      </div>
    );
  }
  if (layout === "grid-2") {
    return (
      <div className="flex gap-0.5 mr-2">
        <div className="flex flex-col gap-0.5">
          {cell(8, 8)}
          {cell(8, 8)}
        </div>
        <div className="flex flex-col gap-0.5">
          {cell(8, 8)}
          {cell(8, 8)}
        </div>
      </div>
    );
  }
  if (layout === "grid-3") {
    return (
      <div className="flex gap-0.5 mr-2">
        {cell(5, 10)}
        {cell(5, 10)}
        {cell(5, 10)}
      </div>
    );
  }
  return (
    <div className="flex gap-0.5 mr-2">
      {cell(4, 10)}
      {cell(4, 10)}
      {cell(4, 10)}
      {cell(4, 10)}
    </div>
  );
}

function AspectRatioBadge({ width, height }: { width: number; height: number }) {
  const ratio = width / height;
  let label: string;
  if (Math.abs(ratio - 1) < 0.05) {
    label = "1:1";
  } else if (ratio > 1.4) {
    label = `${width}:${height}`;
  } else if (ratio < 0.7) {
    label = `${height}:${width}`;
  } else {
    label = `${width}:${height}`;
  }
  return (
    <span className="absolute bottom-1 right-1 text-[8px] font-medium text-white bg-black/60 rounded px-0.5 leading-tight">
      {label}
    </span>
  );
}

function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return createPortal(
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 z-[9999] rounded-full bg-primary text-primary-foreground shadow-lg p-3 hover:bg-primary/90 transition-opacity"
      aria-label="Scroll to top"
    >
      <ChevronUp className="h-5 w-5" />
    </button>,
    document.body
  );
}

interface ImageCombinerToolProps {
  /** Optional pre-population: File objects loaded into the combiner's images list on mount. */
  initialFiles?: File[];
}

export function ImageCombinerTool({ initialFiles }: ImageCombinerToolProps = {}) {
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Settings
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("horizontal");
  const [sizingMode, setSizingMode] = useState<SizingMode>("fit-to-row");
  const [maxWidth, setMaxWidth] = useState(800);
  const [gap, setGap] = useState(15);
  const [outerPadding, setOuterPadding] = useState(0);

  // Output
  const [bgMode, setBgMode] = useState<BgMode>("transparent");
  const [customBg, setCustomBg] = useState("#ffffff");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("png");
  const [quality, setQuality] = useState(85);

  // Drag-to-reorder state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Batch selection state (#2)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastClickedIdRef = useRef<string | null>(null);

  // Undo history (#7)
  const historyRef = useRef<ImageEntry[][]>([]);

  // Preview canvas ref
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  // Blob URL tracking via refs to avoid stale-closure leaks
  const imageUrlRefs = useRef<Map<string, string>>(new Map());

  // Revoke all object URLs on unmount
  useEffect(() => {
    return () => {
      imageUrlRefs.current.forEach((url) => URL.revokeObjectURL(url));
      imageUrlRefs.current.clear();
    };
  }, []);

  // ── Keyboard shortcuts (#7) ──────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;

      // Escape — clear selection
      if (e.key === "Escape" && selectedIds.size > 0) {
        setSelectedIds(new Set());
        lastClickedIdRef.current = null;
        return;
      }

      // Ctrl+A / Cmd+A — select all
      if (mod && e.key === "a" && images.length > 0) {
        e.preventDefault();
        setSelectedIds(new Set(images.map((img) => img.id)));
        return;
      }

      // Delete / Backspace — delete selected or currently selected images
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.size > 0) {
        e.preventDefault();
        const toDelete = Array.from(selectedIds);
        toDelete.forEach((id) => {
          const url = imageUrlRefs.current.get(id);
          if (url) {
            URL.revokeObjectURL(url);
            imageUrlRefs.current.delete(id);
          }
        });
        setImages((prev) => prev.filter((img) => !selectedIds.has(img.id)));
        setSelectedIds(new Set());
        lastClickedIdRef.current = null;
        return;
      }

      // Ctrl+Z — undo last reorder
      if (mod && e.key === "z" && historyRef.current.length > 0) {
        e.preventDefault();
        const prev = historyRef.current.pop()!;
        setImages(prev);
        setSelectedIds(new Set());
        lastClickedIdRef.current = null;
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIds, images]);

  // ── Debounced values for preview rendering ───────────────────────────────────
  const debouncedGap = useDebounce(gap, 150);
  const debouncedOuterPadding = useDebounce(outerPadding, 150);

  // ── Live Preview ────────────────────────────────────────────────────────────

  const renderPreview = useCallback(async () => {
    const canvas = previewCanvasRef.current;
    if (!canvas || images.length === 0) return;

    const bgColor = bgMode === "transparent" ? "transparent"
      : bgMode === "custom" ? customBg : "#ffffff";

    try {
      const loaded: HTMLImageElement[] = await Promise.all(
        images.map((img) => loadImageFromFile(img.file))
      );

      const result = await combineImages(loaded, {
        layout: layoutMode,
        sizing: sizingMode,
        gap: debouncedGap,
        outerPadding: debouncedOuterPadding,
        backgroundColor: bgColor,
        format: outputFormat,
        quality: quality / 100,
        maxWidth,
      });

      const scale = Math.min(1, 600 / result.width);
      canvas.width = Math.round(result.width * scale);
      canvas.height = Math.round(result.height * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const previewImg = new Image();
      previewImg.src = URL.createObjectURL(result.blob);
      await new Promise<void>((resolve) => {
        previewImg.onload = () => {
          ctx.drawImage(previewImg, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(previewImg.src);
          resolve();
        };
        previewImg.onerror = () => resolve();
      });
    } catch {
      // Silent — preview failure is non-critical
    }
  }, [images, layoutMode, sizingMode, debouncedGap, debouncedOuterPadding, bgMode, customBg, outputFormat, quality, maxWidth]);

  useEffect(() => {
    renderPreview();
  }, [renderPreview]);

  // ── File Loading ─────────────────────────────────────────────────────────────

  const loadFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);

    const valid: File[] = [];
    for (const f of fileArray) {
      if (!f.type.startsWith("image/")) {
        toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
        continue;
      }
      if (f.size > 20 * 1024 * 1024) {
        toast({ title: "File too large", description: `${f.name} exceeds 20MB limit.`, variant: "destructive" });
        continue;
      }
      valid.push(f);
    }

    if (valid.length === 0) return;

    const remaining = MAX_IMAGES - images.length;
    if (valid.length > remaining) {
      toast({ title: "Maximum reached", description: `Maximum ${MAX_IMAGES} images allowed.`, variant: "destructive" });
      valid.splice(remaining);
      if (valid.length === 0) return;
    }

    const newEntries: ImageEntry[] = [];
    for (const f of valid) {
      const id = generateId();
      const url = URL.createObjectURL(f);
      imageUrlRefs.current.set(id, url);
      try {
        const dims = await getImageDimensions(f);
        newEntries.push({
          id,
          file: f,
          url,
          width: dims.width,
          height: dims.height,
          name: f.name,
        });
      } catch (e) {
        URL.revokeObjectURL(url);
        imageUrlRefs.current.delete(id);
        console.warn("Could not read image", f.name, e);
        toast({ title: "Could not read image", description: f.name, variant: "destructive" });
      }
    }

    setImages((prev) => [...prev, ...newEntries]);
  }, [images.length]);

  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      loadFiles(initialFiles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Initial population only — run once on mount.

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (images.length >= MAX_IMAGES) {
      toast({ title: "Maximum reached", description: `Maximum ${MAX_IMAGES} images allowed.`, variant: "destructive" });
      return;
    }
    loadFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) loadFiles(e.target.files);
    e.target.value = "";
  };

  const handleAddMoreInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) loadFiles(e.target.files);
    e.target.value = "";
  };

  const handleDelete = (id: string) => {
    const url = imageUrlRefs.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      imageUrlRefs.current.delete(id);
    }
    setImages((prev) => prev.filter((img) => img.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // ── Batch selection (#2) ────────────────────────────────────────────────────

  const handleThumbnailClick = (e: React.MouseEvent, id: string) => {
    if (e.shiftKey && lastClickedIdRef.current !== null) {
      // Range select
      const ids = images.map((img) => img.id);
      const fromIdx = ids.indexOf(lastClickedIdRef.current);
      const toIdx = ids.indexOf(id);
      if (fromIdx !== -1 && toIdx !== -1) {
        const [start, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
        const range = ids.slice(start, end + 1);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          range.forEach((rid) => next.add(rid));
          return next;
        });
        lastClickedIdRef.current = id;
        return;
      }
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    lastClickedIdRef.current = id;
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    selectedIds.forEach((id) => {
      const url = imageUrlRefs.current.get(id);
      if (url) {
        URL.revokeObjectURL(url);
        imageUrlRefs.current.delete(id);
      }
    });
    setImages((prev) => prev.filter((img) => !selectedIds.has(img.id)));
    setSelectedIds(new Set());
    lastClickedIdRef.current = null;
  };

  // ── Drag-to-reorder ────────────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(id);
  };

  const handleDropOn = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    setImages((prev) => {
      const arr = [...prev];
      const fromIdx = arr.findIndex((img) => img.id === draggedId);
      const toIdx = arr.findIndex((img) => img.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const adjustedToIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(adjustedToIdx, 0, item);
      // Save snapshot for undo
      historyRef.current.push([...arr]);
      return arr;
    });
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  // ── Combine & Download ─────────────────────────────────────────────────────

  const handleCombine = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);

    try {
      const loaded: HTMLImageElement[] = await Promise.all(
        images.map((img) => loadImageFromFile(img.file))
      );

      const bgColor = bgMode === "transparent" ? "transparent"
        : bgMode === "custom" ? customBg : "#ffffff";

      const result = await combineImages(loaded, {
        layout: layoutMode,
        sizing: sizingMode,
        gap,
        outerPadding,
        backgroundColor: bgColor,
        format: outputFormat,
        quality: quality / 100,
        maxWidth,
      });

      const ext = outputFormat === "jpeg" ? "jpg" : outputFormat;
      const filename = `combined-${images.length}x${layoutMode}-${new Date().toISOString().slice(0, 10)}.${ext}`;

      const a = document.createElement("a");
      a.href = URL.createObjectURL(result.blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);

      toast({
        title: "Combined!",
        description: `${result.width}×${result.height} · ${formatFileSize(result.size)}`,
      });
    } catch {
      toast({ title: "Error", description: "Failed to combine images.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Presets (#10) ───────────────────────────────────────────────────────────

  const applyPreset = (preset: Preset) => {
    setLayoutMode(preset.layout);
    setSizingMode(preset.sizing);
    setGap(preset.gap);
    setOuterPadding(preset.outerPadding);
    setBgMode(preset.bgMode);
    if (preset.maxWidth !== undefined) {
      setMaxWidth(preset.maxWidth);
    }
  };

  const activePreset = PRESETS.find(
    (p) =>
      p.layout === layoutMode &&
      p.sizing === sizingMode &&
      p.gap === gap &&
      p.outerPadding === outerPadding &&
      p.bgMode === bgMode &&
      (p.maxWidth ?? 800) === maxWidth
  );

  const bgColor = bgMode === "transparent" ? "transparent"
    : bgMode === "custom" ? customBg : "#ffffff";

  return (
    <div className="space-y-6">
      <ScrollToTop />

      {/* ── Upload Card ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload Images</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={handleDrop}
            onClick={() => images.length === 0 && fileInputRef.current?.click()}
            className={`relative rounded-lg border-2 border-dashed transition-colors cursor-pointer ${
              isDraggingOver
                ? "border-primary bg-primary/5"
                : "border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50"
            } ${images.length > 0 ? "min-h-[120px] flex items-center justify-center" : "min-h-[160px]"}`}
          >
            {images.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground py-6">
                <Upload className="h-8 w-8" />
                <p className="text-sm font-medium">Drop images here or click to browse</p>
                <p className="text-xs">PNG, JPEG, WebP — up to 20 MB each</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Drop more images here</p>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileInput}
            className="hidden"
          />

          {/* Thumbnail grid */}
          {images.length > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {images.map((img, idx) => {
                  const isSelected = selectedIds.has(img.id);
                  return (
                    <div
                      key={img.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, img.id)}
                      onDragOver={(e) => handleDragOver(e, img.id)}
                      onDrop={(e) => handleDropOn(e, img.id)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => handleThumbnailClick(e, img.id)}
                      className={`group relative rounded-md border bg-background overflow-hidden transition-all cursor-pointer ${
                        dragOverId === img.id ? "ring-2 ring-primary" : "border-border"
                      } ${draggedId === img.id ? "opacity-40" : "opacity-100"} ${
                        isSelected ? "ring-2 ring-primary border-primary" : ""
                      }`}
                    >
                      {/* Order badge (#3) */}
                      <div className="absolute top-1 left-1 z-10 flex items-center justify-center w-5 h-5 rounded-full bg-black/70 text-white text-[9px] font-semibold pointer-events-none">
                        {idx + 1}
                      </div>

                      {/* Grip handle (#1 — always visible) */}
                      <div className="absolute top-1 right-1 z-10 p-1 text-white/80 hover:text-white cursor-grab active:cursor-grabbing">
                        <GripVertical className="h-3.5 w-3.5 drop-shadow-sm" />
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(img.id); }}
                        className="absolute top-1 left-6 z-10 rounded-full bg-black/60 hover:bg-black/80 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`Remove ${img.name}`}
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>

                      {/* Thumbnail */}
                      <img
                        src={img.url}
                        alt={img.name}
                        className="w-full aspect-square object-cover"
                        title={`${img.width}×${img.height} · ${formatFileSize(img.file.size)}`}
                      />

                      {/* Filename + info overlay (#5) */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1.5">
                        <p className="text-[10px] text-white truncate leading-tight">{img.name}</p>
                        <p className="text-[9px] text-white/60 leading-tight">
                          {img.width}×{img.height} · {formatFileSize(img.file.size)}
                        </p>
                      </div>

                      {/* Aspect ratio badge (#4) */}
                      <AspectRatioBadge width={img.width} height={img.height} />
                    </div>
                  );
                })}
              </div>

              {/* Add more / Clear All */}
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                  {images.length} / {MAX_IMAGES} images
                  {selectedIds.size > 0 && (
                    <span className="ml-2 text-primary font-medium">({selectedIds.size} selected)</span>
                  )}
                </p>
                <div className="flex gap-2">
                  {selectedIds.size > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkDelete}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Delete selected ({selectedIds.size})
                    </Button>
                  )}
                  {images.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        imageUrlRefs.current.forEach((url) => URL.revokeObjectURL(url));
                        imageUrlRefs.current.clear();
                        setImages([]);
                        setSelectedIds(new Set());
                        lastClickedIdRef.current = null;
                        historyRef.current = [];
                        toast({ title: "Cleared", description: "All images removed." });
                      }}
                    >
                      Clear all
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addMoreInputRef.current?.click()}
                    disabled={images.length >= MAX_IMAGES}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add more
                  </Button>
                </div>
                <input
                  ref={addMoreInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleAddMoreInput}
                  className="hidden"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Settings Card ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Layout Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Presets bar (#10) */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Presets:</span>
            {PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant={activePreset?.label === preset.label ? "secondary" : "outline"}
                size="sm"
                onClick={() => applyPreset(preset)}
                className="h-7 text-xs"
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Layout Mode (#8) */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Layout</Label>
              <Select value={layoutMode} onValueChange={(v) => setLayoutMode(v as LayoutMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="horizontal">
                    <LayoutPreviewSvg layout="horizontal" />
                    <span>Horizontal</span>
                  </SelectItem>
                  <SelectItem value="vertical">
                    <LayoutPreviewSvg layout="vertical" />
                    <span>Vertical</span>
                  </SelectItem>
                  <SelectItem value="grid-2">
                    <LayoutPreviewSvg layout="grid-2" />
                    <span>Grid 2-col</span>
                  </SelectItem>
                  <SelectItem value="grid-3">
                    <LayoutPreviewSvg layout="grid-3" />
                    <span>Grid 3-col</span>
                  </SelectItem>
                  <SelectItem value="grid-4">
                    <LayoutPreviewSvg layout="grid-4" />
                    <span>Grid 4-col</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sizing Mode */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Sizing</Label>
              <Select value={sizingMode} onValueChange={(v) => setSizingMode(v as SizingMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fit-to-row">Fit to row</SelectItem>
                  <SelectItem value="keep-original">Keep original dimensions</SelectItem>
                  <SelectItem value="max-width">Max-width constrained</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Max Width (conditional) */}
            {sizingMode === "max-width" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Max Width (px)</Label>
                <Input
                  type="number"
                  value={maxWidth}
                  onChange={(e) => setMaxWidth(Number(e.target.value))}
                  min={100}
                  max={4000}
                  step={10}
                />
              </div>
            )}
          </div>

          {/* Gap */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Gap: {gap}px</Label>
            <Slider value={[gap]} onValueChange={([v]) => setGap(v)} min={0} max={50} step={1} />
          </div>

          {/* Outer Padding */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Outer Padding: {outerPadding}px</Label>
            <Slider
              value={[outerPadding]}
              onValueChange={([v]) => setOuterPadding(v)}
              min={0}
              max={100}
              step={1}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Output Card ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Background &amp; Output</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Background Color */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Background</Label>
              <Select value={bgMode} onValueChange={(v) => setBgMode(v as BgMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="white">White</SelectItem>
                  <SelectItem value="transparent">Transparent</SelectItem>
                  <SelectItem value="custom">Custom Color</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom bg color */}
            {bgMode === "custom" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Hex Color</Label>
                <Input
                  type="text"
                  value={customBg}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) setCustomBg(val);
                  }}
                  placeholder="#ff0000"
                  className="uppercase"
                />
              </div>
            )}

            {/* Output Format */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Format</Label>
              <Select value={outputFormat} onValueChange={(v) => setOutputFormat(v as OutputFormat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="png">PNG</SelectItem>
                  <SelectItem value="jpeg">JPEG</SelectItem>
                  <SelectItem value="webp">WebP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quality */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Quality: {quality}%{outputFormat === "png" && " (PNG is lossless)"}
            </Label>
            <Slider
              value={[quality]}
              onValueChange={([v]) => setQuality(v)}
              min={10}
              max={100}
              step={5}
              disabled={outputFormat === "png"}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Preview Card ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {images.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/20 py-16 gap-2 text-muted-foreground">
              <ImageIcon className="h-8 w-8" />
              <p className="text-sm">Upload images to see preview</p>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-md border border-border bg-muted/20 p-4 overflow-hidden">
              <canvas
                ref={previewCanvasRef}
                className="max-w-full object-contain"
                style={{ maxHeight: 400 }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Download Button ── */}
      <Button
        onClick={handleCombine}
        disabled={images.length === 0 || isProcessing}
        className="w-full gap-2"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Combining…
          </>
        ) : (
          <>
            <Combine className="h-4 w-4" />
            Combine &amp; Download
          </>
        )}
      </Button>
    </div>
  );
}
