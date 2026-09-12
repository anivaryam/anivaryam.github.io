/**
 * HTML Formatter
 * Formats HTML in a compact style with nested tags on the same line
 */

import { BLOCK_ELEMENTS } from './html-cleaner';

const INLINE_ELEMENTS = [
  'a', 'em', 'i', 'strong', 'b', 'span', 'code', 'sup', 'sub',
  'small', 'mark', 'del', 'ins', 'u', 'abbr', 'cite', 'q', 'samp', 'var'
];

const SELF_CLOSING = ['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'];
const PRESERVE_EMPTY_ELEMENTS = new Set(['table', 'thead', 'tbody', 'tr', 'th', 'td']);

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

function formatElement(element: Element, insideLi = false, indentLevel = 0): string {
  const tagName = element.tagName.toLowerCase();
  const isBlock = BLOCK_ELEMENTS.includes(tagName);
  const isSelfClosing = SELF_CLOSING.includes(tagName);
  const isLi = tagName === 'li';
  
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
      
      const isSpacingElement = isSpacingParagraph(node as Element);
      if (BLOCK_ELEMENTS.includes(childTag) && !PRESERVE_EMPTY_ELEMENTS.has(childTag) && !['pre', 'code'].includes(childTag) && !(node as Element).textContent?.trim() && (node as Element).children.length === 0 && !isSpacingElement) {
        continue;
      }
      
      if (BLOCK_ELEMENTS.includes(childTag)) {
        hasBlockChildren = true;
        hasOnlyInlineContent = false;
        blockChildTags.push(childTag);
      }
      
      const childInsideLi = isLi || insideLi;
      const childIndentLevel = BLOCK_ELEMENTS.includes(childTag) ? indentLevel + 1 : indentLevel;
      const formattedChild = formatElement(node as Element, childInsideLi, childIndentLevel);
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
  if (!hasContent && PRESERVE_EMPTY_ELEMENTS.has(tagName)) {
    return '\n' + indent + openingTag + `</${tagName}>`;
  }
  if (!hasContent && !isThisSpacingElement && !PRESERVE_EMPTY_ELEMENTS.has(tagName)) {
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

export function formatCompact(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    let result = '';
    for (let i = 0; i < doc.body.childNodes.length; i++) {
      const node = doc.body.childNodes[i];
      if (node.nodeType === Node.ELEMENT_NODE) {
        const formatted = formatElement(node as Element, false, 0);
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
