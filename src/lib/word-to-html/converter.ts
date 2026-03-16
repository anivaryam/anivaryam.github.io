/**
 * Word to HTML Converter (v2)
 * Integrates advanced conversion logic from word-to-html-v2
 */

const isNode = typeof process !== 'undefined' && process.versions?.node;
const isBrowser = typeof window !== 'undefined';

function logError(message: string, error: unknown): void {
  if (isNode) {
    console.error(message, error);
  } else if (isBrowser) {
    console.error(message, error);
  }
}

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
  sourcesItalic?: boolean;
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
    if (!sanitized) {
      throw new Error('Sanitization returned null or undefined');
    }
    
    // Step 2: Clean HTML structure (remove unnecessary tags, unwrap elements)
    let cleanedStructure = cleanHtml(sanitized);
    if (!cleanedStructure) {
      throw new Error('HTML cleaning returned null or undefined');
    }
    
    // Step 3: Apply mode-specific processing
    let processed = processMode(cleanedStructure, mode, features);
    if (!processed) {
      throw new Error('Mode processing returned null or undefined');
    }
    
    // Step 4: Format HTML for display
    const formatted = formatCompact(processed);
    if (!formatted) {
      throw new Error('HTML formatting returned null or undefined');
    }
    
    return { formatted, unformatted: processed };
  } catch (error) {
    logError('Conversion error:', error);
    throw error instanceof Error ? error : new Error(String(error));
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

