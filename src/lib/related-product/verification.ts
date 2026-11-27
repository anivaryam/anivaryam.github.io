import { suggestSmartCollection, verifyProductResults } from "./api";
import {
  formatSmartCollectionSuggestion,
  getSmartCollectionRows,
  previewSmartCollectionTitles,
  type SmartCollectionOptions,
  type SmartCollectionSuggestion,
} from "./smart-collection";
import type { ProductCandidate, ProductReviewInput, ProductReviewResult } from "./types";

export const AUTOMATIC_VERIFICATION_NOTICE = "Every run automatically reviews the results. One correction and one recheck may add provider requests. Clear, rechecked corrections update the output; uncertainty and failures are flagged. AI agreement is not proof of accuracy or Shopify membership.";

export interface AutomaticVerificationReport {
  status: "complete" | "needs-review" | "incomplete";
  original: ProductReviewInput;
  final: ProductReviewInput;
  review: ProductReviewResult | null;
  changes: Array<{ label: string; before: string; after: string }>;
  uncertainIndices: number[];
  correctionAttempted: boolean;
  message?: string;
  suggestion?: SmartCollectionSuggestion;
}

export function getReviewSummary(input: ProductReviewInput, review: ProductReviewResult) {
  return {
    mismatches: review.assessments.filter((assessment, index) => {
      const selected = input.products[index].selected;
      return selected !== null && assessment.related !== null && selected !== assessment.related;
    }).length,
    uncertain: review.assessments.filter((assessment) => assessment.related === null).length,
  };
}

export function getVerificationLabel(status: AutomaticVerificationReport["status"]): string {
  return status === "complete" ? "AI review complete — human review still required."
    : status === "needs-review" ? "AI review needs attention — review flagged items."
      : "AI verification incomplete — original output retained.";
}

export function markVerificationIncomplete(report: AutomaticVerificationReport, message: string): AutomaticVerificationReport {
  return {
    ...report, status: "incomplete", final: report.original, review: null,
    changes: [], uncertainIndices: [], suggestion: undefined, message,
  };
}

export function createSmartReviewInput(
  draft: string,
  sourceModel: string,
  products: ProductCandidate[],
  suggestion: SmartCollectionSuggestion,
  options: SmartCollectionOptions,
): ProductReviewInput {
  const preview = previewSmartCollectionTitles(products, suggestion, options);
  const passingUrls = new Set(preview.passed.map((product) => product.url));
  return {
    mode: "smart", draft, sourceModel,
    conditions: formatSmartCollectionSuggestion(suggestion, options),
    products: products.map((product) => ({
      product, selected: preview.evaluated ? passingUrls.has(product.url) : null,
    })),
  };
}

export async function automaticallyVerifyResults(
  provider: { apiBase: string; apiKey: string; model: string },
  input: ProductReviewInput,
  options: {
    signal?: AbortSignal;
    onProgress?: (phase: "verifying" | "correcting" | "rechecking", completed: number, total: number) => void;
    smart?: { suggestion: SmartCollectionSuggestion; options: SmartCollectionOptions; urls: string[] };
  } = {},
): Promise<AutomaticVerificationReport> {
  const report: AutomaticVerificationReport = {
    status: "incomplete", original: input, final: input, review: null, changes: [],
    uncertainIndices: [], correctionAttempted: false, suggestion: options.smart?.suggestion,
  };
  const review = async (subject: ProductReviewInput, phase: "verifying" | "rechecking") => {
    options.onProgress?.(phase, 0, subject.products.length);
    return verifyProductResults(provider.apiBase, provider.apiKey, provider.model, subject, {
      signal: options.signal,
      onProgress: (completed, total) => options.onProgress?.(phase, completed, total),
    });
  };
  const finish = (
    final: ProductReviewInput,
    result: ProductReviewResult,
    previous: ProductReviewResult = result,
  ) => {
    report.final = final;
    report.review = result;
    report.uncertainIndices = result.assessments.flatMap((assessment, index) => (
      assessment.related === null || previous.assessments[index].related === null
      || assessment.related !== previous.assessments[index].related ? [index] : []
    ));
    report.status = getReviewSummary(final, result).mismatches > 0
      || report.uncertainIndices.length > 0 || result.needsCorrection || result.warnings.length > 0
      ? "needs-review" : "complete";
    return report;
  };

  try {
    if (input.mode === "manual" && input.products.some((entry) => entry.selected === null)) {
      throw new Error("Original product decisions are missing.");
    }
    const first = await review(input, "verifying");
    report.review = first;
    if (options.signal?.aborted) throw new Error("Request cancelled.");
    const mismatches = getReviewSummary(input, first).mismatches;
    if (mismatches === 0 && !(input.mode === "smart" && first.needsCorrection)) {
      return finish(input, first);
    }
    report.correctionAttempted = true;

    if (input.mode === "manual") {
      const proposed: ProductReviewInput = {
        ...input,
        products: input.products.map((entry, index) => ({
          ...entry, selected: first.assessments[index].related ?? entry.selected,
        })),
      };
      const rechecked = await review(proposed, "rechecking");
      if (options.signal?.aborted) throw new Error("Request cancelled.");
      // Only apply a changed decision when both passes agree; a conflict keeps the original.
      const final: ProductReviewInput = {
        ...input,
        products: input.products.map((entry, index) => ({
          ...entry,
          selected: first.assessments[index].related !== null
            && first.assessments[index].related === rechecked.assessments[index].related
            ? first.assessments[index].related : entry.selected,
        })),
      };
      report.changes = final.products.flatMap((entry, index) => entry.selected === input.products[index].selected ? [] : [{
        label: entry.product.name,
        before: input.products[index].selected ? "Related" : "Unrelated",
        after: entry.selected ? "Related" : "Unrelated",
      }]);
      return finish(final, rechecked, first);
    }

    const smart = options.smart;
    if (!smart) throw new Error("Original Shopify conditions are missing.");
    options.onProgress?.("correcting", 0, input.products.length);
    const revised = await suggestSmartCollection(
      provider.apiBase, provider.apiKey, input.sourceModel, input.draft, smart.urls,
      input.products.map((entry) => entry.product), options.signal, smart.options,
      { suggestion: smart.suggestion, review: first },
    );
    if (options.signal?.aborted) throw new Error("Request cancelled.");
    if (JSON.stringify(getSmartCollectionRows(revised, smart.options)) === JSON.stringify(getSmartCollectionRows(smart.suggestion, smart.options))) {
      report.message = "The correction returned the same conditions. Original rules retained; review the unresolved issues.";
      finish(input, first);
      report.status = "needs-review";
      return report;
    }
    const proposed = createSmartReviewInput(input.draft, input.sourceModel, input.products.map((entry) => entry.product), revised, smart.options);
    const rechecked = await review(proposed, "rechecking");
    if (options.signal?.aborted) throw new Error("Request cancelled.");
    // Dropping title evaluation cannot prove that known mismatches were corrected.
    if (proposed.products.some((entry) => entry.selected === null)
      || getReviewSummary(proposed, first).mismatches > 0
      || getReviewSummary(proposed, rechecked).mismatches > 0 || rechecked.needsCorrection) {
      report.message = "The correction was not confirmed by the recheck. Original rules retained; no further automatic attempts.";
      finish(input, first, rechecked);
      report.status = "needs-review";
      return report;
    }
    report.suggestion = revised;
    report.changes = [{
      label: "Shopify conditions",
      before: formatSmartCollectionSuggestion(smart.suggestion, smart.options),
      after: formatSmartCollectionSuggestion(revised, smart.options),
    }];
    return finish(proposed, rechecked, first);
  } catch (error) {
    return markVerificationIncomplete(report, error instanceof Error ? error.message : "Automatic verification failed.");
  }
}
