/**
 * HTML Validator
 * Validates that all features from each output format are working correctly
 */

import type { OutputMode, FeatureFlags } from './converter';

/**
 * Rule Metadata Registry
 * Enables documentation, UI toggles, and SEO content generation
 */
export const RULE_META: Record<string, {
  severity: 'error' | 'warning' | 'info';
  appliesTo: OutputMode[];
  docs?: string;
  description: string;
}> = {
  'heading-strong': {
    severity: 'error',
    appliesTo: ['blogs', 'shoppables'],
    docs: '/docs/heading-strong',
    description: 'Validates that headings are wrapped in <strong> tags for SEO and styling consistency',
  },
  'link-attributes': {
    severity: 'error',
    appliesTo: ['blogs', 'shoppables'],
    docs: '/docs/link-attributes',
    description: 'Ensures external links have target="_blank" and rel="noopener noreferrer" for security and UX',
  },
  'spacing-rules': {
    severity: 'warning',
    appliesTo: ['blogs', 'shoppables'],
    docs: '/docs/spacing-rules',
    description: 'Validates proper spacing elements before headings and special sections for readability',
  },
  'key-takeaways': {
    severity: 'error',
    appliesTo: ['blogs'],
    docs: '/docs/key-takeaways',
    description: 'Removes <em> tags from Key Takeaways section for consistent formatting',
  },
  'h1-after-key-takeaways': {
    severity: 'error',
    appliesTo: ['blogs'],
    docs: '/docs/h1-removal',
    description: 'Removes H1 headings after Key Takeaways section to maintain proper heading hierarchy',
  },
  'ol-header-conversion': {
    severity: 'warning',
    appliesTo: ['blogs', 'shoppables'],
    docs: '/docs/ol-header-conversion',
    description: 'Converts ordered lists containing headers into manually numbered headings',
  },
  'sources-normalization': {
    severity: 'error',
    appliesTo: ['blogs', 'shoppables'],
    docs: '/docs/sources-normalization',
    description: 'Normalizes Sources section formatting with proper <strong><em> structure',
  },
  'relative-paths': {
    severity: 'warning',
    appliesTo: ['blogs', 'shoppables'],
    docs: '/docs/relative-paths',
    description: 'Converts absolute URLs to relative paths for better portability',
  },
  'list-normalization': {
    severity: 'warning',
    appliesTo: ['regular', 'blogs', 'shoppables'],
    docs: '/docs/list-normalization',
    description: 'Normalizes spacing after <strong> tags ending with colons in list items',
  },
  'basic-structure': {
    severity: 'error',
    appliesTo: ['regular'],
    docs: '/docs/basic-structure',
    description: 'Validates basic HTML structure and content presence',
  },
};

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

    // Track by feature/rule
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

  // Helper: Check if heading has ONLY a <strong> child (no partial wrapping)
  // Uses .children to ignore text nodes (whitespace, newlines)
  function hasOnlyStrongChild(h: Element): boolean {
    const elementChildren = Array.from(h.children);
    return (
      elementChildren.length === 1 &&
      elementChildren[0].tagName.toLowerCase() === 'strong'
    );
  }

  if (mode === 'regular') {
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

  // For blogs and shoppables modes, check feature flag
  const isEnabled = isFeatureEnabled(features, 'headingStrong', true);

  if (!isEnabled) {
    // Feature is disabled, validate that headings are NOT wrapped
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

  // Feature is enabled, validate that all headings ARE wrapped
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
    actual: allWrapped ? 'All headings wrapped correctly' : `${unwrappedCount} of ${headings.length} headings missing wrapper`,
  };
}

function validateLinkAttributes(doc: Document, mode: OutputMode, features?: FeatureFlags): TestResult {
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

  if (mode === 'regular') {
    const hasAttributes = Array.from(links).some(
      (link) => link.hasAttribute('target') || link.hasAttribute('rel')
    );
    return {
      ruleId: 'link-attributes',
      feature: 'Link Attributes',
      mode,
      passed: !hasAttributes,
      message: hasAttributes
        ? 'Links should not have target/rel attributes in regular mode'
        : 'Links correctly without target/rel attributes',
      severity: hasAttributes ? 'error' : 'info',
    };
  }

  // For blogs and shoppables modes, check feature flag
  const isEnabled = isFeatureEnabled(features, 'linkAttributes', true);

  if (!isEnabled) {
    // Feature is disabled, validate that links do NOT have attributes
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

  // Feature is enabled, validate that all links HAVE attributes
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

function validateListNormalize(doc: Document, mode: OutputMode): TestResult {
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
    const strongTags = li.querySelectorAll('strong');

    strongTags.forEach((strong) => {
      const strongText = strong.textContent || '';

      if (strongText.trim().endsWith(':')) {
        const strongHTML = strong.innerHTML;
        const trimmedHTML = strongHTML.trim();
        if (trimmedHTML.endsWith(': ') || trimmedHTML.match(/:\s+$/)) {
          issues.push(
            `List item has trailing space before </strong> in "${strongText.trim().substring(0, 30)}..."`
          );
        }

        let nextNode = strong.nextSibling;

        if (nextNode && nextNode.nodeType === Node.TEXT_NODE) {
          const text = (nextNode as Text).textContent || '';
          if (text.length === 0 || !text.startsWith(' ')) {
            issues.push(
              `List item missing space after </strong> in "${strongText.trim().substring(0, 30)}..."`
            );
          } else if (text.startsWith('  ')) {
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

function validateKeyTakeaways(doc: Document, mode: OutputMode, features?: FeatureFlags): TestResult {
  if (mode !== 'blogs') {
    return {
      ruleId: 'key-takeaways',
      feature: 'Key Takeaways Formatting',
      mode,
      passed: true,
      message: 'Key Takeaways formatting not required for this mode',
      severity: 'info',
    };
  }

  const headings = doc.querySelectorAll('h2');
  let keyTakeawaysHeading: Element | null = null;

  for (let heading of Array.from(headings)) {
    const text = heading.textContent?.trim() || '';
    if (text.toLowerCase().includes('key takeaways')) {
      keyTakeawaysHeading = heading;
      break;
    }
  }

  if (!keyTakeawaysHeading) {
    return {
      ruleId: 'key-takeaways',
      feature: 'Key Takeaways Formatting',
      mode,
      passed: true,
      message: 'No Key Takeaways section found (skipped)',
      severity: 'info',
    };
  }

  let nextSibling = keyTakeawaysHeading.nextElementSibling;
  while (nextSibling && nextSibling.tagName.toLowerCase() !== 'ul') {
    nextSibling = nextSibling.nextElementSibling;
  }

  if (!nextSibling || nextSibling.tagName.toLowerCase() !== 'ul') {
    return {
      ruleId: 'key-takeaways',
      feature: 'Key Takeaways Formatting',
      mode,
      passed: true,
      message: 'Key Takeaways heading found but no list found (skipped)',
      severity: 'info',
    };
  }

  const listItems = nextSibling.querySelectorAll('li');
  const hasEmTags = Array.from(listItems).some((li) => li.querySelector('em'));

  // Check if feature is enabled (enabled by default)
  const isEnabled = isFeatureEnabled(features, 'keyTakeaways', true);

  if (!isEnabled) {
    // Feature is disabled, validate that <em> tags are still present
    const emCount = Array.from(listItems).filter((li) => li.querySelector('em')).length;
    return {
      ruleId: 'key-takeaways',
      feature: 'Key Takeaways Formatting',
      mode,
      passed: hasEmTags,
      message: hasEmTags
        ? '<em> tags correctly preserved in Key Takeaways (feature disabled)'
        : 'No <em> tags found in Key Takeaways (should be present when feature is disabled)',
      severity: hasEmTags ? 'info' : 'error',
      expected: '<em> tags preserved in Key Takeaways (feature disabled)',
      actual: hasEmTags 
        ? `${emCount} list item(s) contain <em> tags`
        : 'No <em> tags found',
    };
  }

  // Feature is enabled, validate that <em> tags are removed
  const emCount = Array.from(listItems).filter((li) => li.querySelector('em')).length;
  return {
    ruleId: 'key-takeaways',
    feature: 'Key Takeaways Formatting',
    mode,
    passed: !hasEmTags,
    message: hasEmTags
      ? 'Found <em> tags in Key Takeaways (should be removed)'
      : 'No <em> tags in Key Takeaways (correct)',
    severity: !hasEmTags ? 'info' : 'error',
    expected: 'No <em> tags in Key Takeaways',
    actual: hasEmTags 
      ? `${emCount} list item(s) contain <em> tags`
      : 'No <em> tags found',
  };
}

function validateH1AfterKeyTakeaways(doc: Document, mode: OutputMode, features?: FeatureFlags): TestResult {
  if (mode !== 'blogs') {
    return {
      ruleId: 'h1-after-key-takeaways',
      feature: 'H1 Removal',
      mode,
      passed: true,
      message: 'H1 removal not required for this mode',
      severity: 'info',
    };
  }

  const headings = doc.querySelectorAll('h2');
  let keyTakeawaysHeading: Element | null = null;

  for (let heading of Array.from(headings)) {
    const text = heading.textContent?.trim() || '';
    if (text.toLowerCase().includes('key takeaways')) {
      keyTakeawaysHeading = heading;
      break;
    }
  }

  if (!keyTakeawaysHeading) {
    return {
      ruleId: 'h1-after-key-takeaways',
      feature: 'H1 Removal',
      mode,
      passed: true,
      message: 'No Key Takeaways section found (skipped)',
      severity: 'info',
    };
  }

  let nextSibling = keyTakeawaysHeading.nextElementSibling;
  while (nextSibling && nextSibling.tagName.toLowerCase() !== 'ul') {
    nextSibling = nextSibling.nextElementSibling;
  }

  if (!nextSibling || nextSibling.tagName.toLowerCase() !== 'ul') {
    return {
      ruleId: 'h1-after-key-takeaways',
      feature: 'H1 Removal',
      mode,
      passed: true,
      message: 'Key Takeaways heading found but no list found (skipped)',
      severity: 'info',
    };
  }

  let nodeAfterUl: Node | null = nextSibling.nextSibling;
  while (
    nodeAfterUl &&
    nodeAfterUl.nodeType === Node.TEXT_NODE &&
    !(nodeAfterUl as Text).textContent?.trim()
  ) {
    nodeAfterUl = nodeAfterUl.nextSibling;
  }

  const elementAfterUl = nodeAfterUl && nodeAfterUl.nodeType === Node.ELEMENT_NODE ? nodeAfterUl as Element : null;
  const hasH1After = elementAfterUl && elementAfterUl.tagName.toLowerCase() === 'h1';

  // Check if feature is enabled (enabled by default)
  const isEnabled = isFeatureEnabled(features, 'h1Removal', true);

  if (!isEnabled) {
    // Feature is disabled, validate that H1 is still present
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

  // Feature is enabled, validate that H1 is removed
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

/**
 * Helper: Check if an element is a spacing element (<p>&nbsp;</p>)
 * Handles single or multiple &nbsp; entities (some editors produce multiple)
 */
function isSpacingElement(element: Element | null): boolean {
  if (!element || element.tagName.toLowerCase() !== 'p') return false;
  const html = element.innerHTML.trim();
  // Match single or multiple &nbsp; or \u00A0 (more forgiving for real-world content)
  return /^(&nbsp;|\u00A0)+$/.test(html);
}

/**
 * Helper: Validate spacing after Key Takeaways section
 */
function validateKeyTakeawaySpacing(doc: Document, issues: string[]): void {
  const headings = doc.querySelectorAll('h2');
  let keyTakeawaysHeading: Element | null = null;
  
  for (let heading of Array.from(headings)) {
    const text = heading.textContent?.trim() || '';
    if (text.toLowerCase().includes('key takeaways')) {
      keyTakeawaysHeading = heading;
      break;
    }
  }

  if (keyTakeawaysHeading) {
    let nextSibling = keyTakeawaysHeading.nextElementSibling;
    while (nextSibling && nextSibling.tagName.toLowerCase() !== 'ul') {
      nextSibling = nextSibling.nextElementSibling;
    }
    if (nextSibling && nextSibling.tagName.toLowerCase() === 'ul') {
      const elementAfterUl = nextSibling.nextElementSibling;
      if (!isSpacingElement(elementAfterUl as Element)) {
        issues.push('Missing spacing after Key Takeaways section');
      }
    }
  }
}

/**
 * Helper: Validate spacing before headings (with FAQ exception)
 */
function validateHeadingSpacing(doc: Document, issues: string[]): void {
  const allHeadings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
  let foundFaqSection = false;
  let isFirstFaqQuestion = false;

  allHeadings.forEach((heading) => {
    const text = heading.textContent?.trim().toLowerCase() || '';
    const tagName = heading.tagName.toLowerCase();

    if (text.includes('key takeaways')) {
      return;
    }

    // Reset FAQ state when encountering a higher-level heading (prevents state bleed across multiple FAQ sections)
    if (tagName === 'h1' || tagName === 'h2') {
      foundFaqSection = false;
      isFirstFaqQuestion = false;
    }

    // More robust FAQ detection (handles "FAQs", "Frequently Asked Questions (FAQ)", etc.)
    if (/faq|frequently asked/i.test(text)) {
      foundFaqSection = true;
      isFirstFaqQuestion = true;
    }

    if (foundFaqSection && isFirstFaqQuestion && tagName === 'h3') {
      isFirstFaqQuestion = false;
      return;
    }

    const prevSibling = heading.previousElementSibling;
    // Skip first heading in document (no previous sibling)
    if (!prevSibling) {
      return;
    }

    if (!isSpacingElement(prevSibling)) {
      issues.push(`Missing spacing before heading: "${heading.textContent?.trim().substring(0, 30)}..."`);
    }
  });
}

/**
 * Helper: Validate spacing before special paragraphs (Read More, Sources, Disclaimer, Alt Image Text)
 */
function validateSpecialParagraphSpacing(doc: Document, issues: string[]): void {
  const paragraphs = doc.querySelectorAll('p');
  
  paragraphs.forEach((p) => {
    const text = p.textContent?.trim().toLowerCase() || '';
    
    if (text.includes('read also:') || text.includes('read more:') || text.includes('see more:')) {
      const prevSibling = p.previousElementSibling;
      if (!isSpacingElement(prevSibling)) {
        issues.push(`Missing spacing before "${text.substring(0, 20)}..."`);
      }
    }
    
    if (text.startsWith('sources:')) {
      const prevSibling = p.previousElementSibling;
      if (!isSpacingElement(prevSibling)) {
        issues.push('Missing spacing before "Sources:" section');
      }
    }
    
    if (text.startsWith('disclaimer:')) {
      const prevSibling = p.previousElementSibling;
      if (!isSpacingElement(prevSibling)) {
        issues.push('Missing spacing before "Disclaimer:" section');
      }
    }
    
    if (text.includes('alt image text:')) {
      const prevSibling = p.previousElementSibling;
      if (!isSpacingElement(prevSibling)) {
        issues.push('Missing spacing before "Alt Image Text:" paragraph');
      }
    }
  });
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

  // Check if spacing is enabled
  // For blogs: enabled by default (undefined !== false), can be disabled (false)
  // For shoppables: disabled by default (undefined !== true), enabled only when true
  const isSpacingEnabled = mode === 'blogs' 
    ? isFeatureEnabled(features, 'spacing', true)
    : isFeatureEnabled(features, 'spacing', false);

  // If spacing is disabled, validate that NO spacing elements exist
  if (!isSpacingEnabled) {
    const allParagraphs = doc.querySelectorAll('p');
    const spacingElements: string[] = [];
    
    allParagraphs.forEach((p) => {
      if (isSpacingElement(p)) {
        spacingElements.push('Found spacing element that should not be present');
      }
    });

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

  // Spacing is enabled, validate that spacing IS applied correctly
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

function validateOlHeaderConversion(doc: Document, mode: OutputMode, features?: FeatureFlags): TestResult {
  const olElements = doc.querySelectorAll('ol');

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

  // Helper function to check if an ol is a header list
  function isHeaderList(ol: Element): boolean {
    const listItems = ol.querySelectorAll(':scope > li');
    if (listItems.length === 0) return false;

    return Array.from(listItems).every((li) => {
      // Check for <strong> wrapping heading: <li><strong><hX>...</hX></strong></li>
      const strongTag = li.querySelector(':scope > strong');
      if (strongTag) {
        const headingChildren = Array.from(strongTag.children).filter((node) =>
          /^h[1-6]$/i.test(node.tagName)
        );
        if (headingChildren.length === 1) {
          return true;
        }
      }
      
      // Check for direct heading: <li><hX><strong>...</strong></hX></li>
      const directHeading = li.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6');
      if (directHeading) {
        const strongInHeading = directHeading.querySelector(':scope > strong');
        return strongInHeading !== null;
      }
      
      return false;
    });
  }

  const headerLists = Array.from(olElements).filter(isHeaderList);

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

  // Check if feature is enabled (enabled by default)
  const isEnabled = isFeatureEnabled(features, 'olHeaderConversion', true);

  if (!isEnabled) {
    // Feature is disabled, validate that header lists are NOT converted (still exist as <ol>)
    // Check if any header lists were converted (would appear as numbered headings)
    const allHeadings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const numberedHeadings = Array.from(allHeadings).filter((h) => {
      const text = h.textContent?.trim() || '';
      // Check if heading starts with a number pattern (handles variations: "1. ", "1)", "1 -", "01.")
      return /^\d+[\.\)\-]\s/.test(text);
    });

    // If we have header lists but no numbered headings, that's good (not converted)
    // If we have numbered headings, that's bad (converted when shouldn't be)
    return {
      ruleId: 'ol-header-conversion',
      feature: 'OL Header Conversion',
      mode,
      passed: numberedHeadings.length === 0,
      message:
        numberedHeadings.length === 0
          ? `Header lists correctly preserved as <ol> elements (feature disabled)`
          : `Found ${numberedHeadings.length} numbered heading(s) (should not be converted when feature is disabled)`,
      severity: numberedHeadings.length === 0 ? 'info' : 'error',
      expected: 'Header lists preserved as <ol> elements (feature disabled)',
      actual: numberedHeadings.length === 0 
        ? `${headerLists.length} header list(s) preserved as <ol>`
        : `${numberedHeadings.length} numbered heading(s) found (should not be converted)`,
    };
  }

  // Feature is enabled, validate that header lists ARE converted
  // Check for unconverted lists (header lists that are not followed by another header list)
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
        return false; // Followed by another header list, so this one should remain
      }
      break;
    }
    return true; // Not followed by header list, should be converted
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

function validateSourcesNormalize(doc: Document, mode: OutputMode, features?: FeatureFlags): TestResult {
  const paragraphs = doc.querySelectorAll('p');

  let sourcesParagraph: Element | null = null;
  for (let p of Array.from(paragraphs)) {
    const text = p.textContent?.trim().toLowerCase() || '';
    if (text === 'sources' || text === 'sources:') {
      sourcesParagraph = p;
      break;
    }
  }

  if (!sourcesParagraph) {
    return {
      ruleId: 'sources-normalization',
      feature: 'Sources Normalization',
      mode,
      passed: true,
      message: 'No Sources section found (skipped)',
      severity: 'info',
    };
  }

  let nextSibling = sourcesParagraph.nextElementSibling;
  while (nextSibling && nextSibling.tagName.toLowerCase() !== 'ol') {
    nextSibling = nextSibling.nextElementSibling;
  }

  if (!nextSibling || nextSibling.tagName.toLowerCase() !== 'ol') {
    return {
      ruleId: 'sources-normalization',
      feature: 'Sources Normalization',
      mode,
      passed: true,
      message: 'Sources paragraph found but no <ol> list found (skipped)',
      severity: 'info',
    };
  }

  const listItems = nextSibling.querySelectorAll('li');
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

  // Check if feature is enabled (enabled by default)
  const isEnabled = isFeatureEnabled(features, 'sourcesNormalize', true);

  if (!isEnabled) {
    // Feature is disabled, validate that sources are NOT normalized
    const issues: string[] = [];

    // Check paragraph formatting - should NOT have <strong><em> structure
    const strongTag = sourcesParagraph.querySelector('strong');
    if (strongTag) {
      const emTag = strongTag.querySelector('em');
      if (emTag) {
        const emText = emTag.textContent?.trim().toLowerCase() || '';
        if (emText === 'sources:') {
          issues.push('Sources paragraph is normalized (should not have <strong><em> structure)');
        }
      }
    }

    // Check list items - should NOT be wrapped in <em>
    listItems.forEach((li, index) => {
      if (li.children.length === 1 && li.children[0].tagName.toLowerCase() === 'em') {
        const hasTextOutside = Array.from(li.childNodes).some(
          (node) =>
            node.nodeType === Node.TEXT_NODE &&
            node !== li.children[0] &&
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
          ? `Sources section correctly not normalized (feature disabled)`
          : `${issues.length} normalization issue(s) found: ${issues.join('; ')}`,
      severity: issues.length === 0 ? 'info' : 'error',
      details: issues.length > 0 ? issues : null,
    };
  }

  // Feature is enabled, validate that sources ARE normalized
  const issues: string[] = [];

  const strongTag = sourcesParagraph.querySelector('strong');
  if (!strongTag) {
    issues.push('Sources paragraph missing <strong> tag');
  } else {
    const emTag = strongTag.querySelector('em');
    if (!emTag) {
      issues.push('Sources paragraph missing <em> tag inside <strong>');
    } else {
      const emText = emTag.textContent?.trim().toLowerCase() || '';
      if (emText !== 'sources:') {
        issues.push(
          `Sources <em> tag should contain "Sources:" but found "${emTag.textContent?.trim()}"`
        );
      }
    }
  }

  listItems.forEach((li, index) => {
    if (li.children.length === 1 && li.children[0].tagName.toLowerCase() === 'em') {
      const hasTextOutside = Array.from(li.childNodes).some(
        (node) =>
          node.nodeType === Node.TEXT_NODE &&
          node !== li.children[0] &&
          (node as Text).textContent?.trim()
      );
      if (hasTextOutside) {
        issues.push(`List item ${index + 1} has text outside <em> tag`);
      }
    } else {
      issues.push(`List item ${index + 1} is not wrapped in <em> tag`);
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
    expected: `Sources section formatted with <strong><em>Sources:</em></strong> and all list items wrapped in <em>`,
    actual: issues.length === 0 
      ? `Sources section correctly formatted (${listItems.length} item(s))`
      : `${issues.length} formatting issue(s) found`,
    details: issues.length > 0 ? issues : null,
  };
}

function validateRelativePaths(doc: Document, mode: OutputMode, features: FeatureFlags): TestResult {
  if (!isFeatureEnabled(features, 'relativePaths', false)) {
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

  // Check for absolute URLs (includes protocol-relative URLs like //cdn.example.com)
  // Exclude special link types: anchors, mail links, tel links, javascript, and data URIs
  const absoluteUrls = Array.from(links).filter((link) => {
    const href = link.getAttribute('href');
    if (!href) return false;
    
    // Skip special link types that shouldn't be converted to relative paths
    if (
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('javascript:') ||
      href.startsWith('data:')
    ) {
      return false;
    }
    
    // Check for protocol-relative URLs (//example.com) or full URLs (http://example.com)
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
 * Validates link spacing in the HTML
 * Checks that links have proper spacing and aren't preceded by opening punctuation
 */
function validateLinkSpacing(doc: Document, mode: OutputMode, features: FeatureFlags): TestResult {
  if (!isFeatureEnabled(features, 'spacing', true)) {
    return {
      ruleId: 'link-spacing',
      feature: 'Link Spacing',
      mode,
      passed: true,
      message: 'Link spacing feature disabled (skipped)',
      severity: 'info',
    };
  }

  const links = doc.querySelectorAll('a[href]');
  const issues: string[] = [];
  const OPENING_PUNCT = /[\("'\[\{\u201C\u2018]$/;
  
  links.forEach((link, index) => {
    const prevSibling = link.previousSibling;
    
    if (prevSibling && prevSibling.nodeType === Node.TEXT_NODE) {
      const text = prevSibling.textContent || '';
      const trimmedEnd = text.trimEnd();
      
      // Check if text ends with opening punctuation - should NOT add space
      if (OPENING_PUNCT.test(trimmedEnd)) {
        // This is correct - no space should be added after opening punct
        return;
      }
      
      // Check if there's proper spacing (space before link)
      if (!text.endsWith(' ') && !text.endsWith('\u00A0')) {
        // Check if link is at start of text - that's okay
        if (text.trim().length > 0) {
          issues.push(`Missing space before link: "${text.trim()}..."`);
        }
      }
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
    expected: 'Links preceded by space (except after opening punctuation)',
    actual: issues.length === 0 
      ? `All ${links.length} link(s) have proper spacing`
      : `${issues.length} link(s) have spacing issues`,
  };
}

/**
 * Validates that Sources links are removed when removeSourcesLinks feature is enabled
 */
function validateRemoveSourcesLinks(doc: Document, mode: OutputMode, features: FeatureFlags): TestResult {
  // Find Sources section (same logic as normalizeSources)
  const paragraphs = doc.querySelectorAll('p');
  let sourcesOl: Element | null = null;
  
  paragraphs.forEach(p => {
    const text = p.textContent?.trim() || '';
    const lowerText = text.toLowerCase();
    
    if (lowerText === 'sources' || lowerText === 'sources:' || lowerText.startsWith('sources:')) {
      let nextSibling = p.nextElementSibling;
      while (nextSibling && nextSibling.tagName.toLowerCase() !== 'ol') {
        nextSibling = nextSibling.nextElementSibling;
      }
      if (nextSibling) {
        sourcesOl = nextSibling;
      }
    }
  });
  
  if (!sourcesOl) {
    return {
      ruleId: 'remove-sources-links',
      feature: 'Remove Sources Links',
      mode,
      passed: true,
      message: 'No Sources section found (skipped)',
      severity: 'info',
    };
  }
  
  const sourcesLinks = sourcesOl.querySelectorAll('a');
  const totalLinks = sourcesLinks.length;
  
  // If no anchor tags exist at all, feature state doesn't matter - nothing to remove
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
  
  // Check if feature is enabled
  const isEnabled = isFeatureEnabled(features, 'removeSourcesLinks', true);
  
  if (isEnabled) {
    // Feature enabled: validate that NO anchor tags exist
    return {
      ruleId: 'remove-sources-links',
      feature: 'Remove Sources Links',
      mode,
      passed: totalLinks === 0,
      message: totalLinks === 0 
        ? `No anchor tags in Sources section (correct)`
        : `${totalLinks} anchor tag(s) found in Sources (should be removed)`,
      severity: totalLinks === 0 ? 'info' : 'error',
      expected: 'No <a> tags in Sources <ol>',
      actual: totalLinks === 0 
        ? 'No anchor tags found in Sources'
        : `${totalLinks} anchor tag(s) present in Sources`,
    };
  } else {
    // Feature disabled: validate that anchor tags ARE present (feature not applied)
    return {
      ruleId: 'remove-sources-links',
      feature: 'Remove Sources Links',
      mode,
      passed: totalLinks > 0,
      message: totalLinks > 0 
        ? `${totalLinks} anchor tag(s) found in Sources (feature disabled, not applied)`
        : `No anchor tags in Sources (feature disabled, expected links to remain)`,
      severity: totalLinks > 0 ? 'info' : 'warning',
      expected: '<a> tags present in Sources (feature disabled)',
      actual: totalLinks > 0 
        ? `${totalLinks} anchor tag(s) found in Sources`
        : 'No anchor tags (unexpected when feature disabled)',
    };
  }
}

/**
 * Validates that ordered list items with colons have bold labels
 * Excludes Sources section lists
 */
function validateOlBoldLabels(doc: Document, mode: OutputMode, features: FeatureFlags): TestResult {
  // Identify Sources ol lists (same logic as normalizeSources)
  const sourcesOlSet = new Set<Element>();
  
  const paragraphs = doc.querySelectorAll('p');
  paragraphs.forEach(p => {
    const text = p.textContent?.trim() || '';
    const lowerText = text.toLowerCase();
    
    if (lowerText === 'sources' || lowerText === 'sources:' || lowerText.startsWith('sources:')) {
      let nextSibling = p.nextElementSibling;
      while (nextSibling && nextSibling.tagName.toLowerCase() !== 'ol') {
        nextSibling = nextSibling.nextElementSibling;
      }
      if (nextSibling) {
        sourcesOlSet.add(nextSibling);
      }
    }
  });
  
  // Check ordered lists, excluding Sources
  const olItems = doc.querySelectorAll('ol > li');
  let itemsWithColon = 0;
  let itemsWithBold = 0;
  let skippedSources = 0;
  
  olItems.forEach(li => {
    // Skip if this is a Sources list
    if (sourcesOlSet.has(li.parentElement!)) {
      skippedSources++;
      return;
    }
    
    const text = li.textContent || '';
    if (text.includes(':')) {
      itemsWithColon++;
      // Check if text before colon is wrapped in strong
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
    passed: hasContent && hasValidElements,
    message:
      hasContent && hasValidElements
        ? 'HTML structure is valid'
        : 'HTML structure is invalid or empty',
    severity: hasContent && hasValidElements ? 'info' : 'error',
  };
}

export function validateMode(html: string, mode: OutputMode, features: FeatureFlags): ValidationResults {
  // Parse DOM once and pass Document to all validators (performance optimization)
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const results = new ValidationResultsImpl();

  if (mode === 'regular') {
    results.addResult(validateBasicStructure(doc, mode));
    results.addResult(validateHeadingStrong(doc, mode, features));
    results.addResult(validateLinkAttributes(doc, mode, features));
    results.addResult(validateListNormalize(doc, mode));
    results.addResult(validateLinkSpacing(doc, mode, features));
    results.addResult(validateOlBoldLabels(doc, mode, features));
    results.addResult(validateOlHeaderConversion(doc, mode, features));
  }

  if (mode === 'blogs') {
    results.addResult(validateHeadingStrong(doc, mode, features));
    results.addResult(validateKeyTakeaways(doc, mode, features));
    results.addResult(validateH1AfterKeyTakeaways(doc, mode, features));
    results.addResult(validateLinkAttributes(doc, mode, features));
    results.addResult(validateSpacing(doc, mode, features));
    results.addResult(validateOlHeaderConversion(doc, mode, features));
    results.addResult(validateRelativePaths(doc, mode, features));
    results.addResult(validateListNormalize(doc, mode));
    results.addResult(validateSourcesNormalize(doc, mode, features));
    results.addResult(validateLinkSpacing(doc, mode, features));
    results.addResult(validateRemoveSourcesLinks(doc, mode, features));
    results.addResult(validateOlBoldLabels(doc, mode, features));
  }

  if (mode === 'shoppables') {
    results.addResult(validateHeadingStrong(doc, mode, features));
    results.addResult(validateLinkAttributes(doc, mode, features));
    results.addResult(validateOlHeaderConversion(doc, mode, features));
    results.addResult(validateRelativePaths(doc, mode, features));
    results.addResult(validateListNormalize(doc, mode));
    results.addResult(validateSourcesNormalize(doc, mode, features));
    results.addResult(validateSpacing(doc, mode, features));
    results.addResult(validateLinkSpacing(doc, mode, features));
    results.addResult(validateRemoveSourcesLinks(doc, mode, features));
    results.addResult(validateOlBoldLabels(doc, mode, features));
  }

  return results;
}

