import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DEFAULT_SMART_COLLECTION_OPTIONS,
  getSmartCollectionLabels,
  getSmartCollectionRows,
  SMART_COLLECTION_ANY_NOTICE,
  SMART_COLLECTION_NOTICE,
  type SmartCollectionOptions,
  type SmartCollectionSuggestion,
} from "@/lib/related-product/smart-collection";

export function SmartCollectionConditions({
  suggestion, options = DEFAULT_SMART_COLLECTION_OPTIONS,
}: { suggestion: SmartCollectionSuggestion | null; options?: SmartCollectionOptions }) {
  const labels = getSmartCollectionLabels(options);
  return (
    <section aria-labelledby="smart-conditions-title" className="min-w-0 space-y-4 rounded-xl border border-border bg-card/50 p-4">
      <h2 id="smart-conditions-title" className="font-semibold">Smart Collection Suggestions</h2>
      <p className="text-xs leading-relaxed text-muted-foreground">{SMART_COLLECTION_NOTICE}</p>
      {suggestion ? (
        <>
          <p className="text-sm font-medium">{labels.source}</p>
          <p className="text-xs text-muted-foreground">{labels.subcategories}. Add each title exclusion as its own condition.</p>
          {options.match === "any" && <p className="text-xs leading-relaxed text-muted-foreground">{SMART_COLLECTION_ANY_NOTICE}</p>}
          <Table aria-label="Suggested Shopify conditions">
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead>Operator</TableHead>
                <TableHead>Values</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {getSmartCollectionRows(suggestion, options).map((row, index) => (
                <TableRow key={index}>
                  <TableCell className="px-2 align-top">{row.field}</TableCell>
                  <TableCell className="px-2 align-top">{row.operator}</TableCell>
                  <TableCell className="px-2 align-top">
                    <ul className="flex flex-wrap gap-1.5">
                      {row.values.map((value, valueIndex) => (
                        <li key={valueIndex} className="max-w-full break-words rounded-md bg-muted px-2 py-1">{value}</li>
                      ))}
                    </ul>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {suggestion.notes.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Review notes</h3>
              <ul className="list-disc space-y-2 pl-5 text-xs leading-relaxed text-muted-foreground">
                {suggestion.notes.map((note, index) => <li key={index}>{note}</li>)}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Add the AM’s collection links and draft, then generate conditions to enter in Shopify. No Shopify collections are created or changed by this tool.</p>
      )}
    </section>
  );
}
