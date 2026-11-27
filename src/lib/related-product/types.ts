export interface ProductCandidate {
  name: string;
  productType: string;
  description: string;
  price: string;
  url: string;
  foundVia?: string[];
}

export interface ProductResultGroup {
  sourceUrl: string | null;
  products: ProductCandidate[];
}

export type MinorityResult =
  | { kind: "summary"; text: "All related" | "All unrelated" }
  | { kind: "groups"; heading: string; groups: ProductResultGroup[] };

export interface ProductModel {
  id: string;
  ownedBy?: string;
}

export interface SavedProviderSettings {
  apiBase: string;
  apiKey: string;
  selectedModel: string;
}

export interface ProductDecision {
  id: string;
  related: boolean;
}

export interface CollectionResult {
  products: ProductCandidate[];
  warnings: string[];
}

export interface ProductReviewInput {
  mode: "manual" | "smart";
  draft: string;
  sourceModel: string;
  products: Array<{ product: ProductCandidate; selected: boolean | null }>;
  conditions?: string;
}

export interface ProductReviewAssessment {
  id: string;
  related: boolean | null;
  reason: string;
}

export interface ProductReviewResult {
  model: string;
  assessments: ProductReviewAssessment[];
  warnings: string[];
}
