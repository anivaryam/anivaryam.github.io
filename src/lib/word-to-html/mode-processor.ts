/**
 * Mode Processor
 * Applies mode-specific formatting based on selected mode and enabled features
 */

import { wrapHeadingsInStrong, unwrapHeadingsFromStrong } from './mode-heading-strong';
import { formatKeyTakeaways } from './mode-key-takeaways';
import { removeH1AfterKeyTakeaways } from './mode-h1-removal';
import { addLinkAttributes } from './mode-link-attributes';
import { normalizeLists } from './mode-list-normalize';
import { convertOlHeaders } from './mode-ol-header-conversion';
import { convertToRelativePaths } from './mode-relative-paths';
import { normalizeSources } from './mode-sources-normalize';
import { normalizeDisclaimer } from './mode-disclaimer-normalize';
import { removeSourcesLinks } from './mode-remove-sources-links';
import { addSpacing, addSpacingBetweenParagraphs } from './mode-spacing';
import { addLinkSpacing } from './mode-link-spacing';
import { addBrBeforeReadMore, addBrBeforeSources } from './mode-br-spacing';
import { wrapLinksStrongUnderline } from './mode-wrap-links-strong-underline';
import { convertTablesToLists } from './mode-table-to-list';
import { applyImageLibrary } from './image-library';
import { applyCustomSpacer } from './html-spacing';
import type { OutputMode, FeatureFlags } from './converter';

/** Shared defaults for conversion, validation, and the feature controls. */
export function resolveFeatures(mode: OutputMode, features: FeatureFlags = {}): Required<FeatureFlags> {
  return {
    headingStrong: features.headingStrong ?? mode !== 'regular',
    keyTakeaways: features.keyTakeaways ?? mode === 'blogs',
    h1Removal: features.h1Removal ?? mode === 'blogs',
    linkAttributes: features.linkAttributes ?? mode !== 'regular',
    relativePaths: features.relativePaths ?? false,
    spacing: features.spacing ?? mode === 'blogs',
    paragraphSpacing: features.paragraphSpacing ?? false,
    olHeaderConversion: features.olHeaderConversion ?? mode !== 'regular',
    sourcesNormalize: features.sourcesNormalize ?? mode !== 'regular',
    sourcesItalic: features.sourcesItalic ?? mode !== 'regular',
    disclaimerNormalize: features.disclaimerNormalize ?? mode !== 'regular',
    removeSourcesLinks: features.removeSourcesLinks ?? mode !== 'regular',
    brBeforeReadMore: features.brBeforeReadMore ?? false,
    brBeforeSources: features.brBeforeSources ?? false,
    wrapLinksStrongUnderline: features.wrapLinksStrongUnderline ?? false,
    tablesToLists: features.tablesToLists ?? false,
    customSpacer: features.customSpacer ?? '',
    imageLibrary: features.imageLibrary ?? [],
  };
}

/**
 * Applies heading strong tag wrapping/unwrapping based on feature flag
 */
function applyHeadingStrong(html: string, features: FeatureFlags): string {
  return features.headingStrong === false
    ? unwrapHeadingsFromStrong(html)
    : wrapHeadingsInStrong(html);
}

export function processMode(html: string, mode: OutputMode, features: FeatureFlags = {}): string {
  const processed = runModePipeline(html, mode, features);
  // The spacing rules emit the default spacer; swap it for the configured
  // markup once the mode run is complete so BR spacers stay untouched.
  return applyCustomSpacer(processed, features.customSpacer);
}

function runModePipeline(html: string, mode: OutputMode, features: FeatureFlags = {}): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  let processedHtml = html;
  features = resolveFeatures(mode, features);

  // List normalization - applies to all modes (regular, blogs, shoppables)
  processedHtml = normalizeLists(processedHtml);

  // Regular mode: minimal processing by default, but apply features when enabled
  if (mode === 'regular') {
    // Apply features when enabled (same as blogs mode)
    // Heading strong tags
    processedHtml = applyHeadingStrong(processedHtml, features);

    // Key Takeaways formatting
    if (features.keyTakeaways !== false) {
      processedHtml = formatKeyTakeaways(processedHtml);
    }

    // Source Title styles are normalized to H1 before this removal.
    if (features.h1Removal !== false) {
      processedHtml = removeH1AfterKeyTakeaways(processedHtml);
    }

    // Link attributes
    if (features.linkAttributes !== false) {
      processedHtml = addLinkAttributes(processedHtml);
    }

    // OL Header Conversion
    if (features.olHeaderConversion !== false) {
      processedHtml = convertOlHeaders(processedHtml);
    }

    // Spacing
    if (features.spacing !== false) {
      processedHtml = addSpacing(processedHtml);
    }

    // Paragraph spacing between consecutive paragraphs
    if (features.paragraphSpacing === true) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(processedHtml, 'text/html');
      addSpacingBetweenParagraphs(doc);
      processedHtml = doc.body.innerHTML;
    }

    // Relative paths (disabled by default)
    if (features.relativePaths === true) {
      processedHtml = convertToRelativePaths(processedHtml);
    }

    // Sources normalization
    if (features.sourcesNormalize !== false) {
      processedHtml = normalizeSources(processedHtml, features.sourcesItalic !== false);
    }

    // Disclaimer normalization
    if (features.disclaimerNormalize !== false) {
      processedHtml = normalizeDisclaimer(processedHtml);
    }

    // Link spacing (must run before removeSourcesLinks to preserve whitespace)
    processedHtml = addLinkSpacing(processedHtml);

    // Remove links in Sources section
    if (features.removeSourcesLinks !== false) {
      processedHtml = removeSourcesLinks(processedHtml);
    }

    // Final list normalization pass (no merging: see normalizeLists)
    processedHtml = normalizeLists(processedHtml, { mergeLists: false });

    return processedHtml;
  }

  // Blogs mode features
  if (mode === 'blogs') {
    // Heading strong tags (must be first to wrap headings before other processing)
    processedHtml = applyHeadingStrong(processedHtml, features);

    // Key Takeaways formatting
    if (features.keyTakeaways !== false) {
      processedHtml = formatKeyTakeaways(processedHtml);
    }

    if (features.h1Removal !== false) {
      processedHtml = removeH1AfterKeyTakeaways(processedHtml);
    }

    // Link attributes
    if (features.linkAttributes !== false) {
      processedHtml = addLinkAttributes(processedHtml);
    }

    // OL Header Conversion (enabled by default, before spacing so converted headings get spacing)
    if (features.olHeaderConversion !== false) {
      processedHtml = convertOlHeaders(processedHtml);
    }

    // Spacing (after OL conversion so converted headings get spacing)
    if (features.spacing !== false) {
      processedHtml = addSpacing(processedHtml);
    }

    // Saved Shopify images replace image CTAs after spacing, so the image keeps
    // the spacer its "Alt Image Text:" paragraph got, and before paragraph
    // spacing, which would split the alt text and link paragraphs. Relative
    // paths still run afterwards.
    processedHtml = applyImageLibrary(processedHtml, features.imageLibrary ?? [], features.linkAttributes !== false);

    // Paragraph spacing between consecutive paragraphs (disabled by default)
    if (features.paragraphSpacing === true) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(processedHtml, 'text/html');
      addSpacingBetweenParagraphs(doc);
      processedHtml = doc.body.innerHTML;
    }

    // Relative paths (disabled by default)
    if (features.relativePaths === true) {
      processedHtml = convertToRelativePaths(processedHtml);
    }

    // Sources normalization
    if (features.sourcesNormalize !== false) {
      processedHtml = normalizeSources(processedHtml, features.sourcesItalic !== false);
    }

    // Disclaimer normalization
    if (features.disclaimerNormalize !== false) {
      processedHtml = normalizeDisclaimer(processedHtml);
    }

    // Link spacing (must run before removeSourcesLinks to preserve whitespace)
    processedHtml = addLinkSpacing(processedHtml);

    // Remove links in Sources section (before wrapping, so plain citations
    // do not keep link styling)
    if (features.removeSourcesLinks !== false) {
      processedHtml = removeSourcesLinks(processedHtml);
    }

    // Wrap non-alt-text links in <strong><u> (disabled by default)
    if (features.wrapLinksStrongUnderline === true) {
      processedHtml = wrapLinksStrongUnderline(processedHtml);
    }

    // Final list normalization pass (after all processing that might modify list items)
    // This ensures spacing is normalized even if other functions reintroduced multiple spaces
    // No merging: lists the mode steps made adjacent stay apart (see normalizeLists)
    // Unbolded list labels are bolded here, after Sources lists are identified
    processedHtml = normalizeLists(processedHtml, { mergeLists: false, boldLabels: true });
    return processedHtml;
  }

  // Shoppables mode features
  if (mode === 'shoppables') {
    // Table to list conversion (disabled by default, before Heading Strong so
    // the row headings and their lists get the same processing as the rest)
    if (features.tablesToLists === true) {
      processedHtml = convertTablesToLists(processedHtml);
    }

    // Heading strong tags (must be first to wrap headings before other processing)
    processedHtml = applyHeadingStrong(processedHtml, features);

    // Link attributes
    if (features.linkAttributes !== false) {
      processedHtml = addLinkAttributes(processedHtml);
    }

    // Relative paths (disabled by default)
    if (features.relativePaths === true) {
      processedHtml = convertToRelativePaths(processedHtml);
    }

    // OL Header Conversion (enabled by default, before spacing so converted headings get spacing)
    if (features.olHeaderConversion !== false) {
      processedHtml = convertOlHeaders(processedHtml);
    }

    // Spacing (disabled by default, only applied when explicitly enabled)
    if (features.spacing === true) {
      processedHtml = addSpacing(processedHtml);
    }

    if (features.paragraphSpacing === true) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(processedHtml, 'text/html');
      addSpacingBetweenParagraphs(doc);
      processedHtml = doc.body.innerHTML;
    }

    // BR spacing before read more (works independently, replaces &nbsp; if spacing rules added them)
    if (features.brBeforeReadMore === true) {
      processedHtml = addBrBeforeReadMore(processedHtml);
    }

    // BR spacing before sources (works independently, replaces &nbsp; if spacing rules added them)
    if (features.brBeforeSources === true) {
      processedHtml = addBrBeforeSources(processedHtml);
    }

    // Sources normalization
    if (features.sourcesNormalize !== false) {
      processedHtml = normalizeSources(processedHtml, features.sourcesItalic !== false);
    }

    // Disclaimer normalization
    if (features.disclaimerNormalize !== false) {
      processedHtml = normalizeDisclaimer(processedHtml);
    }

    // Link spacing (must run before removeSourcesLinks to preserve whitespace)
    processedHtml = addLinkSpacing(processedHtml);

    // Remove links in Sources section (before wrapping, so plain citations
    // do not keep link styling)
    if (features.removeSourcesLinks !== false) {
      processedHtml = removeSourcesLinks(processedHtml);
    }

    // Wrap non-alt-text links in <strong><u> (disabled by default)
    if (features.wrapLinksStrongUnderline === true) {
      processedHtml = wrapLinksStrongUnderline(processedHtml);
    }

    // Final list normalization pass (after all processing that might modify list items)
    // This ensures spacing is normalized even if other functions reintroduced multiple spaces
    // No merging: lists the mode steps made adjacent stay apart (see normalizeLists)
    // Unbolded list labels are bolded here, after Sources lists are identified
    processedHtml = normalizeLists(processedHtml, { mergeLists: false, boldLabels: true });
    return processedHtml;
  }

  console.warn(`Unknown mode: ${mode}`);
  throw new Error(`Unknown mode: ${mode}`);
}
