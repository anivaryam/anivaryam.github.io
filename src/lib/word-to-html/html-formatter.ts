/**
 * HTML Formatter
 * Formats HTML in a compact style with nested tags on the same line
 */

import { BLOCK_ELEMENTS, VOID_ELEMENTS } from './html-cleaner';
import { isCustomSpacerElement, parseCustomSpacer, unmarkedSpacerElement, type CustomSpacer } from './spacer';

const INLINE_ELEMENTS = [
  'a', 'em', 'i', 'strong', 'b', 'span', 'code', 'sup', 'sub',
  'small', 'mark', 'del', 'ins', 'u', 'abbr', 'cite', 'q', 'samp', 'var'
];

const PRESERVE_EMPTY_ELEMENTS = new Set(['table', 'thead', 'tbody', 'tr', 'th', 'td']);
// Empty list items keep the numbering and empty headings the structure the
// preview shows, so the copied code matches it. A document without any text
// has no remaining content, so they are not kept on their own.
const PRESERVE_EMPTY_CONTENT_ELEMENTS = new Set(['li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const NO_SPACER: CustomSpacer = { html: '', root: null };

function isInlineElement(node: Node | null): boolean {
  return node?.nodeType === Node.ELEMENT_NODE && !BLOCK_ELEMENTS.includes((node as Element).tagName.toLowerCase());
}

function escapeHtml(str: unknown): string {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isSpacingParagraph(node: Element): boolean {
  if (!node || node.tagName.toLowerCase() !== 'p') return false;
  const html = (node.innerHTML || '').trim();
  const text = node.textContent || '';
  return html === '&nbsp;' || 
         html === '\u00A0' ||
         (text.trim() === '' && (html.includes('&nbsp;') || html === '\u00A0')) ||
         text === '\u00A0' ||
         text.trim() === '\u00A0';
}

function preservesEmpty(tagName: string, keepEmptyContent: boolean): boolean {
  return PRESERVE_EMPTY_ELEMENTS.has(tagName) || (keepEmptyContent && PRESERVE_EMPTY_CONTENT_ELEMENTS.has(tagName));
}

function formatElement(element: Element, insideLi = false, indentLevel = 0, spacer: CustomSpacer = NO_SPACER, keepEmptyContent = false): string {
  const tagName = element.tagName.toLowerCase();
  const isBlock = BLOCK_ELEMENTS.includes(tagName);
  const isSelfClosing = VOID_ELEMENTS.includes(tagName);
  const isLi = tagName === 'li';
  
  // A custom spacer is emitted verbatim so its markup reaches the output.
  // It is checked first so a spacer shaped like a blank paragraph keeps its
  // own markup instead of the canonical spacer.
  if (isCustomSpacerElement(element, spacer)) {
    const indent = '  '.repeat(indentLevel);
    return '\n' + indent + unmarkedSpacerElement(element).outerHTML;
  }

  if (isSpacingParagraph(element)) {
    const indent = '  '.repeat(indentLevel);
    return '\n' + indent + '<p>&nbsp;</p>';
  }
  
  const indent = '  '.repeat(indentLevel);
  
  if (isSelfClosing) {
    let tag = `<${tagName}`;
    if (element.attributes && element.attributes.length > 0) {
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        tag += ` ${attr.name}="${escapeHtml(attr.value)}"`;
      }
    }
    tag += '>';
    return tag;
  }
  
  let openingTag = `<${tagName}`;
  if (element.attributes && element.attributes.length > 0) {
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      openingTag += ` ${attr.name}="${escapeHtml(attr.value)}"`;
    }
  }
  openingTag += '>';

  // Formatting whitespace is data inside pre/code. Serialize that subtree
  // without indentation or line cleanup (DOM serialization still escapes text).
  if (tagName === 'pre' || tagName === 'code') {
    const content = element.innerHTML;
    const leadingNewline = tagName === 'pre' && content.startsWith('\n') ? '\n' : '';
    return (isBlock ? '\n' + indent : '') + openingTag + leadingNewline + content + `</${tagName}>`;
  }
  if (INLINE_ELEMENTS.includes(tagName) && !element.children.length && !element.textContent?.trim()) {
    return escapeHtml(element.textContent);
  }
  
  let content = '';
  let hasBlockChildren = false;
  let hasOnlyInlineContent = true;
  let hasContent = false;
  const blockChildTags: string[] = [];
  
  for (let i = 0; i < element.childNodes.length; i++) {
    const node = element.childNodes[i];
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const childTag = (node as Element).tagName.toLowerCase();
      
      const isSpacingElement = isSpacingParagraph(node as Element) || isCustomSpacerElement(node as Element, spacer);
      if (BLOCK_ELEMENTS.includes(childTag) && !preservesEmpty(childTag, keepEmptyContent) && !['pre', 'code'].includes(childTag) && !(node as Element).textContent?.trim() && (node as Element).children.length === 0 && !isSpacingElement) {
        continue;
      }
      
      if (BLOCK_ELEMENTS.includes(childTag)) {
        hasBlockChildren = true;
        hasOnlyInlineContent = false;
        blockChildTags.push(childTag);
      }
      
      const childInsideLi = isLi || insideLi;
      const childIndentLevel = BLOCK_ELEMENTS.includes(childTag) ? indentLevel + 1 : indentLevel;
      const formattedChild = formatElement(node as Element, childInsideLi, childIndentLevel, spacer, keepEmptyContent);
      if (formattedChild) {
        if (BLOCK_ELEMENTS.includes(childTag) && isBlock) {
          content += formattedChild;
        } else {
          content += formattedChild;
        }
        hasContent = true;
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      const isSpaceOnly = text.trim() === '' && text.length > 0 && /^\s+$/.test(text);
      const prevSibling = node.previousSibling;
      const nextSibling = node.nextSibling;
      const isBetweenElements = isInlineElement(prevSibling) || isInlineElement(nextSibling);
      
      if (text.trim() || (isSpaceOnly && isBetweenElements)) {
        content += escapeHtml(text);
        hasContent = true;
      }
    }
  }
  
  const isThisSpacingElement = isSpacingParagraph(element);
  if (!hasContent && preservesEmpty(tagName, keepEmptyContent)) {
    return '\n' + indent + openingTag + `</${tagName}>`;
  }
  if (!hasContent && !isThisSpacingElement && !preservesEmpty(tagName, keepEmptyContent)) {
    return '';
  }
  
  if (isThisSpacingElement) {
    const indent = '  '.repeat(indentLevel);
    return '\n' + indent + '<p>&nbsp;</p>';
  }
  
  const closingTag = `</${tagName}>`;
  
  if (isBlock) {
    if (tagName === 'p' && insideLi) {
      return openingTag + content + closingTag;
    }
    
    if (tagName === 'li') {
      const onlyHasP = hasBlockChildren && blockChildTags.length > 0 && 
        blockChildTags.every(tag => tag === 'p');
      
      if (onlyHasP || (!hasBlockChildren && content.trim())) {
        return '\n' + indent + openingTag + content + closingTag;
      }
    }
    
    if (hasOnlyInlineContent && !hasBlockChildren && content.trim()) {
      return '\n' + indent + openingTag + content + closingTag;
    } else {
      return '\n' + indent + openingTag + content + '\n' + indent + closingTag;
    }
  } else {
    return openingTag + content + closingTag;
  }
}

export function formatCompact(html: string, customSpacer?: string | null): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const spacer = parseCustomSpacer(customSpacer);
    const keepEmptyContent = !!doc.body.textContent?.trim();
    
    let result = '';
    for (let i = 0; i < doc.body.childNodes.length; i++) {
      const node = doc.body.childNodes[i];
      if (node.nodeType === Node.ELEMENT_NODE) {
        const formatted = formatElement(node as Element, false, 0, spacer, keepEmptyContent);
        result += formatted;
      } else if (node.nodeType === Node.TEXT_NODE) {
        // Keep separators between top-level inline nodes intact.
        if (node.textContent?.trim() || isInlineElement(node.previousSibling) || isInlineElement(node.nextSibling)) {
          result += escapeHtml(node.textContent);
        }
      }
    }
    
    return result.trim();
  } catch (e) {
    console.warn('HTML formatting failed:', e);
    return html;
  }
}
