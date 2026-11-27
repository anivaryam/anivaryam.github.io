import { CopyButton } from "@/components/ui/copy-button";
import {
  DEFAULT_SMART_COLLECTION_OPTIONS,
  getSmartCollectionLabels,
  getSmartCollectionRows,
  formatSmartCollectionSuggestion,
  SMART_COLLECTION_ANY_NOTICE,
  SMART_COLLECTION_NOTICE,
  type SmartCollectionOptions,
  type SmartCollectionSuggestion,
} from "@/lib/related-product/smart-collection";

export function SmartCollectionConditions({
  suggestion, options = DEFAULT_SMART_COLLECTION_OPTIONS, running = false, warning = "", error = "",
}: {
  suggestion: SmartCollectionSuggestion | null;
  options?: SmartCollectionOptions;
  running?: boolean;
  warning?: string;
  error?: string;
}) {
  const labels = getSmartCollectionLabels(options);
  return (
    <section aria-labelledby="smart-conditions-title" aria-busy={running} className="flex h-full min-h-80 min-w-0 flex-col rounded-xl border border-border bg-card/50">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 id="smart-conditions-title" className="text-sm font-semibold">Smart Collection Suggestions</h2>
        <CopyButton
          text={suggestion ? `${formatSmartCollectionSuggestion(suggestion, options)}${warning ? `\n\n${warning}` : ""}` : ""}
          iconOnly variant="ghost" size="icon" className="h-8 w-8 shrink-0"
          aria-label="Copy smart collection suggestions" title="Copy smart collection suggestions"
          disabled={running || !suggestion}
        />
      </header>
      {error && <p role="alert" className="px-4 pt-4 text-xs text-destructive">{error}</p>}
      {warning && <p role="status" className="px-4 pt-4 text-xs font-medium text-amber-800 dark:text-amber-300">{warning}</p>}
      {suggestion ? (
        <div className="flex-1">
          <p className="px-4 pt-3 text-xs font-medium">{labels.source}</p>
          {getSmartCollectionRows(suggestion, options).map((row, index) => (
            <section key={index} aria-label={`${row.field} ${row.operator} condition`} className="space-y-2 border-b border-border/60 p-4 last:border-b-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xs font-semibold">{row.field}</h3>
                <span className="text-xs text-muted-foreground">{row.operator}</span>
                <CopyButton text={`${row.field} → ${row.operator}\n${row.values.join("\n")}`} iconOnly variant="ghost" size="icon" className="h-7 w-7"
                  aria-label={`Copy ${row.field} ${row.operator} condition`} title="Copy condition" disabled={running} />
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {row.values.map((value, valueIndex) => (
                  <li key={valueIndex} className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-muted/40 py-1 pl-2 pr-1">
                    <span className="min-w-0 break-words text-xs">{value}</span>
                    <CopyButton text={value} iconOnly variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                      aria-label={`Copy ${row.field} ${row.operator} value: ${value}`} title={`Copy ${value}`} disabled={running} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <details className="border-t border-border p-4 text-xs">
            <summary className="cursor-pointer text-muted-foreground">Rule details &amp; notes</summary>
            <p className="mt-3 text-muted-foreground">{labels.subcategories}. Add each title exclusion as its own condition.</p>
            {suggestion.notes.length > 0 && <ul className="mt-3 list-disc space-y-2 pl-4 text-muted-foreground">
              {suggestion.notes.map((note, index) => <li key={index}>{note}</li>)}
            </ul>}
          </details>
        </div>
      ) : (
        <p className="flex-1 p-4 text-sm text-muted-foreground">{running ? "Suggested conditions will appear when generation finishes." : "Add collection links and a draft, then run a check. No Shopify collections are created or changed."}</p>
      )}
      <div className="mt-auto space-y-2 border-t border-border bg-muted/20 p-4 text-xs leading-relaxed text-muted-foreground">
        <p>{SMART_COLLECTION_NOTICE}</p>
        {options.match === "any" && <p>{SMART_COLLECTION_ANY_NOTICE}</p>}
      </div>
    </section>
  );
}
