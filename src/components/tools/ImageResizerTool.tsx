import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Upload, Download, Trash2, CheckCircle2, XCircle, Plus, Pencil, X, ChevronDown, ChevronUp, Settings } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  getPresets, addClient, deleteClient, addPlacement, deletePlacement, updateClientName,
  type ClientPreset,
} from "@/lib/image-resizer/presets";
import {
  resizeImage, getImageDimensions, mimeToFormat, formatFileSize,
  type ResizeMode, type OutputFormat,
} from "@/lib/image-resizer/resizer";

interface ImageInfo {
  width: number;
  height: number;
  size: number;
  format: string;
  name: string;
}

type StatusResult =
  | { type: 'none' }
  | { type: 'pass' }
  | { type: 'fail'; widthDiff: string; heightDiff: string };

function getStatus(info: ImageInfo | null, width: number | undefined, height: number | undefined): StatusResult {
  if (!info || !width || !height) return { type: 'none' };
  if (info.width === width && info.height === height) return { type: 'pass' };
  const wRatio = (info.width / width).toFixed(2);
  const hRatio = (info.height / height).toFixed(2);
  return {
    type: 'fail',
    widthDiff: info.width > width ? `${wRatio}× too wide` : `${(width / info.width).toFixed(2)}× too narrow`,
    heightDiff: info.height > height ? `${hRatio}× too tall` : `${(height / info.height).toFixed(2)}× too short`,
  };
}

export function ImageResizerTool() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState('');
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultSize, setResultSize] = useState(0);

  // Presets
  const [presets, setPresets] = useState<ClientPreset[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedPlacementId, setSelectedPlacementId] = useState('');

  // Resize settings
  const [resizeMode, setResizeMode] = useState<ResizeMode>('fill');
  const [outputFormat, setOutputFormat] = useState<OutputFormat | 'original'>('original');
  const [quality, setQuality] = useState(85);

  // Preset editor state
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editingClientName, setEditingClientName] = useState('');
  const [addingPlacementClientId, setAddingPlacementClientId] = useState<string | null>(null);
  const [newPlacementName, setNewPlacementName] = useState('');
  const [newPlacementWidth, setNewPlacementWidth] = useState('');
  const [newPlacementHeight, setNewPlacementHeight] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Track blob URLs via refs to avoid stale-closure leaks across rapid loads
  const previewUrlRef = useRef('');
  const resultUrlRef = useRef('');

  // Revoke both blob URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  useEffect(() => {
    const loaded = getPresets();
    setPresets(loaded);
    if (loaded.length > 0) {
      setSelectedClientId(loaded[0].id);
      if (loaded[0].placements.length > 0) {
        setSelectedPlacementId(loaded[0].placements[0].id);
      }
    }
  }, []);

  const selectedClient = presets.find((c) => c.id === selectedClientId);
  const selectedPlacement = selectedClient?.placements.find((p) => p.id === selectedPlacementId);
  const status = getStatus(imageInfo, selectedPlacement?.width, selectedPlacement?.height);

  const loadFile = useCallback(async (f: File) => {
    if (!f.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please select an image file.', variant: 'destructive' });
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Please select an image smaller than 20MB.', variant: 'destructive' });
      return;
    }

    // Revoke previous URLs via refs (avoids stale-closure leaks on rapid loads)
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = '';
    setResultUrl('');
    setResultBlob(null);

    const url = URL.createObjectURL(f);
    previewUrlRef.current = url;
    setFile(f);
    setPreviewUrl(url);

    try {
      const dims = await getImageDimensions(f);
      setImageInfo({
        width: dims.width,
        height: dims.height,
        size: f.size,
        format: f.type.replace('image/', '').toUpperCase(),
        name: f.name,
      });
    } catch {
      toast({ title: 'Error', description: 'Could not read image dimensions.', variant: 'destructive' });
    }
  }, []); // stable — uses refs, no state deps

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) loadFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const item = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith('image/'));
    if (item) {
      const f = item.getAsFile();
      if (f) loadFile(f);
    }
  }, [loadFile]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const handleClear = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    previewUrlRef.current = '';
    resultUrlRef.current = '';
    setFile(null);
    setPreviewUrl('');
    setImageInfo(null);
    setResultUrl('');
    setResultBlob(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleResize = async () => {
    if (!file || !selectedPlacement) return;
    setIsProcessing(true);
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);

    try {
      const format: OutputFormat = outputFormat === 'original' ? mimeToFormat(file.type) : outputFormat;
      const blob = await resizeImage(file, {
        width: selectedPlacement.width,
        height: selectedPlacement.height,
        mode: resizeMode,
        format,
        quality: quality / 100,
      });

      const url = URL.createObjectURL(blob);
      resultUrlRef.current = url;
      setResultUrl(url);
      setResultBlob(blob);
      setResultSize(blob.size);
      toast({ title: 'Done!', description: `Resized to ${selectedPlacement.width}×${selectedPlacement.height}` });
    } catch {
      toast({ title: 'Error', description: 'Failed to resize image.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const slugify = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleDownload = () => {
    if (!resultBlob || !file || !selectedPlacement) return;
    const format: OutputFormat = outputFormat === 'original' ? mimeToFormat(file.type) : outputFormat;
    const baseName = slugify(file.name.replace(/\.[^/.]+$/, ''));
    const clientSlug = slugify(selectedClient?.name ?? 'client');
    const placementSlug = slugify(selectedPlacement.name);
    const filename = `${baseName}-${clientSlug}-${placementSlug}-${selectedPlacement.width}x${selectedPlacement.height}.${format === 'jpeg' ? 'jpg' : format}`;

    const a = document.createElement('a');
    a.href = URL.createObjectURL(resultBlob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Preset editor handlers
  const handleAddClient = () => {
    if (!newClientName.trim()) return;
    try {
      const updated = addClient(presets, newClientName.trim());
      setPresets(updated);
      setSelectedClientId(updated[updated.length - 1].id);
      setSelectedPlacementId('');
      setNewClientName('');
    } catch (e) {
      toast({ title: 'Could not save', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleDeleteClient = (clientId: string) => {
    try {
      const updated = deleteClient(presets, clientId);
      setPresets(updated);
      if (selectedClientId === clientId) {
        setSelectedClientId(updated[0]?.id ?? '');
        setSelectedPlacementId(updated[0]?.placements[0]?.id ?? '');
      }
    } catch (e) {
      toast({ title: 'Could not save', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleSaveClientName = (clientId: string) => {
    if (!editingClientName.trim()) return;
    try {
      const updated = updateClientName(presets, clientId, editingClientName.trim());
      setPresets(updated);
      setEditingClientId(null);
    } catch (e) {
      toast({ title: 'Could not save', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleAddPlacement = (clientId: string) => {
    const w = parseInt(newPlacementWidth, 10);
    const h = parseInt(newPlacementHeight, 10);
    if (!newPlacementName.trim() || !Number.isInteger(w) || w <= 0 || w > 10000 || !Number.isInteger(h) || h <= 0 || h > 10000) {
      toast({ title: 'Invalid dimensions', description: 'Width and height must be whole numbers between 1 and 10000.', variant: 'destructive' });
      return;
    }
    try {
      const updated = addPlacement(presets, clientId, { name: newPlacementName.trim(), width: w, height: h });
      setPresets(updated);
      const newP = updated.find((c) => c.id === clientId)?.placements.at(-1);
      if (newP) setSelectedPlacementId(newP.id);
      setAddingPlacementClientId(null);
      setNewPlacementName('');
      setNewPlacementWidth('');
      setNewPlacementHeight('');
    } catch (e) {
      toast({ title: 'Could not save', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleDeletePlacement = (clientId: string, placementId: string) => {
    try {
      const updated = deletePlacement(presets, clientId, placementId);
      setPresets(updated);
      if (selectedPlacementId === placementId) {
        const client = updated.find((c) => c.id === clientId);
        setSelectedPlacementId(client?.placements[0]?.id ?? '');
      }
    } catch (e) {
      toast({ title: 'Could not save', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const formatLabel = (f: OutputFormat | 'original') => {
    if (f === 'original') return 'Original format';
    return f.toUpperCase();
  };

  const canResize = !!file && !!selectedPlacement;

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Image</Label>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" />
              Choose file
            </Button>
            {file && (
              <Button variant="ghost" size="sm" onClick={handleClear}>
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileInput} className="hidden" />

        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !file && fileInputRef.current?.click()}
          className={`relative rounded-lg border-2 border-dashed transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'
          } ${!file ? 'cursor-pointer hover:border-primary/50 hover:bg-muted/50' : ''}`}
          style={{ minHeight: 220 }}
        >
          {previewUrl ? (
            <div className="flex items-center justify-center p-4" style={{ minHeight: 220 }}>
              <img src={previewUrl} alt="Original" className="max-h-52 max-w-full object-contain rounded" />
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Upload className="h-10 w-10" />
              <p className="font-medium text-sm">Drop image here, click to upload, or paste from clipboard</p>
              <p className="text-xs">PNG, JPEG, WebP — up to 20 MB</p>
            </div>
          )}
        </div>

        {/* Image info bar */}
        {imageInfo && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground px-1">
            <span className="font-medium text-foreground truncate max-w-[200px]">{imageInfo.name}</span>
            <span>{imageInfo.width} × {imageInfo.height} px</span>
            <span>{formatFileSize(imageInfo.size)}</span>
            <span>{imageInfo.format}</span>
          </div>
        )}
      </div>

      {/* Preset selector + status */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Placement</CardTitle>
            <CardDescription className="text-xs">Select the target client and image placement</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {presets.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No clients yet. Open <span className="font-medium">Manage Presets</span> below to add your first client and placements.
              </p>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Client</Label>
              <Select value={selectedClientId} onValueChange={(v) => {
                setSelectedClientId(v);
                const client = presets.find((c) => c.id === v);
                setSelectedPlacementId(client?.placements[0]?.id ?? '');
              }} disabled={presets.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Placement</Label>
              <Select
                value={selectedPlacementId}
                onValueChange={setSelectedPlacementId}
                disabled={!selectedClient || selectedClient.placements.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedClient?.placements.length === 0 ? 'No placements' : 'Select placement'} />
                </SelectTrigger>
                <SelectContent>
                  {selectedClient?.placements.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {p.width}×{p.height}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPlacement && (
              <p className="text-xs text-muted-foreground">
                Required: <span className="font-mono font-medium text-foreground">{selectedPlacement.width} × {selectedPlacement.height} px</span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Status</CardTitle>
            <CardDescription className="text-xs">Dimension check against selected placement</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center min-h-[100px]">
            {status.type === 'none' && (
              <p className="text-sm text-muted-foreground text-center">
                {!imageInfo ? 'Upload an image to check' : 'Select a placement to check'}
              </p>
            )}
            {status.type === 'pass' && (
              <div className="flex flex-col items-center gap-1 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Correct dimensions</p>
                <p className="text-xs text-muted-foreground">{imageInfo!.width} × {imageInfo!.height} px</p>
              </div>
            )}
            {status.type === 'fail' && (
              <div className="flex flex-col items-center gap-1.5 text-center">
                <XCircle className="h-8 w-8 text-destructive" />
                <p className="text-sm font-medium text-destructive">Wrong dimensions</p>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>Current: <span className="font-mono">{imageInfo!.width} × {imageInfo!.height}</span></p>
                  <p>Required: <span className="font-mono">{selectedPlacement!.width} × {selectedPlacement!.height}</span></p>
                  <p className="text-destructive/80">{status.widthDiff} · {status.heightDiff}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resize settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resize Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Mode */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Resize mode</Label>
              <Select value={resizeMode} onValueChange={(v) => setResizeMode(v as ResizeMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fill">Fill (crop to center)</SelectItem>
                  <SelectItem value="fit">Fit (letterbox)</SelectItem>
                  <SelectItem value="exact">Exact (stretch)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {resizeMode === 'fill' && 'Scale to cover, center-crop to exact size'}
                {resizeMode === 'fit' && 'Scale to fit inside, pad with white'}
                {resizeMode === 'exact' && 'Stretch/squish to exact dimensions'}
              </p>
            </div>

            {/* Format */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Output format</Label>
              <Select value={outputFormat} onValueChange={(v) => setOutputFormat(v as OutputFormat | 'original')}>
                <SelectTrigger>
                  <SelectValue>{formatLabel(outputFormat)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="original">Original format</SelectItem>
                  <SelectItem value="jpeg">JPG</SelectItem>
                  <SelectItem value="png">PNG</SelectItem>
                  <SelectItem value="webp">WebP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quality */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Quality: {quality}%</Label>
              <Slider
                value={[quality]}
                onValueChange={([v]) => setQuality(v)}
                min={10}
                max={100}
                step={5}
                disabled={outputFormat === 'png'}
              />
              {outputFormat === 'png' && (
                <p className="text-xs text-muted-foreground">PNG is lossless — quality slider has no effect</p>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button onClick={handleResize} disabled={!canResize || isProcessing} className="flex-1 sm:flex-none sm:min-w-[160px]">
              {isProcessing ? 'Resizing…' : `Resize to ${selectedPlacement ? `${selectedPlacement.width}×${selectedPlacement.height}` : '…'}`}
            </Button>
            {resultBlob && (
              <Button variant="outline" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1.5" />
                Download ({formatFileSize(resultSize)})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Result preview */}
      {resultUrl && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Result</CardTitle>
            <CardDescription className="text-xs">
              {selectedPlacement?.width} × {selectedPlacement?.height} px · {formatFileSize(resultSize)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center rounded-md bg-muted/40 border border-border p-4">
              <img src={resultUrl} alt="Resized" className="max-h-72 max-w-full object-contain rounded" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preset manager */}
      <Collapsible open={presetsOpen} onOpenChange={setPresetsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="h-4 w-4" />
            Manage Presets
            {presetsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Presets are saved in your browser. Each client can have multiple placements with fixed dimensions.
          </p>

          {presets.map((client) => (
            <Card key={client.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  {editingClientId === client.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editingClientName}
                        onChange={(e) => setEditingClientName(e.target.value)}
                        className="h-7 text-sm"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveClientName(client.id); if (e.key === 'Escape') setEditingClientId(null); }}
                        autoFocus
                      />
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleSaveClientName(client.id)}>Save</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingClientId(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <CardTitle className="text-sm font-medium">{client.name}</CardTitle>
                  )}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm" variant="ghost" className="h-7 w-7 p-0"
                      aria-label={`Rename ${client.name}`}
                      onClick={() => { setEditingClientId(client.id); setEditingClientName(client.name); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      aria-label={`Delete ${client.name}`}
                      onClick={() => handleDeleteClient(client.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {client.placements.length === 0 && (
                  <p className="text-xs text-muted-foreground">No placements yet.</p>
                )}
                {client.placements.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span>{p.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-muted-foreground">{p.width} × {p.height}</span>
                      <Button
                        size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        aria-label={`Delete placement ${p.name}`}
                        onClick={() => handleDeletePlacement(client.id, p.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}

                {addingPlacementClientId === client.id ? (
                  <div className="pt-2 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        placeholder="Name (e.g. Blog Hero)"
                        value={newPlacementName}
                        onChange={(e) => setNewPlacementName(e.target.value)}
                        className="col-span-3 h-8 text-sm"
                      />
                      <Input
                        placeholder="Width px"
                        type="number"
                        value={newPlacementWidth}
                        onChange={(e) => setNewPlacementWidth(e.target.value)}
                        className="h-8 text-sm"
                      />
                      <Input
                        placeholder="Height px"
                        type="number"
                        value={newPlacementHeight}
                        onChange={(e) => setNewPlacementHeight(e.target.value)}
                        className="h-8 text-sm"
                      />
                      <div className="flex gap-1">
                        <Button size="sm" className="h-8 flex-1" onClick={() => handleAddPlacement(client.id)}>Add</Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setAddingPlacementClientId(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm" variant="outline" className="h-7 text-xs mt-1"
                    onClick={() => setAddingPlacementClientId(client.id)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add placement
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Add new client */}
          <div className="flex gap-2">
            <Input
              placeholder="New client name"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              className="h-8 text-sm max-w-[220px]"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddClient(); }}
            />
            <Button size="sm" onClick={handleAddClient} disabled={!newClientName.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              Add client
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
