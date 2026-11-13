import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { API_PRESETS, DEFAULT_API_BASE, classifyProducts, fetchAvailableModels, formatMinorityResult, normalizeApiBase } from "@/lib/related-product/api";
import { collectProductsFromUrls, normalizeCollectionUrl } from "@/lib/related-product/collector";
import { forgetProviderSettings, hasSavedProviderSettings, saveProviderSettings, unlockProviderSettings } from "@/lib/related-product/storage";
import type { ProductModel, SavedProviderSettings } from "@/lib/related-product/types";
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  Loader2,
  LockKeyhole,
  PackageSearch,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UnlockKeyhole,
} from "lucide-react";

type VaultState = "checking" | "setup" | "locked" | "unlocked";

export function RelatedProductFinderTool() {
  const [vaultState, setVaultState] = useState<VaultState>("checking");
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [models, setModels] = useState<ProductModel[]>([]);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [setupPassphrase, setSetupPassphrase] = useState("");
  const [setupPassphraseConfirmation, setSetupPassphraseConfirmation] = useState("");
  const [unlockPassphrase, setUnlockPassphrase] = useState("");
  const [loadingModels, setLoadingModels] = useState(false);
  const [savingSelection, setSavingSelection] = useState(false);
  const [modelError, setModelError] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [urlsInput, setUrlsInput] = useState("");
  const [draft, setDraft] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [runError, setRunError] = useState("");
  const [output, setOutput] = useState("");
  const [resultNote, setResultNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [forgetDialogOpen, setForgetDialogOpen] = useState(false);

  const passphraseRef = useRef("");
  const settingsRef = useRef<SavedProviderSettings | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveVersionRef = useRef(0);
  const runControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      setVaultState(hasSavedProviderSettings() ? "locked" : "setup");
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Could not read browser storage.");
      setVaultState("setup");
    }
  }, []);

  const presetValue = API_PRESETS.find((preset) => preset.url === apiBase)?.url || "custom";
  const selectedModelIsAvailable = models.some((model) => model.id === selectedModel);

  const refreshModelList = async (settings: SavedProviderSettings) => {
    setLoadingModels(true);
    setModelError("");
    try {
      const available = await fetchAvailableModels(settings.apiBase, settings.apiKey);
      setModels(available);
      if (available.length === 0) {
        setModelError("The provider returned no models for this API key.");
      }
    } catch (error) {
      setModelError(error instanceof Error ? error.message : "Could not load models.");
    } finally {
      setLoadingModels(false);
    }
  };

  const handleConnect = async () => {
    setSettingsError("");
    setModelError("");
    const trimmedKey = apiKey.trim();
    const passphrase = setupPassphrase;

    if (!trimmedKey) {
      setSettingsError("Enter an API key to load its available models.");
      return;
    }
    if (passphrase.length < 12) {
      setSettingsError("Use a vault passphrase with at least 12 characters.");
      return;
    }
    if (passphrase !== setupPassphraseConfirmation) {
      setSettingsError("The vault passphrases do not match.");
      return;
    }

    setLoadingModels(true);
    try {
      const normalizedBase = normalizeApiBase(apiBase);
      const available = await fetchAvailableModels(normalizedBase, trimmedKey);
      const saved: SavedProviderSettings = {
        apiBase: normalizedBase,
        apiKey: trimmedKey,
        selectedModel: "",
      };
      await saveProviderSettings(saved, passphrase);

      settingsRef.current = saved;
      passphraseRef.current = passphrase;
      setApiBase(normalizedBase);
      setApiKey(trimmedKey);
      setSelectedModel("");
      setModels(available);
      setSetupPassphrase("");
      setSetupPassphraseConfirmation("");
      setVaultState("unlocked");
      if (available.length === 0) {
        setModelError("The provider returned no models for this API key.");
      }
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Could not connect to this provider.");
    } finally {
      setLoadingModels(false);
    }
  };

  const handleUnlock = async () => {
    setSettingsError("");
    setModelError("");
    try {
      const passphrase = unlockPassphrase;
      const saved = await unlockProviderSettings(passphrase);
      const normalizedBase = normalizeApiBase(saved.apiBase);
      const settings = { ...saved, apiBase: normalizedBase };
      settingsRef.current = settings;
      passphraseRef.current = passphrase;
      setApiBase(normalizedBase);
      setApiKey(saved.apiKey);
      setSelectedModel(saved.selectedModel);
      setUnlockPassphrase("");
      setVaultState("unlocked");
      await refreshModelList(settings);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Could not unlock saved settings.");
    }
  };

  const handleLock = async () => {
    runControllerRef.current?.abort();
    await saveQueueRef.current.catch(() => undefined);
    passphraseRef.current = "";
    settingsRef.current = null;
    setApiKey("");
    setModels([]);
    setModelError("");
    setVaultState("locked");
  };

  const handleForget = async () => {
    setSettingsError("");
    try {
      await saveQueueRef.current.catch(() => undefined);
      forgetProviderSettings();
      passphraseRef.current = "";
      settingsRef.current = null;
      setApiBase(DEFAULT_API_BASE);
      setApiKey("");
      setSelectedModel("");
      setModels([]);
      setModelError("");
      setSettingsError("");
      setUnlockPassphrase("");
      setSetupPassphrase("");
      setSetupPassphraseConfirmation("");
      setVaultState("setup");
      setForgetDialogOpen(false);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Could not forget saved settings.");
    }
  };

  const handleModelChange = (modelId: string) => {
    if (!modelId || modelId === selectedModel) return;
    const current = settingsRef.current;
    const passphrase = passphraseRef.current;
    if (!current || !passphrase) {
      setSettingsError("Unlock your saved settings before changing the model.");
      return;
    }

    const next: SavedProviderSettings = { ...current, selectedModel: modelId };
    settingsRef.current = next;
    setSelectedModel(modelId);
    setSettingsError("");
    setSavingSelection(true);
    const saveVersion = ++saveVersionRef.current;
    const write = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveProviderSettings(next, passphrase));
    saveQueueRef.current = write;

    void write
      .catch((error) => {
        setSettingsError(error instanceof Error ? error.message : "Could not save the selected model.");
      })
      .finally(() => {
        if (saveVersionRef.current === saveVersion) setSavingSelection(false);
      });
  };

  const handleRun = async () => {
    setRunError("");
    setOutput("");
    setResultNote("");
    setCopied(false);

    if (!urlsInput.trim()) {
      setRunError("Add one or more collection or product URLs.");
      return;
    }
    if (!draft.trim()) {
      setRunError("Add the content draft to compare products against.");
      return;
    }
    if (!selectedModel || !selectedModelIsAvailable) {
      setRunError("Choose an available model using its radio button before running.");
      return;
    }

    let urls: string[];
    try {
      urls = [...new Set(
        urlsInput
          .split(/[\s,]+/)
          .filter(Boolean)
          .map(normalizeCollectionUrl),
      )];
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "One of the URLs is invalid.");
      return;
    }
    if (urls.length === 0) {
      setRunError("Add one or more collection or product URLs.");
      return;
    }

    const settings = settingsRef.current;
    if (!settings) {
      setRunError("Unlock your saved API settings first.");
      return;
    }

    const controller = new AbortController();
    runControllerRef.current = controller;
    setRunning(true);
    setProgress(0);
    setProgressMessage("Starting collection…");

    try {
      const collected = await collectProductsFromUrls(
        urls,
        controller.signal,
        (message, completed, total) => {
          setProgressMessage(message);
          setProgress(total > 0 ? Math.round((completed / total) * 45) : 0);
        },
      );
      if (controller.signal.aborted) throw new Error("Run cancelled.");
      setProgressMessage(`Classifying ${collected.products.length} unique products…`);
      setProgress(50);

      const decisions = await classifyProducts(
        settings.apiBase,
        settings.apiKey,
        selectedModel,
        draft.trim(),
        collected.products,
        {
          signal: controller.signal,
          onProgress: (completed, total) => {
            setProgressMessage(`Classifying products (${completed}/${total})…`);
            setProgress(50 + Math.round((completed / total) * 50));
          },
        },
      );
      const text = formatMinorityResult(
        collected.products.map((product) => product.name),
        decisions,
      );
      setOutput(text);
      setResultNote(
        `${collected.products.length} unique product${collected.products.length === 1 ? "" : "s"} checked across ${urls.length} URL${urls.length === 1 ? "" : "s"}.`
        + (collected.warnings.length ? ` ${collected.warnings.join(" ")}` : ""),
      );
      setProgress(100);
      setProgressMessage("Done.");
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Could not complete the product check.");
      setProgressMessage("");
      setProgress(0);
    } finally {
      runControllerRef.current = null;
      setRunning(false);
    }
  };

  const handleCopy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      globalThis.setTimeout(() => setCopied(false), 1800);
    } catch {
      setRunError("Could not copy the result. Select the text and copy it manually.");
    }
  };

  return (
    <div className="space-y-6">
      <section aria-labelledby="api-settings-title" className="rounded-xl border border-border bg-card/50 p-4 sm:p-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            {vaultState === "unlocked" ? <ShieldCheck className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="api-settings-title" className="font-semibold">Connect your LLM</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your key loads the models enabled for your provider account. Choose a model yourself below.
            </p>
          </div>
          {vaultState === "unlocked" && (
            <Button type="button" variant="outline" size="sm" onClick={handleLock} disabled={loadingModels}>
              <LockKeyhole className="mr-2 h-4 w-4" />
              Lock
            </Button>
          )}
        </div>

        {vaultState === "checking" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking this browser…
          </div>
        )}

        {vaultState === "setup" && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="related-api-provider">API provider</Label>
                <select
                  id="related-api-provider"
                  value={presetValue}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (next !== "custom") {
                      setApiBase(next);
                    }
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {API_PRESETS.map((preset) => (
                    <option key={preset.url} value={preset.url}>{preset.name}</option>
                  ))}
                  <option value="custom">Other OpenAI-compatible API</option>
                </select>
              </div>
              {presetValue === "custom" && (
                <div className="space-y-2">
                  <Label htmlFor="related-api-base">API base URL</Label>
                  <Input
                    id="related-api-base"
                    value={apiBase}
                    onChange={(event) => setApiBase(event.target.value)}
                    placeholder="https://api.example.com/v1"
                    autoComplete="url"
                  />
                </div>
              )}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="related-api-key">API key</Label>
                <div className="flex gap-2">
                  <Input
                    id="related-api-key"
                    type={apiKeyVisible ? "text" : "password"}
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="Paste your provider API key"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setApiKeyVisible((visible) => !visible)}
                    aria-label={apiKeyVisible ? "Hide API key" : "Show API key"}
                  >
                    {apiKeyVisible ? "Hide" : "Show"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="related-vault-passphrase">Vault passphrase</Label>
                <Input
                  id="related-vault-passphrase"
                  type="password"
                  value={setupPassphrase}
                  onChange={(event) => setSetupPassphrase(event.target.value)}
                  placeholder="At least 12 characters"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="related-vault-confirm">Confirm passphrase</Label>
                <Input
                  id="related-vault-confirm"
                  type="password"
                  value={setupPassphraseConfirmation}
                  onChange={(event) => setSetupPassphraseConfirmation(event.target.value)}
                  placeholder="Enter it again"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              The key and chosen model are encrypted with AES-GCM before being saved in this browser. Your passphrase is never saved; if you forget it, the key cannot be recovered.
            </p>
            <Button
              type="button"
              onClick={handleConnect}
              disabled={loadingModels || !apiKey.trim() || setupPassphrase.length < 12 || !setupPassphraseConfirmation}
              className="w-full sm:w-auto"
            >
              {loadingModels ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              {loadingModels ? "Connecting and loading models…" : "Connect & load models"}
            </Button>
          </div>
        )}

        {vaultState === "locked" && (
          <div className="space-y-4">
            <div className="max-w-xl space-y-2">
              <Label htmlFor="related-unlock-passphrase">Unlock your saved settings</Label>
              <Input
                id="related-unlock-passphrase"
                type="password"
                value={unlockPassphrase}
                onChange={(event) => setUnlockPassphrase(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && unlockPassphrase) void handleUnlock();
                }}
                placeholder="Vault passphrase"
                autoComplete="current-password"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handleUnlock} disabled={!unlockPassphrase || loadingModels}>
                {loadingModels ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UnlockKeyhole className="mr-2 h-4 w-4" />}
                {loadingModels ? "Unlocking…" : "Unlock & load models"}
              </Button>
              <AlertDialog open={forgetDialogOpen} onOpenChange={setForgetDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Forget saved key
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Forget the saved API settings?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes the encrypted key and selected model from this browser. You will need to connect again.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={(event) => {
                      event.preventDefault();
                      void handleForget();
                    }}>
                      Forget settings
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}

        {vaultState === "unlocked" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">Connected</span>
              <span className="font-mono text-muted-foreground">{new URL(apiBase).host}</span>
              {selectedModel && (
                <span className="rounded-full border border-border px-3 py-1">
                  {selectedModelIsAvailable ? `Selected: ${selectedModel}` : `Saved model unavailable: ${selectedModel}`}
                </span>
              )}
              {savingSelection && <span className="text-xs text-muted-foreground">Saving selection…</span>}
            </div>
            {!selectedModel && (
              <p className="text-sm text-muted-foreground">
                No model is selected yet. Choose one with its radio button; this choice will be remembered.
              </p>
            )}
            {selectedModel && !selectedModelIsAvailable && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  The saved model was not returned by the provider. It remains selected until you choose another model below.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-medium">Available models</h3>
                <p className="text-xs text-muted-foreground">
                  {models.length} model{models.length === 1 ? "" : "s"} returned for this API key
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => settingsRef.current && void refreshModelList(settingsRef.current)}
                disabled={loadingModels}
              >
                {loadingModels ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh models
              </Button>
            </div>

            {selectedModel && !selectedModelIsAvailable && (
              <label className="flex cursor-not-allowed items-start gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3 opacity-80">
                <input
                  type="radio"
                  name="related-product-model"
                  checked
                  disabled
                  readOnly
                  className="mt-1 accent-primary"
                  aria-label={`Saved model ${selectedModel}, no longer available`}
                />
                <span className="min-w-0">
                  <span className="block break-all font-mono text-sm">{selectedModel}</span>
                  <span className="text-xs text-muted-foreground">Saved selection · not returned by the latest model list</span>
                </span>
              </label>
            )}

            <RadioGroup
              value={selectedModelIsAvailable ? selectedModel : ""}
              onValueChange={handleModelChange}
              aria-label="Choose an available LLM model"
              className="max-h-72 gap-2 overflow-y-auto rounded-lg border border-border bg-background/40 p-2"
            >
              {models.map((model) => (
                <Label
                  key={model.id}
                  htmlFor={`related-model-${encodeURIComponent(model.id)}`}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                    selectedModel === model.id
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:border-border hover:bg-muted/40"
                  }`}
                >
                  <RadioGroupItem
                    id={`related-model-${encodeURIComponent(model.id)}`}
                    value={model.id}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block break-all font-mono text-sm">{model.id}</span>
                    {model.ownedBy && (
                      <span className="mt-0.5 block text-xs text-muted-foreground">{model.ownedBy}</span>
                    )}
                  </span>
                </Label>
              ))}
              {models.length === 0 && !loadingModels && (
                <p className="p-3 text-sm text-muted-foreground">No model IDs are available to display. Refresh or check your provider.</p>
              )}
            </RadioGroup>
          </div>
        )}

        {settingsError && (
          <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {settingsError}
          </p>
        )}
        {modelError && (
          <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {modelError}
          </p>
        )}
      </section>

      <section aria-labelledby="product-check-title" className="rounded-xl border border-border bg-card/50 p-4 sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <PackageSearch className="h-5 w-5" />
          </div>
          <div>
            <h2 id="product-check-title" className="font-semibold">Check products against a draft</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add collection URLs (one per line) and the content draft. Only products on those sites are considered.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="related-collection-urls">Collection or product URLs</Label>
            <Textarea
              id="related-collection-urls"
              value={urlsInput}
              onChange={(event) => setUrlsInput(event.target.value)}
              placeholder={"https://store.example/collections/bill-acceptors\nhttps://store.example/collections/stackers"}
              className="min-h-24 font-mono text-sm"
              disabled={running}
            />
            <p className="text-xs text-muted-foreground">
              Separate multiple URLs with a new line or comma. Collections and individual product pages are supported (up to 10 URLs and 1,000 unique products per run).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="related-draft">Content draft</Label>
            <Textarea
              id="related-draft"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Paste the complete draft you want to match products against…"
              className="min-h-48 text-sm"
              disabled={running}
            />
          </div>

          {running && (
            <div className="space-y-2" aria-live="polite">
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{progressMessage}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {runError && (
            <Alert variant="destructive" role="alert">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{runError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              onClick={() => void handleRun()}
              disabled={running || vaultState !== "unlocked" || !selectedModel || !selectedModelIsAvailable || savingSelection}
              className="flex-1"
            >
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageSearch className="mr-2 h-4 w-4" />}
              {running ? "Checking products…" : "Find related products"}
            </Button>
            {running && (
              <Button
                type="button"
                variant="outline"
                onClick={() => runControllerRef.current?.abort()}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </section>

      {(output || resultNote) && (
        <section aria-labelledby="related-result-title" className="rounded-xl border border-primary/30 bg-card/50 p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="related-result-title" className="font-semibold">Result</h2>
              {resultNote && <p className="mt-1 text-xs text-muted-foreground">{resultNote}</p>}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()} disabled={!output}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "Copied" : "Copy result"}
            </Button>
          </div>
          {output && (
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-background/70 p-4 font-mono text-sm" data-lenisignore>
              {output}
            </pre>
          )}
        </section>
      )}

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription className="text-xs leading-relaxed">
          The API key is kept in memory while unlocked and stored only as AES-GCM-encrypted data in this browser’s localStorage. It is sent only to the API base URL you choose, never to the page-fetch service. Local development uses the Vite dev server; the deployed version uses the site’s Cloudflare Worker to fetch public pages, which the Worker can see. Use a unique strong vault passphrase; a compromised browser or same-page script can still access a key while unlocked.
        </AlertDescription>
      </Alert>
    </div>
  );
}
