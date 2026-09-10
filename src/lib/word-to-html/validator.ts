/**
 * HTML Validator
 * Validates that all features from each output format are working correctly
 */

import type { OutputMode, FeatureFlags } from './converter';
import { resolveFeatures } from './mode-processor';
import { ALLOWED_ELEMENTS as SANITIZED_ELEMENTS, getStructuralIssues, isSafeUrl } from './html-sanitizer';
import { isSpacingParagraph as isAnySpacingElement, isBrSpacingParagraph as isBrSpacingElement } from './html-spacing';
import { getHeadingSpacingIssues } from './mode-spacing';
import { isReadMoreParagraph, isSourcesParagraph } from './mode-br-spacing';

/**
 * Centralized feature flag check with explicit defaults
 * Prevents logic drift and makes behavior explicit
 */
function isFeatureEnabled(
  features: FeatureFlags | undefined,
  key: keyof FeatureFlags,
  defaultValue: boolean
): boolean {
  const value = features?.[key];
  return value === undefined ? defaultValue : value;
}

const ALLOWED_ELEMENTS = new Set(SANITIZED_ELEMENTS);

/**
 * Attributes the sanitizer always strips, regardless of element.
 */
const ALWAYS_BANNED_ATTRIBUTES = new Set([
  'style', 'class', 'id', 'dir', 'role', 'aria-level',
]);

/**
 * Attribute prefixes the sanitizer always strips.
 */
const BANNED_ATTRIBUTE_PREFIXES = ['data-', 'on'];

/**
 * Allowed `rel` values on anchor tags after sanitization.
 */
const SAFE_REL_VALUES = new Set([
  'nofollow',
  'noopener',
  'noreferrer',
  'noopener,noreferrer',
]);

interface KeyTakeawaysSection {
  heading: Element;
  list: Element;
}

function findKeyTakeawaysSection(doc: Document): KeyTakeawaysSection | null {
  const headings = doc.querySelectorAll('h2');
  let keyTakeawaysHeading: Element | null = null;

  for (const heading of Array.from(headings)) {
    const text = heading.textContent?.trim() || '';
    if (text.toLowerCase().includes('key takeaways')) {
      keyTakeawaysHeading = heading;
      break;
    }
  }

  if (!keyTakeawaysHeading) {
    return null;
  }

  let nextSibling = keyTakeawaysHeading.nextElementSibling;
  while (nextSibling && nextSibling.tagName.toLowerCase() !== 'ul') {
    nextSibling = nextSibling.nextElementSibling;
  }

  if (!nextSibling || nextSibling.tagName.toLowerCase() !== 'ul') {
    return null;
  }

  return { heading: keyTakeawaysHeading, list: nextSibling };
}

interface SourcesSection {
  paragraph: Element;
  list: Element;
}

/**
 * Locates the Sources paragraph and its companion ordered list.
 * Returns null when no Sources paragraph exists.
 */
function findSourcesSection(doc: Document): SourcesSection | null {
  const paragraphs = doc.querySelectorAll('p');

  let sourcesParagraph: Element | null = null;
  for (const p of Array.from(paragraphs)) {
    const text = p.textContent?.trim().toLowerCase() || '';
    if (text === 'sources' || text === 'sources:' || text.startsWith('sources:')) {
      sourcesParagraph = p;
      break;
    }
  }

  if (!sourcesParagraph) {
    return null;
  }

  let nextSibling = sourcesParagraph.nextElementSibling;
  while (nextSibling && nextSibling.tagName.toLowerCase() !== 'ol') {
    nextSibling = nextSibling.nextElementSibling;
  }

  if (!nextSibling || nextSibling.tagName.toLowerCase() !== 'ol') {
    return null;
  }

  return { paragraph: sourcesParagraph, list: nextSibling };
}

function findDisclaimerSection(doc: Document): { paragraph: Element } | null {
  const paragraphs = doc.querySelectorAll('p');
  for (const p of Array.from(paragraphs)) {
    const text = (p.textContent || '').trim().toLowerCase();
    if (text.startsWith('disclaimer')) {
      return { paragraph: p };
    }
  }
  return null;
}

/**
 * Blank non-BR paragraphs include ordinary whitespace and wrapped Word spaces.
 */
function isNbspSpacingElement(element: Element | null): boolean {
  return isAnySpacingElement(element) && !isBrSpacingElement(element);
}

/**
 * Helper: Locate the next non-spacing element after `from` within its parent.
 * Walks through text-node whitespace and <p>&nbsp;</p> / <p><br></p> spacers
 * so validators don't false-pass when a node is hidden behind inserted spacing.
 */
function nextNonSpacingElement(from: Element): Element | null {
  let node: Element | null = from.nextElementSibling;
  while (node) {
    if (!isAnySpacingElement(node)) {
      return node;
    }
    node = node.nextElementSibling;
  }
  return null;
}

export interface TestResult {
  /** Stable rule identifier for programmatic access (e.g., 'heading-strong', 'spacing-rules') */
  ruleId: string;
  /** Human-readable feature name for display */
  feature: string;
  mode: OutputMode;
  passed: boolean;
  message: string;
  /** Severity level: error (must fix), warning (should fix), info (informational) */
  severity?: 'error' | 'warning' | 'info';
  /** Expected state (what should be true) - enables better UI explanations */
  expected?: string;
  /** Actual state (what was found) - enables better UI explanations */
  actual?: string;
  details?: string[] | null;
}

export interface ValidationResults {
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    byMode: {
      regular: { total: number; passed: number; failed: number };
      blogs: { total: number; passed: number; failed: number };
      shoppables: { total: number; passed: number; failed: number };
    };
    /** Grouped by feature/rule for easier analysis */
    byFeature: Record<string, { passed: number; failed: number }>;
  };
}

class ValidationResultsImpl implements ValidationResults {
  results: TestResult[] = [];
  summary = {
    total: 0,
    passed: 0,
    failed: 0,
    byMode: {
      regular: { total: 0, passed: 0, failed: 0 },
      blogs: { total: 0, passed: 0, failed: 0 },
      shoppables: { total: 0, passed: 0, failed: 0 },
    },
    byFeature: {} as Record<string, { passed: number; failed: number }>,
  };

  addResult(result: TestResult) {
    this.results.push(result);
    this.summary.total++;
    this.summary.byMode[result.mode].total++;

    if (!this.summary.byFeature[result.ruleId]) {
      this.summary.byFeature[result.ruleId] = { passed: 0, failed: 0 };
    }

    if (result.passed) {
      this.summary.passed++;
      this.summary.byMode[result.mode].passed++;
      this.summary.byFeature[result.ruleId].passed++;
    } else {
      this.summary.failed++;
      this.summary.byMode[result.mode].failed++;
      this.summary.byFeature[result.ruleId].failed++;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Sanitizer coverage                                                  */
/* ------------------------------------------------------------------ */

function validateSanitizedStructure(doc: Document, mode: OutputMode): TestResult {
  const issues = getStructuralIssues(doc.body).map(issue => issue.message);

  const sourcesList = findSourcesSection(doc)?.list ?? null;

  const allElements = doc.body.querySelectorAll('*');
  allElements.forEach((el) => {
    const tagName = el.tagName.toLowerCase();
    if (!ALLOWED_ELEMENTS.has(tagName)) {
      issues.push(`Disallowed element <${tagName}> present`);
    }

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (ALWAYS_BANNED_ATTRIBUTES.has(name)) {
        if (isAllowedSourcesItalicStyle(el, attr, sourcesList)) {
          continue;
        }
        issues.push(`Banned attribute "${name}" on <${tagName}>`);
        continue;
      }
      if (BANNED_ATTRIBUTE_PREFIXES.some((p) => name.startsWith(p))) {
        issues.push(`Banned attribute "${name}" on <${tagName}>`);
      }
    }
  });

  return {
    ruleId: 'sanitized-structure',
    feature: 'Sanitized Structure',
    mode,
    passed: issues.length === 0,
    message:
      issues.length === 0
        ? 'No disallowed elements or banned attributes'
        : `${issues.length} sanitizer issue(s) found`,
    severity: issues.length === 0 ? 'info' : 'error',
    expected: 'Only allowed elements (h1-h6, p, br, ul/ol/li, em, strong, u, sup, sub, a, img, blockquote, pre, code, table*) and no banned attributes (style/class/id/dir/role/aria-level/data-*/on*), except style="font-style: italic" on Sources <li>',
    actual: issues.length === 0
      ? 'Document structure matches sanitizer allowlist'
      : `${issues.length} issue(s) found`,
    details: issues.length > 0 ? issues : null,
  };
}

/**
 * Strict allowlist exception for the converter-produced Sources <li> italic
 * style. Accepts only `font-style: italic` (trimmed, lowercased) on an <li>
 * whose ancestor <ol> is the Sources section. Any other value or mixed
 * declarations still fail.
 */
function isAllowedSourcesItalicStyle(el: Element, attr: Attr, sourcesList: Element | null): boolean {
  if (!sourcesList) return false;
  if (el.tagName.toLowerCase() !== 'li') return false;
  if (!sourcesList.contains(el)) return false;
  if (attr.name.toLowerCase() !== 'style') return false;
  return attr.value.trim().toLowerCase() === 'font-style: italic';
}

function validateLinkSafety(doc: Document, mode: OutputMode): TestResult {
  const links = doc.querySelectorAll('a[href]');
  const issues: string[] = [];

  links.forEach((link, index) => {
    const href = link.getAttribute('href') || '';
    const label = href.length > 40 ? `${href.substring(0, 40)}...` : href || '(empty)';

    if (!isSafeUrl(href)) {
      issues.push(`Link ${index + 1} uses unsafe protocol or invalid URL: ${label}`);
    }

    const target = link.getAttribute('target');
    if (target === '_blank') {
      const rel = (link.getAttribute('rel') || '').toLowerCase();
      const hasNoopener = /\bnoopener\b/.test(rel);
      if (!hasNoopener) {
        issues.push(`Link ${index + 1} opens in new window but is missing noopener: ${label}`);
      }
    }

    const relAttr = link.getAttribute('rel');
    if (relAttr !== null) {
      const parts = relAttr.toLowerCase().split(/\s+/).filter((p) => p.length > 0);
      const invalidParts = parts.filter((p) => !SAFE_REL_VALUES.has(p));
      if (invalidParts.length > 0) {
        issues.push(`Link ${index + 1} has unsafe rel value(s): ${invalidParts.join(', ')}`);
      }
    }
  });

  return {
    ruleId: 'link-safety',
    feature: 'Link Safety',
    mode,
    passed: issues.length === 0,
    message:
      issues.length === 0
        ? 'All links use safe protocols and rel values'
        : `${issues.length} link safety issue(s) found`,
    severity: issues.length === 0 ? 'info' : 'error',
    expected: 'Links use only http(s)/mailto/# anchors; _blank links always have noopener',
    actual: issues.length === 0
      ? 'All links safe'
      : `${issues.length} issue(s) found`,
    details: issues.length > 0 ? issues : null,
  };
}

function validateBasicStructure(doc: Document, mode: OutputMode): TestResult {
  if (mode !== 'regular') {
    return {
      ruleId: 'basic-structure',
      feature: 'Basic HTML Structure',
      mode,
      passed: true,
      message: 'Basic structure validation not required for this mode',
      severity: 'info',
    };
  }

  const hasContent = doc.body && doc.body.innerHTML.trim().length > 0;
  const hasValidElements = doc.body && doc.body.children.length > 0;

  return {
    ruleId: 'basic-structure',
    feature: 'Basic HTML Structure',
    mode,
    passed: !!(hasContent && hasValidElements),
    message:
      hasContent && hasValidElements
        ? 'HTML structure is valid'
        : 'HTML structure is invalid or empty',
    severity: hasContent && hasValidElements ? 'info' : 'error',
  };
}

/* ------------------------------------------------------------------ */
/* Heading & key takeaways                                            */
/* ------------------------------------------------------------------ */

function validateHeadingStrong(doc: Document, mode: OutputMode, features?: FeatureFlags): TestResult {
  const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');

  if (headings.length === 0) {
    return {
      ruleId: 'heading-strong',
      feature: 'Heading Strong Tags',
      mode,
      passed: true,
      message: 'No headings found (skipped)',
      severity: 'info',
    };
  }

  function hasOnlyStrongChild(h: Element): boolean {
    const elementChildren = Array.from(h.children);
    return (
      elementChildren.length === 1 &&
      elementChildren[0].tagName.toLowerCase() === 'strong' &&
      Array.from(h.childNodes).every(node => node === elementChildren[0] || !node.textContent?.trim())
    );
  }

  if (mode === 'regular' && !features?.headingStrong) {
    const hasStrongWrapped = Array.from(headings).some(hasOnlyStrongChild);
    return {
      ruleId: 'heading-strong',
      feature: 'Heading Strong Tags',
      mode,
      passed: !hasStrongWrapped,
      message: hasStrongWrapped
        ? 'Headings should not be wrapped in <strong> in regular mode'
        : 'Headings correctly not wrapped in <strong>',
      severity: hasStrongWrapped ? 'error' : 'info',
    };
  }

  const isEnabled = isFeatureEnabled(features, 'headingStrong', true);

  if (!isEnabled) {
    const wrappedHeadings = Array.from(headings).filter(hasOnlyStrongChild);

    return {
      ruleId: 'heading-strong',
      feature: 'Heading Strong Tags',
      mode,
      passed: wrappedHeadings.length === 0,
      message:
        wrappedHeadings.length === 0
          ? 'Headings correctly not wrapped in <strong> (feature disabled)'
          : `Found ${wrappedHeadings.length} heading(s) wrapped in <strong> (should not be wrapped)`,
      severity: wrappedHeadings.length === 0 ? 'info' : 'error',
    };
  }

  const allWrapped = Array.from(headings).every(hasOnlyStrongChild);
  const wrappedCount = Array.from(headings).filter(hasOnlyStrongChild).length;
  const unwrappedCount = headings.length - wrappedCount;

  return {
    ruleId: 'heading-strong',
    feature: 'Heading Strong Tags',
    mode,
    passed: allWrapped,
    message: allWrapped
      ? 'All headings wrapped in <strong>'
      : `Found ${unwrappedCount} heading(s) without <strong> wrapper`,
    severity: allWrapped ? 'info' : 'error',
    expected: 'All headings wrapped in <strong>',
    actual: allWrapped
      ? 'All headings wrapped correctly'
      : `${unwrappedCount} of ${headings.length} headings missing wrapper`,
  };
}

function validateKeyTakeaways(doc: Document, mode: OutputMode, features?: FeatureFlags): TestResult {
  if (mode === 'regular') {
    return {
      ruleId: 'key-takeaways',
      feature: 'Key Takeaways Formatting',
      mode,
      passed: true,
      message: 'Key Takeaways formatting is a blogs/shoppables feature (skipped)',
      severity: 'info',
    };
  }
  if (mode === 'shoppables') {
    return {
      ruleId: 'key-takeaways',
      feature: 'Key Takeaways Formatting',
      mode,
      passed: true,
      message: 'Key Takeaways formatting not required for this mode',
      severity: 'info',
    };
  }

  const section = findKeyTakeawaysSection(doc);

  if (!section) {
    return {
      ruleId: 'key-takeaways',
      feature: 'Key Takeaways Formatting',
      mode,
      passed: true,
      message: 'No Key Takeaways section found (skipped)',
      severity: 'info',
    };
  }

  /* Also validate the heading itself was normalized. */
  const headingIssues: string[] = [];
  const headingText = section.heading.textContent?.trim() || '';
  if (!headingText.endsWith(':')) {
    headingIssues.push(`Heading missing trailing colon: "${headingText.substring(0, 40)}"`);
  }
  const headingEmCount = section.heading.querySelectorAll('em').length;
  if (headingEmCount > 0) {
    headingIssues.push(`Heading still contains ${headingEmCount} <em> tag(s) (should be removed)`);
  }

  const listItems = section.list.querySelectorAll('li');
  const itemsWithEm = Array.from(listItems).filter((li) => li.querySelector('em'));
  const hasEmTags = itemsWithEm.length > 0;
  const isEnabled = isFeatureEnabled(features, 'keyTakeaways', true);

  if (!isEnabled) {
    const issues = [...headingIssues];
    if (!hasEmTags) {
      issues.push('No <em> tags in Key Takeaways list (should be present when feature is disabled)');
    }
    return {
      ruleId: 'key-takeaways',
      feature: 'Key Takeaways Formatting',
      mode,
      passed: issues.length === 0,
      message:
        issues.length === 0
          ? 'Key Takeaways correctly preserved (feature disabled)'
          : `${issues.length} issue(s) found`,
      severity: issues.length === 0 ? 'info' : 'error',
      details: issues.length > 0 ? issues : null,
    };
  }

  /* Feature enabled — <em> tags should be removed and heading should end with :. */
  const issues = [...headingIssues];
  if (hasEmTags) {
    issues.push(`Found ${itemsWithEm.length} <em> tag(s) in Key Takeaways list (should be removed)`);
  }

  return {
    ruleId: 'key-takeaways',
    feature: 'Key Takeaways Formatting',
    mode,
    passed: issues.length === 0,
    message:
      issues.length === 0
        ? 'Key Takeaways correctly formatted'
        : `${issues.length} issue(s) found`,
    severity: issues.length === 0 ? 'info' : 'error',
    expected: 'Heading ends with ":" and contains no <em>; list items contain no <em>',
    actual: issues.length === 0
      ? 'Key Takeaways correctly formatted'
      : `${issues.length} issue(s) found`,
    details: issues.length > 0 ? issues : null,
  };
}

function validateH1AfterKeyTakeaways(doc: Document, mode: OutputMode, features?: FeatureFlags): TestResult {
  if (mode === 'regular') {
    return {
      ruleId: 'h1-after-key-takeaways',
      feature: 'H1 Removal',
      mode,
      passed: true,
      message: 'H1 removal is a blogs/shoppables feature (skipped)',
      severity: 'info',
    };
  }
  if (mode === 'shoppables') {
    return {
      ruleId: 'h1-after-key-takeaways',
      feature: 'H1 Removal',
      mode,
      passed: true,
      message: 'H1 removal not required for this mode',
      severity: 'info',
    };
  }

  const section = findKeyTakeawaysSection(doc);

  if (!section) {
    return {
      ruleId: 'h1-after-key-takeaways',
      feature: 'H1 Removal',
      mode,
      passed: true,
      message: 'No Key Takeaways section found (skipped)',
      severity: 'info',
    };
  }

  /* Walk past any spacing elements (added after the H1 removal pass) so a
   * leftover H1 hiding behind a <p>&nbsp;</p> is still detected. */
  const elementAfterUl = nextNonSpacingElement(section.list);
  const hasH1After = elementAfterUl?.tagName.toLowerCase() === 'h1';

  const isEnabled = isFeatureEnabled(features, 'h1Removal', true);

  if (!isEnabled) {
    return {
      ruleId: 'h1-after-key-takeaways',
      feature: 'H1 Removal',
      mode,
      passed: hasH1After,
      message: hasH1After
        ? 'H1 correctly preserved after Key Takeaways (feature disabled)'
        : 'No H1 found after Key Takeaways (should be present when feature is disabled)',
      severity: hasH1After ? 'info' : 'error',
      expected: 'H1 preserved after Key Takeaways (feature disabled)',
      actual: hasH1After ? 'H1 found after Key Takeaways' : 'No H1 found',
    };
  }

  return {
    ruleId: 'h1-after-key-takeaways',
    feature: 'H1 Removal',
    mode,
    passed: !hasH1After,
    message: hasH1After
      ? 'Found H1 after Key Takeaways (should be removed)'
      : 'No H1 after Key Takeaways (correct)',
    severity: !hasH1After ? 'info' : 'error',
    expected: 'No H1 after Key Takeaways',
    actual: hasH1After ? 'H1 found after Key Takeaways' : 'No H1 found',
  };
}

/* ------------------------------------------------------------------ */
/* Links & attributes                                                  */
/* ------------------------------------------------------------------ */

function validateLinkAttributes(doc: Document, mode: OutputMode, features?: FeatureFlags): TestResult {
  if (mode === 'regular') {
    return {
      ruleId: 'link-attributes',
      feature: 'Link Attributes',
      mode,
      passed: true,
      message: 'Link attributes is a blogs/shoppables feature (skipped)',
      severity: 'info',
    };
  }

  const links = doc.querySelectorAll('a[href]');

  if (links.length === 0) {
    return {
      ruleId: 'link-attributes',
      feature: 'Link Attributes',
      mode,
      passed: true,
      message: 'No links found (skipped)',
      severity: 'info',
    };
  }

  const isEnabled = isFeatureEnabled(features, 'linkAttributes', true);

  if (!isEnabled) {
    const linksWithAttributes = Array.from(links).filter((link) => {
      return link.hasAttribute('target') || link.hasAttribute('rel');
    });

    return {
      ruleId: 'link-attributes',
      feature: 'Link Attributes',
      mode,
      passed: linksWithAttributes.length === 0,
      message:
        linksWithAttributes.length === 0
          ? 'Links correctly without target/rel attributes (feature disabled)'
          : `Found ${linksWithAttributes.length} link(s) with target/rel attributes (should not have attributes)`,
      severity: linksWithAttributes.length === 0 ? 'info' : 'error',
    };
  }

  const allHaveAttributes = Array.from(links).every((link) => {
    const hasTarget = link.getAttribute('target') === '_blank';
    const rel = link.getAttribute('rel') || '';
    const hasRel = rel.includes('noopener') && rel.includes('noreferrer');
    return hasTarget && hasRel;
  });

  const missingCount = Array.from(links).filter((link) => {
    const hasTarget = link.getAttribute('target') === '_blank';
    const rel = link.getAttribute('rel') || '';
    const hasRel = rel.includes('noopener') && rel.includes('noreferrer');
    return !hasTarget || !hasRel;
  }).length;

  return {
    ruleId: 'link-attributes',
    feature: 'Link Attributes',
    mode,
    passed: allHaveAttributes,
    message: allHaveAttributes
      ? `All ${links.length} links have target="_blank" rel="noopener noreferrer"`
      : `${missingCount} of ${links.length} links missing required attributes`,
    severity: allHaveAttributes ? 'info' : 'error',
    expected: `All ${links.length} links have target="_blank" rel="noopener noreferrer"`,
    actual: allHaveAttributes
      ? `All ${links.length} links have required attributes`
      : `${missingCount} of ${links.length} links missing required attributes`,
  };
}

function validateRelativePaths(doc: Document, mode: OutputMode, features?: FeatureFlags): TestResult {
  const enabled = isFeatureEnabled(features, 'relativePaths', false);
  if (!enabled) {
    return {
      ruleId: 'relative-paths',
      feature: 'Relative Paths',
      mode,
      passed: true,
      message: 'Relative paths feature disabled (skipped)',
      severity: 'info',
    };
  }

  const links = doc.querySelectorAll('a[href]');

  if (links.length === 0) {
    return {
      ruleId: 'relative-paths',
      feature: 'Relative Paths',
      mode,
      passed: true,
      message: 'No links found (skipped)',
      severity: 'info',
    };
  }

  const absoluteUrls = Array.from(links).filter((link) => {
    const href = link.getAttribute('href');
    if (!href) return false;

    if (
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('javascript:') ||
      href.startsWith('data:')
    ) {
      return false;
    }

    return href.includes('://') || href.startsWith('//');
  });

  return {
    ruleId: 'relative-paths',
    feature: 'Relative Paths',
    mode,
    passed: absoluteUrls.length === 0,
    message:
      absoluteUrls.length === 0
        ? 'All URLs converted to relative paths'
        : `${absoluteUrls.length} absolute URL(s) found (should be converted)`,
    severity: absoluteUrls.length === 0 ? 'info' : 'warning',
    expected: 'All URLs converted to relative paths',
    actual: absoluteUrls.length === 0
      ? `All ${links.length} link(s) use relative paths`
      : `${absoluteUrls.length} of ${links.length} link(s) use absolute URLs`,
  };
}

/**
 * Walk previous siblings (including element nodes) so images and <br> tags
 * immediately before a link are also checked for missing space.
 */
function validateLinkSpacing(doc: Document, mode: OutputMode, features?: FeatureFlags): TestResult {
  const links = doc.querySelectorAll('a[href]');
  const issues: string[] = [];
  const OPENING_PUNCT = /[\("'\[\{\u201C\u2018]$/;
  const TRAILING_PUNCT = /[.,;:!?)}\]\u201D\u2019"']$/;

  links.forEach((link) => {
    const parent = link.parentNode;
    if (!parent) return;

    /* Walk siblings before the link and capture the closest visible text. */
    let previousText = '';
    for (const node of Array.from(parent.childNodes)) {
      if (node === link) break;
      if (node.nodeType === Node.TEXT_NODE) {
        previousText = (node as Text).textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE && node !== link) {
        const text = (node as Element).textContent || '';
        if (text.length > 0) {
          previousText = text;
        }
      }
    }

    if (previousText.length === 0) {
      /* No prior content in the parent — link is at start, no space needed. */
      return;
    }

    const trimmedEnd = previousText.replace(/\s+$/, '');
    if (OPENING_PUNCT.test(trimmedEnd)) {
      return;
    }
    if (TRAILING_PUNCT.test(trimmedEnd)) {
      return;
    }
    const lastChar = previousText.slice(-1);
    if (lastChar !== ' ' && lastChar !== '\u00A0') {
      issues.push(`Missing space before link: "${trimmedEnd.slice(-30)}..."`);
      return;
    }
    if (/^\s{2,}/.test(previousText.slice(-10))) {
      issues.push(`Multiple spaces before link: "${trimmedEnd.slice(-30)}..."`);
    }
  });

  return {
    ruleId: 'link-spacing',
    feature: 'Link Spacing',
    mode,
    passed: issues.length === 0,
    message: issues.length === 0
      ? `Link spacing correctly applied (${links.length} link(s) checked)`
      : `${issues.length} spacing issue(s): ${issues.join('; ')}`,
    severity: issues.length === 0 ? 'info' : 'warning',
    expected: 'Links preceded by space (except after opening/closing punctuation)',
    actual: issues.length === 0
      ? `All ${links.length} link(s) have proper spacing`
      : `${issues.length} link(s) have spacing issues`,
  };
}

/* ------------------------------------------------------------------ */
/* Lists & list items                                                  */
/* ------------------------------------------------------------------ */

/* Also detect trailing &nbsp; before </strong>. */
function trailingSpaceBeforeStrong(html: string): boolean {
  const trimmed = html.trim();
  return trimmed.endsWith(': ') || trimmed.match(/:\s+$/) !== null;
}

function validateListNormalize(doc: Document, mode: OutputMode): TestResult {
  const sourcesSection = findSourcesSection(doc);
  const sourcesOl = sourcesSection?.list ?? null;

  const listItems = doc.querySelectorAll('li');

  if (listItems.length === 0) {
    return {
      ruleId: 'list-normalization',
      feature: 'List Normalization',
      mode,
      passed: true,
      message: 'No list items found (skipped)',
      severity: 'info',
    };
  }

  const issues: string[] = [];

  listItems.forEach((li) => {
    if (sourcesOl && sourcesOl.contains(li)) {
      return;
    }

    const strongTags = li.querySelectorAll('strong');

    strongTags.forEach((strong) => {
      const strongText = strong.textContent || '';

      if (strongText.trim().endsWith(':')) {
        if (trailingSpaceBeforeStrong(strong.innerHTML)) {
          issues.push(
            `List item has trailing space before </strong> in "${strongText.trim().substring(0, 30)}..."`
          );
        }

        const nextNode = strong.nextSibling;

        if (nextNode && nextNode.nodeType === Node.TEXT_NODE) {
          const text = (nextNode as Text).textContent || '';
          if (text.length === 0 || (!text.startsWith(' ') && !text.startsWith('\u00A0'))) {
            issues.push(
              `List item missing space after </strong> in "${strongText.trim().substring(0, 30)}..."`
            );
          } else if (/^\s{2,}/.test(text)) {
            issues.push(
              `List item has multiple spaces after </strong> in "${strongText.trim().substring(0, 30)}..."`
            );
          }
        } else {
          issues.push(
            `List item missing text node with space after </strong> in "${strongText.trim().substring(0, 30)}..."`
          );
        }
      }
    });
  });

  return {
    ruleId: 'list-normalization',
    feature: 'List Normalization',
    mode,
    passed: issues.length === 0,
    message:
      issues.length === 0
        ? 'All list items with colons are properly normalized'
        : `${issues.length} list normalization issue(s) found`,
    severity: issues.length === 0 ? 'info' : 'warning',
    details: issues.length > 0 ? issues : null,
  };
}

function validateOlBoldLabels(doc: Document, mode: OutputMode, features?: FeatureFlags): TestResult {
  if (mode === 'regular') {
    return {
      ruleId: 'ol-bold-labels',
      feature: 'OL Bold Labels',
      mode,
      passed: true,
      message: 'OL bold labels is a blogs/shoppables feature (skipped)',
      severity: 'info',
    };
  }

  const sourcesOlSet = new Set<Element>();
  const sourcesSection = findSourcesSection(doc);
  if (sourcesSection) {
    sourcesOlSet.add(sourcesSection.list);
  }

  const olItems = doc.querySelectorAll('ol > li');
  let itemsWithColon = 0;
  let itemsWithBold = 0;
  let skippedSources = 0;

  olItems.forEach((li) => {
    if (li.parentElement && sourcesOlSet.has(li.parentElement)) {
      skippedSources++;
      return;
    }

    const text = li.textContent || '';
    if (text.includes(':')) {
      itemsWithColon++;
      const strong = li.querySelector('strong');
      if (strong) {
        const strongText = strong.textContent || '';
        if (strongText.includes(':')) {
          itemsWithBold++;
        }
      }
    }
  });

  if (itemsWithColon === 0) {
    return {
      ruleId: 'ol-bold-labels',
      feature: 'OL Bold Labels',
      mode,
      passed: true,
      message: skippedSources > 0
        ? `No ordered list items with colons found (${skippedSources} Sources items skipped)`
        : 'No ordered list items with colons found',
      severity: 'info',
    };
  }

  const passed = itemsWithBold === itemsWithColon;

  return {
    ruleId: 'ol-bold-labels',
    feature: 'OL Bold Labels',
    mode,
    passed,
    message: passed
      ? `${itemsWithBold}/${itemsWithColon} ordered list items have bold labels`
      : `${itemsWithBold}/${itemsWithColon} ordered list items have bold labels (${itemsWithColon - itemsWithBold} missing)`,
    severity: passed ? 'info' : 'warning',
    expected: 'Text before colon in <ol> wrapped in <strong>',
    actual: `${itemsWithBold}/${itemsWithColon} items have bold (${skippedSources} Sources items excluded)`,
  };
}

/* ------------------------------------------------------------------ */
/* Sources & disclaimer                                                */
/* ------------------------------------------------------------------ */

/**
 * Distinguish the label <em> from any body <em>. The Sources label lives as
 * the only direct child of the Sources paragraph's <strong>, not deeper in
 * the body content. We anchor checks against that location.
 */
function validateSourcesNormalize(doc: Document, mode: OutputMode, features?: FeatureFlags): TestResult {
  if (mode === 'regular') {
    return {
      ruleId: 'sources-normalization',
      feature: 'Sources Normalization',
      mode,
      passed: true,
      message: 'Sources normalization is a blogs/shoppables feature (skipped)',
      severity: 'info',
    };
  }

  const section = findSourcesSection(doc);

  if (!section) {
    return {
      ruleId: 'sources-normalization',
      feature: 'Sources Normalization',
      mode,
      passed: true,
      message: 'No Sources section found (skipped)',
      severity: 'info',
    };
  }

  const listItems = section.list.querySelectorAll('li');
  if (listItems.length === 0) {
    return {
      ruleId: 'sources-normalization',
      feature: 'Sources Normalization',
      mode,
      passed: true,
      message: 'Sources paragraph found but <ol> has no items (skipped)',
      severity: 'info',
    };
  }

  const isEnabled = isFeatureEnabled(features, 'sourcesNormalize', true);

  if (!isEnabled) {
    const issues: string[] = [];

    /* Label check: only look at the strong > em structure on the paragraph. */
    const labelStrong = section.paragraph.querySelector(':scope > strong');
    const labelEm = labelStrong?.querySelector(':scope > em');
    const emText = labelEm?.textContent?.trim().toLowerCase() || '';
    if (labelEm && emText === 'sources:') {
      issues.push('Sources paragraph is normalized (should not have <strong><em> structure)');
    }

    listItems.forEach((li, index) => {
      const directEm = Array.from(li.children).find(
        (c) => c.tagName.toLowerCase() === 'em'
      );
      if (directEm) {
        const hasTextOutside = Array.from(li.childNodes).some(
          (node) =>
            node.nodeType === Node.TEXT_NODE &&
            (node as Text).textContent?.trim()
        );
        if (!hasTextOutside) {
          issues.push(`List item ${index + 1} is wrapped in <em> tag (should not be normalized)`);
        }
      }
    });

    return {
      ruleId: 'sources-normalization',
      feature: 'Sources Normalization',
      mode,
      passed: issues.length === 0,
      message:
        issues.length === 0
          ? 'Sources section correctly not normalized (feature disabled)'
          : `${issues.length} normalization issue(s) found: ${issues.join('; ')}`,
      severity: issues.length === 0 ? 'info' : 'error',
      details: issues.length > 0 ? issues : null,
    };
  }

  const issues: string[] = [];

  const labelStrong = section.paragraph.querySelector(':scope > strong');
  const labelEm = labelStrong?.querySelector(':scope > em');
  if (!labelStrong) {
    issues.push('Sources paragraph missing <strong> tag');
  } else if (!labelEm) {
    issues.push('Sources paragraph missing <em> tag inside <strong>');
  } else {
    const emText = labelEm.textContent?.trim().toLowerCase() || '';
    if (emText !== 'sources:') {
      issues.push(
        `Sources <em> tag should contain "Sources:" but found "${labelEm.textContent?.trim()}"`
      );
    }
  }

  listItems.forEach((li, index) => {
    const directEm = Array.from(li.children).find(
      (c) => c.tagName.toLowerCase() === 'em'
    );
    if (!directEm) {
      issues.push(`List item ${index + 1} is not wrapped in <em> tag`);
      return;
    }
    const hasTextOutside = Array.from(li.childNodes).some(
      (node) =>
        node.nodeType === Node.TEXT_NODE &&
        (node as Text).textContent?.trim()
    );
    if (hasTextOutside) {
      issues.push(`List item ${index + 1} has text outside <em> tag`);
    }
  });

  return {
    ruleId: 'sources-normalization',
    feature: 'Sources Normalization',
    mode,
    passed: issues.length === 0,
    message:
      issues.length === 0
        ? `Sources section correctly formatted (${listItems.length} item(s))`
        : `${issues.length} issue(s) found: ${issues.join('; ')}`,
    severity: issues.length === 0 ? 'info' : 'error',
    expected: 'Sources paragraph uses <strong><em>Sources:</em></strong> and all <li> are wrapped in <em>',
    actual: issues.length === 0
      ? `Sources section correctly formatted (${listItems.length} item(s))`
      : `${issues.length} formatting issue(s) found`,
    details: issues.length > 0 ? issues : null,
  };
}

/**
 * When removeSourcesLinks is enabled, validate anchors are absent. When
 * disabled, validate they remain present (strict).
 */
function validateRemoveSourcesLinks(doc: Document, mode: OutputMode, features?: FeatureFlags): TestResult {
  if (mode === 'regular') {
    return {
      ruleId: 'remove-sources-links',
      feature: 'Remove Sources Links',
      mode,
      passed: true,
      message: 'Remove Sources Links is a blogs/shoppables feature (skipped)',
      severity: 'info',
    };
  }

  const enabled = features?.removeSourcesLinks ?? true;
  const section = findSourcesSection(doc);

  if (!section) {
    return {
      ruleId: 'remove-sources-links',
      feature: 'Remove Sources Links',
      mode,
      passed: true,
      message: 'No Sources section found (skipped)',
      severity: 'info',
    };
  }

  const sourcesLinks = section.list.querySelectorAll('a');
  const totalLinks = sourcesLinks.length;

  if (totalLinks === 0) {
    return {
      ruleId: 'remove-sources-links',
      feature: 'Remove Sources Links',
      mode,
      passed: true,
      message: 'No anchor tags in Sources (skipped - nothing to remove)',
      severity: 'info',
    };
  }

  if (enabled) {
    return {
      ruleId: 'remove-sources-links',
      feature: 'Remove Sources Links',
      mode,
      passed: false,
      message: `${totalLinks} anchor tag(s) found in Sources (should be removed)`,
      severity: 'error',
      expected: 'No <a> tags in Sources <ol>',
      actual: `${totalLinks} anchor tag(s) present in Sources`,
    };
  }

  return {
    ruleId: 'remove-sources-links',
    feature: 'Remove Sources Links',
    mode,
    passed: true,
    message: `${totalLinks} anchor tag(s) preserved in Sources (feature disabled)`,
    severity: 'info',
    expected: 'Anchor tags preserved when removeSourcesLinks is disabled',
    actual: `${totalLinks} anchor tag(s) preserved`,
  };
}

/**
 * Disabled branch only passes when there is no <strong><em>Disclaimer:</em></strong>
 * on the paragraph's first child; otherwise reports the leftover normalization.
 */
function validateDisclaimerNormalize(doc: Document, mode: OutputMode, features?: FeatureFlags): TestResult {
  if (mode === 'regular') {
    return {
      ruleId: 'disclaimer-normalization',
      feature: 'Disclaimer Normalization',
      mode,
      passed: true,
      message: 'Disclaimer normalization is a blogs/shoppables feature (skipped)',
      severity: 'info',
    };
  }

  const section = findDisclaimerSection(doc);

  if (!section) {
    return {
      ruleId: 'disclaimer-normalization',
      feature: 'Disclaimer Normalization',
      mode,
      passed: true,
      message: 'No Disclaimer section present',
      severity: 'info',
    };
  }

  const isEnabled = isFeatureEnabled(features, 'disclaimerNormalize', true);

  const labelStrong = section.paragraph.querySelector(':scope > strong');
  const labelEm = labelStrong?.querySelector(':scope > em');
  const emText = labelEm?.textContent?.trim().toLowerCase() || '';

  if (!isEnabled) {
    const isOverNormalized = !!labelEm && emText === 'disclaimer:';
    return {
      ruleId: 'disclaimer-normalization',
      feature: 'Disclaimer Normalization',
      mode,
      passed: !isOverNormalized,
      message: isOverNormalized
        ? 'Disclaimer paragraph is normalized (should not have <strong><em> structure)'
        : 'Disclaimer section correctly not normalized (feature disabled)',
      severity: isOverNormalized ? 'error' : 'info',
    };
  }

  const issues: string[] = [];
  if (!labelStrong) {
    issues.push('Disclaimer paragraph missing <strong> tag');
  } else if (!labelEm) {
    issues.push('Disclaimer paragraph missing <em> tag inside <strong>');
  } else if (emText !== 'disclaimer:') {
    issues.push(
      `Disclaimer <em> tag should contain "Disclaimer:" but found "${labelEm.textContent?.trim()}"`
    );
  }

  return {
    ruleId: 'disclaimer-normalization',
    feature: 'Disclaimer Normalization',
    mode,
    passed: issues.length === 0,
    message:
      issues.length === 0
        ? 'Disclaimer label correctly formatted'
        : `${issues.length} issue(s) found: ${issues.join('; ')}`,
    severity: issues.length === 0 ? 'info' : 'error',
    expected: 'Disclaimer label wrapped in <strong><em>Disclaimer:</em></strong>',
    actual: issues.length === 0
      ? 'Disclaimer label correctly formatted'
      : `${issues.length} formatting issue(s) found`,
    details: issues.length > 0 ? issues : null,
  };
}

/* ------------------------------------------------------------------ */
/* Spacing                                                            */
/* ------------------------------------------------------------------ */

function validateKeyTakeawaySpacing(doc: Document, issues: string[]): void {
  const section = findKeyTakeawaysSection(doc);
  if (!section) return;
  const elementAfterUl = section.list.nextElementSibling;
  if (!isAnySpacingElement(elementAfterUl)) {
    issues.push('Missing spacing after Key Takeaways section');
  }
}

function validateHeadingSpacing(doc: Document, issues: string[]): void {
  issues.push(...getHeadingSpacingIssues(doc).map(issue => issue.message));
}

function validateSpecialParagraphSpacing(doc: Document, issues: string[]): void {
  const paragraphs = doc.querySelectorAll('p');

  paragraphs.forEach((p) => {
    const text = p.textContent?.trim().toLowerCase() || '';

    /* Use exact prefix matching for "alt image text:" instead of includes(). */
    if (text === 'read also:' || text.startsWith('read also:') ||
        text === 'read more:' || text.startsWith('read more:') ||
        text === 'see more:' || text.startsWith('see more:')) {
      const prevSibling = p.previousElementSibling;
      if (!isAnySpacingElement(prevSibling)) {
        issues.push(`Missing spacing before "${text.substring(0, 20)}..."`);
      }
    }

    if (text === 'sources' || text === 'sources:' || text.startsWith('sources:')) {
      const prevSibling = p.previousElementSibling;
      if (!isAnySpacingElement(prevSibling)) {
        issues.push('Missing spacing before "Sources:" section');
      }
    }

    if (text.startsWith('disclaimer')) {
      const prevSibling = p.previousElementSibling;
      if (!isAnySpacingElement(prevSibling)) {
        issues.push('Missing spacing before "Disclaimer:" section');
      }
    }

    if (text.startsWith('alt image text:')) {
      const prevSibling = p.previousElementSibling;
      if (!isAnySpacingElement(prevSibling)) {
        issues.push('Missing spacing before "Alt Image Text:" paragraph');
      }
    }
  });
}

/** Shared element-level diagnostics for disabled spacing and preview highlights. */
export function getUnexpectedSpacingIssues(doc: Document, features?: FeatureFlags): { element: Element; message: string }[] {
  const issues = getHeadingSpacingIssues(doc).filter(issue => issue.kind === 'unexpected');
  const result: { element: Element; message: string }[] = [...issues];
  doc.querySelectorAll('p').forEach(p => {
    if (!isAnySpacingElement(p)) return;
    const previous = p.previousElementSibling;
    const next = p.nextElementSibling;
    if (issues.some(issue => issue.element === next)) return;
    if (isBrSpacingElement(p) && (
      (features?.brBeforeReadMore && isReadMoreParagraph(next)) ||
      (features?.brBeforeSources && isSourcesParagraph(next))
    )) return;
    if (features?.paragraphSpacing && previous?.tagName === 'P' && next?.tagName === 'P' &&
        previous.textContent?.trim() && next.textContent?.trim()) return;
    result.push({ element: p, message: 'Found blank spacing paragraph that should not be present' });
  });
  return result;
}

function validateSpacing(doc: Document, mode: OutputMode, features?: FeatureFlags): TestResult {
  if (mode !== 'blogs' && mode !== 'shoppables') {
    return {
      ruleId: 'spacing-rules',
      feature: 'Spacing Rules',
      mode,
      passed: true,
      message: 'Spacing rules not required for this mode',
      severity: 'info',
    };
  }

  /* For blogs: enabled by default. For shoppables: disabled by default. */
  const isSpacingEnabled = mode === 'blogs'
    ? isFeatureEnabled(features, 'spacing', true)
    : isFeatureEnabled(features, 'spacing', false);

  if (!isSpacingEnabled) {
    const spacingElements = getUnexpectedSpacingIssues(doc, features).map(issue => issue.message);

    return {
      ruleId: 'spacing-rules',
      feature: 'Spacing Rules',
      mode,
      passed: spacingElements.length === 0,
      message:
        spacingElements.length === 0
          ? 'Spacing rules correctly disabled (no spacing elements found)'
          : `${spacingElements.length} spacing element(s) found (should not be present)`,
      severity: spacingElements.length === 0 ? 'info' : 'error',
      expected: 'No spacing elements present (feature disabled)',
      actual: spacingElements.length === 0
        ? 'No spacing elements found'
        : `${spacingElements.length} spacing element(s) found`,
      details: spacingElements.length > 0 ? spacingElements : null,
    };
  }

  const issues: string[] = [];

  validateKeyTakeawaySpacing(doc, issues);
  validateHeadingSpacing(doc, issues);
  validateSpecialParagraphSpacing(doc, issues);

  return {
    ruleId: 'spacing-rules',
    feature: 'Spacing Rules',
    mode,
    passed: issues.length === 0,
    message:
      issues.length === 0 ? 'All spacing rules satisfied' : `${issues.length} spacing issues found`,
    severity: issues.length === 0 ? 'info' : 'warning',
    expected: 'All spacing rules satisfied',
    actual: issues.length === 0
      ? 'All spacing rules satisfied'
      : `${issues.length} spacing issue(s) found`,
    details: issues.length > 0 ? issues : null,
  };
}

/* ------------------------------------------------------------------ */
/* New feature-flag validators                                         */
/* ------------------------------------------------------------------ */

function validateParagraphSpacing(doc: Document, mode: OutputMode, features?: FeatureFlags): TestResult {
  const enabled = isFeatureEnabled(features, 'paragraphSpacing', false);
  if (!enabled) {
    return {
      ruleId: 'paragraph-spacing',
      feature: 'Paragraph Spacing',
      mode,
      passed: true,
      message: 'Paragraph spacing disabled (skipped)',
      severity: 'info',
    };
  }

  /* Walk direct children of body and look for adjacent <p> pairs missing a
   * spacing element between them. */
  const issues: string[] = [];
  const rootChildren = doc.body ? Array.from(doc.body.children) : [];
  for (let i = 0; i < rootChildren.length - 1; i++) {
    const a = rootChildren[i];
    const b = rootChildren[i + 1];
    if (a.tagName.toLowerCase() !== 'p' || b.tagName.toLowerCase() !== 'p') continue;
    if (isNbspSpacingElement(a) || isBrSpacingElement(a)) continue;
    if (isNbspSpacingElement(b) || isBrSpacingElement(b)) continue;

    const aText = (a.textContent || '').trim();
    const bText = (b.textContent || '').trim();
    if (!aText || !bText) continue;
    issues.push(`Missing paragraph spacing between "${aText.substring(0, 30)}..." and "${bText.substring(0, 30)}..."`);
  }

  return {
    ruleId: 'paragraph-spacing',
    feature: 'Paragraph Spacing',
    mode,
    passed: issues.length === 0,
    message:
      issues.length === 0
        ? 'Paragraph spacing correctly applied'
        : `${issues.length} missing paragraph spacing(s) found`,
    severity: issues.length === 0 ? 'info' : 'warning',
    expected: 'Every adjacent pair of <p> at body root has a spacing element between them',
    actual: issues.length === 0
      ? 'Paragraph spacing correctly applied'
      : `${issues.length} missing spacing(s)`,
    details: issues.length > 0 ? issues : null,
  };
}

function validateSourcesItalic(doc: Document, mode: OutputMode, features?: FeatureFlags): TestResult {
  if (mode !== 'blogs' && mode !== 'shoppables') {
    return {
      ruleId: 'sources-italic',
      feature: 'Sources Italic',
      mode,
      passed: true,
      message: 'Sources italic check not required for this mode',
      severity: 'info',
    };
  }

  if (features?.sourcesNormalize === false) {
    return {
      ruleId: 'sources-italic',
      feature: 'Sources Italic',
      mode,
      passed: true,
      message: 'Sources normalization disabled (skipped)',
      severity: 'info',
    };
  }

  const enabled = isFeatureEnabled(features, 'sourcesItalic', true);
  const section = findSourcesSection(doc);

  if (!section) {
    return {
      ruleId: 'sources-italic',
      feature: 'Sources Italic',
      mode,
      passed: true,
      message: 'No Sources section found (skipped)',
      severity: 'info',
    };
  }

  const listItems = section.list.querySelectorAll('li');
  if (listItems.length === 0) {
    return {
      ruleId: 'sources-italic',
      feature: 'Sources Italic',
      mode,
      passed: true,
      message: 'Sources <ol> has no items (skipped)',
      severity: 'info',
    };
  }

  if (!enabled) {
    /* Feature disabled — italic style should not be present. */
    const italicItems = Array.from(listItems).filter(
      (li) => (li.getAttribute('style') || '').toLowerCase().includes('font-style: italic')
    );
    return {
      ruleId: 'sources-italic',
      feature: 'Sources Italic',
      mode,
      passed: italicItems.length === 0,
      message:
        italicItems.length === 0
          ? 'Sources correctly not italicized (feature disabled)'
          : `${italicItems.length} sources item(s) italicized (should not be)`,
      severity: italicItems.length === 0 ? 'info' : 'error',
    };
  }

  const missingItalic = Array.from(listItems).filter(
    (li) => !(li.getAttribute('style') || '').toLowerCase().includes('font-style: italic')
  );

  return {
    ruleId: 'sources-italic',
    feature: 'Sources Italic',
    mode,
    passed: missingItalic.length === 0,
    message:
      missingItalic.length === 0
        ? `All ${listItems.length} sources item(s) italicized`
        : `${missingItalic.length} of ${listItems.length} sources item(s) missing italic style`,
    severity: missingItalic.length === 0 ? 'info' : 'warning',
    expected: 'Every <li> in Sources has style="font-style: italic"',
    actual: missingItalic.length === 0
      ? `All ${listItems.length} sources item(s) italicized`
      : `${missingItalic.length} of ${listItems.length} sources item(s) missing italic style`,
  };
}

function validateBrBeforeReadMore(doc: Document, mode: OutputMode, features?: FeatureFlags): TestResult {
  if (mode !== 'shoppables') {
    return {
      ruleId: 'br-before-read-more',
      feature: 'BR Before Read More',
      mode,
      passed: true,
      message: 'BR before read more is a shoppables-only feature (skipped)',
      severity: 'info',
    };
  }

  const enabled = isFeatureEnabled(features, 'brBeforeReadMore', false);
  if (!enabled) {
    return {
      ruleId: 'br-before-read-more',
      feature: 'BR Before Read More',
      mode,
      passed: true,
      message: 'Feature disabled (skipped)',
      severity: 'info',
    };
  }

  const paragraphs = doc.querySelectorAll('p');
  const targets: Element[] = [];
  paragraphs.forEach((p) => {
    if (isReadMoreParagraph(p)) {
      targets.push(p);
    }
  });

  if (targets.length === 0) {
    return {
      ruleId: 'br-before-read-more',
      feature: 'BR Before Read More',
      mode,
      passed: true,
      message: 'No read-more paragraph found (skipped)',
      severity: 'info',
    };
  }

  const issues: string[] = [];
  targets.forEach((p) => {
    const prevSibling = p.previousElementSibling;
    if (!isBrSpacingElement(prevSibling)) {
      issues.push(`Missing <p><br></p> before "${(p.textContent || '').trim().substring(0, 30)}..."`);
    }
  });

  return {
    ruleId: 'br-before-read-more',
    feature: 'BR Before Read More',
    mode,
    passed: issues.length === 0,
    message:
      issues.length === 0
        ? `BR spacing correctly applied before ${targets.length} read-more paragraph(s)`
        : `${issues.length} missing BR spacing(s)`,
    severity: issues.length === 0 ? 'info' : 'warning',
    expected: '<p><br></p> immediately precedes each read-more/also/see-more paragraph',
    actual: issues.length === 0
      ? `BR spacing applied to ${targets.length} target(s)`
      : `${issues.length} target(s) missing BR spacing`,
    details: issues.length > 0 ? issues : null,
  };
}

function validateBrBeforeSources(doc: Document, mode: OutputMode, features?: FeatureFlags): TestResult {
  if (mode !== 'shoppables') {
    return {
      ruleId: 'br-before-sources',
      feature: 'BR Before Sources',
      mode,
      passed: true,
      message: 'BR before sources is a shoppables-only feature (skipped)',
      severity: 'info',
    };
  }

  const enabled = isFeatureEnabled(features, 'brBeforeSources', false);
  if (!enabled) {
    return {
      ruleId: 'br-before-sources',
      feature: 'BR Before Sources',
      mode,
      passed: true,
      message: 'Feature disabled (skipped)',
      severity: 'info',
    };
  }

  const section = findSourcesSection(doc);
  if (!section) {
    return {
      ruleId: 'br-before-sources',
      feature: 'BR Before Sources',
      mode,
      passed: true,
      message: 'No Sources paragraph found (skipped)',
      severity: 'info',
    };
  }

  const prevSibling = section.paragraph.previousElementSibling;
  if (isBrSpacingElement(prevSibling)) {
    return {
      ruleId: 'br-before-sources',
      feature: 'BR Before Sources',
      mode,
      passed: true,
      message: 'BR spacing correctly applied before Sources',
      severity: 'info',
    };
  }

  return {
    ruleId: 'br-before-sources',
    feature: 'BR Before Sources',
    mode,
    passed: false,
    message: 'Missing <p><br></p> before Sources paragraph',
    severity: 'warning',
    expected: '<p><br></p> immediately precedes Sources paragraph',
    actual: prevSibling ? `Previous sibling: <${prevSibling.tagName.toLowerCase()}>` : 'No previous sibling',
  };
}

/* ------------------------------------------------------------------ */
/* OL header conversion                                                */
/* ------------------------------------------------------------------ */

function isHeaderList(ol: Element): boolean {
  const listItems = ol.querySelectorAll(':scope > li');
  if (listItems.length === 0) return false;

  return Array.from(listItems).every((li) => {
    const strongTag = li.querySelector(':scope > strong');
    if (strongTag) {
      const headingChildren = Array.from(strongTag.children).filter((node) =>
        /^h[1-6]$/i.test(node.tagName)
      );
      if (headingChildren.length === 1) {
        return true;
      }
    }

    const directHeading = li.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6');
    if (directHeading) {
      const strongInHeading = directHeading.querySelector(':scope > strong');
      return strongInHeading !== null;
    }

    return false;
  });
}

function validateOlHeaderConversion(doc: Document, mode: OutputMode, features?: FeatureFlags): TestResult {
  if (mode === 'regular') {
    return {
      ruleId: 'ol-header-conversion',
      feature: 'OL Header Conversion',
      mode,
      passed: true,
      message: 'OL header conversion is a blogs/shoppables feature (skipped)',
      severity: 'info',
    };
  }

  const olElements = doc.querySelectorAll('ol');
  const headerLists = Array.from(olElements).filter(isHeaderList);
  const isEnabled = isFeatureEnabled(features, 'olHeaderConversion', true);

  if (!isEnabled) {
    /* Disabled — check that no numbered headings exist regardless of
     * whether <ol> elements are present (manual edits can also produce
     * them). */
    const allHeadings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const numberedHeadings = Array.from(allHeadings).filter((h) => {
      const text = h.textContent?.trim() || '';
      return /^\d+[\.\)\-]\s/.test(text) || /^\d+[\.\)]/.test(text);
    });

    return {
      ruleId: 'ol-header-conversion',
      feature: 'OL Header Conversion',
      mode,
      passed: numberedHeadings.length === 0,
      message:
        numberedHeadings.length === 0
          ? 'No numbered headings found (feature disabled, conversion not applied)'
          : `Found ${numberedHeadings.length} numbered heading(s) (should not be converted when feature is disabled)`,
      severity: numberedHeadings.length === 0 ? 'info' : 'error',
      expected: 'No numbered headings present when feature is disabled',
      actual: numberedHeadings.length === 0
        ? 'No numbered headings found'
        : `${numberedHeadings.length} numbered heading(s) found`,
    };
  }

  if (olElements.length === 0) {
    return {
      ruleId: 'ol-header-conversion',
      feature: 'OL Header Conversion',
      mode,
      passed: true,
      message: 'No <ol> elements found (skipped)',
      severity: 'info',
    };
  }

  if (headerLists.length === 0) {
    return {
      ruleId: 'ol-header-conversion',
      feature: 'OL Header Conversion',
      mode,
      passed: true,
      message: 'No header lists found (skipped)',
      severity: 'info',
    };
  }



  /* A header list is "correctly converted" iff there's no <ol> that still
   * satisfies isHeaderList() — unless it's intentionally chained with
   * another header list (which the producer preserves as the original
   * single-level list). */
  const unconvertedLists = headerLists.filter((ol) => {
    let nextSibling = ol.nextElementSibling;
    while (nextSibling) {
      if (nextSibling.tagName.toLowerCase() === 'p') {
        const text = nextSibling.textContent?.trim() || '';
        if (text === '' || text === '\u00A0' || text === '&nbsp;') {
          nextSibling = nextSibling.nextElementSibling;
          continue;
        }
      }
      if (nextSibling.tagName.toLowerCase() === 'ol' && isHeaderList(nextSibling)) {
        return false;
      }
      break;
    }
    return true;
  });

  return {
    ruleId: 'ol-header-conversion',
    feature: 'OL Header Conversion',
    mode,
    passed: unconvertedLists.length === 0,
    message:
      unconvertedLists.length === 0
        ? 'All header lists correctly converted'
        : `${unconvertedLists.length} header list(s) should be converted but remain as <ol>`,
    severity: unconvertedLists.length === 0 ? 'info' : 'warning',
    expected: 'All header lists converted to numbered headings',
    actual: unconvertedLists.length === 0
      ? `All ${headerLists.length} header list(s) converted`
      : `${unconvertedLists.length} of ${headerLists.length} header list(s) remain unconverted`,
  };
}

/* ------------------------------------------------------------------ */
/* validateMode — single registry, validators self-gate                */
/* ------------------------------------------------------------------ */

export function validateMode(html: string, mode: OutputMode, features: FeatureFlags): ValidationResults {
  if (!html || !html.trim()) {
    return {
      results: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        byMode: {
          regular: { total: 0, passed: 0, failed: 0 },
          blogs: { total: 0, passed: 0, failed: 0 },
          shoppables: { total: 0, passed: 0, failed: 0 },
        },
        byFeature: {},
      },
    };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const results = new ValidationResultsImpl();
  features = resolveFeatures(mode, features);

  /* Run every validator. Each one self-gates on mode/feature flag and
   * returns an informational pass when not applicable. */
  results.addResult(validateSanitizedStructure(doc, mode));
  results.addResult(validateLinkSafety(doc, mode));
  results.addResult(validateBasicStructure(doc, mode));
  results.addResult(validateHeadingStrong(doc, mode, features));
  results.addResult(validateKeyTakeaways(doc, mode, features));
  results.addResult(validateH1AfterKeyTakeaways(doc, mode, features));
  results.addResult(validateLinkAttributes(doc, mode, features));
  results.addResult(validateSourcesNormalize(doc, mode, features));
  results.addResult(validateSpacing(doc, mode, features));
  results.addResult(validateParagraphSpacing(doc, mode, features));
  results.addResult(validateOlHeaderConversion(doc, mode, features));
  results.addResult(validateRelativePaths(doc, mode, features));
  results.addResult(validateListNormalize(doc, mode));
  results.addResult(validateLinkSpacing(doc, mode, features));
  results.addResult(validateRemoveSourcesLinks(doc, mode, features));
  results.addResult(validateOlBoldLabels(doc, mode, features));
  results.addResult(validateDisclaimerNormalize(doc, mode, features));
  results.addResult(validateSourcesItalic(doc, mode, features));
  results.addResult(validateBrBeforeReadMore(doc, mode, features));
  results.addResult(validateBrBeforeSources(doc, mode, features));
  results.addResult(validateWrapLinksStrongUnderline(doc, mode, features));

  return results;
}

/**
 * Mirrors the skip conditions used by mode-wrap-links-strong-underline.ts so
 * the validator agrees with the converter about which links are in scope.
 */
function isAltContextLink(anchor: Element): boolean {
  if (anchor.querySelector(':scope > img') || anchor.querySelector('img')) return true;
  let parent = anchor.parentElement;
  while (parent) {
    if (parent.tagName.toLowerCase() === 'p') {
      const text = (parent.textContent || '').trim().toLowerCase();
      return text.startsWith('alt image text:');
    }
    parent = parent.parentElement;
  }
  return false;
}

function validateWrapLinksStrongUnderline(doc: Document, mode: OutputMode, features?: FeatureFlags): TestResult {
  if (mode === 'regular') {
    return {
      ruleId: 'wrap-links-strong-underline',
      feature: 'Wrap Links Strong & Underline',
      mode,
      passed: true,
      message: 'Wrap Links Strong & Underline is a blogs/shoppables feature (skipped)',
      severity: 'info',
    };
  }

  const enabled = features?.wrapLinksStrongUnderline === true;
  const anchors = Array.from(doc.querySelectorAll('a[href]'));

  if (!enabled) {
    const wrapped = anchors.filter((a) => a.querySelector(':scope > strong > u') !== null);
    return {
      ruleId: 'wrap-links-strong-underline',
      feature: 'Wrap Links Strong & Underline',
      mode,
      passed: wrapped.length === 0,
      message:
        wrapped.length === 0
          ? 'No links wrapped in <strong><u> (feature disabled)'
          : `${wrapped.length} link(s) wrapped in <strong><u> (should not be when disabled)`,
      severity: wrapped.length === 0 ? 'info' : 'error',
      details: wrapped.length > 0 ? [`${wrapped.length} wrapped link(s) found`] : null,
    };
  }

  const unwrapped = anchors.filter(
    (a) => !isAltContextLink(a) && a.querySelector(':scope > strong > u') === null
  );

  return {
    ruleId: 'wrap-links-strong-underline',
    feature: 'Wrap Links Strong & Underline',
    mode,
    passed: unwrapped.length === 0,
    message:
      unwrapped.length === 0
        ? `All non-alt-text links wrapped in <strong><u> (${anchors.length} link(s) checked)`
        : `${unwrapped.length} of ${anchors.length} non-alt-text link(s) missing <strong><u> wrap`,
    severity: unwrapped.length === 0 ? 'info' : 'error',
    expected: 'Every non-alt-text <a> has direct <strong><u> wrapping',
    actual: unwrapped.length === 0
      ? `All ${anchors.length} link(s) wrapped correctly`
      : `${unwrapped.length} of ${anchors.length} link(s) missing wrap`,
    details: unwrapped.length > 0 ? [`${unwrapped.length} link(s) missing wrap`] : null,
  };
}
