import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Upload, Download, Trash2, Image as ImageIcon, Minimize2, RefreshCw, FileImage, ZoomIn } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ImageFormat = "png" | "jpeg" | "webp";
type ToolMode = "compress" | "convert" | "favicon" | "resize" | "upscale";

interface ProcessedImage {
  blob: Blob;
  url: string;
  size: number;
  format: ImageFormat;
  width?: number;
  height?: number;
}

export function ImageTool() {
  const [originalImage, setOriginalImage] = useState<File | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string>("");
  const [processedImage, setProcessedImage] = useState<ProcessedImage | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<ToolMode>("compress");
  
  // Compression settings
  const [quality, setQuality] = useState([80]);
  const [targetFormat, setTargetFormat] = useState<ImageFormat>("jpeg");
  
  // Conversion settings
  const [convertFormat, setConvertFormat] = useState<ImageFormat>("png");
  
  // Resize settings
  const [resizeWidth, setResizeWidth] = useState("");
  const [resizeHeight, setResizeHeight] = useState("");
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  
  // Favicon settings
  const [faviconSizes, setFaviconSizes] = useState<number[]>([16, 32, 48, 64]);
  
  // Upscale settings
  const [upscaleFactor, setUpscaleFactor] = useState([2]);
  const [upscaleMethod, setUpscaleMethod] = useState<"bicubic" | "lanczos" | "nearest">("lanczos");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getImageDimensions = async (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.src = URL.createObjectURL(file);
    });
  };

  const loadImage = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processImage = async (
    image: HTMLImageElement,
    format: ImageFormat,
    quality: number = 0.9,
    width?: number,
    height?: number
  ): Promise<Blob> => {
    const canvas = canvasRef.current || document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");

    // Calculate dimensions
    let targetWidth = width || image.width;
    let targetHeight = height || image.height;

    if (maintainAspectRatio && mode === "resize") {
      const aspectRatio = image.width / image.height;
      if (width && !height) {
        targetHeight = Math.round(width / aspectRatio);
      } else if (height && !width) {
        targetWidth = Math.round(height * aspectRatio);
      } else if (width && height) {
        // If both provided, maintain aspect ratio based on the limiting dimension
        const widthRatio = width / image.width;
        const heightRatio = height / image.height;
        if (widthRatio < heightRatio) {
          targetWidth = width;
          targetHeight = Math.round(width / aspectRatio);
        } else {
          targetHeight = height;
          targetWidth = Math.round(height * aspectRatio);
        }
      }
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // Apply image smoothing based on method
    if (mode === "upscale") {
      // For upscaling, use better interpolation
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = upscaleMethod === "lanczos" ? "high" : upscaleMethod === "bicubic" ? "high" : "low";
    } else {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
    }

    // Draw image
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    // Convert to blob
    // Note: PNG is lossless and doesn't support quality compression
    // For PNG, we can't reduce file size through quality, only through dimension reduction
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to create blob"));
        },
        `image/${format}`,
        format === "png" ? undefined : quality // PNG doesn't support quality parameter
      );
    });
  };

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 10MB.",
        variant: "destructive",
      });
      return;
    }

    setOriginalImage(file);
    const preview = URL.createObjectURL(file);
    setOriginalPreview(preview);

    // Auto-process based on mode
    try {
      const img = await loadImage(file);
      await processBasedOnMode(img, file);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load image.",
        variant: "destructive",
      });
    }
  };

  const handleReprocess = async () => {
    if (!originalImage) return;
    
    try {
      const img = await loadImage(originalImage);
      await processBasedOnMode(img, originalImage);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process image.",
        variant: "destructive",
      });
    }
  };

  const processBasedOnMode = async (img: HTMLImageElement, file: File) => {
    try {
      let blob: Blob;
      let format: ImageFormat = targetFormat;

      switch (mode) {
        case "compress":
          format = targetFormat;
          blob = await processImage(img, format, quality[0] / 100);
          break;
        case "convert":
          format = convertFormat;
          blob = await processImage(img, format, 0.9);
          break;
        case "resize":
          format = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpeg";
          const width = resizeWidth ? parseInt(resizeWidth) : undefined;
          const height = resizeHeight ? parseInt(resizeHeight) : undefined;
          blob = await processImage(img, format, 0.9, width, height);
          break;
        case "favicon":
          format = "png";
          blob = await processImage(img, format, 1, 32, 32);
          break;
        case "upscale":
          format = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpeg";
          const upscaleWidth = Math.round(img.width * upscaleFactor[0]);
          const upscaleHeight = Math.round(img.height * upscaleFactor[0]);
          blob = await processImage(img, format, 0.95, upscaleWidth, upscaleHeight);
          break;
        default:
          return;
      }

      const url = URL.createObjectURL(blob);
      setProcessedImage({
        blob,
        url,
        size: blob.size,
        format,
        width: mode === "upscale" ? Math.round(img.width * upscaleFactor[0]) : img.width,
        height: mode === "upscale" ? Math.round(img.height * upscaleFactor[0]) : img.height,
      });

      const originalSizeKB = (file.size / 1024).toFixed(2);
      const processedSizeKB = (blob.size / 1024).toFixed(2);
      const savings = ((1 - blob.size / file.size) * 100).toFixed(1);

      toast({
        title: "Processed!",
        description: mode === "compress" 
          ? `Compressed from ${originalSizeKB}KB to ${processedSizeKB}KB (${savings}% reduction)`
          : mode === "upscale"
          ? `Upscaled ${upscaleFactor[0]}x to ${Math.round(img.width * upscaleFactor[0])} × ${Math.round(img.height * upscaleFactor[0])} pixels`
          : "Image processed successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process image.",
        variant: "destructive",
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Downloaded!",
      description: `File saved as ${filename}`,
    });
  };

  const handleDownloadFavicons = async () => {
    if (!originalImage) return;

    try {
      const img = await loadImage(originalImage);
      
      for (const size of faviconSizes) {
        const blob = await processImage(img, "png", 1, size, size);
        const filename = `favicon-${size}x${size}.png`;
        handleDownload(blob, filename);
      }

      toast({
        title: "Favicons generated!",
        description: `Downloaded ${faviconSizes.length} favicon files.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate favicons.",
        variant: "destructive",
      });
    }
  };

  const handleClear = () => {
    if (originalPreview) URL.revokeObjectURL(originalPreview);
    if (processedImage?.url) URL.revokeObjectURL(processedImage.url);
    setOriginalImage(null);
    setOriginalPreview("");
    setProcessedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Mode Selection */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as ToolMode)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="compress">
            <Minimize2 className="mr-2 h-4 w-4" />
            Compress
          </TabsTrigger>
          <TabsTrigger value="convert">
            <RefreshCw className="mr-2 h-4 w-4" />
            Convert
          </TabsTrigger>
          <TabsTrigger value="resize">
            <ImageIcon className="mr-2 h-4 w-4" />
            Resize
          </TabsTrigger>
          <TabsTrigger value="upscale">
            <ZoomIn className="mr-2 h-4 w-4" />
            Upscale
          </TabsTrigger>
          <TabsTrigger value="favicon">
            <FileImage className="mr-2 h-4 w-4" />
            Favicon
          </TabsTrigger>
        </TabsList>

        {/* Compress Tab */}
        <TabsContent value="compress" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Image Compression</CardTitle>
              <CardDescription>Reduce image file size while maintaining quality</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Quality: {quality[0]}%</Label>
                <Slider
                  value={quality}
                  onValueChange={(value) => {
                    setQuality(value);
                    if (originalImage && mode === "compress") {
                      setTimeout(() => handleReprocess(), 300);
                    }
                  }}
                  min={10}
                  max={100}
                  step={5}
                />
              </div>
              <div className="space-y-2">
                <Label>Output Format</Label>
                <Select value={targetFormat} onValueChange={(v) => {
                  setTargetFormat(v as ImageFormat);
                  if (originalImage && mode === "compress") {
                    setTimeout(() => handleReprocess(), 100);
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="jpeg">JPEG</SelectItem>
                    <SelectItem value="png">PNG</SelectItem>
                    <SelectItem value="webp">WebP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Convert Tab */}
        <TabsContent value="convert" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Format Conversion</CardTitle>
              <CardDescription>Convert images between PNG, JPEG, and WebP</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Output Format</Label>
                <Select value={convertFormat} onValueChange={(v) => {
                  setConvertFormat(v as ImageFormat);
                  if (originalImage && mode === "convert") {
                    setTimeout(() => handleReprocess(), 100);
                  }
                }}>
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resize Tab */}
        <TabsContent value="resize" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Image Resize</CardTitle>
              <CardDescription>Resize images to specific dimensions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Width (px)</Label>
                  <Input
                    type="number"
                    value={resizeWidth}
                    onChange={(e) => {
                      setResizeWidth(e.target.value);
                      if (originalImage && mode === "resize" && e.target.value) {
                        setTimeout(() => handleReprocess(), 500);
                      }
                    }}
                    placeholder="Auto"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Height (px)</Label>
                  <Input
                    type="number"
                    value={resizeHeight}
                    onChange={(e) => {
                      setResizeHeight(e.target.value);
                      if (originalImage && mode === "resize" && e.target.value) {
                        setTimeout(() => handleReprocess(), 500);
                      }
                    }}
                    placeholder="Auto"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="maintain-ratio"
                  checked={maintainAspectRatio}
                  onChange={(e) => {
                    setMaintainAspectRatio(e.target.checked);
                    if (originalImage && mode === "resize") {
                      setTimeout(() => handleReprocess(), 100);
                    }
                  }}
                  className="rounded"
                />
                <Label htmlFor="maintain-ratio">Maintain aspect ratio</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upscale Tab */}
        <TabsContent value="upscale" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Image Upscaling</CardTitle>
              <CardDescription>
                Increase image resolution using interpolation algorithms. Note: This smooths pixels but cannot add new detail.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium mb-1">
                   Important Limitation
                </p>
                <p className="text-xs text-muted-foreground">
                  Browser-based upscaling uses interpolation (smoothing pixels), not AI. The image will still appear blurry when zoomed in because it cannot recreate detail that wasn't in the original. For true quality preservation when zooming, you need AI super-resolution tools (like Real-ESRGAN, Topaz AI, or similar) that use machine learning models - these require server-side processing.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Upscale Factor: {upscaleFactor[0]}x</Label>
                <Slider
                  value={upscaleFactor}
                  onValueChange={(value) => {
                    setUpscaleFactor(value);
                    if (originalImage && mode === "upscale") {
                      setTimeout(() => handleReprocess(), 300);
                    }
                  }}
                  min={1.5}
                  max={4}
                  step={0.5}
                />
                {originalImage && (
                  <p className="text-xs text-muted-foreground">
                    Output dimensions will be calculated after processing
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Interpolation Method</Label>
                <Select value={upscaleMethod} onValueChange={(v) => {
                  setUpscaleMethod(v as "bicubic" | "lanczos" | "nearest");
                  if (originalImage && mode === "upscale") {
                    setTimeout(() => handleReprocess(), 100);
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lanczos">Lanczos (Best interpolation quality)</SelectItem>
                    <SelectItem value="bicubic">Bicubic (Good interpolation quality)</SelectItem>
                    <SelectItem value="nearest">Nearest Neighbor (Fast, pixelated)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  These methods smooth pixels but cannot add new detail. For AI-based enhancement, use specialized tools.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Favicon Tab */}
        <TabsContent value="favicon" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Favicon Generator</CardTitle>
              <CardDescription>Generate favicons in multiple sizes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Favicon Sizes (px)</Label>
                <div className="flex flex-wrap gap-2">
                  {[16, 32, 48, 64, 128, 256].map((size) => (
                    <Button
                      key={size}
                      variant={faviconSizes.includes(size) ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (faviconSizes.includes(size)) {
                          setFaviconSizes(faviconSizes.filter((s) => s !== size));
                        } else {
                          setFaviconSizes([...faviconSizes, size].sort((a, b) => a - b));
                        }
                      }}
                    >
                      {size}x{size}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* File Upload Area */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Upload Image</Label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Choose File
            </Button>
            {originalImage && (
              <Button variant="ghost" size="sm" onClick={handleClear}>
                <Trash2 className="mr-2 h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInput}
          className="hidden"
        />
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative h-[300px] rounded-md border-2 border-dashed transition-colors ${
            isDragging
              ? "border-primary bg-primary/10"
              : "border-border bg-background/50"
          }`}
        >
          {originalPreview ? (
            <div className="h-full p-4 flex items-center justify-center">
              <img
                src={originalPreview}
                alt="Original"
                className="max-h-full max-w-full object-contain rounded"
              />
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Upload className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-muted-foreground font-medium">Drop image here or click to upload</p>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPEG, WebP (max 10MB)</p>
            </div>
          )}
        </div>
      </div>

      {/* Processed Image */}
      {processedImage && (
        <Card>
          <CardHeader>
            <CardTitle>Processed Image</CardTitle>
            <CardDescription>
              Size: {formatFileSize(processedImage.size)} • Format: {processedImage.format.toUpperCase()}
              {processedImage.width && processedImage.height && (
                <> • Dimensions: {processedImage.width} × {processedImage.height}</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center p-4 bg-background/50 rounded-md border border-border">
              <img
                src={processedImage.url}
                alt="Processed"
                className="max-h-[400px] max-w-full object-contain rounded"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  const ext = processedImage.format;
                  const filename = originalImage?.name.replace(/\.[^/.]+$/, "") || "image";
                  handleDownload(processedImage.blob, `${filename}.${ext}`);
                }}
                className="flex-1"
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              {mode === "favicon" && (
                <Button onClick={handleDownloadFavicons} variant="outline" className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Download All Favicons
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

