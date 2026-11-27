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
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { SmartCollectionConditions } from "./SmartCollectionConditions";
import { SmartCollectionSettings } from "./SmartCollectionSettings";
import { ProductResultVerifier } from "./ProductResultVerifier";
import { API_PRESETS, DEFAULT_API_BASE, buildMinorityResult, classifyProducts, fetchAvailableModels, formatMinorityResult, groupProductsBySource, normalizeApiBase, suggestSmartCollection } from "@/lib/related-product/api";
import { collectProductsFromUrls, deduplicateProducts, MAX_SAMPLE_PRODUCTS_PER_URL, normalizeCollectionUrl } from "@/lib/related-product/collector";
import {
  DEFAULT_SMART_COLLECTION_OPTIONS,
  NO_TITLE_RULES_NOTICE,
  SHOPIFY_MATCH_COUNT_NOTICE,
  formatSmartCollectionSuggestion,
  parseSmartCollectionOptions,
  previewSmartCollectionTitles,
  type SmartCollectionOptions,
  type SmartCollectionOptionsInput,
  type SmartCollectionSuggestion,
} from "@/lib/related-product/smart-collection";
import { forgetProviderSettings, hasSavedProviderSettings, saveProviderSettings, unlockProviderSettings } from "@/lib/related-product/storage";
import { AUTOMATIC_VERIFICATION_NOTICE, automaticallyVerifyResults, createSmartReviewInput, getVerificationLabel, markVerificationIncomplete, type AutomaticVerificationReport } from "@/lib/related-product/verification";
import type { MinorityResult, ProductCandidate, ProductDecision, ProductModel, ProductResultGroup, ProductReviewInput, SavedProviderSettings } from "@/lib/related-product/types";
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

interface SmartResult {
  suggestion: SmartCollectionSuggestion;
  options: SmartCollectionOptions;
  samples: ProductCandidate[];
  warnings: string[];
  reviewInput: ProductReviewInput;
}

interface FinderResult {
  minority: MinorityResult;
  relatedGroups: ProductResultGroup[];
  unrelatedGroups: ProductResultGroup[];
  relatedCount: number;
  unrelatedCount: number;
  note: string;
  reviewInput: ProductReviewInput;
}

function ProductResultsPanel({
  id, title, groups, count, hasResult, running, warning,
}: {
  id: string;
  title: string;
  groups: ProductResultGroup[];
  count: number;
  hasResult: boolean;
  running: boolean;
  warning?: string;
}) {
  const products = deduplicateProducts(groups.flatMap((group) => group.products));
  return (
    <section aria-labelledby={id} aria-busy={running} className="flex min-h-80 min-w-0 flex-col rounded-xl border border-border bg-card/50">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h2 id={id} className="text-sm font-semibold">{title}</h2>
        {hasResult && <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">{count}</span>}
        <CopyButton text={products.map((product) => product.name).join("\n")} iconOnly variant="ghost" size="icon"
          className="ml-auto h-8 w-8 shrink-0" aria-label={`Copy all ${title.toLowerCase().replace("products", "product")} names`} title={`Copy all ${title.toLowerCase()}`}
          disabled={running || !hasResult || products.length === 0} />
      </header>
      {warning && <p className="px-4 pt-3 text-xs font-medium text-amber-800 dark:text-amber-300">{warning}</p>}
      <div className="min-h-0 max-h-[32rem] flex-1 overflow-y-auto" data-lenisignore>
        {products.length > 0 ? (
          <ul className="divide-y divide-border">
            {products.map((product) => (
              <li key={product.url} className="flex items-center gap-1 px-4 py-3">
                <a href={product.url} target="_blank" rel="noopener noreferrer" className="min-w-0 break-words rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{product.name}</a>
                <CopyButton text={product.name} iconOnly variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                  aria-label={`Copy product name: ${product.name}`} title={`Copy ${product.name}`} disabled={running} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-4 text-center text-sm text-muted-foreground">
            <PackageSearch className="h-7 w-7 opacity-60" aria-hidden="true" />
            <p>{running ? "Results will appear when the check finishes." : hasResult ? `No ${title.toLowerCase()} found in this check.` : "Add your collection links and draft, then run a check."}</p>
          </div>
        )}
      </div>
      {groups.length > 0 && <details className="border-t border-border p-4 text-xs">
        <summary className="cursor-pointer text-muted-foreground">Submitted sources</summary>
        <ul className="mt-3 space-y-3">
          {groups.map((group, index) => <li key={`${group.sourceUrl}-${index}`} className="space-y-1">
            <p className="text-muted-foreground">{group.products.length} products</p>
            {group.sourceUrl ? <a href={group.sourceUrl} target="_blank" rel="noopener noreferrer" className="block break-all underline underline-offset-4">{group.sourceUrl}</a> : <span>Source URL unavailable</span>}
          </li>)}
        </ul>
      </details>}
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
  const [smartSettings, setSmartSettings] = useState<SmartCollectionOptionsInput>(DEFAULT_SMART_COLLECTION_OPTIONS);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [runError, setRunError] = useState("");
  const [resultView, setResultView] = useState<FinderResult | null>(null);
  const [smartResult, setSmartResult] = useState<SmartResult | null>(null);
  const [verifierModel, setVerifierModel] = useState("");
  const [verification, setVerification] = useState<AutomaticVerificationReport | null>(null);
  const [smartVerification, setSmartVerification] = useState<AutomaticVerificationReport | null>(null);
  const [matchingError, setMatchingError] = useState("");
  const [smartError, setSmartError] = useState("");
  const [copied, setCopied] = useState(false);
  const [forgetDialogOpen, setForgetDialogOpen] = useState(false);

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
    return () => {
      runControllerRef.current?.abort();
      runControllerRef.current = null;
    };
  }, []);

  const providerPreset = API_PRESETS.find((preset) => preset.url === apiBase);
  const presetValue = providerPreset?.url || "custom";
  const selectedModelIsAvailable = models.some((model) => model.id === selectedModel);
  const effectiveVerifierModel = verifierModel || selectedModel;
  const verifierModelIsAvailable = models.some((model) => model.id === effectiveVerifierModel);
  const providerName = providerPreset?.name
    || (vaultState === "unlocked" ? new URL(apiBase).host : "");
  const titlePreview = smartResult ? previewSmartCollectionTitles(smartResult.samples, smartResult.suggestion, smartResult.options) : null;
  const smartSummary = smartResult && titlePreview ? [
    { label: "Products sampled", value: smartResult.samples.length },
    { label: "Sampled titles matching rules", value: titlePreview.evaluated ? titlePreview.passed.length : "Not evaluated" },
    { label: "Sampled titles not matching rules", value: titlePreview.evaluated ? titlePreview.excluded.length : "Not evaluated" },
    { label: "Actual Shopify matches", value: SHOPIFY_MATCH_COUNT_NOTICE },
  ] : [];
  const resultOutput = resultView ? formatMinorityResult(resultView.minority) : "";
  const verificationWarning = verification && verification.status !== "complete"
    ? `${getVerificationLabel(verification.status)}${verification.message ? `\n${verification.message}` : ""}` : "";
  const smartVerificationWarning = smartVerification && smartVerification.status !== "complete"
    ? `${getVerificationLabel(smartVerification.status)}${smartVerification.message ? `\n${smartVerification.message}` : ""}` : "";
  const output = resultOutput && verificationWarning
    ? `${resultOutput}\n\n${verificationWarning}`
    : resultOutput;
  const smartOutput = smartResult
    ? `${formatSmartCollectionSuggestion(smartResult.suggestion, smartResult.options)}${smartVerificationWarning ? `\n\n${smartVerificationWarning}` : ""}`
    : "";
  const relatedNames = resultView ? deduplicateProducts(resultView.relatedGroups.flatMap((group) => group.products)).map((product) => product.name).join("\n") : "";
  const unrelatedNames = resultView ? deduplicateProducts(resultView.unrelatedGroups.flatMap((group) => group.products)).map((product) => product.name).join("\n") : "";
  const combinedOutput = resultView || smartResult ? [
    smartOutput || `Smart collection unavailable: ${smartError || "No suggestion was produced."}`,
    resultView
      ? `Related Products\n${relatedNames || "None"}\n\nUnrelated Products\n${unrelatedNames || "None"}${verificationWarning ? `\n\n${verificationWarning}` : ""}`
      : `Product matching unavailable: ${matchingError || "No complete product matching result was produced."}`,
  ].join("\n\n") : "";
  const reviewInput = resultView?.reviewInput;
  const invalidateResults = () => {
    setResultView(null);
    setSmartResult(null);
    setVerification(null);
    setSmartVerification(null);
    setMatchingError("");
    setSmartError("");
    setRunError("");
    setProgress(0);
    setProgressMessage("");
    setCopied(false);
  };

  const refreshModelList = async (settings: SavedProviderSettings) => {
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
    if (running || !modelId || modelId === selectedModel) return;
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
    if (runControllerRef.current) return;
    invalidateResults();

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
    if (!verifierModelIsAvailable) {
      setRunError("Choose an available verifier model before running.");
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
    const smartEligible = new Set(urls.map((url) => new URL(url).origin)).size === 1;
    let clientOptions = DEFAULT_SMART_COLLECTION_OPTIONS;
    if (smartEligible) {
      try {
        clientOptions = parseSmartCollectionOptions(smartSettings);
      } catch (error) {
        setRunError(error instanceof Error ? error.message : "Check smart collection settings.");
        return;
      }
    } else {
      setSmartError("Smart collection suggestions require URLs from one Shopify store. Product matching still runs across your submitted stores.");
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
    setProgressMessage("Collecting products…");
    const automaticOptions = (subject: string, start: number) => ({
      signal: controller.signal,
      onProgress: (phase: "verifying" | "correcting" | "rechecking", completed: number, total: number) => {
        if (runControllerRef.current !== controller || controller.signal.aborted) return;
        setProgressMessage(`${subject}: ${phase === "correcting" ? "correcting conditions" : phase === "rechecking" ? "rechecking corrections" : "reviewing results"} (${completed}/${total})…`);
        setProgress(start + (phase === "rechecking" ? 8 : phase === "correcting" ? 6 : 0) + Math.round((completed / Math.max(total, 1)) * 5));
      },
    });
    const reviewer = { apiBase: settings.apiBase, apiKey: settings.apiKey, model: effectiveVerifierModel };

    try {
      let collected: Awaited<ReturnType<typeof collectProductsFromUrls>> | null = null;
      let samples: Awaited<ReturnType<typeof collectProductsFromUrls>> | null = null;
      let produced = false;
      const collectProgress = (message: string, completed: number, total: number) => {
        if (runControllerRef.current !== controller || controller.signal.aborted) return;
        setProgressMessage(message);
        setProgress(total > 0 ? Math.round((completed / total) * 30) : 0);
      };
      try {
        collected = await collectProductsFromUrls(urls, controller.signal, collectProgress);
      } catch (error) {
        if (controller.signal.aborted) throw error;
        setMatchingError(error instanceof Error ? error.message : "Could not collect a complete product list.");
      }
      if (controller.signal.aborted) throw new Error("Run cancelled.");
      if (collected) {
        // Bound each source before deduplicating products shared by collections.
        samples = {
          products: deduplicateProducts(groupProductsBySource(collected.products).flatMap((group) => group.products.slice(0, MAX_SAMPLE_PRODUCTS_PER_URL))),
          warnings: [...collected.warnings, `Sample only: at most ${MAX_SAMPLE_PRODUCTS_PER_URL} collected products per submitted URL. Smart suggestions do not verify store-wide coverage or Shopify membership.`],
        };
        try {
          setProgressMessage(`Classifying ${collected.products.length} unique products…`);
          const decisions = await classifyProducts(
            settings.apiBase, settings.apiKey, selectedModel, draft.trim(), collected.products, {
              signal: controller.signal,
              onProgress: (completed, total) => {
                if (runControllerRef.current !== controller || controller.signal.aborted) return;
                setProgressMessage(`Classifying products (${completed}/${total})…`);
                setProgress(30 + Math.round((completed / Math.max(total, 1)) * 10));
              },
            },
          );
          if (controller.signal.aborted) throw new Error("Run cancelled.");
          const input: ProductReviewInput = {
            mode: "manual", draft: draft.trim(), sourceModel: selectedModel,
            products: collected.products.map((product, index) => ({ product, selected: decisions[index].related })),
          };
          const present = (finalDecisions: ProductDecision[]): FinderResult => {
            const related = collected.products.filter((_, index) => finalDecisions[index].related);
            const unrelated = collected.products.filter((_, index) => !finalDecisions[index].related);
            return {
              minority: buildMinorityResult(collected.products, finalDecisions),
              relatedGroups: groupProductsBySource(related), unrelatedGroups: groupProductsBySource(unrelated),
              relatedCount: related.length, unrelatedCount: unrelated.length, reviewInput: input,
              note: `${collected.products.length} unique product${collected.products.length === 1 ? "" : "s"} checked across ${urls.length} URL${urls.length === 1 ? "" : "s"}.`
                + (collected.warnings.length ? ` ${collected.warnings.join(" ")}` : ""),
            };
          };
          setResultView(present(decisions));
          produced = true;
          const verified = await automaticallyVerifyResults(reviewer, input, automaticOptions("Product matching", 42));
          if (runControllerRef.current !== controller) return;
          setVerification(controller.signal.aborted ? markVerificationIncomplete(verified, "Request cancelled.") : verified);
          if (!controller.signal.aborted) setResultView(present(decisions.map((decision, index) => ({
            ...decision, related: verified.final.products[index].selected ?? decision.related,
          }))));
        } catch (error) {
          if (controller.signal.aborted) throw error;
          setMatchingError(error instanceof Error ? error.message : "Product matching failed.");
        }
      }
      if (controller.signal.aborted) throw new Error("Request cancelled.");
      if (smartEligible) {
        try {
          samples ??= await collectProductsFromUrls(urls, controller.signal, collectProgress, { sampleOnly: true });
          if (controller.signal.aborted) throw new Error("Request cancelled.");
          setProgress(65);
          setProgressMessage(`Suggesting smart conditions from ${samples.products.length} sampled products…`);
          const suggestion = await suggestSmartCollection(
            settings.apiBase, settings.apiKey, selectedModel, draft.trim(), urls,
            samples.products, controller.signal, clientOptions,
          );
          if (controller.signal.aborted) throw new Error("Request cancelled.");
          const initial: SmartResult = {
            suggestion, options: clientOptions, samples: samples.products, warnings: samples.warnings,
            reviewInput: createSmartReviewInput(draft.trim(), selectedModel, samples.products, suggestion, clientOptions),
          };
          setSmartResult(initial);
          produced = true;
          const verified = await automaticallyVerifyResults(reviewer, initial.reviewInput, {
            ...automaticOptions("Smart collection", 78), smart: { suggestion, options: clientOptions, urls },
          });
          if (runControllerRef.current !== controller) return;
          setSmartVerification(controller.signal.aborted ? markVerificationIncomplete(verified, "Request cancelled.") : verified);
          if (!controller.signal.aborted) setSmartResult({ ...initial, suggestion: verified.suggestion ?? suggestion });
        } catch (error) {
          if (controller.signal.aborted) throw error;
          setSmartError(error instanceof Error ? error.message : "Smart suggestions failed.");
        }
      }
      if (controller.signal.aborted) throw new Error("Request cancelled.");
      setProgress(produced ? 100 : 0);
      setProgressMessage(produced ? "Done." : "No outputs completed.");
    } catch (error) {
      if (runControllerRef.current !== controller) return;
      setRunError(error instanceof Error ? error.message : "Could not complete the product check.");
      if (controller.signal.aborted) setSmartError((previous) => previous || "Smart collection generation was cancelled or not completed.");
      setProgressMessage("");
      setProgress(0);
    } finally {
      if (runControllerRef.current === controller) {
        runControllerRef.current = null;
        setRunning(false);
      }
    }
  };

  const handleCopy = async () => {
    if (!output || running) return;
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
    setSmartSettings(DEFAULT_SMART_COLLECTION_OPTIONS);
    setVerifierModel("");
    invalidateResults();
    urlsInputRef.current?.focus();
  };

  return (
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside aria-label="Connection settings and summary" className="grid min-w-0 items-start gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <section aria-labelledby="api-settings-title" className="min-w-0 rounded-xl border border-border bg-card/50 p-4">
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
                <Button type="button" variant="outline" size="sm" onClick={handleLock} disabled={loadingModels}>
                  <LockKeyhole className="mr-2 h-4 w-4" />
                  Lock
                </Button>
              </div>
            )}
          </div>

          <div className="mt-4">
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

                <div className="grid gap-3">
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
                    disabled={running || loadingModels}
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
                  disabled={running || loadingModels}
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

            <fieldset disabled={running || vaultState !== "unlocked" || loadingModels} className="mt-4 min-w-0 space-y-2 border-t border-border pt-4">
              <Label htmlFor="related-verifier-model">Verifier model</Label>
              <select id="related-verifier-model" value={verifierModel}
                onChange={(event) => { setVerifierModel(event.target.value); invalidateResults(); }}
                className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Use selected matching model</option>
                {verifierModel && !models.some((model) => model.id === verifierModel) && <option value={verifierModel}>Saved reviewer unavailable: {verifierModel}</option>}
                {models.map((model) => <option key={model.id} value={model.id}>{model.id}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">{effectiveVerifierModel === selectedModel
                ? "The same model can repeat its own mistakes. You can choose another model from this provider."
                : "A different model can still share the same mistakes."}</p>
            </fieldset>
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
          </div>
        </section>
        <section aria-labelledby="related-summary-title" className="min-w-0 space-y-4 rounded-xl border border-primary/30 bg-card/50 p-4">
          <h2 id="related-summary-title" className="font-semibold">Summary</h2>
          {running ? <div className="space-y-3" aria-live="polite">
            <p className="text-xs text-muted-foreground">{progressMessage}</p>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">{progress}% complete</p>
          </div> : (resultView || smartResult) ? <p role="status" className="text-sm font-medium">
            {verificationWarning || smartVerificationWarning || (matchingError || smartError ? "Some outputs are unavailable — review the warnings." : resultView?.minority.kind === "summary" ? resultView.minority.text : "Check complete")}
          </p> : <p className="text-xs text-muted-foreground">Connect your provider, choose a model, and run a check to produce all outputs.</p>}
          <dl className="grid grid-cols-2 gap-3">
            {[
              ["Unique products", resultView ? resultView.relatedCount + resultView.unrelatedCount : "—"],
              ["Smart samples", smartResult?.samples.length ?? "—"],
              ["Related", resultView?.relatedCount ?? "—"],
              ["Unrelated", resultView?.unrelatedCount ?? "—"],
            ].map(([label, value]) => <div key={label} className="rounded-lg border border-border bg-background/40 p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-semibold">{value}</dd>
            </div>)}
          </dl>
          {((verification && verification.status !== "complete") || (smartVerification && smartVerification.status !== "complete")) &&
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">AI review needs attention. Inspect the review details before using the output.</p>}
          <p className="text-xs text-muted-foreground">Product relevance and smart title-rule matches are separate. Actual Shopify matches remain unverified.</p>
          <Button type="button" variant="outline" size="sm" className="w-full hover:bg-muted hover:text-foreground" onClick={() => void handleCopy()} disabled={!output || running}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}{copied ? "Copied" : "Copy result"}
          </Button>
          <p className="text-xs text-muted-foreground">Copy result preserves the smaller-group rule and includes source links.</p>
        </section>
      </aside>

      <div className="min-w-0 space-y-4">
        <section aria-labelledby="product-check-title" className="min-w-0 rounded-xl border border-border bg-card/50 p-4 sm:p-5">
          <div className="mb-5 flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <PackageSearch className="h-5 w-5" />
            </div>
            <div>
              <h2 id="product-check-title" className="font-semibold">Check products against a draft</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Match products and suggest smart collection conditions in one run. Both outputs receive automatic AI review, which adds provider requests.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)]">
              <div className="flex flex-col gap-2">
                <Label htmlFor="related-collection-urls">Collection links</Label>
                <Textarea
                  id="related-collection-urls"
                  ref={urlsInputRef}
                  value={urlsInput}
                  onChange={(event) => {
                    setUrlsInput(event.target.value);
                    invalidateResults();
                  }}
                  placeholder={"https://store.example/collections/bill-acceptors\nhttps://store.example/collections/stackers"}
                  className="min-h-48 font-mono text-sm"
                  disabled={running}
                  data-lenisignore
                />
                <p className="text-xs text-muted-foreground">
                  Separate URLs with a new line or comma. Up to 10 URLs and 1,000 unique products. Smart suggestions require one store and use up to {MAX_SAMPLE_PRODUCTS_PER_URL} collected products per URL.
                </p>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="related-draft">Draft content</Label>
                <Textarea
                  id="related-draft"
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    invalidateResults();
                  }}
                  placeholder="Paste the complete draft you want to match products against…"
                  className="min-h-48 flex-1 text-sm"
                  disabled={running}
                  data-lenisignore
                />
              </div>
            </div>
            <details className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Smart collection settings</summary>
              <div className="mt-3">
                <SmartCollectionSettings
                  settings={smartSettings}
                  disabled={running}
                  onChange={(settings) => { setSmartSettings(settings); invalidateResults(); }}
                />
              </div>
            </details>
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
                disabled={running || loadingModels || vaultState !== "unlocked" || !selectedModel || !selectedModelIsAvailable || !verifierModelIsAvailable || savingSelection}
                className="flex-1 text-black"
              >
                {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageSearch className="mr-2 h-4 w-4" />}
                {running ? "Checking products…" : "Run check"}
              </Button>
              {running && (
                <Button type="button" variant="outline" onClick={() => runControllerRef.current?.abort()}>
                  Cancel
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={handleNewCheck}
                disabled={running || (!urlsInput && !draft && !resultView && !smartResult && !runError && smartSettings === DEFAULT_SMART_COLLECTION_OPTIONS)}
              >
                New check
              </Button>
            </div>
          </div>
        </section>

        <section aria-labelledby="related-final-title" className="min-w-0 space-y-3">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="related-final-title" className="text-sm font-semibold">Final outputs</h2>
            <CopyButton text={combinedOutput} variant="outline" size="sm" className="hover:bg-muted hover:text-foreground"
              disabled={running || !combinedOutput}>Copy all final outputs</CopyButton>
          </header>
          {matchingError && (
            <Alert variant="destructive" role="alert">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Product matching: {matchingError}</AlertDescription>
            </Alert>
          )}
          <div id="related-final-outputs" className="grid min-w-0 items-stretch gap-4 md:grid-cols-2 min-[1440px]:grid-cols-3">
            <div className="min-w-0 md:col-span-2 min-[1440px]:col-span-1">
              <SmartCollectionConditions
                suggestion={smartVerification ? smartResult?.suggestion || null : null}
                options={smartResult?.options}
                running={running}
                warning={smartVerificationWarning}
                error={smartError || (smartResult && smartResult.samples.length === 0 ? "No product samples were readable. These suggestions use only the draft and URL paths; no product preview is available." : "")}
              />
            </div>
            <ProductResultsPanel
              id="related-products-title"
              title="Related Products"
              groups={verification ? resultView?.relatedGroups || [] : []}
              count={verification ? resultView?.relatedCount ?? 0 : 0}
              hasResult={Boolean(resultView && verification)}
              running={running}
              warning={verificationWarning}
            />
            <ProductResultsPanel
              id="unrelated-products-title"
              title="Unrelated Products"
              groups={verification ? resultView?.unrelatedGroups || [] : []}
              count={verification ? resultView?.unrelatedCount ?? 0 : 0}
              hasResult={Boolean(resultView && verification)}
              running={running}
              warning={verificationWarning}
            />
          </div>
        </section>
        {(reviewInput || smartResult) && (
          <details className="min-w-0 rounded-xl border border-border bg-card/50 p-4">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Reasons, sources &amp; initial output</summary>
            <div className="mt-4 grid min-w-0 gap-4">
              <p className="text-xs text-muted-foreground">{AUTOMATIC_VERIFICATION_NOTICE}</p>
              {resultView && <p className="text-xs text-muted-foreground">{resultView.note}</p>}
              {reviewInput && <ProductResultVerifier input={reviewInput} report={verification} id="manual-verifier-title" title="Product matching review" />}
              {smartResult && (
                <>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    {smartSummary.map((row) => (
                      <div key={row.label} className="rounded-lg border border-border p-3">
                        <dt className="text-xs text-muted-foreground">{row.label}</dt>
                        <dd className="mt-1 text-sm font-medium">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                  {!titlePreview?.evaluated && <p className="text-xs text-muted-foreground">{NO_TITLE_RULES_NOTICE}</p>}
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    {smartResult.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
                  </ul>
                  <ProductResultVerifier input={smartResult.reviewInput} report={smartVerification} id="smart-verifier-title" title="Smart collection review" />
                </>
              )}
            </div>
          </details>
        )}
      </div>

      <details className="rounded-lg border border-border p-4 lg:col-span-2">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Privacy &amp; API key security</summary>
        <Alert className="mt-3">
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription className="text-xs leading-relaxed">
            The API key is kept in memory while unlocked and stored only as AES-GCM-encrypted data in this browser’s localStorage. It is sent only to the API base URL you choose, never to the page-fetch service. Local development uses the Vite dev server; the deployed version uses the site’s Cloudflare Worker to fetch public pages, which the Worker can see. Use a unique strong vault passphrase; a compromised browser or same-page script can still access a key while unlocked.
          </AlertDescription>
        </Alert>
      </details>
    </div>
  );
}
