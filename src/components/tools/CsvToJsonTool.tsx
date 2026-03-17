import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Copy, Check, Trash2, ArrowUpDown, Upload, FileText, Download } from "lucide-react";
import Papa from "papaparse";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function CsvToJsonTool() {
  const [csv, setCsv] = useState("");
  const [json, setJson] = useState("");
  const [delimiter, setDelimiter] = useState(",");
  const [hasHeader, setHasHeader] = useState(true);
  const [copied, setCopied] = useState(false);
  const [direction, setDirection] = useState<"csv-to-json" | "json-to-csv">("csv-to-json");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const convertCsvToJson = () => {
    if (!csv.trim()) {
      toast({
        title: "Error",
        description: "Please enter CSV data.",
        variant: "destructive",
      });
      return;
    }

    try {
      Papa.parse(csv, {
        header: hasHeader,
        delimiter: delimiter || ",",
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            toast({
              title: "Parse Warning",
              description: results.errors[0].message,
              variant: "destructive",
            });
          }
          setJson(JSON.stringify(results.data, null, 2));
          toast({
            title: "Converted!",
            description: "CSV converted to JSON successfully.",
          });
        },
        error: (error) => {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        },
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to convert CSV",
        variant: "destructive",
      });
    }
  };

  // Flatten nested objects for CSV conversion
  const flattenObject = (obj: any, prefix = "", result: Record<string, any> = {}): Record<string, any> => {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (obj[key] !== null && typeof obj[key] === "object" && !Array.isArray(obj[key])) {
          flattenObject(obj[key], newKey, result);
        } else if (Array.isArray(obj[key])) {
          // For arrays, convert to JSON string
          result[newKey] = JSON.stringify(obj[key]);
        } else {
          result[newKey] = obj[key];
        }
      }
    }
    return result;
  };

  const convertJsonToCsv = () => {
    if (!json.trim()) {
      toast({
        title: "Error",
        description: "Please enter JSON data.",
        variant: "destructive",
      });
      return;
    }

    try {
      const parsed = JSON.parse(json);
      
      // Handle different JSON structures
      let array: any[] = [];
      
      if (Array.isArray(parsed)) {
        // If it's already an array, use it
        array = parsed;
      } else if (typeof parsed === "object" && parsed !== null) {
        // If it's an object, check for common array properties
        if (parsed.results && Array.isArray(parsed.results)) {
          // Common pattern: { results: [...] }
          array = parsed.results;
        } else if (parsed.data && Array.isArray(parsed.data)) {
          // Common pattern: { data: [...] }
          array = parsed.data;
        } else if (parsed.items && Array.isArray(parsed.items)) {
          // Common pattern: { items: [...] }
          array = parsed.items;
        } else {
          // Single object - flatten it and wrap in array
          array = [flattenObject(parsed)];
        }
      } else {
        toast({
          title: "Error",
          description: "JSON must be an object or array.",
          variant: "destructive",
        });
        return;
      }
      
      if (array.length === 0) {
        toast({
          title: "Error",
          description: "No data found to convert. JSON array is empty.",
          variant: "destructive",
        });
        return;
      }

      // Flatten nested objects in the array
      const flattenedArray = array.map(item => {
        if (typeof item === "object" && item !== null && !Array.isArray(item)) {
          return flattenObject(item);
        }
        return item;
      });

      const csv = Papa.unparse(flattenedArray, {
        delimiter: delimiter || ",",
        header: hasHeader,
      });
      
      setCsv(csv);
      toast({
        title: "Converted!",
        description: `JSON converted to CSV successfully. ${flattenedArray.length} row(s) converted.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Invalid JSON",
        variant: "destructive",
      });
    }
  };

  const handleConvert = () => {
    if (direction === "csv-to-json") {
      convertCsvToJson();
    } else {
      convertJsonToCsv();
    }
  };

  const handleCopy = async () => {
    const textToCopy = direction === "csv-to-json" ? json : csv;
    if (!textToCopy) return;
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast({
        title: "Copied!",
        description: `${direction === "csv-to-json" ? "JSON" : "CSV"} copied to clipboard.`,
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
    const content = direction === "csv-to-json" ? json : csv;
    if (!content) return;

    const extension = direction === "csv-to-json" ? "json" : "csv";
    const mimeType = direction === "csv-to-json" ? "application/json" : "text/csv";
    const filename = `converted.${extension}`;

    const blob = new Blob([content], { type: mimeType });
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

  const handleClear = () => {
    setCsv("");
    setJson("");
  };

  const handleFileRead = (file: File) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const content = e.target?.result as string;
      
      if (direction === "csv-to-json") {
        // Check if file is CSV
        if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.txt')) {
          toast({
            title: "Invalid file type",
            description: "Please drop a CSV file (.csv or .txt)",
            variant: "destructive",
          });
          return;
        }
        setCsv(content);
        toast({
          title: "File loaded",
          description: `${file.name} loaded successfully. Click Convert to process.`,
        });
      } else {
        // Check if file is JSON
        if (!file.name.toLowerCase().endsWith('.json')) {
          toast({
            title: "Invalid file type",
            description: "Please drop a JSON file (.json)",
            variant: "destructive",
          });
          return;
        }
        try {
          // Validate JSON
          JSON.parse(content);
          setJson(content);
          toast({
            title: "File loaded",
            description: `${file.name} loaded successfully. Click Convert to process.`,
          });
        } catch {
          toast({
            title: "Invalid JSON",
            description: "The file does not contain valid JSON.",
            variant: "destructive",
          });
        }
      }
    };
    
    reader.onerror = () => {
      toast({
        title: "Error reading file",
        description: "Failed to read the file.",
        variant: "destructive",
      });
    };
    
    reader.readAsText(file);
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
    if (files.length === 0) return;

    const file = files[0];
    handleFileRead(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileRead(files[0]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Direction Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Tabs value={direction} onValueChange={(v) => setDirection(v as typeof direction)}>
          <TabsList>
            <TabsTrigger value="csv-to-json">CSV → JSON</TabsTrigger>
            <TabsTrigger value="json-to-csv">JSON → CSV</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleCopy}
            variant="outline"
            size="sm"
            disabled={direction === "csv-to-json" ? !json : !csv}
          >
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </>
            )}
          </Button>
          <Button
            onClick={handleDownload}
            variant="outline"
            size="sm"
            disabled={direction === "csv-to-json" ? !json : !csv}
          >
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          <Button onClick={handleClear} variant="ghost" size="sm">
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      {/* Options */}
      <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4 p-4 bg-background/50 rounded-lg border border-border">
        <div className="flex items-center gap-2">
          <Label htmlFor="delimiter" className="text-sm">Delimiter:</Label>
          <Input
            id="delimiter"
            value={delimiter}
            onChange={(e) => setDelimiter(e.target.value || ",")}
            className="w-20 font-mono"
            placeholder=","
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="header"
            checked={hasHeader}
            onCheckedChange={setHasHeader}
          />
          <Label htmlFor="header" className="text-sm">Has Header Row</Label>
        </div>
        <Button onClick={handleConvert} className="w-full sm:w-auto sm:ml-auto">
          <ArrowUpDown className="mr-2 h-4 w-4" />
          Convert
        </Button>
      </div>

      {/* Input/Output */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <label className="text-sm font-medium text-muted-foreground">
              {direction === "csv-to-json" ? "CSV Input" : "JSON Input"}
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto"
            >
              <Upload className="mr-2 h-4 w-4" />
              Choose File
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={direction === "csv-to-json" ? ".csv,.txt" : ".json"}
            onChange={handleFileInput}
            className="hidden"
          />
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative h-[400px] rounded-md border-2 border-dashed transition-colors overflow-hidden ${
              isDragging
                ? "border-primary bg-primary/10"
                : "border-border bg-background/50"
            }`}
          >
            {isDragging ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                <Upload className="h-12 w-12 text-primary mb-2" />
                <p className="text-primary font-medium">Drop file here</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {direction === "csv-to-json" ? "CSV or TXT file" : "JSON file"}
                </p>
              </div>
            ) : (
              <Textarea
                value={direction === "csv-to-json" ? csv : json}
                onChange={(e) => {
                  if (direction === "csv-to-json") {
                    setCsv(e.target.value);
                  } else {
                    setJson(e.target.value);
                  }
                }}
                placeholder={
                  direction === "csv-to-json"
                    ? "Drag and drop a CSV file here, or paste CSV data...\n\nExample:\nname,age,city\nJohn,30,New York\nJane,25,London"
                    : 'Drag and drop a JSON file here, or paste JSON data...\n\nExample:\n[\n  {"name": "John", "age": 30, "city": "New York"}\n]'
                }
                className="h-full font-mono text-sm bg-transparent border-0 resize-none overflow-auto" data-lenisignore
              />
            )}
            {!isDragging && (
              <div className="absolute bottom-2 right-2 flex items-center gap-2 text-xs text-muted-foreground pointer-events-none">
                <FileText className="h-3 w-3" />
                <span>Drag & drop or paste</span>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            {direction === "csv-to-json" ? "JSON Output" : "CSV Output"}
          </label>
          <pre className="h-[400px] p-4 bg-background/50 border border-border rounded-md overflow-auto text-sm font-mono whitespace-pre-wrap" data-lenisignore>
            {direction === "csv-to-json" 
              ? (json || "Converted JSON will appear here...")
              : (csv || "Converted CSV will appear here...")
            }
          </pre>
        </div>
      </div>
    </div>
  );
}

