/**
 * Mode Utility: Strip AI tracking parameters
 * AI draft generators tag the links they emit with a tracking query parameter
 * (e.g. ChatGPT appends ?utm_source=chatgpt.com). Published, the tag would
 * misattribute every click to the generator, so it is removed from links.
 */

/**
 * utm_source values AI generators append to links. Lowercase; compared after
 * percent-decoding. Add an entry here to support a new generator.
 */
export const AI_UTM_SOURCES = [
  'chatgpt.com',
  'chatgpt',
  'openai',
  'openai.com',
  'perplexity',
  'perplexity.ai',
  'gemini',
  'gemini.google.com',
  'copilot',
  'copilot.microsoft.com',
  'claude',
  'claude.ai',
  'grok',
  'grok.com',
  'deepseek',
  'deepseek.com',
];

export function stripAiTracking(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    doc.querySelectorAll('a[href]').forEach(link => {
      const href = link.getAttribute('href');
      if (!href) return;
      const stripped = stripAiTrackingFromUrl(href);
      if (stripped !== href) {
        link.setAttribute('href', stripped);
      }
    });

    return doc.body.innerHTML;
  } catch (e) {
    console.warn('AI tracking removal failed:', e);
    return html;
  }
}

/**
 * Removes the utm_* parameters from one URL when its utm_source names an AI
 * generator. Other parameters and the hash stay byte-for-byte; a URL without
 * an AI utm_source is returned untouched. Works on relative URLs too.
 */
export function stripAiTrackingFromUrl(href: string): string {
  const unwrapped = stripInsideGoogleRedirect(href);
  if (unwrapped !== null) return unwrapped;

  const hashIndex = href.indexOf('#');
  const hash = hashIndex === -1 ? '' : href.slice(hashIndex);
  const base = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const queryIndex = base.indexOf('?');
  if (queryIndex === -1) return href;

  const params = base.slice(queryIndex + 1).split('&');
  const source = params.find(param => paramKey(param) === 'utm_source');
  if (!source || !AI_UTM_SOURCES.includes(paramValue(source))) return href;

  // The generator that set utm_source injected the whole utm_* set with it
  const kept = params.filter(param => !paramKey(param).startsWith('utm_'));
  return base.slice(0, queryIndex) + (kept.length > 0 ? `?${kept.join('&')}` : '') + hash;
}

/**
 * Google Docs exports wrap links as google.com/url?q=<target> (see
 * getStoreHost in image-library.ts), so the tracking parameters travel
 * percent-encoded inside q. Returns the wrapper with a cleaned target, the
 * unchanged href when the target carries no AI tracking, or null when the
 * href is not such a wrapper.
 */
function stripInsideGoogleRedirect(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const target = url.searchParams.get('q');
  if (host !== 'google.com' || url.pathname !== '/url' || !target) return null;
  const stripped = stripAiTrackingFromUrl(target);
  if (stripped === target) return href;
  url.searchParams.set('q', stripped);
  return url.toString();
}

function paramKey(param: string): string {
  const eq = param.indexOf('=');
  return decodeComponent(eq === -1 ? param : param.slice(0, eq)).trim().toLowerCase();
}

function paramValue(param: string): string {
  const eq = param.indexOf('=');
  if (eq === -1) return '';
  return decodeComponent(param.slice(eq + 1)).trim().toLowerCase().replace(/\/+$/, '');
}

function decodeComponent(text: string): string {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '));
  } catch {
    return text;
  }
}
