import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CommandDialog, CommandInput, CommandList, CommandGroup, CommandItem } from "@/components/ui/command";
import { Calculator, FileJson, Lock, Unlock, Link, Type, Image, Clock, Hash, Key, Regex, Scissors, FileCode, Table, QrCode, TextCursor, Download, Palette, Wand2, Search, Calendar, Images } from "lucide-react";

const tools = [
  { name: "Word to HTML", description: "Convert Word documents to HTML", icon: FileCode, path: "/tools/word-to-html", keywords: ["word", "html", "converter", "document"] },
  { name: "JSON Formatter", description: "Format and validate JSON", icon: FileJson, path: "/tools/json-formatter", keywords: ["json", "format", "validate", "beautify"] },
  { name: "Base64 Encoder/Decoder", description: "Encode and decode Base64", icon: Lock, path: "/tools/base64", keywords: ["base64", "encode", "decode", "converter"] },
  { name: "URL Encoder/Decoder", description: "Encode and decode URLs", icon: Link, path: "/tools/url-encoder", keywords: ["url", "encode", "decode", "uri"] },
  { name: "Color Converter", description: "Convert between color formats", icon: Palette, path: "/tools/color-converter", keywords: ["color", "hex", "rgb", "hsl", "converter"] },
  { name: "UUID Generator", description: "Generate unique IDs", icon: Hash, path: "/tools/uuid-generator", keywords: ["uuid", "guid", "generator", "unique"] },
  { name: "Regex Tester", description: "Test regular expressions", icon: Regex, path: "/tools/regex-tester", keywords: ["regex", "regular", "expression", "tester"] },
  { name: "Hash Generator", description: "Generate hash values", icon: Key, path: "/tools/hash-generator", keywords: ["hash", "sha", "md5", "generator"] },
  { name: "Hash Decoder", description: "Decode hash values", icon: Unlock, path: "/tools/hash-decoder", keywords: ["hash", "decode", "crack"] },
  { name: "JWT Decoder", description: "Decode JWT tokens", icon: Key, path: "/tools/jwt-decoder", keywords: ["jwt", "token", "decode", "json web token"] },
  { name: "JWT Encoder", description: "Encode JWT tokens", icon: Lock, path: "/tools/jwt-encoder", keywords: ["jwt", "token", "encode", "json web token"] },
  { name: "Timestamp Converter", description: "Convert timestamps", icon: Clock, path: "/tools/timestamp-converter", keywords: ["timestamp", "date", "converter", "unix"] },
  { name: "Web Scraper", description: "Extract data from websites", icon: Search, path: "/tools/web-scraper", keywords: ["scraper", "scrape", "crawl", "extract"] },
  { name: "JSON Extractor", description: "Extract data from JSON", icon: FileJson, path: "/tools/json-extractor", keywords: ["json", "extract", "path", "query"] },
  { name: "QR Code Generator", description: "Generate QR codes", icon: QrCode, path: "/tools/qr-code-generator", keywords: ["qr", "code", "generator", "barcode"] },
  { name: "Text Diff", description: "Compare text differences", icon: FileCode, path: "/tools/text-diff", keywords: ["diff", "compare", "difference", "text"] },
  { name: "CSV to JSON", description: "Convert CSV to JSON", icon: Table, path: "/tools/csv-to-json", keywords: ["csv", "json", "converter", "table"] },
  { name: "Image Tool", description: "Image compression and conversion", icon: Image, path: "/tools/image-tool", keywords: ["image", "compress", "convert", "resize"] },
  { name: "Random Universe Cipher", description: "Quantum-safe encryption", icon: Wand2, path: "/tools/random-universe-cipher", keywords: ["cipher", "encryption", "quantum", "ruc"] },
  { name: "Timestamp Converter", description: "Time and date conversions", icon: Calendar, path: "/tools/timestamp-converter", keywords: ["time", "date", "epoch", "converter"] },
  { name: "Image Extractor", description: "Extract images from Google Docs / Word", icon: Images, path: "/tools/image-extractor", keywords: ["image", "extract", "google docs", "docx", "scrape"] },
];

export function QuickSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "F" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search tools... (Cmd+K or Ctrl+K)" />
      <CommandList>
        <CommandGroup heading="Tools">
          {tools.map((tool) => (
            <CommandItem
              key={tool.path}
              onSelect={() => runCommand(() => navigate(tool.path))}
              className="cursor-pointer"
            >
              <tool.icon className="mr-2 h-4 w-4" />
              <div>
                <div className="font-medium">{tool.name}</div>
                <div className="text-xs text-muted-foreground">{tool.description}</div>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Pages">
          <CommandItem onSelect={() => runCommand(() => navigate("/tools"))}>
            <Wand2 className="mr-2 h-4 w-4" />
            All Tools
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/downloads"))}>
            <Download className="mr-2 h-4 w-4" />
            Downloads
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/blogs"))}>
            <FileCode className="mr-2 h-4 w-4" />
            Blog
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/about"))}>
            <Type className="mr-2 h-4 w-4" />
            About
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
