/**
 * Word HTML Cleaner
 * Comprehensive cleaning of Word HTML while preserving formatting
 * This matches the cleanWordHtml function from converter.js
 */

import { splitEmphasisOverrides } from './html-sanitizer';
import { nextNonSpacingElement, removeSpacingParagraphs, removeLayoutBreaks } from './html-spacing';
import { createInertContainer, prepareWordSource } from './word-source-formatting';

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}

function parseStyle(styleString: string): Record<string, string> {
  const styles: Record<string, string> = {};
  if (!styleString) return styles;
  
  styleString.split(';').forEach(rule => {
    const parts = rule.split(':').map(s => s.trim());
    if (parts.length === 2) {
      styles[parts[0].toLowerCase()] = parts[1];
    }
  });
  return styles;
}

function cleanStyleAttribute(styleString: string): string {
  if (!styleString) return '';
  
  const styles = parseStyle(styleString);
  const preservedStyles: Record<string, string> = {};
  
  const formattingProps = [
    'font-style', 'font-weight', 'text-decoration', 'font-size', 
    'font-family', 'color', 'background-color', 'background',
    'vertical-align', 'text-align', 'line-height', 'letter-spacing', 
    'text-transform', 'font-variant', 'text-indent', 'margin',
    'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
    'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
    'padding-inline-start', 'border', 'border-top', 'border-bottom', 'border-left', 'border-right',
    'border-color', 'border-style', 'border-width',
    'white-space', 'white-space-collapse', 'word-spacing', 'text-shadow', 'font-stretch',
    'text-decoration-line', 'text-decoration-skip-ink', 'text-wrap-mode',
    'font-variant-numeric', 'font-variant-east-asian', 'font-variant-alternates',
    'font-variant-position', 'font-variant-emoji',
    'display', 'list-style-type', 'dir', 'aria-level', 'role'
  ];
  
  const redundantDefaults: Record<string, string> = {
    'font-variant-numeric': 'normal',
    'font-variant-east-asian': 'normal',
    'font-variant-alternates': 'normal',
    'font-variant-position': 'normal',
    'font-variant-emoji': 'normal',
    'vertical-align': 'baseline',
    'background-color': 'transparent',
    'font-weight': '400',
    'font-style': 'normal',
    'text-decoration': 'none',
    'text-decoration-line': 'none'
  };
  
  Object.keys(styles).forEach(key => {
    const lowerKey = key.toLowerCase().trim();
    const value = styles[key].trim();
    
    if (lowerKey.includes('mso-') || lowerKey.startsWith('mso')) {
      return;
    }
    
    if (redundantDefaults[lowerKey] === value.toLowerCase()) {
      return;
    }
    
    if (formattingProps.includes(lowerKey)) {
      preservedStyles[key] = styles[key];
    } else if (!lowerKey.match(/^(o:|v:|xml)/) && 
               !lowerKey.includes('mso') &&
               !lowerKey.includes('word-wrap')) {
      preservedStyles[key] = styles[key];
    }
  });
  
  return Object.keys(preservedStyles)
    .map(k => `${k}: ${preservedStyles[k]}`)
    .join('; ');
}

function removeImages(element: Element): void {
  const images = element.querySelectorAll('img');
  images.forEach(img => img.remove());
  
  // Empty image wrappers are removed, but empty rows and cells stay: removing
  // them shifts the remaining cells into the wrong columns.
  const imageClassElements = element.querySelectorAll('[class*="image"], [class*="Image"]');
  imageClassElements.forEach(el => {
    if (!el.textContent?.trim() && !el.matches('tr, th, td')) el.remove();
  });
  
  const bgImageElements = element.querySelectorAll('[style*="background-image"]');
  bgImageElements.forEach(el => {
    if (!el.textContent?.trim() && !el.matches('tr, th, td')) el.remove();
  });
  
  const allElements = element.querySelectorAll('*');
  allElements.forEach(el => {
    const tagName = el.tagName.toLowerCase();
    if (tagName.includes('imagedata') || 
        tagName.includes('shape') || 
        tagName === 'pict' ||
        tagName.includes('bindata') ||
        tagName.includes('picture')) {
      el.remove();
    }
  });
  
  const emptyAnchors = element.querySelectorAll('a');
  emptyAnchors.forEach(anchor => {
    if (!anchor.textContent?.trim() && !anchor.children.length && !anchor.getAttribute('href')) {
      anchor.remove();
    }
  });
}

function preserveFormattingElements(element: Element): void {
  const allElements = element.querySelectorAll('*');
  const elementsToProcess = Array.from(allElements);
  
  elementsToProcess.forEach(el => {
    const style = el.getAttribute('style') || '';
    if (!style) return;
    
    const cleanedStyle = cleanStyleAttribute(style);
    if (cleanedStyle) {
      el.setAttribute('style', cleanedStyle);
    } else {
      el.removeAttribute('style');
    }
  });
  
  if (element.hasAttribute && element.hasAttribute('style')) {
    const style = element.getAttribute('style') || '';
    const cleanedStyle = cleanStyleAttribute(style);
    if (cleanedStyle) {
      element.setAttribute('style', cleanedStyle);
    } else {
      element.removeAttribute('style');
    }
  }
  
  // Superscript/subscript conversion belongs to html-sanitizer's shared
  // formatting extraction, which also preserves the original block structure.
}

function removeWordSpecificAttributes(element: Element): void {
  const allElements = element.querySelectorAll('*');
  
  allElements.forEach(el => {
    const attrsToRemove: string[] = [];
    
    Array.from(el.attributes).forEach(attr => {
      const attrName = attr.name.toLowerCase();
      
      if (attrName.startsWith('o:') || 
          attrName.startsWith('v:') || 
          attrName.startsWith('xmlns') ||
          attrName === 'xml:lang' ||
          (attrName === 'class' && (attr.value.includes('Mso') || attr.value.includes('mso-'))) ||
          (attrName === 'lang' && attr.value === 'EN-US')) {
        attrsToRemove.push(attr.name);
      }
      
      if (attrName === 'style') {
        const style = attr.value;
        const cleanedStyle = cleanStyleAttribute(style);
        if (cleanedStyle) {
          el.setAttribute('style', cleanedStyle);
        } else {
          attrsToRemove.push(attr.name);
        }
      }
    });
    
    attrsToRemove.forEach(attrName => el.removeAttribute(attrName));
    
    if (el.tagName === 'A' && (el as HTMLAnchorElement).href) {
      const href = el.getAttribute('href');
      if (href && !href.startsWith('#') && !/^(javascript|vbscript|data):/i.test(href)) {
        el.setAttribute('href', href);
      }
    }
  });
}

function convertFontTagsToSpans(tempDiv: Element): void {
  const fontTags = tempDiv.querySelectorAll('font');
  fontTags.forEach(font => {
    const span = font.ownerDocument.createElement('span');
    
    Array.from(font.attributes).forEach(attr => {
      if (attr.name.toLowerCase() === 'color') {
        const existingStyle = span.getAttribute('style') || '';
        span.setAttribute('style', existingStyle ? `${existingStyle}; color: ${attr.value}` : `color: ${attr.value}`);
      } else if (attr.name.toLowerCase() === 'face') {
        const existingStyle = span.getAttribute('style') || '';
        span.setAttribute('style', existingStyle ? `${existingStyle}; font-family: ${attr.value}` : `font-family: ${attr.value}`);
      } else if (attr.name.toLowerCase() === 'size') {
        const size = parseInt(attr.value);
        if (!isNaN(size)) {
          const fontSize = size <= 1 ? '0.6em' : 
                         size === 2 ? '0.8em' :
                         size === 3 ? '1em' :
                         size === 4 ? '1.2em' :
                         size === 5 ? '1.5em' :
                         size === 6 ? '2em' : '1em';
          const existingStyle = span.getAttribute('style') || '';
          span.setAttribute('style', existingStyle ? `${existingStyle}; font-size: ${fontSize}` : `font-size: ${fontSize}`);
        }
      } else if (attr.name.toLowerCase() !== 'class' && !attr.name.toLowerCase().startsWith('mso')) {
        span.setAttribute(attr.name, attr.value);
      }
    });
    
    span.innerHTML = font.innerHTML;
    font.parentNode?.replaceChild(span, font);
  });
}

function normalizeFormattingTags(element: Element): void {
  const elementsWithItalic = element.querySelectorAll('span[style*="font-style"][style*="italic"]');
  const italicElements = Array.from(elementsWithItalic);
  
  italicElements.forEach(el => {
    const style = el.getAttribute('style') || '';
    const styleObj = parseStyle(style);
    
    const otherStyles = Object.keys(styleObj).filter(k => 
      k !== 'font-style' && 
      k !== 'mso-' && 
      !k.startsWith('mso')
    );
    
    if (styleObj['font-style'] && styleObj['font-style'].toLowerCase().includes('italic')) {
      if (otherStyles.length <= 1) {
        const italic = el.ownerDocument.createElement('em');
        if (otherStyles.length > 0) {
          const preservedStyle = otherStyles.map(k => `${k}: ${styleObj[k]}`).join('; ');
          if (preservedStyle) italic.setAttribute('style', preservedStyle);
        }
        italic.innerHTML = el.innerHTML;
        if (el.parentNode) {
          el.parentNode.replaceChild(italic, el);
        }
      }
    }
  });
  
  const elementsWithBold = element.querySelectorAll('span[style*="font-weight"]');
  const boldElements = Array.from(elementsWithBold);
  
  boldElements.forEach(el => {
    const style = el.getAttribute('style') || '';
    const styleObj = parseStyle(style);
    const fontWeight = styleObj['font-weight'];
    
    if (fontWeight && (
      fontWeight.toLowerCase() === 'bold' || 
      parseInt(fontWeight) >= 700
    )) {
      const otherStyles = Object.keys(styleObj).filter(k => 
        k !== 'font-weight' && 
        k !== 'mso-' && 
        !k.startsWith('mso')
      );
      
      if (otherStyles.length <= 1) {
        const bold = el.ownerDocument.createElement('strong');
        if (otherStyles.length > 0) {
          const preservedStyle = otherStyles.map(k => `${k}: ${styleObj[k]}`).join('; ');
          if (preservedStyle) bold.setAttribute('style', preservedStyle);
        }
        bold.innerHTML = el.innerHTML;
        if (el.parentNode) {
          el.parentNode.replaceChild(bold, el);
        }
      }
    }
  });
}

function removeWordWrapperElements(element: Element): void {
  // Remove Google Docs wrapper elements
  const googleDocsWrappers = element.querySelectorAll('[id^="docs-internal-guid"]');
  googleDocsWrappers.forEach(el => {
    const parent = el.parentNode;
    if (parent) {
      while (el.firstChild) {
        parent.insertBefore(el.firstChild, el);
      }
      parent.removeChild(el);
    }
  });
  
  const wordElements = element.querySelectorAll('[class*="Mso"], [class*="mso-"]');
  wordElements.forEach(el => {
    const parent = el.parentNode;
    if (parent) {
      while (el.firstChild) {
        parent.insertBefore(el.firstChild, el);
      }
      parent.removeChild(el);
    }
  });
  
  const allElements = element.querySelectorAll('*');
  allElements.forEach(el => {
    const style = el.getAttribute('style') || '';
    if (style.includes('mso-') && !style.match(/(font-style|font-weight|color|text-decoration|vertical-align)/i)) {
      const parent = el.parentNode;
      if (parent && el.children.length > 0) {
        const fragment = document.createDocumentFragment();
        while (el.firstChild) {
          fragment.appendChild(el.firstChild);
        }
        parent.insertBefore(fragment, el);
        parent.removeChild(el);
      }
    }
  });
}

function flattenNestedSpans(element: Element): void {
  let changed = true;
  let iterations = 0;
  const maxIterations = 15;
  
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;
    
    const allSpans = Array.from(element.querySelectorAll('span'));
    
    for (let i = allSpans.length - 1; i >= 0; i--) {
      const span = allSpans[i];
      if (!span.parentNode || !span.isConnected) continue;
      
      const parent = span.parentNode;
      
      if (parent && (parent as Element).tagName && (parent as Element).tagName.toUpperCase() === 'SPAN') {
        const parentStyle = (parent as Element).getAttribute('style') || '';
        const childStyle = span.getAttribute('style') || '';
        
        const parentStyles = parseStyle(parentStyle);
        const childStyles = parseStyle(childStyle);
        
        const parentUniqueProps = Object.keys(parentStyles).filter(
          prop => !childStyles[prop] || childStyles[prop] !== parentStyles[prop]
        );
        
        if (parentUniqueProps.length === 0) {
          const grandparent = parent.parentNode;
          if (grandparent) {
            while (parent.firstChild) {
              grandparent.insertBefore(parent.firstChild, parent);
            }
            grandparent.removeChild(parent);
            changed = true;
            continue;
          }
        }
      }
    }
    
    const allSpansAgain = Array.from(element.querySelectorAll('span'));
    for (let i = 0; i < allSpansAgain.length; i++) {
      const span = allSpansAgain[i];
      if (!span.parentNode) continue;
      
      let nextSibling = span.nextSibling;
      while (nextSibling && nextSibling.nodeType === Node.TEXT_NODE && !(nextSibling as Text).textContent?.trim()) {
        nextSibling = nextSibling.nextSibling;
      }
      
      if (nextSibling && (nextSibling as Element).tagName && (nextSibling as Element).tagName.toUpperCase() === 'SPAN') {
        const spanStyle = span.getAttribute('style') || '';
        const nextStyle = (nextSibling as Element).getAttribute('style') || '';
        
        if (spanStyle === nextStyle) {
          // Move the separator along with the spans; dropping it joins words.
          let betweenNode = span.nextSibling;
          while (betweenNode && betweenNode !== nextSibling) {
            const toMove = betweenNode;
            betweenNode = betweenNode.nextSibling;
            span.appendChild(toMove);
          }
          while (nextSibling.firstChild) {
            span.appendChild(nextSibling.firstChild);
          }
          nextSibling.remove();
          changed = true;
        }
      }
    }
  }
  
  const finalSpans = Array.from(element.querySelectorAll('span'));
  finalSpans.forEach(span => {
    if (!span.parentNode || !span.isConnected) return;
    
    const hasOnlyText = span.children.length === 0;
    const style = span.getAttribute('style') || '';
    
    if (hasOnlyText && (!style || style.trim() === '')) {
      const parent = span.parentNode;
      const fragment = document.createDocumentFragment();
      while (span.firstChild) {
        fragment.appendChild(span.firstChild);
      }
      parent.replaceChild(fragment, span);
    }
  });
}

function cleanEmptyElements(element: Element): void {
  const allSpans = element.querySelectorAll('span');
  const spansToRemove: Element[] = [];
  
  allSpans.forEach(span => {
    const textContent = span.textContent;
    const hasText = textContent && textContent.length > 0;
    const hasChildren = span.children.length > 0;
    
    if (!hasText && !hasChildren) {
      spansToRemove.push(span);
    }
  });
  
  spansToRemove.forEach(span => {
    if (span.parentNode) {
      span.remove();
    }
  });
  
  const emptyDivs = element.querySelectorAll('div');
  emptyDivs.forEach(div => {
    if (!div.textContent?.trim() && div.children.length === 0) {
      div.remove();
    }
  });
  
  removeSpacingParagraphs(element);
}

function getLastTextNode(element: Element): Text | null {
  if (!element) return null;
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT
  );
  let lastTextNode: Text | null = null;
  let node;
  while (node = walker.nextNode()) {
    lastTextNode = node as Text;
  }
  return lastTextNode;
}

interface WordListMarker {
  tag: 'ul' | 'ol';
  /** The bullet glyph, or the numbering type with its punctuation, e.g. `a)`. */
  family: string;
  value: number;
}

interface WordListItem {
  paragraph: HTMLElement;
  /** Length of the marker text plus its spacer at the start of the paragraph. */
  markerLength: number;
  /** Most likely reading first; `i`, `v` and `x` can be roman or alphabetic. */
  markers: WordListMarker[];
  /** Left margin in points, when the paste kept it. */
  indent: number | null;
}

// Bullets: Word's library glyphs as pasted text (Symbol ·, Courier New o,
// Wingdings § Ø ü v) and typed ones. Numbers: decimal, alphabetic, or roman,
// followed by `.` or `)`. Word always separates the marker with a spacer.
const WORD_LIST_MARKER = /^\s*(?:([·•◦▪▫■□●○◆◇♦❖➢➤►✓✔o§Øüv*\-–—])|(\(?)(\d{1,4}|[a-z]+|[A-Z]+)([.)]))\s+/;
const ROMAN_NUMERAL = /^x{0,3}(?:ix|iv|v?i{0,3})$/;
const ROMAN_DIGITS: Record<string, number> = { i: 1, v: 5, x: 10 };
const POINTS_PER_UNIT: Record<string, number> = { in: 72, pt: 1, px: 0.75, cm: 72 / 2.54, mm: 72 / 25.4 };
const INDENT_TOLERANCE = 1;

function isWordListParagraph(paragraph: Element): boolean {
  return Array.from(paragraph.classList).some(name => /^MsoListParagraph/.test(name)) ||
    /mso-list\s*:\s*l\d/i.test(paragraph.getAttribute('style') || '');
}

function parseWordListMarker(text: string): Pick<WordListItem, 'markerLength' | 'markers'> | null {
  const match = WORD_LIST_MARKER.exec(text);
  if (!match) return null;
  const [prefix, bullet, open, token, close] = match;
  if (bullet) return { markerLength: prefix.length, markers: [{ tag: 'ul', family: bullet, value: 0 }] };

  const markers: WordListMarker[] = [];
  const family = (type: string) => `${open}${type}${close}`;
  if (/^\d+$/.test(token)) {
    markers.push({ tag: 'ol', family: family('1'), value: parseInt(token, 10) });
  } else {
    const lower = token.toLowerCase();
    const upper = lower !== token;
    if (ROMAN_NUMERAL.test(lower)) {
      const digits = Array.from(lower, digit => ROMAN_DIGITS[digit]);
      const value = digits.reduce((sum, digit, index) => sum + (digit < (digits[index + 1] || 0) ? -digit : digit), 0);
      markers.push({ tag: 'ol', family: family(upper ? 'I' : 'i'), value });
    }
    // Word continues alphabetic numbering past z as aa, bb, ...
    if (/^([a-z])\1*$/.test(lower)) {
      markers.push({ tag: 'ol', family: family(upper ? 'A' : 'a'), value: (lower.length - 1) * 26 + lower.charCodeAt(0) - 96 });
    }
    // A lone v or x more likely continues an alphabetic list; i starts a roman one.
    if (markers.length > 1 && /^[vx]$/.test(lower)) markers.reverse();
  }
  return markers.length ? { markerLength: prefix.length, markers } : null;
}

function lengthInPoints(value: string): number | null {
  const match = /^(-?\d*\.?\d+)([a-z]*)$/.exec(value.trim());
  if (!match) return null;
  const amount = parseFloat(match[1]);
  return amount === 0 ? 0 : match[2] in POINTS_PER_UNIT ? amount * POINTS_PER_UNIT[match[2]] : null;
}

/** Remove a text prefix that may span several nodes, with the wrappers it empties. */
function removeLeadingText(element: Element, length: number): void {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const emptied: Text[] = [];
  for (let node = walker.nextNode() as Text | null; node && length > 0; node = walker.nextNode() as Text | null) {
    const removed = Math.min(length, node.data.length);
    node.data = node.data.slice(removed);
    length -= removed;
    if (!node.data) emptied.push(node);
  }
  for (const node of emptied) {
    let parent = node.parentElement;
    node.remove();
    while (parent && parent !== element && !parent.hasChildNodes()) {
      const next = parent.parentElement;
      parent.remove();
      parent = next;
    }
  }
}

/**
 * Build the lists for one run of consecutive Word list paragraphs. Levels come
 * from left margins when every item kept one. Otherwise a new marker family
 * nests only if an enclosing list resumes after it, or if it was nested earlier
 * in the run; else it starts a new list at the same level.
 */
function buildWordLists(items: WordListItem[]): void {
  const byIndent = items.every(item => item.indent !== null);
  const open: { list: HTMLElement; family: string; last: number; indent: number }[] = [];
  const familyDepths = new Map<string, number>();

  items.forEach((item, index) => {
    const marker = item.markers.find(candidate =>
      open.some(level => level.family === candidate.family && level.last + 1 === candidate.value)
    ) || item.markers[0];
    let depth: number;
    if (byIndent) {
      depth = open.length - 1;
      while (depth > 0 && open[depth].indent > item.indent! + INDENT_TOLERANCE) depth--;
      if (depth >= 0 && item.indent! > open[depth].indent + INDENT_TOLERANCE) depth++;
      depth = Math.max(depth, 0);
    } else {
      depth = open.map(level => level.family).lastIndexOf(marker.family);
      if (depth < 0) {
        const resumes = items.slice(index + 1).some(next =>
          next.markers.some(candidate => open.some(level => level.family === candidate.family))
        );
        const earlier = familyDepths.get(marker.family);
        depth = earlier !== undefined ? Math.min(earlier, open.length)
          : resumes ? open.length : Math.max(open.length - 1, 0);
      }
    }
    open.length = Math.min(open.length, depth + 1);
    familyDepths.set(marker.family, depth);

    const doc = item.paragraph.ownerDocument;
    let level = open[depth];
    if (!level || level.family !== marker.family || (marker.tag === 'ol' && marker.value !== level.last + 1)) {
      const list = doc.createElement(marker.tag);
      if (marker.tag === 'ol' && marker.value !== 1) list.setAttribute('start', String(marker.value));
      if (level) level.list.after(list);
      else if (depth === 0) item.paragraph.before(list);
      else open[depth - 1].list.lastElementChild!.append(list);
      level = open[depth] = { list, family: marker.family, last: 0, indent: item.indent ?? 0 };
    }
    level.last = marker.value;

    const listItem = doc.createElement('li');
    for (const attr of Array.from(item.paragraph.attributes)) listItem.setAttribute(attr.name, attr.value);
    removeLeadingText(item.paragraph, item.markerLength);
    listItem.append(...Array.from(item.paragraph.childNodes));
    item.paragraph.remove();
    level.list.append(listItem);
  });
}

/**
 * Word list paragraphs reach the cleaner as paragraphs with the marker as text:
 * paste drops `mso-list`, but keeps the MsoListParagraph class and the marker.
 * Without that class (or a surviving `mso-list`), a paragraph is never
 * converted, whatever its text.
 */
function convertWordListParagraphs(root: HTMLElement): void {
  let run: WordListItem[] = [];
  for (const paragraph of Array.from(root.querySelectorAll<HTMLElement>('p'))) {
    if (!isWordListParagraph(paragraph) || paragraph.closest('li')) continue;
    const marker = parseWordListMarker(paragraph.textContent || '');
    if (!marker) continue;
    const previous = run[run.length - 1];
    if (previous && (paragraph.classList.contains('MsoListParagraphCxSpFirst') || nextNonSpacingElement(previous.paragraph) !== paragraph)) {
      buildWordLists(run);
      run = [];
    }
    run.push({ paragraph, ...marker, indent: lengthInPoints(paragraph.style.marginLeft) });
  }
  if (run.length) buildWordLists(run);
}

export function cleanWordHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';

  const tempDiv = createInertContainer();
  tempDiv.innerHTML = html;

  removeImages(tempDiv);
  // Before cleanup drops the classes, and before title detection looks for a
  // Key Takeaways list.
  convertWordListParagraphs(tempDiv);
  prepareWordSource(tempDiv);
  // Style cleanup drops `font-style: normal`; resolve the overrides it marks first.
  splitEmphasisOverrides(tempDiv);
  preserveFormattingElements(tempDiv);
  removeWordSpecificAttributes(tempDiv);
  convertFontTagsToSpans(tempDiv);
  normalizeFormattingTags(tempDiv);
  cleanEmptyElements(tempDiv);
  flattenNestedSpans(tempDiv);
  removeWordWrapperElements(tempDiv);
  
  removeLayoutBreaks(tempDiv);
  
  return tempDiv.innerHTML;
}
