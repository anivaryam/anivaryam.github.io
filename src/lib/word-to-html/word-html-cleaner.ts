/**
 * Word HTML Cleaner
 * Comprehensive cleaning of Word HTML while preserving formatting
 * This matches the cleanWordHtml function from converter.js
 */

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
  
  const imageClassElements = element.querySelectorAll('[class*="image"], [class*="Image"]');
  imageClassElements.forEach(el => el.remove());
  
  const bgImageElements = element.querySelectorAll('[style*="background-image"]');
  bgImageElements.forEach(el => el.remove());
  
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
  
  const elementsWithVA = element.querySelectorAll('[style*="vertical-align"]');
  const vaElements = Array.from(elementsWithVA);
  
  vaElements.forEach(el => {
    const style = el.getAttribute('style') || '';
    const styleObj = parseStyle(style);
    const va = styleObj['vertical-align'];
    
    if (va) {
      const vaLower = va.toLowerCase().trim();
      if (vaLower === 'super' || vaLower.includes('super') || vaLower.includes('35%') || vaLower.includes('0.6')) {
        const sup = document.createElement('sup');
        const otherStyles = Object.keys(styleObj)
          .filter(k => k !== 'vertical-align')
          .map(k => `${k}: ${styleObj[k]}`)
          .join('; ');
        if (otherStyles) sup.setAttribute('style', otherStyles);
        sup.innerHTML = el.innerHTML;
        if (el.parentNode) {
          el.parentNode.replaceChild(sup, el);
        }
      } else if (vaLower === 'sub' || vaLower.includes('sub') || vaLower.includes('-35%') || vaLower.includes('-0.6')) {
        const sub = document.createElement('sub');
        const otherStyles = Object.keys(styleObj)
          .filter(k => k !== 'vertical-align')
          .map(k => `${k}: ${styleObj[k]}`)
          .join('; ');
        if (otherStyles) sub.setAttribute('style', otherStyles);
        sub.innerHTML = el.innerHTML;
        if (el.parentNode) {
          el.parentNode.replaceChild(sub, el);
        }
      }
    }
  });
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
    const span = document.createElement('span');
    
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
        const italic = document.createElement('em');
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
        const bold = document.createElement('strong');
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
          while ((nextSibling as Element).firstChild) {
            span.appendChild((nextSibling as Element).firstChild);
          }
          let betweenNode = span.nextSibling;
          while (betweenNode && betweenNode !== nextSibling) {
            const toRemove = betweenNode;
            betweenNode = betweenNode.nextSibling;
            if (toRemove.nodeType === Node.TEXT_NODE && !(toRemove as Text).textContent?.trim()) {
              toRemove.remove();
            }
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
    const hasText = textContent && textContent.trim().length > 0;
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
  
  const emptyParagraphs = element.querySelectorAll('p');
  emptyParagraphs.forEach(p => {
    if (!p.textContent?.trim() && p.children.length === 0 && p.parentNode) {
      const br = document.createElement('br');
      p.parentNode.replaceChild(br, p);
    }
  });
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

export function cleanWordHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  removeImages(tempDiv);
  preserveFormattingElements(tempDiv);
  removeWordSpecificAttributes(tempDiv);
  convertFontTagsToSpans(tempDiv);
  normalizeFormattingTags(tempDiv);
  cleanEmptyElements(tempDiv);
  flattenNestedSpans(tempDiv);
  removeWordWrapperElements(tempDiv);
  
  // Remove all <br> tags to clean up Word HTML
  const brTags = tempDiv.querySelectorAll('br');
  brTags.forEach(br => br.remove());
  
  return tempDiv.innerHTML;
}

