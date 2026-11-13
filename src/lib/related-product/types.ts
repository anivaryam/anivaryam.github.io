export interface ProductCandidate {
  name: string;
  productType: string;
  description: string;
  price: string;
  url: string;
  foundVia?: string[];
}

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
