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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { API_PRESETS, DEFAULT_API_BASE, buildMinorityResult, classifyProducts, fetchAvailableModels, formatMinorityResult, groupProductsBySource, normalizeApiBase } from "@/lib/related-product/api";
import { collectProductsFromUrls, normalizeCollectionUrl } from "@/lib/related-product/collector";
import { forgetProviderSettings, hasSavedProviderSettings, saveProviderSettings, unlockProviderSettings } from "@/lib/related-product/storage";
import type { MinorityResult, ProductModel, ProductResultGroup, SavedProviderSettings } from "@/lib/related-product/types";
import {
  AlertTriangle,
  Check,
  ChevronDown,
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

interface FinderResult {
  minority: MinorityResult;
  relatedGroups: ProductResultGroup[];
  unrelatedGroups: ProductResultGroup[];
  relatedCount: number;
  unrelatedCount: number;
  note: string;
}

function ProductResultsPanel({
  id, title, groups, count, hasResult, running,
}: {
  id: string;
  title: string;
  groups: ProductResultGroup[];
  count: number;
  hasResult: boolean;
  running: boolean;
}) {
  return (
    <section aria-labelledby={id} aria-busy={running} className="flex min-h-80 min-w-0 flex-col rounded-xl border border-border bg-card/50 p-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 id={id} className="font-semibold">{title}</h2>
        {hasResult && <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{count}</span>}
      </header>
      <div className="min-h-0 max-h-[32rem] flex-1 space-y-3 overflow-y-auto rounded-lg border border-border bg-background/40 p-3" data-lenisignore>
        {groups.length > 0 ? groups.map((group, groupIndex) => (
          <section
            key={`${group.sourceUrl || "unknown-source"}-${groupIndex}`}
            aria-labelledby={`${id}-source-${groupIndex}`}
            className="overflow-hidden rounded-lg border border-border bg-background"
          >
            <header className="space-y-2 border-b border-border bg-muted/50 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id={`${id}-source-${groupIndex}`} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Submitted URL {groupIndex + 1}
                </h3>
                <span className="text-xs text-muted-foreground">{group.products.length} product{group.products.length === 1 ? "" : "s"}</span>
              </div>
              {group.sourceUrl ? (
                <a href={group.sourceUrl} target="_blank" rel="noopener noreferrer" className="block break-all text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {group.sourceUrl}
                </a>
              ) : <p className="text-xs text-muted-foreground">Source URL unavailable</p>}
            </header>
            <ul className="divide-y divide-border">
              {group.products.map((product, productIndex) => (
                <li key={`${product.url}-${productIndex}`} className="px-3 py-3">
                  <a href={product.url} target="_blank" rel="noopener noreferrer" className="block rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="block break-words text-sm font-medium text-foreground">{product.name}</span>
                    <span className="mt-1 block break-all text-xs text-muted-foreground">{product.url}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )) : (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-3 text-center text-sm text-muted-foreground">
            <PackageSearch className="h-7 w-7 opacity-60" aria-hidden="true" />
            <p>{running ? "Results will appear when the check finishes." : hasResult ? `No ${title.toLowerCase()} found in this check.` : "Add your collection links and draft, then run a check."}</p>
          </div>
        )}
      </div>
    </section>
  );
}

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
  const [resultView, setResultView] = useState<FinderResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [forgetDialogOpen, setForgetDialogOpen] = useState(false);
  const [connectionExpanded, setConnectionExpanded] = useState(true);

  const connectionContentRef = useRef<HTMLDivElement>(null);
  const urlsInputRef = useRef<HTMLTextAreaElement>(null);
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

  const providerPreset = API_PRESETS.find((preset) => preset.url === apiBase);
  const presetValue = providerPreset?.url || "custom";
  const selectedModelIsAvailable = models.some((model) => model.id === selectedModel);
  const providerName = providerPreset?.name
    || (vaultState === "unlocked" ? new URL(apiBase).host : "");
  const connectionNeedsAttention = vaultState !== "unlocked"
    || !selectedModelIsAvailable || Boolean(settingsError || modelError);
  const connectionOpen = connectionExpanded || connectionNeedsAttention;
  const output = resultView ? formatMinorityResult(resultView.minority) : "";

  const collapseConnectionSettings = () => {
    // Advance from settings without stealing focus from inputs edited during the save.
    if (connectionContentRef.current?.contains(document.activeElement)) {
      urlsInputRef.current?.focus();
    }
    setConnectionExpanded(false);
  };

  const refreshModelList = async (settings: SavedProviderSettings) => {
    setConnectionExpanded(true);
    setLoadingModels(true);
    setModelError("");
    try {
      const available = await fetchAvailableModels(settings.apiBase, settings.apiKey);
      setModels(available);
      if (available.length === 0) {
        setModelError("The provider returned no models for this API key.");
      }
      return available;
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
      const available = await refreshModelList(settings);
      if (available?.some((model) => model.id === settings.selectedModel)) {
        collapseConnectionSettings();
      }
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
    setConnectionExpanded(true);
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
      setConnectionExpanded(true);
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
      .then(() => {
        if (saveVersionRef.current === saveVersion) collapseConnectionSettings();
      })
      .catch((error) => {
        setConnectionExpanded(true);
        setSettingsError(error instanceof Error ? error.message : "Could not save the selected model.");
      })
      .finally(() => {
        if (saveVersionRef.current === saveVersion) setSavingSelection(false);
      });
  };

  const handleRun = async () => {
    setRunError("");
    setResultView(null);
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
      ).catch((error) => {
        if (!controller.signal.aborted) setConnectionExpanded(true);
        throw error;
      });
      const related = collected.products.filter((_, index) => decisions[index].related);
      const unrelated = collected.products.filter((_, index) => !decisions[index].related);
      setResultView({
        minority: buildMinorityResult(collected.products, decisions),
        relatedGroups: groupProductsBySource(related),
        unrelatedGroups: groupProductsBySource(unrelated),
        relatedCount: related.length,
        unrelatedCount: unrelated.length,
        note: `${collected.products.length} unique product${collected.products.length === 1 ? "" : "s"} checked across ${urls.length} URL${urls.length === 1 ? "" : "s"}.`
          + (collected.warnings.length ? ` ${collected.warnings.join(" ")}` : ""),
      });
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

  const handleNewCheck = () => {
    setUrlsInput("");
    setDraft("");
    setResultView(null);
    setRunError("");
    setProgress(0);
    setProgressMessage("");
    setCopied(false);
    urlsInputRef.current?.focus();
  };

  return (
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(16rem,0.85fr)_minmax(0,1.9fr)_minmax(18rem,1fr)] xl:grid-rows-[max-content_1fr_auto]">
      <Collapsible open={connectionOpen} onOpenChange={setConnectionExpanded} asChild>
        <section aria-labelledby="api-settings-title" className="min-w-0 rounded-xl border border-border bg-card/50 p-4 sm:p-5 xl:col-start-1 xl:row-start-1">
          <div className="flex flex-wrap items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              {vaultState === "unlocked" ? <ShieldCheck className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1 basis-40">
              <h2 id="api-settings-title" className="font-semibold">{vaultState === "unlocked" ? "LLM connection" : "Connect your LLM"}</h2>
              {vaultState === "unlocked" ? (
                <div className="mt-1 space-y-1 text-xs">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium text-green-800 dark:text-primary">Connected</span>
                    <span className="break-all text-muted-foreground">{providerName}</span>
                  </p>
                  <p className="break-all font-mono text-muted-foreground">
                    {selectedModelIsAvailable ? selectedModel : selectedModel ? `Saved model unavailable: ${selectedModel}` : "Choose a model below"}
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  Your key loads the models enabled for your provider account. Choose a model yourself below.
                </p>
              )}
            </div>
            {vaultState === "unlocked" && (
              <div className="ml-auto flex flex-wrap gap-2">
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="outline" size="sm" disabled={connectionNeedsAttention || loadingModels || savingSelection}>
                    <ChevronDown className={`mr-2 h-4 w-4 ${connectionOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                    {connectionOpen ? "Hide settings" : "Manage"}
                  </Button>
                </CollapsibleTrigger>
                <Button type="button" variant="outline" size="sm" onClick={handleLock} disabled={loadingModels}>
                  <LockKeyhole className="mr-2 h-4 w-4" />
                  Lock
                </Button>
              </div>
            )}
          </div>

          <CollapsibleContent ref={connectionContentRef} className="mt-4">
            {vaultState === "checking" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking this browser…
              </div>
            )}

            {vaultState === "setup" && (
              <div className="space-y-4">
                <div className="grid gap-4">
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
                  <div className="space-y-2">
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

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
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
                  className="w-full text-black"
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
                  <Button type="button" onClick={handleUnlock} disabled={!unlockPassphrase || loadingModels} className="text-black">
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
                        <AlertDialogAction className="text-black" onClick={(event) => {
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
                {savingSelection && <p role="status" className="text-xs text-muted-foreground">Saving selection…</p>}
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
                  data-lenisignore
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
          </CollapsibleContent>
        </section>
      </Collapsible>

      <section aria-labelledby="product-check-title" className="flex min-w-0 flex-col rounded-xl border border-border bg-card/50 p-4 sm:p-5 xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:h-full">
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

        <div className="flex flex-1 flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="related-collection-urls">Collection links</Label>
            <Textarea
              id="related-collection-urls"
              ref={urlsInputRef}
              value={urlsInput}
              onChange={(event) => setUrlsInput(event.target.value)}
              placeholder={"https://store.example/collections/bill-acceptors\nhttps://store.example/collections/stackers"}
              className="min-h-24 font-mono text-sm"
              disabled={running}
              data-lenisignore
            />
            <p className="text-xs text-muted-foreground">
              Separate multiple URLs with a new line or comma. Collections and individual product pages are supported (up to 10 URLs and 1,000 unique products per run).
            </p>
          </div>

          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="related-draft">Draft content</Label>
            <Textarea
              id="related-draft"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Paste the complete draft you want to match products against…"
              className="min-h-80 flex-1 text-sm"
              disabled={running}
              data-lenisignore
            />
          </div>

          {runError && (
            <Alert variant="destructive" role="alert">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{runError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void handleRun()}
              disabled={running || vaultState !== "unlocked" || !selectedModel || !selectedModelIsAvailable || savingSelection}
              className="flex-1 text-black"
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
            <Button
              type="button"
              variant="outline"
              onClick={handleNewCheck}
              disabled={running || (!urlsInput && !draft && !resultView && !runError)}
            >
              New check
            </Button>
          </div>
        </div>
      </section>

      <div className="grid min-w-0 grid-rows-2 gap-4 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:h-full">
        <ProductResultsPanel
          id="related-products-title"
          title="Related Products"
          groups={resultView?.relatedGroups || []}
          count={resultView?.relatedCount || 0}
          hasResult={Boolean(resultView)}
          running={running}
        />
        <ProductResultsPanel
          id="unrelated-products-title"
          title="Unrelated Products"
          groups={resultView?.unrelatedGroups || []}
          count={resultView?.unrelatedCount || 0}
          hasResult={Boolean(resultView)}
          running={running}
        />
      </div>

      <section aria-labelledby="related-summary-title" className="flex min-h-80 min-w-0 flex-col rounded-xl border border-primary/30 bg-card/50 p-4 xl:col-start-1 xl:row-start-2">
        <h2 id="related-summary-title" className="mb-4 font-semibold">Summary</h2>
        {running ? (
          <div className="space-y-3" aria-live="polite">
            <p className="text-sm text-muted-foreground">{progressMessage}</p>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">{progress}% complete</p>
          </div>
        ) : resultView ? (
          <div className="space-y-5">
            <p role="status" className="rounded-lg border border-border bg-background/60 p-3 font-semibold">
              {resultView.minority.kind === "summary" ? resultView.minority.text : "Check complete"}
            </p>
            <dl className="grid grid-cols-2 gap-3">
              <div className="col-span-2 rounded-lg border border-border bg-background/40 p-3">
                <dt className="text-xs text-muted-foreground">Unique products</dt>
                <dd className="mt-1 text-2xl font-semibold">{resultView.relatedCount + resultView.unrelatedCount}</dd>
              </div>
              <div className="rounded-lg border border-border bg-background/40 p-3">
                <dt className="text-xs text-muted-foreground">Related</dt>
                <dd className="mt-1 text-xl font-semibold">{resultView.relatedCount}</dd>
              </div>
              <div className="rounded-lg border border-border bg-background/40 p-3">
                <dt className="text-xs text-muted-foreground">Unrelated</dt>
                <dd className="mt-1 text-xl font-semibold">{resultView.unrelatedCount}</dd>
              </div>
            </dl>
            <p className="break-words text-xs leading-relaxed text-muted-foreground">{resultView.note}</p>
            {resultView.minority.kind === "groups" && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Copy result keeps the smaller-group rule and its fewer-than-ten unrelated products exception. Both complete groups are visible alongside this summary.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {runError ? "The check did not finish. Review the error and try again." : "Connect your provider, choose a model, and check a draft to see the product breakdown here."}
          </p>
        )}
        <div className="mt-auto pt-6">
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => void handleCopy()} disabled={!output}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? "Copied" : "Copy result"}
          </Button>
        </div>
      </section>

      <Alert className="xl:col-span-3">
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription className="text-xs leading-relaxed">
          The API key is kept in memory while unlocked and stored only as AES-GCM-encrypted data in this browser’s localStorage. It is sent only to the API base URL you choose, never to the page-fetch service. Local development uses the Vite dev server; the deployed version uses the site’s Cloudflare Worker to fetch public pages, which the Worker can see. Use a unique strong vault passphrase; a compromised browser or same-page script can still access a key while unlocked.
        </AlertDescription>
      </Alert>
    </div>
  );
}
