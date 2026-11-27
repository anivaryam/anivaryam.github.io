import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { verifyProductResults } from "@/lib/related-product/api";
import type { ProductModel, ProductReviewInput, ProductReviewResult } from "@/lib/related-product/types";

export function ProductResultVerifier({
  input, apiBase, apiKey, selectedModel, models, enabled,
}: {
  input: ProductReviewInput;
  apiBase: string;
  apiKey: string;
  selectedModel: string;
  models: ProductModel[];
  enabled: boolean;
}) {
  const [model, setModel] = useState(selectedModel);
  const [review, setReview] = useState<ProductReviewResult | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [error, setError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!enabled) controllerRef.current?.abort();
  }, [enabled]);

  useEffect(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setReview(null);
    setError("");
    setCompleted(0);
    setReviewing(false);
  }, [input]);

  const canVerify = enabled && models.some((available) => available.id === model) && input.products.length > 0;
  const handleVerify = async () => {
    if (!canVerify || controllerRef.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setReview(null);
    setError("");
    setCompleted(0);
    setReviewing(true);
    try {
      const result = await verifyProductResults(apiBase, apiKey, model, input, {
        signal: controller.signal,
        onProgress: (count) => {
          if (mountedRef.current && !controller.signal.aborted) setCompleted(count);
        },
      });
      if (mountedRef.current && controllerRef.current === controller && !controller.signal.aborted) setReview(result);
    } catch (cause) {
      if (mountedRef.current && controllerRef.current === controller) {
        setError(cause instanceof Error ? cause.message : "AI verification failed. Original results are unchanged.");
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        if (mountedRef.current) setReviewing(false);
      }
    }
  };
  const mismatches = review?.assessments.filter((assessment, index) => {
    const selected = input.products[index].selected;
    return selected !== null && assessment.related !== null && selected !== assessment.related;
  }).length ?? 0;
  const uncertain = review?.assessments.filter((assessment) => assessment.related === null).length ?? 0;

  return (
    <section aria-labelledby="product-verifier-title" aria-busy={reviewing} className="min-w-0 space-y-4 rounded-xl border border-border bg-card/50 p-4">
      <h2 id="product-verifier-title" className="font-semibold">AI result verifier</h2>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Advisory review of all {input.products.length} {input.mode === "smart" ? "sampled" : "collected"} products against the draft, including matches and nonmatches.
        {" "}Additional provider usage occurs only when you click Verify. It does not change your results or verify Shopify categories, status, inventory or store-wide counts.
      </p>
      <div className="space-y-2">
        <Label htmlFor="related-verifier-model">Verifier model</Label>
        <select
          id="related-verifier-model"
          value={model}
          onChange={(event) => {
            setModel(event.target.value);
            setReview(null);
            setError("");
          }}
          disabled={!enabled || reviewing}
          className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {!models.some((available) => available.id === model) && <option value={model}>Choose an available model</option>}
          {models.map((available) => <option key={available.id} value={available.id}>{available.id}</option>)}
        </select>
        <p className="text-xs leading-relaxed text-muted-foreground">
          A separate request is not proof of accuracy. {model === input.sourceModel
            ? "This is the same model that generated the results; it can repeat its own mistakes."
            : "A different model can still share the same mistakes. Review the evidence yourself."}
        </p>
      </div>
      {!enabled && <p className="text-xs text-muted-foreground">Unlock your provider and choose an available model to verify results.</p>}
      {input.products.length === 0 && <p className="text-xs text-muted-foreground">No product samples are available to verify. Review the rules in Shopify instead.</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void handleVerify()} disabled={!canVerify || reviewing} className="text-black">
          {reviewing ? "Verifying results…" : "Verify results with AI"}
        </Button>
        {reviewing && <Button type="button" variant="outline" onClick={() => controllerRef.current?.abort()}>Cancel verification</Button>}
      </div>
      {reviewing && (
        <div className="space-y-2" role="status">
          <p className="text-sm">AI reviewing products ({completed}/{input.products.length})…</p>
          <Progress value={(completed / input.products.length) * 100} />
        </div>
      )}
      {error && <Alert variant="destructive" role="alert"><AlertDescription>{error} Original results are unchanged.</AlertDescription></Alert>}
      {review && (
        <div className="space-y-4">
          <p role="status" className="text-sm font-medium">AI review complete — human review still required.</p>
          <p className="break-all text-xs text-muted-foreground">Reviewed by: {review.model}</p>
          <dl className="grid gap-3 sm:grid-cols-3">
            {[
              ["Products reviewed", review.assessments.length],
              ["Potential mismatches", mismatches],
              ["Uncertain", uncertain],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-xl font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          {input.products.every((entry) => entry.selected === null) && (
            <p className="text-xs text-muted-foreground">No title-match baseline was evaluated. The assessments below are relevance opinions, not a comparison with Shopify membership.</p>
          )}
          {review.warnings.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Verifier warnings</h3>
              <ul className="list-disc space-y-2 pl-5 text-xs text-muted-foreground">
                {review.warnings.map((warning, index) => <li key={index} className="break-words">{warning}</li>)}
              </ul>
            </div>
          )}
          <ul aria-label="AI product assessments" className="max-h-[32rem] space-y-3 overflow-y-auto" data-lenisignore>
            {review.assessments.map((assessment, index) => {
              const entry = input.products[index];
              const issue = assessment.related !== null && entry.selected !== null && assessment.related !== entry.selected;
              return (
                <li key={assessment.id} className="space-y-2 rounded-lg border border-border bg-background/40 p-3 text-sm">
                  <a href={entry.product.url} target="_blank" rel="noopener noreferrer" className="break-words font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{entry.product.name}</a>
                  <p className="text-xs font-medium">
                    {assessment.related === null ? "Uncertain" : issue
                      ? entry.selected ? "Potential false positive" : "Potential missed product"
                      : assessment.related ? "AI considers relevant" : "AI considers unrelated"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Original {input.mode === "smart" ? "title result" : "AI decision"}: {entry.selected === null ? "not evaluated" : input.mode === "smart"
                      ? entry.selected ? "matched" : "did not match"
                      : entry.selected ? "related" : "unrelated"}
                  </p>
                  <p className="break-words text-xs leading-relaxed text-muted-foreground">{assessment.reason}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
