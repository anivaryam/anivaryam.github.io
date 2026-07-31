import { useRef, useState } from "react";
import { Upload, Loader2, CheckCircle2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { loadZipAsHtml } from "@/lib/image-extractor/load-zip";

interface ImageExtractorZipDropProps {
  onHtmlLoaded: (html: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ImageExtractorZipDrop({ onHtmlLoaded }: ImageExtractorZipDropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadedFile, setLoadedFile] = useState<{ name: string; size: number } | null>(null);
  const dragCounter = useRef(0);

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLoading) return;
    dragCounter.current += 1;
    if (dragCounter.current === 1) setIsDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setIsDragOver(false);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast({
        title: "Invalid file",
        description: "Please drop a .zip file exported from Google Docs.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const html = await loadZipAsHtml(file);
      onHtmlLoaded(html);
      setLoadedFile({ name: file.name, size: file.size });
      toast({
        title: "Zip loaded",
        description: `Loaded ${file.name} from zip archive.`,
      });
    } catch (e) {
      toast({
        title: "Failed to load zip",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleClear = () => {
    setLoadedFile(null);
    onHtmlLoaded("");
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);
    if (isLoading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  };

  if (loadedFile) {
    return (
      <Card data-testid="zip-dropzone-loaded">
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500 flex-shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate text-foreground" title={loadedFile.name}>
                {loadedFile.name}
              </p>
              <p className="text-xs text-muted-foreground">{formatSize(loadedFile.size)} loaded</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="flex-shrink-0"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "relative border-dashed transition-colors cursor-pointer",
        isDragOver ? "border-primary bg-primary/5" : "border-border",
        isLoading && "opacity-60 pointer-events-none",
      )}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      data-testid="zip-dropzone"
    >
      <CardContent className="flex flex-col items-center justify-center gap-2 py-6 text-center">
        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
        ) : (
          <Upload className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        )}
        <p className="text-sm font-medium">
          {isLoading ? "Loading zip…" : "Drop a .zip file here, or click to browse"}
        </p>
        <p className="text-xs text-muted-foreground">
          Use Google Docs → File → Download → Web Page (.zip)
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".zip"
          onChange={onInputChange}
          disabled={isLoading}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          aria-label="Upload Google Docs zip file"
        />
      </CardContent>
    </Card>
  );
}
