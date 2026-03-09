import { useState, useRef, useMemo, Component, ErrorInfo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { Copy, Check, Trash2, Download, QrCode, Wifi, User, Link as LinkIcon, Image, FileText, Upload, AlertCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type QrCodeType = "text" | "wifi" | "contact" | "url" | "file";
type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";

// QR code capacity limits (approximate characters for alphanumeric)
const QR_CAPACITY: Record<ErrorCorrectionLevel, number> = {
  L: 2953,  // Low - ~7% error correction
  M: 2331,  // Medium - ~15% error correction (default)
  Q: 1663,  // Quartile - ~25% error correction
  H: 1273,  // High - ~30% error correction
};

// QR Code Renderer Component with Error Handling
function QRCodeRenderer({
  value,
  size,
  errorCorrectionLevel,
  onError,
  onDownload,
}: {
  value: string;
  size: number;
  errorCorrectionLevel: ErrorCorrectionLevel;
  onError: (error: string) => void;
  onDownload: () => void;
}) {
  // Validate before rendering
  if (value.length > QR_CAPACITY[errorCorrectionLevel]) {
    const errorMsg = `Data (${value.length} chars) exceeds QR code capacity (${QR_CAPACITY[errorCorrectionLevel]} chars) for ${errorCorrectionLevel} level`;
    onError(errorMsg);
    return (
      <div className="text-center py-12 text-muted-foreground">
        <AlertCircle className="h-16 w-16 mx-auto mb-4 opacity-50 text-destructive" />
        <p className="text-destructive">{errorMsg}</p>
      </div>
    );
  }

  return (
    <QRCodeErrorBoundary onError={onError}>
      <div className="space-y-4 w-full">
        <div id="qr-code-container" className="flex justify-center">
          <QRCodeSVG
            value={value}
            size={size}
            level={errorCorrectionLevel}
            includeMargin={true}
            className="bg-white p-4 rounded"
          />
        </div>
        <Button onClick={onDownload} className="w-full">
          <Download className="mr-2 h-4 w-4" />
          Download QR Code
        </Button>
      </div>
    </QRCodeErrorBoundary>
  );
}

// React Error Boundary Class Component
class QRCodeErrorBoundary extends Component<
  { children: React.ReactNode; onError: (error: string) => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; onError: (error: string) => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorMsg = error?.message || "Failed to generate QR code. Data may be too long.";
    this.props.onError(errorMsg);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <AlertCircle className="h-16 w-16 mx-auto mb-4 opacity-50 text-destructive" />
          <p className="text-destructive">
            {this.state.error?.message || "Failed to generate QR code. Data may be too long."}
          </p>
          <p className="text-sm mt-2">Please reduce the data size or use a URL instead.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export function QrCodeGeneratorTool() {
  const [qrType, setQrType] = useState<QrCodeType>("text");
  const [size, setSize] = useState([256]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Text/URL
  const [text, setText] = useState("");

  // WiFi
  const [wifiSSID, setWifiSSID] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [wifiSecurity, setWifiSecurity] = useState("WPA");
  const [wifiHidden, setWifiHidden] = useState(false);

  // Contact (vCard)
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactOrg, setContactOrg] = useState("");
  const [contactUrl, setContactUrl] = useState("");

  // File
  const [fileUrl, setFileUrl] = useState("");
  const [fileDataUri, setFileDataUri] = useState("");

  const generateQrValue = (): string => {
    switch (qrType) {
      case "text":
        return text;
      
      case "url":
        return text.startsWith("http://") || text.startsWith("https://") 
          ? text 
          : `https://${text}`;
      
      case "wifi":
        if (!wifiSSID) return "";
        const security = wifiSecurity === "None" ? "nopass" : wifiSecurity;
        return `WIFI:T:${security};S:${wifiSSID};P:${wifiPassword || ""};${wifiHidden ? "H:true;" : ""};;`;
      
      case "contact":
        if (!contactName) return "";
        const vCard = [
          "BEGIN:VCARD",
          "VERSION:3.0",
          `FN:${contactName}`,
          contactPhone ? `TEL:${contactPhone}` : "",
          contactEmail ? `EMAIL:${contactEmail}` : "",
          contactOrg ? `ORG:${contactOrg}` : "",
          contactUrl ? `URL:${contactUrl}` : "",
          "END:VCARD"
        ].filter(Boolean).join("\n");
        return vCard;
      
      case "file":
        return fileDataUri || fileUrl || "";
      
      default:
        return "";
    }
  };

  const qrValue = generateQrValue();

  // Calculate appropriate error correction level based on data length
  const errorCorrectionLevel = useMemo((): ErrorCorrectionLevel => {
    const length = qrValue.length;
    if (length === 0) return "M";
    
    // Use lower error correction for larger data to maximize capacity
    if (length > QR_CAPACITY.H) {
      return "L"; // Lowest error correction for maximum capacity
    } else if (length > QR_CAPACITY.Q) {
      return "M";
    } else if (length > QR_CAPACITY.M) {
      return "Q";
    } else {
      return "H"; // Highest error correction for smaller data
    }
  }, [qrValue]);

  // Validate QR code data length
  const validationError = useMemo(() => {
    if (!qrValue) return null;
    
    const length = qrValue.length;
    const maxCapacity = QR_CAPACITY[errorCorrectionLevel];
    
    if (length > maxCapacity) {
      return `Data too long (${length} characters). Maximum capacity is ${maxCapacity} characters with ${errorCorrectionLevel} error correction level. Please reduce the data size.`;
    }
    
    return null;
  }, [qrValue, errorCorrectionLevel]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (limit to 500KB for QR code capacity)
    const maxSize = 500 * 1024; // 500KB
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "File must be less than 500KB to embed in QR code. Consider using a URL instead.",
        variant: "destructive",
      });
      setFileDataUri("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      // Check if data URI is too long for QR code
      if (result.length > QR_CAPACITY.L) {
        toast({
          title: "File too large",
          description: `File data URI (${result.length} chars) exceeds QR code capacity. Use a URL instead.`,
          variant: "destructive",
        });
        setFileDataUri("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }
      setFileDataUri(result);
      setFileUrl("");
      setError(null);
      toast({
        title: "File loaded",
        description: `${file.name} converted to data URI.`,
      });
    };
    reader.onerror = () => {
      toast({
        title: "Error",
        description: "Failed to read file.",
        variant: "destructive",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleCopy = async () => {
    if (!qrValue) return;
    
    try {
      await navigator.clipboard.writeText(qrValue);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "QR code data copied to clipboard.",
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

  const handleDownload = () => {
    if (!qrValue) return;
    
    const container = document.getElementById("qr-code-container");
    const svg = container?.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new window.Image();
    
    canvas.width = size[0];
    canvas.height = size[0];
    
    img.onload = () => {
      ctx?.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `qrcode-${Date.now()}.png`;
          a.click();
          URL.revokeObjectURL(url);
          toast({
            title: "Downloaded!",
            description: "QR code saved to your downloads.",
          });
        }
      });
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleClear = () => {
    setText("");
    setWifiSSID("");
    setWifiPassword("");
    setContactName("");
    setContactPhone("");
    setContactEmail("");
    setContactOrg("");
    setContactUrl("");
    setFileUrl("");
    setFileDataUri("");
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Type Selection */}
      <Tabs value={qrType} onValueChange={(v) => setQrType(v as QrCodeType)}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 h-auto">
          <TabsTrigger value="text" className="flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm">
            <FileText className="h-3 w-3 flex-shrink-0" />
            <span className="hidden sm:inline">Text</span>
          </TabsTrigger>
          <TabsTrigger value="url" className="flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm">
            <LinkIcon className="h-3 w-3 flex-shrink-0" />
            <span className="hidden sm:inline">URL</span>
          </TabsTrigger>
          <TabsTrigger value="wifi" className="flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm">
            <Wifi className="h-3 w-3 flex-shrink-0" />
            <span className="hidden sm:inline">WiFi</span>
          </TabsTrigger>
          <TabsTrigger value="contact" className="flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm">
            <User className="h-3 w-3 flex-shrink-0" />
            <span className="hidden sm:inline">Contact</span>
          </TabsTrigger>
          <TabsTrigger value="file" className="flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm">
            <Image className="h-3 w-3 flex-shrink-0" />
            <span className="hidden sm:inline">File</span>
          </TabsTrigger>
        </TabsList>

        {/* Text/URL Input */}
        <TabsContent value="text" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="qr-text">Text</Label>
            <Textarea
              id="qr-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter text to generate QR code..."
              className="min-h-[100px] font-mono text-sm"
            />
          </div>
        </TabsContent>

        <TabsContent value="url" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="qr-url">Website URL</Label>
            <Input
              id="qr-url"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="example.com or https://example.com"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              URLs without http:// will automatically have https:// added
            </p>
          </div>
        </TabsContent>

        {/* WiFi */}
        <TabsContent value="wifi" className="space-y-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="wifi-ssid">Network Name (SSID) *</Label>
              <Input
                id="wifi-ssid"
                value={wifiSSID}
                onChange={(e) => setWifiSSID(e.target.value)}
                placeholder="MyWiFiNetwork"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wifi-password">Password</Label>
              <Input
                id="wifi-password"
                type="password"
                value={wifiPassword}
                onChange={(e) => setWifiPassword(e.target.value)}
                placeholder="Leave empty for open networks"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="wifi-security">Security Type</Label>
                <Select value={wifiSecurity} onValueChange={setWifiSecurity}>
                  <SelectTrigger id="wifi-security">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WPA">WPA/WPA2</SelectItem>
                    <SelectItem value="WEP">WEP</SelectItem>
                    <SelectItem value="None">None (Open)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex items-end">
                <Label htmlFor="wifi-hidden" className="flex items-center gap-2 cursor-pointer">
                  <input
                    id="wifi-hidden"
                    type="checkbox"
                    checked={wifiHidden}
                    onChange={(e) => setWifiHidden(e.target.checked)}
                    className="rounded"
                  />
                  Hidden Network
                </Label>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Contact */}
        <TabsContent value="contact" className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Name *</Label>
              <Input
                id="contact-name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact-phone">Phone</Label>
                <Input
                  id="contact-phone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+1234567890"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-org">Organization</Label>
              <Input
                id="contact-org"
                value={contactOrg}
                onChange={(e) => setContactOrg(e.target.value)}
                placeholder="Company Name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-url">Website</Label>
              <Input
                id="contact-url"
                value={contactUrl}
                onChange={(e) => setContactUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>
        </TabsContent>

        {/* File */}
        <TabsContent value="file" className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Upload File (Image/Video/PDF)</Label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,.pdf"
                  onChange={handleFileUpload}
                  className="cursor-pointer"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Choose File
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Files up to 500KB can be embedded. Larger files should use a URL.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="file-url">Or Enter File URL</Label>
              <Input
                id="file-url"
                value={fileUrl}
                onChange={(e) => {
                  setFileUrl(e.target.value);
                  setFileDataUri("");
                }}
                placeholder="https://example.com/image.png"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Enter a direct URL to an image, video, or PDF file
              </p>
            </div>
            {fileDataUri && (
              <div className="p-3 bg-background/50 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground mb-2">File loaded as data URI</p>
                <p className="text-xs font-mono break-all">{fileDataUri.substring(0, 100)}...</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Error Display */}
      {(validationError || error) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{validationError || error}</AlertDescription>
        </Alert>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">
            {qrValue.length} characters
            {qrValue && (
              <span className="ml-2">
                (Max: {QR_CAPACITY[errorCorrectionLevel]} with {errorCorrectionLevel} level)
              </span>
            )}
          </span>
          {qrValue && qrValue.length > QR_CAPACITY[errorCorrectionLevel] * 0.8 && (
            <span className="text-xs text-yellow-500 mt-1">
               Approaching capacity limit
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleCopy}
            variant="outline"
            size="sm"
            disabled={!qrValue}
          >
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy Data
              </>
            )}
          </Button>
          <Button onClick={handleClear} variant="ghost" size="sm">
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      {/* Size Control */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Size: {size[0]}px</Label>
        </div>
        <Slider
          value={size}
          onValueChange={setSize}
          min={128}
          max={512}
          step={32}
          className="w-full"
        />
      </div>

      {/* QR Code Display */}
      <div className="flex flex-col items-center justify-center p-8 bg-background/50 rounded-lg border border-border">
        {qrValue && !validationError ? (
          <QRCodeRenderer
            value={qrValue}
            size={size[0]}
            errorCorrectionLevel={errorCorrectionLevel}
            onError={(err) => setError(err)}
            onDownload={handleDownload}
          />
        ) : validationError ? (
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="h-16 w-16 mx-auto mb-4 opacity-50 text-destructive" />
            <p className="text-destructive">{validationError}</p>
            <p className="text-sm mt-2">Please reduce the data size or use a URL instead of embedding files.</p>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <QrCode className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p>Fill in the form above to generate QR code</p>
          </div>
        )}
      </div>
    </div>
  );
}
