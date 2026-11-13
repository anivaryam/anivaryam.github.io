import type { CollectionResult, ProductCandidate } from "./types";
import { isPrivateHost } from "./url-safety";
import { LINK_CHECKER_WORKER_URL } from "../worker-endpoints";

const MAX_PAGES_PER_COLLECTION = 20;
const MAX_PRODUCTS_PER_COLLECTION = 1_000;
const MAX_COLLECTION_URLS = 10;
const MAX_PRODUCTS_PER_RUN = 1_000;
const MAX_DETAIL_REQUESTS = 80;
const DEV_PAGE_FETCH_ENDPOINT = "/__related-product/page?url=";

class CollectionSafetyLimitError extends Error {}
class IncompleteShopifyFeedError extends Error {}

export function normalizeCollectionUrl(input: string): string {
  const value = input.trim();
  const withProtocol = /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;
  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error(`Invalid URL: ${input}`);
  }

  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("Only public HTTP or HTTPS URLs are supported.");
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new Error("Local and private-network URLs are not supported.");
  }
  parsed.hash = "";
  return parsed.href;
}

function requireSameOrigin(targetUrl: string, expectedOrigin: string): URL {
  const target = new URL(targetUrl);
  if (target.origin !== expectedOrigin || isPrivateHost(target.hostname)) {
    throw new Error("The collection linked to a different website. Only pages on the provided site are allowed.");
  }
  return target;
}

async function fetchPage(targetUrl: string, expectedOrigin: string, signal: AbortSignal): Promise<string> {
  const safeUrl = requireSameOrigin(targetUrl, expectedOrigin);
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 30_000);
  const abortFromParent = () => controller.abort();
  if (signal.aborted) controller.abort();
  else signal.addEventListener("abort", abortFromParent, { once: true });

  try {
    const isDevelopment = import.meta.env.DEV;
    const requestInit: RequestInit = {
      method: isDevelopment ? "GET" : "POST",
      signal: controller.signal,
      cache: "no-store",
      headers: isDevelopment
        ? {
          Accept: "application/json",
          "X-Related-Product-Dev-Proxy": "1",
        }
        : {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
    };
    if (!isDevelopment) {
      requestInit.body = JSON.stringify({ action: "fetch-page", url: safeUrl.href });
    }
    const response = await fetch(
      isDevelopment
        ? `${DEV_PAGE_FETCH_ENDPOINT}${encodeURIComponent(safeUrl.href)}`
        : LINK_CHECKER_WORKER_URL,
      requestInit,
    );
    if (!response.ok) {
      let message = `Page fetch failed (${response.status}).`;
      try {
        const payload = await response.json() as { error?: unknown };
        if (typeof payload.error === "string") message = payload.error;
      } catch {
        // Keep a bounded status-only message if the fetch service returned non-JSON.
      }
      throw new Error(message);
    }
    const payload = await response.json() as { contents?: unknown };
    if (typeof payload.contents !== "string") {
      throw new Error("The page-fetch proxy returned no page content.");
    }
    if (payload.contents.length > 8_000_000) throw new Error("This page is too large to process.");
    return payload.contents;
  } catch (error) {
    if (signal.aborted) throw new Error("Collection cancelled.");
    if (controller.signal.aborted) throw new Error("A page request timed out.");
    if (error instanceof TypeError) {
      throw new Error("Could not reach the page-fetch service. The site or fetch service may be blocked or unavailable.");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
    signal.removeEventListener("abort", abortFromParent);
  }
}

function cleanText(value: string | null | undefined, maxLength = 1_500): string {
  return (value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function htmlToText(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const parsed = new DOMParser().parseFromString(value, "text/html");
  return cleanText(parsed.body.textContent, 1_500);
}

function flattenJsonLd(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  return [
    record,
    ...flattenJsonLd(record["@graph"]),
    ...flattenJsonLd(record.itemListElement),
    ...flattenJsonLd(record.mainEntity),
  ];
}

function isProductSchema(value: Record<string, unknown>): boolean {
  const type = value["@type"];
  return (typeof type === "string" && type.toLowerCase() === "product")
    || (Array.isArray(type) && type.some((item) => typeof item === "string" && item.toLowerCase() === "product"));
}

function fromSchemaProduct(
  value: Record<string, unknown>,
  pageUrl: string,
): ProductCandidate | null {
  const name = cleanText(typeof value.name === "string" ? value.name : "");
  if (!name) return null;
  const offers = Array.isArray(value.offers) ? value.offers[0] : value.offers;
  const offer = offers && typeof offers === "object" ? offers as Record<string, unknown> : undefined;
  const brand = value.brand && typeof value.brand === "object"
    ? cleanText(String((value.brand as Record<string, unknown>).name || ""))
    : typeof value.brand === "string"
      ? cleanText(value.brand)
      : "";
  const page = new URL(pageUrl);
  const rawUrl = typeof value.url === "string"
    ? value.url
    : typeof offer?.url === "string"
      ? offer.url
      : "";
  if (!rawUrl && !productPath(page.pathname)) return null;
  let productUrl: string;
  try {
    productUrl = rawUrl ? new URL(rawUrl, pageUrl).href : pageUrl;
  } catch {
    return null;
  }
  return {
    name,
    productType: brand,
    description: cleanText(typeof value.description === "string" ? value.description : ""),
    price: cleanText(String(offer?.price || "")),
    url: productUrl,
  };
}

function readSchemaProducts(doc: Document, pageUrl: string): ProductCandidate[] {
  const records: Record<string, unknown>[] = [];
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      records.push(...flattenJsonLd(JSON.parse(script.textContent || "")));
    } catch {
      // One malformed JSON-LD block should not hide other product cards.
    }
  }
  return records
    .filter(isProductSchema)
    .map((record) => fromSchemaProduct(record, pageUrl))
    .filter((product): product is ProductCandidate => product !== null);
}

function productPath(pathname: string): boolean {
  return /(?:^|\/)(?:products?|items?|p)\/[^/]+/i.test(pathname)
    && !/\.json$/i.test(pathname);
}

function productCardFor(anchor: HTMLAnchorElement): Element {
  const pageOrigin = new URL(anchor.href).origin;
  let parent = anchor.parentElement;
  while (parent && parent.tagName !== "BODY") {
    const classes = typeof parent.className === "string" ? parent.className : "";
    const resemblesCard = parent.hasAttribute("data-product")
      || /product[-_ ]?(card|item)|product__item/i.test(classes)
      || ["ARTICLE", "LI"].includes(parent.tagName);
    if (resemblesCard) {
      const productLinks = [...parent.querySelectorAll<HTMLAnchorElement>("a[href]")]
        .filter((link) => {
          try {
            const url = new URL(link.href);
            return url.origin === pageOrigin && productPath(url.pathname);
          } catch {
            return false;
          }
        });
      if (productLinks.length <= 1) return parent;
    }
    parent = parent.parentElement;
  }
  return anchor;
}

function readCardProducts(doc: Document, pageUrl: string): ProductCandidate[] {
  const page = new URL(pageUrl);
  const candidates = new Map<string, ProductCandidate>();
  for (const anchor of doc.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    let productUrl: URL;
    try {
      productUrl = new URL(anchor.getAttribute("href") || "", pageUrl);
    } catch {
      continue;
    }
    if (productUrl.origin !== page.origin || !productPath(productUrl.pathname)) continue;
    productUrl.hash = "";
    productUrl.search = "";

    const card = productCardFor(anchor);
    const nameElement = card.querySelector(
      '[itemprop="name"], h2, h3, h4, [class*="product-title"], [class*="product-name"], [class*="title"]',
    );
    const imageAlt = card.querySelector("img[alt]")?.getAttribute("alt") || "";
    const name = cleanText(
      nameElement?.textContent
      || anchor.getAttribute("aria-label")
      || anchor.textContent
      || imageAlt,
      240,
    );
    if (!name) continue;

    const descriptionElement = card.querySelector(
      '[itemprop="description"], [class*="description"], p',
    );
    const cardText = cleanText(card.textContent, 1_500);
    const description = cleanText(descriptionElement?.textContent || cardText);
    const priceElement = card.querySelector('[itemprop="price"], [class*="price"]');
    const price = cleanText(
      priceElement?.getAttribute("content")
      || priceElement?.textContent,
      120,
    );
    const type = cleanText(card.getAttribute("data-product-type") || "", 120);

    candidates.set(productUrl.href, {
      name,
      productType: type,
      description,
      price,
      url: productUrl.href,
    });
  }
  return [...candidates.values()];
}

function paginationLinks(doc: Document, pageUrl: string, origin: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  const currentPath = new URL(pageUrl).pathname.replace(/\/page\/\d+\/?$/i, "").replace(/\/+$/, "");
  for (const anchor of doc.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    const label = cleanText(
      `${anchor.textContent || ""} ${anchor.getAttribute("aria-label") || ""} ${anchor.getAttribute("rel") || ""}`,
      160,
    ).toLowerCase();
    let next: URL;
    try {
      next = new URL(anchor.getAttribute("href") || "", pageUrl);
    } catch {
      continue;
    }
    if (next.origin !== origin) continue;
    const nextBasePath = next.pathname.replace(/\/page\/\d+\/?$/i, "").replace(/\/+$/, "");
    if (nextBasePath !== currentPath) continue;
    const hasPageParameter = ["page", "paged", "p", "pg", "offset", "start"].some((key) => {
      const value = next.searchParams.get(key);
      return value !== null && /^\d+$/.test(value);
    });
    const hasPagePath = /\/page\/\d+\/?$/i.test(next.pathname);
    const isNext = /\b(next|older)\b|[›»→]/i.test(label);
    if (!hasPageParameter && !hasPagePath && !isNext) continue;
    next.hash = "";
    if (seen.has(next.href)) continue;
    seen.add(next.href);
    links.push(next.href);
  }
  return links;
}

function mergeDetails(
  card: ProductCandidate,
  details: ProductCandidate | null,
): ProductCandidate {
  if (!details) return card;
  return {
    ...card,
    name: details.name || card.name,
    productType: details.productType || card.productType,
    description: details.description || card.description,
    price: details.price || card.price,
  };
}

export function parseCollectionHtml(html: string, pageUrl: string): {
  products: ProductCandidate[];
  pagination: string[];
  hasDynamicLoadMore: boolean;
} {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const origin = new URL(pageUrl).origin;
  const structuredProducts = readSchemaProducts(doc, pageUrl)
    .filter((product) => {
      try {
        return new URL(product.url, pageUrl).origin === origin;
      } catch {
        return false;
      }
    });
  const cards = readCardProducts(doc, pageUrl);
  const products = new Map<string, ProductCandidate>();
  for (const product of [...structuredProducts, ...cards]) {
    const url = new URL(product.url, pageUrl);
    url.hash = "";
    url.search = "";
    if (!products.has(url.href)) products.set(url.href, { ...product, url: url.href });
  }
  return {
    products: [...products.values()],
    pagination: paginationLinks(doc, pageUrl, origin),
    hasDynamicLoadMore: [...doc.querySelectorAll("button, a, [role='button']")].some((element) => {
      const label = cleanText(
        `${element.textContent || ""} ${element.getAttribute("aria-label") || ""}`,
        100,
      );
      return /\b(load|show)\s+more(?:\s+products?)?\b/i.test(label);
    }) || Boolean(doc.querySelector("[data-infinite-scroll], [data-infinite-load]")),
  };
}

function readShopifyFeed(payload: unknown, origin: string): ProductCandidate[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { products?: unknown }).products)) {
    throw new Error("This store did not return a Shopify product feed.");
  }
  const feed = (payload as { products: Array<Record<string, unknown>> }).products;
  return feed.flatMap((product) => {
    const name = cleanText(typeof product.title === "string" ? product.title : "", 240);
    const handle = typeof product.handle === "string" ? product.handle : "";
    if (!name || !handle) return [];
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const firstVariant = variants[0] as Record<string, unknown> | undefined;
    const url = new URL(`/products/${encodeURIComponent(handle)}`, origin).href;
    return [{
      name,
      productType: cleanText(typeof product.product_type === "string" ? product.product_type : "", 120),
      description: htmlToText(product.body_html),
      price: cleanText(String(firstVariant?.price || ""), 120),
      url,
    }];
  });
}

function parseProductPage(html: string, pageUrl: string): ProductCandidate | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const origin = new URL(pageUrl).origin;
  const product = readSchemaProducts(doc, pageUrl).find((candidate) => {
    try {
      return new URL(candidate.url, pageUrl).origin === origin;
    } catch {
      return false;
    }
  });
  if (product) return product;

  const title = cleanText(
    doc.querySelector("h1")?.textContent
    || doc.querySelector('meta[property="og:title"]')?.getAttribute("content")
    || doc.title,
    240,
  );
  if (!title) return null;
  return {
    name: title,
    productType: "",
    description: cleanText(
      doc.querySelector('meta[name="description"]')?.getAttribute("content")
      || doc.querySelector('meta[property="og:description"]')?.getAttribute("content"),
    ),
    price: cleanText(doc.querySelector('[itemprop="price"]')?.getAttribute("content"), 120),
    url: pageUrl,
  };
}

export function deduplicateProducts(products: ProductCandidate[]): ProductCandidate[] {
  const seenUrls = new Set<string>();
  const seenNames = new Set<string>();
  const unique: ProductCandidate[] = [];
  for (const product of products) {
    const normalizedUrl = new URL(product.url);
    normalizedUrl.hash = "";
    normalizedUrl.search = "";
    const urlKey = normalizedUrl.href.replace(/\/+$/, "").toLowerCase();
    const nameKey = product.name.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (!nameKey || seenUrls.has(urlKey) || seenNames.has(nameKey)) continue;
    seenUrls.add(urlKey);
    seenNames.add(nameKey);
    unique.push(product);
  }
  return unique;
}

async function collectShopifyCollection(
  collectionUrl: string,
  signal: AbortSignal,
  onProgress: (message: string) => void,
): Promise<ProductCandidate[]> {
  const collection = new URL(collectionUrl);
  const path = collection.pathname.replace(/\/+$/, "");
  const products: ProductCandidate[] = [];

  for (let page = 1; page <= MAX_PAGES_PER_COLLECTION; page++) {
    const feedUrl = new URL(`${path}/products.json`, collection.origin);
    feedUrl.searchParams.set("limit", "250");
    feedUrl.searchParams.set("page", String(page));
    onProgress(`Reading Shopify product feed, page ${page}…`);
    let raw: string;
    try {
      raw = await fetchPage(feedUrl.href, collection.origin, signal);
    } catch (error) {
      if (products.length > 0) {
        throw new IncompleteShopifyFeedError(
          `The Shopify feed stopped after ${products.length} products. No partial result was used.`,
        );
      }
      throw error;
    }
    let feed: unknown;
    try {
      feed = JSON.parse(raw);
    } catch {
      if (products.length > 0) {
        throw new IncompleteShopifyFeedError(
          `The Shopify feed became unreadable after ${products.length} products. No partial result was used.`,
        );
      }
      throw new Error("This store's Shopify product feed was not readable.");
    }
    let pageProducts: ProductCandidate[];
    try {
      pageProducts = readShopifyFeed(feed, collection.origin);
    } catch (error) {
      if (products.length > 0) {
        throw new IncompleteShopifyFeedError(
          `The Shopify feed became invalid after ${products.length} products. No partial result was used.`,
        );
      }
      throw error;
    }
    if (pageProducts.length === 0) {
      if (page === 1) throw new Error("No products were returned by the Shopify feed.");
      return deduplicateProducts(products);
    }
    products.push(...pageProducts);
    if (products.length > MAX_PRODUCTS_PER_COLLECTION) {
      throw new CollectionSafetyLimitError(`This collection exceeds the ${MAX_PRODUCTS_PER_COLLECTION.toLocaleString()}-product safety limit.`);
    }
    if (pageProducts.length < 250) return deduplicateProducts(products);
  }

  throw new CollectionSafetyLimitError(`This collection exceeds the ${MAX_PAGES_PER_COLLECTION}-page safety limit.`);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  signal: AbortSignal,
  run: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      if (signal.aborted) throw new Error("Collection cancelled.");
      const index = next++;
      output[index] = await run(items[index], index);
    }
  });
  await Promise.all(workers);
  return output;
}

async function collectGenericCollection(
  collectionUrl: string,
  signal: AbortSignal,
  onProgress: (message: string) => void,
): Promise<CollectionResult> {
  const origin = new URL(collectionUrl).origin;
  const queue = [collectionUrl];
  const visitedPages = new Set<string>();
  const products: ProductCandidate[] = [];
  const warnings: string[] = [];

  while (queue.length > 0) {
    if (visitedPages.size >= MAX_PAGES_PER_COLLECTION) {
      throw new Error(`This collection exceeds the ${MAX_PAGES_PER_COLLECTION}-page safety limit.`);
    }
    const pageUrl = queue.shift()!;
    if (visitedPages.has(pageUrl)) continue;
    visitedPages.add(pageUrl);
    onProgress(`Reading collection page ${visitedPages.size}…`);
    const html = await fetchPage(pageUrl, origin, signal);
    const parsed = parseCollectionHtml(html, pageUrl);
    if (parsed.hasDynamicLoadMore) {
      throw new Error("This collection uses a JavaScript load-more control. No partial result was produced; use a collection with pagination or provide its product-page URLs.");
    }
    products.push(...parsed.products);
    if (products.length > MAX_PRODUCTS_PER_COLLECTION) {
      throw new CollectionSafetyLimitError(`This collection exceeds the ${MAX_PRODUCTS_PER_COLLECTION.toLocaleString()}-product safety limit.`);
    }
    for (const nextPage of parsed.pagination) {
      if (!visitedPages.has(nextPage) && !queue.includes(nextPage)) queue.push(nextPage);
    }
  }

  const uniqueProducts = deduplicateProducts(products);
  if (uniqueProducts.length === 0) {
    throw new Error("No product cards were found. Enter a collection or category page that lists products.");
  }

  const needsDetails = uniqueProducts.filter((product) => product.description.length < 80);
  const detailProducts = needsDetails.slice(0, MAX_DETAIL_REQUESTS);
  if (needsDetails.length > detailProducts.length) {
    warnings.push(`${needsDetails.length - detailProducts.length} products had only listing-page details.`);
  }
  if (detailProducts.length > 0) {
    let completed = 0;
    let failedDetails = 0;
    const detailed = await mapWithConcurrency(detailProducts, 4, signal, async (product) => {
      try {
        const html = await fetchPage(product.url, origin, signal);
        return mergeDetails(product, parseProductPage(html, product.url));
      } catch (error) {
        if (signal.aborted) throw error;
        failedDetails += 1;
        return product;
      } finally {
        completed += 1;
        onProgress(`Checking product details (${completed}/${detailProducts.length})…`);
      }
    });
    const detailsByUrl = new Map(detailProducts.map((product, index) => [product.url, detailed[index]]));
    if (failedDetails > 0) {
      warnings.push(`${failedDetails} product detail page${failedDetails === 1 ? " was" : "s were"} unavailable; listing information was used.`);
    }
    return {
      products: uniqueProducts.map((product) => detailsByUrl.get(product.url) || product),
      warnings,
    };
  }

  return { products: uniqueProducts, warnings };
}

async function collectOneCollection(
  collectionUrl: string,
  signal: AbortSignal,
  onProgress: (message: string) => void,
): Promise<CollectionResult> {
  const url = new URL(collectionUrl);
  if (productPath(url.pathname)) {
    onProgress("Reading the provided product page…");
    const html = await fetchPage(url.href, url.origin, signal);
    const product = parseProductPage(html, url.href);
    if (!product) throw new Error("No product details were found on this product page.");
    return { products: [product], warnings: [] };
  }

  if (/\/collections\/[^/]+/i.test(url.pathname)) {
    try {
      const products = await collectShopifyCollection(collectionUrl, signal, onProgress);
      return { products, warnings: [] };
    } catch (error) {
      if (signal.aborted) throw error;
      if (error instanceof CollectionSafetyLimitError || error instanceof IncompleteShopifyFeedError) {
        throw error;
      }
      onProgress("Shopify feed unavailable; reading the collection page instead…");
    }
  }

  return collectGenericCollection(collectionUrl, signal, onProgress);
}

export async function collectProductsFromUrls(
  urls: string[],
  signal: AbortSignal,
  onProgress: (message: string, completed: number, total: number) => void,
): Promise<CollectionResult> {
  if (urls.length > MAX_COLLECTION_URLS) {
    throw new Error(`A run can check up to ${MAX_COLLECTION_URLS} collection URLs.`);
  }
  const products: ProductCandidate[] = [];
  const warnings: string[] = [];
  for (let index = 0; index < urls.length; index++) {
    onProgress(`Reading collection ${index + 1} of ${urls.length}…`, index, urls.length);
    const result = await collectOneCollection(
      urls[index],
      signal,
      (message) => onProgress(message, index + 0.5, urls.length),
    );
    products.push(...result.products);
    if (deduplicateProducts(products).length > MAX_PRODUCTS_PER_RUN) {
      throw new Error(`A run can check up to ${MAX_PRODUCTS_PER_RUN.toLocaleString()} unique products.`);
    }
    warnings.push(...result.warnings);
    onProgress(`Read collection ${index + 1} of ${urls.length}.`, index + 1, urls.length);
  }

  const uniqueProducts = deduplicateProducts(products);
  if (uniqueProducts.length === 0) throw new Error("No products were found in the provided URLs.");
  return { products: uniqueProducts, warnings: [...new Set(warnings)] };
}
