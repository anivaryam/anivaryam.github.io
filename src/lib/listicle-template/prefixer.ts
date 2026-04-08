export interface PrefixOptions {
  templateName: string;
  shopifyMode?: boolean;
}

const ROOT_ELEMENTS = ['html', 'body', ':root'];
const COMMENT_PLACEHOLDER_PREFIX = '___CSS_CMT_';
const PLACEHOLDER_RE = new RegExp(`^${COMMENT_PLACEHOLDER_PREFIX}\\d+___`);

interface StrippedComment {
  placeholder: string;
  original: string;
}

export function stripComments(css: string): { stripped: string; comments: StrippedComment[] } {
  const comments: StrippedComment[] = [];
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, (match) => {
    const placeholder = `${COMMENT_PLACEHOLDER_PREFIX}${comments.length}___`;
    comments.push({ placeholder, original: match });
    return placeholder;
  });
  return { stripped, comments };
}

export function restoreComments(css: string, comments: StrippedComment[]): string {
  let result = css;
  for (const { placeholder, original } of comments) {
    result = result.replaceAll(placeholder, original);
  }
  return result;
}

function isRootElement(selector: string): boolean {
  const lower = selector.trim().toLowerCase();
  return ROOT_ELEMENTS.some(el => lower === el || lower.startsWith(el + ':') || lower.startsWith(el + ' '));
}

function isGlobalResetSelector(selectorPart: string): boolean {
  const selectors = selectorPart.split(',').map(s => s.trim().toLowerCase());
  return selectors.every(s => s === '*' || isRootElement(s));
}

function prefixSelector(selector: string, templateName: string): string {
  const trimmed = selector.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('@') || trimmed.startsWith('//')) return trimmed;

  const classPrefix = templateName.startsWith('.') ? templateName : `.${templateName}`;
  const lowerTrimmed = trimmed.toLowerCase();

  // Rewrite root elements (html, body, :root) to target the template class
  for (const el of ROOT_ELEMENTS) {
    if (lowerTrimmed === el) return classPrefix;
    if (lowerTrimmed.startsWith(el + ':') || lowerTrimmed.startsWith(el + ' ')) {
      return classPrefix + trimmed.slice(el.length);
    }
  }

  return `${classPrefix} ${trimmed}`;
}

function splitRules(css: string): string[] {
  const result: string[] = [];
  let current = '';
  let braceDepth = 0;

  for (let i = 0; i < css.length; i++) {
    const char = css[i];

    if (char === '{') {
      braceDepth++;
      current += char;
    } else if (char === '}') {
      braceDepth--;
      current += char;
      if (braceDepth === 0 && current.trim()) {
        result.push(current.trim());
        current = '';
      }
    } else if (braceDepth === 0 && char === '\n' && css[i + 1] === '\n') {
      if (current.trim()) result.push(current.trim());
      current = '';
      i++;
    } else if (braceDepth === 0 && char === '_') {
      const suffix = css.slice(i);
      const match = suffix.match(PLACEHOLDER_RE);
      if (match) {
        if (current.trim()) result.push(current.trim());
        result.push(match[0]);
        i += match[0].length - 1;
        current = '';
      } else {
        current += char;
      }
    } else {
      current += char;
    }
  }

  if (current.trim()) result.push(current.trim());
  return result;
}

function prefixInnerRules(innerContent: string, templateName: string, shopifyMode: boolean): string {
  const rules = splitRules(innerContent);

  return rules.map(rule => {
    const trimmed = rule.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith(COMMENT_PLACEHOLDER_PREFIX)) return trimmed;
    if (trimmed.startsWith('@') || trimmed.startsWith('//')) return trimmed;

    if (trimmed.includes('{')) {
      const braceIndex = trimmed.indexOf('{');
      const selectorPart = trimmed.slice(0, braceIndex);
      const stylePart = trimmed.slice(braceIndex);

      if (shopifyMode && isGlobalResetSelector(selectorPart)) return '';

      const selectors = selectorPart.split(',').map(s => s.trim()).filter(Boolean);
      const prefixedSelectors = selectors.map(s => prefixSelector(s, templateName)).join(', ');
      return prefixedSelectors + stylePart;
    }

    return prefixSelector(trimmed, templateName);
  }).filter(Boolean).join('\n\n');
}

function prefixMediaQuery(mediaQuery: string, templateName: string, shopifyMode: boolean): string {
  const match = mediaQuery.match(/^(@media[^{]+)\{(.+)\}$/s);
  if (!match) return mediaQuery;
  return `${match[1]}{\n${prefixInnerRules(match[2], templateName, shopifyMode)}\n}`;
}

function prefixSupportsQuery(supportsQuery: string, templateName: string, shopifyMode: boolean): string {
  const match = supportsQuery.match(/^(@supports[^{]+)\{(.+)\}$/s);
  if (!match) return supportsQuery;
  return `${match[1]}{\n${prefixInnerRules(match[2], templateName, shopifyMode)}\n}`;
}

export function prefixCss(css: string, templateName: string, shopifyMode = false): string {
  if (!css || !css.trim()) return '';
  if (!templateName) return css;

  // Strip <style> / </style> wrapper tags if the user pastes a full HTML style block
  css = css.replace(/<\/?style[^>]*>/gi, '').trim();

  const { stripped, comments } = stripComments(css);
  const normalized = stripped.replace(/\n[ \t]+\n/g, '\n\n');
  const rules = splitRules(normalized);

  const prefixed = rules.map(rule => {
    const trimmed = rule.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith(COMMENT_PLACEHOLDER_PREFIX)) return trimmed;

    if (trimmed.startsWith('@media')) return prefixMediaQuery(trimmed, templateName, shopifyMode);
    if (trimmed.startsWith('@supports')) return prefixSupportsQuery(trimmed, templateName, shopifyMode);
    if (trimmed.startsWith('@') || trimmed.startsWith('//')) return trimmed;

    if (trimmed.includes('{')) {
      const braceIndex = trimmed.indexOf('{');
      const selectorPart = trimmed.slice(0, braceIndex);
      const stylePart = trimmed.slice(braceIndex);

      if (shopifyMode && isGlobalResetSelector(selectorPart)) return '';

      const selectors = selectorPart.split(',').map(s => s.trim()).filter(Boolean);
      const prefixedSelectors = selectors.map(s => prefixSelector(s, templateName)).join(', ');
      return prefixedSelectors + stylePart;
    }

    return prefixSelector(trimmed, templateName);
  }).filter(Boolean);

  return restoreComments(prefixed.join('\n\n'), comments);
}

export function processCss(input: string, options: PrefixOptions): string {
  return prefixCss(input, options.templateName, options.shopifyMode);
}
