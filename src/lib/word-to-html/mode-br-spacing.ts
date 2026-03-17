/**
 * Mode Utility: BR Spacing for Shoppables
 * Adds <p><br></p> spacing elements before read more and sources sections
 * Replaces existing <p>&nbsp;</p> spacers if spacing rules already added them
 */

function isSpacingElement(element: Element | null): boolean {
  if (!element || element.tagName.toLowerCase() !== 'p') {
    return false;
  }
  const text = (element.textContent || '').trim();
  const html = element.innerHTML.trim();
  
  const isOnlyNbsp = (html === '&nbsp;' || html === '&#160;' || html === '\u00A0');
  const isOnlySpaceChar = (text === '\u00A0' || text === '');
  
  return isOnlyNbsp && isOnlySpaceChar;
}

function isBrSpacingElement(element: Element | null): boolean {
  if (!element || element.tagName.toLowerCase() !== 'p') {
    return false;
  }
  const html = element.innerHTML.trim();
  return html === '<br>' || html === '<br/>' || html === '<br />';
}

/**
 * Adds or replaces spacing before read more/read also/see more sections with <p><br></p>
 * If spacing rules already added <p>&nbsp;</p>, it will be replaced with <p><br></p>
 */
export function addBrBeforeReadMore(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const paragraphs = doc.querySelectorAll('p');
    
    paragraphs.forEach(p => {
      const text = p.textContent?.trim().toLowerCase() || '';
      if (text.includes('read also:') || 
          text.includes('read more:') || 
          text.includes('see more:')) {
        
        // Check if there's an existing spacing element before this paragraph
        const prevSibling = p.previousElementSibling;
        const hasExistingNbspSpacing = prevSibling && isSpacingElement(prevSibling);
        const hasExistingBrSpacing = prevSibling && isBrSpacingElement(prevSibling);
        
        // If there's already a BR spacing, skip
        if (hasExistingBrSpacing) {
          return;
        }
        
        // If there's a &nbsp; spacing, replace it with <br>
        if (hasExistingNbspSpacing && prevSibling) {
          prevSibling.innerHTML = '<br>';
          return;
        }
        
        // Check text nodes before the paragraph
        let node = p.previousSibling;
        while (node && node.nodeType === Node.TEXT_NODE && !(node as Text).textContent?.trim()) {
          node = node.previousSibling;
        }
        
        // If we found a spacing element in text nodes, replace it
        if (node && node.nodeType === Node.ELEMENT_NODE) {
          if (isSpacingElement(node as Element)) {
            (node as Element).innerHTML = '<br>';
            return;
          }
          if (isBrSpacingElement(node as Element)) {
            return; // Already has BR spacing
          }
        }
        
        // No existing spacing found, add new <p><br></p>
        const brSpacing = doc.createElement('p');
        brSpacing.innerHTML = '<br>';
        p.parentNode!.insertBefore(brSpacing, p);
      }
    });
    
    return doc.body.innerHTML;
  } catch (e) {
    console.warn('BR spacing before read more failed:', e);
    return html;
  }
}

/**
 * Adds or replaces spacing before sources sections with <p><br></p>
 * If spacing rules already added <p>&nbsp;</p>, it will be replaced with <p><br></p>
 */
export function addBrBeforeSources(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const paragraphs = doc.querySelectorAll('p');
    
    paragraphs.forEach(p => {
      const text = p.textContent?.trim().toLowerCase() || '';
      if (text.startsWith('sources:')) {
        
        // Check if there's an existing spacing element before this paragraph
        const prevSibling = p.previousElementSibling;
        const hasExistingNbspSpacing = prevSibling && isSpacingElement(prevSibling);
        const hasExistingBrSpacing = prevSibling && isBrSpacingElement(prevSibling);
        
        // If there's already a BR spacing, skip
        if (hasExistingBrSpacing) {
          return;
        }
        
        // If there's a &nbsp; spacing, replace it with <br>
        if (hasExistingNbspSpacing && prevSibling) {
          prevSibling.innerHTML = '<br>';
          return;
        }
        
        // Check text nodes before the paragraph
        let node = p.previousSibling;
        while (node && node.nodeType === Node.TEXT_NODE && !(node as Text).textContent?.trim()) {
          node = node.previousSibling;
        }
        
        // If we found a spacing element in text nodes, replace it
        if (node && node.nodeType === Node.ELEMENT_NODE) {
          if (isSpacingElement(node as Element)) {
            (node as Element).innerHTML = '<br>';
            return;
          }
          if (isBrSpacingElement(node as Element)) {
            return; // Already has BR spacing
          }
        }
        
        // No existing spacing found, add new <p><br></p>
        const brSpacing = doc.createElement('p');
        brSpacing.innerHTML = '<br>';
        p.parentNode!.insertBefore(brSpacing, p);
      }
    });
    
    return doc.body.innerHTML;
  } catch (e) {
    console.warn('BR spacing before sources failed:', e);
    return html;
  }
}

