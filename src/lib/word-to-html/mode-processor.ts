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
import { removeSourcesLinks } from './mode-remove-sources-links';
import { addSpacing } from './mode-spacing';
import { addLinkSpacing } from './mode-link-spacing';
import { addBrBeforeReadMore, addBrBeforeSources } from './mode-br-spacing';
import type { OutputMode, FeatureFlags } from './converter';

/**
 * Applies heading strong tag wrapping/unwrapping based on feature flag
 */
function applyHeadingStrong(html: string, features: FeatureFlags): string {
  return features.headingStrong === false
    ? unwrapHeadingsFromStrong(html)
    : wrapHeadingsInStrong(html);
}

export function processMode(html: string, mode: OutputMode, features: FeatureFlags = {}): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  let processedHtml = html;

  // List normalization - applies to all modes (regular, blogs, shoppables)
  processedHtml = normalizeLists(processedHtml);

  // Regular mode: minimal processing (list + link spacing only)
  if (mode === 'regular') {
    processedHtml = addLinkSpacing(processedHtml);
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

    // H1 removal
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

    // Relative paths (disabled by default)
    if (features.relativePaths === true) {
      processedHtml = convertToRelativePaths(processedHtml);
    }

    // Remove links in Sources section (must run before normalizeSources)
    if (features.removeSourcesLinks !== false) {
      processedHtml = removeSourcesLinks(processedHtml);
    }

    // Sources normalization
    if (features.sourcesNormalize !== false) {
      processedHtml = normalizeSources(processedHtml);
    }
    
    // Link spacing (at the end, after all other processing)
    processedHtml = addLinkSpacing(processedHtml);
    
    // Final list normalization pass (after all processing that might modify list items)
    // This ensures spacing is normalized even if other functions reintroduced multiple spaces
    processedHtml = normalizeLists(processedHtml);
    return processedHtml;
  }

  // Shoppables mode features
  if (mode === 'shoppables') {
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

    // BR spacing before read more (works independently, replaces &nbsp; if spacing rules added them)
    if (features.brBeforeReadMore === true) {
      processedHtml = addBrBeforeReadMore(processedHtml);
    }

    // BR spacing before sources (works independently, replaces &nbsp; if spacing rules added them)
    if (features.brBeforeSources === true) {
      processedHtml = addBrBeforeSources(processedHtml);
    }

    // Remove links in Sources section (must run before normalizeSources)
    if (features.removeSourcesLinks !== false) {
      processedHtml = removeSourcesLinks(processedHtml);
    }

    // Sources normalization
    if (features.sourcesNormalize !== false) {
      processedHtml = normalizeSources(processedHtml);
    }
    
    // Link spacing (at the end, after all other processing)
    processedHtml = addLinkSpacing(processedHtml);
    
    // Final list normalization pass (after all processing that might modify list items)
    // This ensures spacing is normalized even if other functions reintroduced multiple spaces
    processedHtml = normalizeLists(processedHtml);
    return processedHtml;
  }

  console.warn(`Unknown mode: ${mode}`);
  throw new Error(`Unknown mode: ${mode}`);
}

