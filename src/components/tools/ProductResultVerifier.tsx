import { Alert, AlertDescription } from "@/components/ui/alert";
import { getReviewSummary, getVerificationLabel, type AutomaticVerificationReport } from "@/lib/related-product/verification";
import type { ProductReviewInput } from "@/lib/related-product/types";

export function ProductResultVerifier({
  input, report,
}: {
  input: ProductReviewInput;
  report: AutomaticVerificationReport | null;
}) {
  const review = report?.review;
  const final = report?.final ?? input;
  const mismatches = review ? getReviewSummary(final, review).mismatches : 0;
  const uncertain = new Set(report?.uncertainIndices ?? []);
  const selectionLabel = (selected: boolean | null) => selected === null ? "not evaluated"
    : input.mode === "smart" ? selected ? "matched" : "did not match"
      : selected ? "related" : "unrelated";

  return (
    <section aria-labelledby="product-verifier-title" aria-busy={!report} className="min-w-0 space-y-4 rounded-xl border border-border bg-card/50 p-4">
      <h2 id="product-verifier-title" className="font-semibold">AI result verifier</h2>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Advisory review of all {input.products.length} {input.mode === "smart" ? "sampled" : "collected"} products against the draft, including matches and nonmatches.
        {" "}Rechecked corrections update the output automatically. AI cannot verify Shopify categories, status, inventory or store-wide counts.
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">At most one correction and one recheck. Model agreement is not proof of accuracy; human review is still required.</p>
      {input.products.length === 0 && <p className="text-xs text-muted-foreground">No product samples are available to verify. Review the rules in Shopify instead.</p>}
      <p role="status" className="text-sm font-medium">{report ? getVerificationLabel(report.status) : "Automatic AI verification is running…"}</p>
      {report?.message && <Alert role={report.status === "incomplete" ? "alert" : undefined}><AlertDescription>{report.message}</AlertDescription></Alert>}
      {report && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Applied changes ({report.changes.length})</h3>
          {report.changes.length === 0 ? <p className="text-xs text-muted-foreground">No automatic changes were applied.</p> : (
            <ul className="space-y-3">
              {report.changes.map((change, index) => (
                <li key={index} className="space-y-2 rounded-lg border border-border p-3 text-xs">
                  <p className="break-words font-medium">{change.label}</p>
                  <p className="whitespace-pre-wrap break-words text-muted-foreground">Before: {change.before}</p>
                  <p className="whitespace-pre-wrap break-words text-muted-foreground">After: {change.after}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {review && (
        <div className="space-y-4">
          <p className="break-all text-xs text-muted-foreground">Reviewed by: {review.model}</p>
          {review.model === input.sourceModel && <p className="text-xs text-muted-foreground">The same model generated and reviewed these results; it can repeat its own mistakes.</p>}
          <dl className="grid gap-3 sm:grid-cols-3">
            {[
              ["Products reviewed", review.assessments.length],
              ["Remaining mismatches", mismatches],
              ["Uncertain / conflicting", uncertain.size],
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
              const selected = final.products[index].selected;
              const issue = assessment.related !== null && selected !== null && assessment.related !== selected;
              return (
                <li key={assessment.id} className="space-y-2 rounded-lg border border-border bg-background/40 p-3 text-sm">
                  <a href={entry.product.url} target="_blank" rel="noopener noreferrer" className="break-words font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{entry.product.name}</a>
                  <p className="text-xs font-medium">
                    {uncertain.has(index) ? "Uncertain / conflicting reviews" : issue
                      ? selected ? "Potential false positive" : "Potential missed product"
                      : assessment.related ? "AI considers relevant" : "AI considers unrelated"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Original {input.mode === "smart" ? "title result" : "AI decision"}: {selectionLabel(entry.selected)}
                  </p>
                  <p className="text-xs text-muted-foreground">Final {input.mode === "smart" ? "title result" : "AI decision"}: {selectionLabel(selected)}</p>
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
