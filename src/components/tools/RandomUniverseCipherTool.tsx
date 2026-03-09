import { useState, useRef } from "react";
import { useRandomUniverseCipher } from "@/hooks/useRandomUniverseCipher";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Unlock, Download, Upload, Copy, Check, AlertCircle, Loader2, Zap, Clock, Timer } from "lucide-react";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

// Helper function to format time in human-readable format
function formatTime(seconds: number): string {
  if (seconds < 1) return '< 1s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

export function RandomUniverseCipherTool() {
  const [mode, setMode] = useState<'text' | 'file'>('text');
  const [operation, setOperation] = useState<'encrypt' | 'decrypt'>('encrypt');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [password, setPassword] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { encrypt, decrypt, encryptString, decryptString, isReady, progress, progressMessage, timeElapsed, timeRemaining, lastOperationTime, error } = useRandomUniverseCipher();
  const { copied, copy } = useCopyToClipboard();

  const handleTextOperation = async () => {
    if (!password || !inputText) {
      return;
    }

    setIsProcessing(true);
    setOutputText('');

    try {
      const startTime = Date.now();
      if (operation === 'encrypt') {
        const result = await encryptString(inputText, password);
        setOutputText(result);
      } else {
        const result = await decryptString(inputText, password);
        setOutputText(result);
      }
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    } catch (err) {
      setOutputText(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileOperation = async () => {
    if (!password || !file) {
      return;
    }

    setIsProcessing(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      let result: Uint8Array;
      if (operation === 'encrypt') {
        result = await encrypt(data, password, true);
      } else {
        result = await decrypt(data, password, true);
      }

      // Verify result is a proper Uint8Array
      if (!(result instanceof Uint8Array)) {
        throw new Error(`Invalid result type: ${typeof result}, expected Uint8Array`);
      }
      
      // Create download link - create a copy to ensure proper Blob creation
      // Copy the data to avoid any buffer view issues
      const resultCopy = new Uint8Array(result);
      const blob = new Blob([resultCopy.buffer], { type: 'application/octet-stream' });
      
      // Verify blob size matches result size
      if (blob.size !== result.length) {
        console.error(` Size mismatch! Result: ${result.length}, Blob: ${blob.size}`);
      }
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = operation === 'encrypt' 
        ? `${file.name}.ruc` 
        : file.name.replace('.ruc', '');
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      // Wait longer before cleanup to ensure download starts
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);

      // Show completion message with time
      const timeStr = lastOperationTime > 0 ? ` in ${formatTime(lastOperationTime)}` : '';
      setOutputText(`File ${operation === 'encrypt' ? 'encrypted' : 'decrypted'} successfully${timeStr}!`);
    } catch (err) {
      setOutputText(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setOutputText('');
    }
  };

  const handleCopy = () => {
    copy(outputText);
  };

  const handleSwapTextMode = () => {
    setInputText(outputText);
    setOutputText('');
    setOperation(operation === 'encrypt' ? 'decrypt' : 'encrypt');
  };

  return (
    <div className="w-full space-y-6">
      {/* Status Bar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">WASM-Accelerated Cipher</CardTitle>
            </div>
            <div className={`text-sm font-medium ${isReady ? 'text-green-500' : 'text-yellow-500'}`}>
              {isReady ? '✓ Ready' : '⏳ Loading...'}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Progress Bar with Timing */}
      {progress > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">{progressMessage}</span>
                <span className="font-bold text-lg">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-3" />
              <div className="grid grid-cols-2 gap-4 text-sm pt-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Elapsed: <span className="font-medium text-foreground">{formatTime(timeElapsed)}</span></span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Timer className="h-4 w-4" />
                  <span>Remaining: <span className="font-medium text-foreground">{formatTime(timeRemaining)}</span></span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Interface */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'text' | 'file')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="text">Text Mode</TabsTrigger>
          <TabsTrigger value="file">File Mode</TabsTrigger>
        </TabsList>

        {/* Text Mode */}
        <TabsContent value="text" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Text Encryption/Decryption</CardTitle>
              <CardDescription>
                Encrypt or decrypt text messages using password-based authentication
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Operation Selector */}
              <div className="flex gap-2">
                <Button
                  variant={operation === 'encrypt' ? 'default' : 'outline'}
                  onClick={() => setOperation('encrypt')}
                  className="flex-1"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Encrypt
                </Button>
                <Button
                  variant={operation === 'decrypt' ? 'default' : 'outline'}
                  onClick={() => setOperation('decrypt')}
                  className="flex-1"
                >
                  <Unlock className="h-4 w-4 mr-2" />
                  Decrypt
                </Button>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isProcessing}
                />
              </div>

              {/* Input Text */}
              <div className="space-y-2">
                <Label htmlFor="input-text">
                  {operation === 'encrypt' ? 'Plain Text' : 'Encrypted Text (Base64)'}
                </Label>
                <Textarea
                  id="input-text"
                  placeholder={operation === 'encrypt' 
                    ? 'Enter text to encrypt...' 
                    : 'Paste encrypted text here...'
                  }
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={isProcessing}
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>

              {/* Action Button */}
              <Button
                onClick={handleTextOperation}
                disabled={!isReady || !password || !inputText || isProcessing}
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {operation === 'encrypt' ? <Lock className="h-4 w-4 mr-2" /> : <Unlock className="h-4 w-4 mr-2" />}
                    {operation === 'encrypt' ? 'Encrypt Text' : 'Decrypt Text'}
                  </>
                )}
              </Button>

              {/* Output Text */}
              {outputText && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="output-text">
                      {operation === 'encrypt' ? 'Encrypted Text (Base64)' : 'Decrypted Text'}
                    </Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSwapTextMode}
                        disabled={isProcessing || outputText.startsWith('Error:')}
                      >
                        <Unlock className="h-3 w-3 mr-1" />
                        Swap & {operation === 'encrypt' ? 'Decrypt' : 'Encrypt'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopy}
                        disabled={outputText.startsWith('Error:')}
                      >
                        {copied ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    id="output-text"
                    value={outputText}
                    readOnly
                    rows={6}
                    className={`font-mono text-sm ${outputText.startsWith('Error:') ? 'text-destructive' : ''}`}
                  />
                  {/* Show completion time for text operations */}
                  {lastOperationTime > 0 && !outputText.startsWith('Error:') && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Completed in {formatTime(lastOperationTime)}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* File Mode */}
        <TabsContent value="file" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>File Encryption/Decryption</CardTitle>
              <CardDescription>
                Encrypt or decrypt files with high-speed WASM processing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Operation Selector */}
              <div className="flex gap-2">
                <Button
                  variant={operation === 'encrypt' ? 'default' : 'outline'}
                  onClick={() => setOperation('encrypt')}
                  className="flex-1"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Encrypt
                </Button>
                <Button
                  variant={operation === 'decrypt' ? 'default' : 'outline'}
                  onClick={() => setOperation('decrypt')}
                  className="flex-1"
                >
                  <Unlock className="h-4 w-4 mr-2" />
                  Decrypt
                </Button>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <Label htmlFor="file-password">Password</Label>
                <Input
                  id="file-password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isProcessing}
                />
              </div>

              {/* File Input */}
              <div className="space-y-2">
                <Label htmlFor="file-input">Select File</Label>
                <div className="flex gap-2">
                  <Input
                    id="file-input"
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    disabled={isProcessing}
                    className="flex-1"
                  />
                </div>
                {file && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>

              {/* Action Button */}
              <Button
                onClick={handleFileOperation}
                disabled={!isReady || !password || !file || isProcessing}
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {operation === 'encrypt' ? <Lock className="h-4 w-4 mr-2" /> : <Unlock className="h-4 w-4 mr-2" />}
                    {operation === 'encrypt' ? 'Encrypt File' : 'Decrypt File'}
                  </>
                )}
              </Button>

              {/* Output Message */}
              {outputText && (
                <Alert className={outputText.startsWith('Error:') ? 'border-destructive' : 'border-green-500'}>
                  {outputText.startsWith('Error:') ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  <AlertDescription>{outputText}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong> Tip:</strong> The cipher uses WASM acceleration for fast encryption/decryption.</p>
            <p><strong>🔒 Security:</strong> All operations run locally in your browser. No data is sent to any server.</p>
            <p><strong> Files:</strong> Encrypted files are saved with .ruc extension. Decryption removes this extension.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
