/**
 * Word to HTML Converter (v2)
 * Integrates advanced conversion logic from word-to-html-v2
 */

import { cleanHtml } from './html-cleaner';
import { sanitizeHtml } from './html-sanitizer';
import { formatCompact } from './html-formatter';
import { processMode } from './mode-processor';
import { cleanWordHtml } from './word-html-cleaner';

export type OutputMode = 'regular' | 'blogs' | 'shoppables';

export interface FeatureFlags {
  headingStrong?: boolean;
  keyTakeaways?: boolean;
  h1Removal?: boolean;
  linkAttributes?: boolean;
  relativePaths?: boolean;
  spacing?: boolean;
  olHeaderConversion?: boolean;
  sourcesNormalize?: boolean;
  removeSourcesLinks?: boolean;
  brBeforeReadMore?: boolean;
  brBeforeSources?: boolean;
}

/**
 * Convert HTML to output (matches convertToHtml from converter.js)
 * This function expects HTML that has already been cleaned by cleanWordHtml
 */
export function convertToHtml(
  cleanedHtml: string,
  mode: OutputMode = 'regular',
  features: FeatureFlags = {}
): { formatted: string; unformatted: string } {
  if (!cleanedHtml || !cleanedHtml.trim()) {
    return { formatted: '', unformatted: '' };
  }

  try {
    // Step 1: Sanitize HTML (removes styling and unsafe attributes)
    let sanitized = sanitizeHtml(cleanedHtml);
    
    // Step 2: Clean HTML structure (remove unnecessary tags, unwrap elements)
    let cleanedStructure = cleanHtml(sanitized);
    
    // Step 3: Apply mode-specific processing
    let processed = processMode(cleanedStructure, mode, features);
    
    // Step 4: Format HTML for display
    const formatted = formatCompact(processed);
    
    return { formatted, unformatted: processed };
  } catch (error) {
    console.error('Conversion error:', error);
    return { formatted: '', unformatted: '' };
  }
}

/**
 * Main conversion function
 * This is a convenience function that does the full conversion including cleanWordHtml
 */
export function convertWordToHtml(
  input: string,
  mode: OutputMode = 'regular',
  features: FeatureFlags = {}
): string {
  if (!input || !input.trim()) return '';

  // Step 1: Clean Word HTML (removes Word-specific markup, images, etc.)
  const cleaned = cleanWordHtml(input);

  // Step 2-4: Convert using the main conversion function
  const result = convertToHtml(cleaned, mode, features);
  
  return result.formatted;
}

/**
 * Get unformatted HTML (for preview rendering)
 */
export function getUnformattedHtml(
  input: string,
  mode: OutputMode = 'regular',
  features: FeatureFlags = {}
): string {
  if (!input || !input.trim()) return '';

  // Step 1: Clean Word HTML
  const cleaned = cleanWordHtml(input);

  // Step 2-4: Convert using the main conversion function
  const result = convertToHtml(cleaned, mode, features);
  
  return result.unformatted;
}

