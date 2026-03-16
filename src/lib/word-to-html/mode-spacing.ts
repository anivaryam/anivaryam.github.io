/**
 * Mode Utility: Spacing Rules
 * Adds <p>&nbsp;</p> spacing elements in specific locations
 */

function isSpacingElement(element: Element): boolean {
  if (!element || element.tagName.toLowerCase() !== 'p') {
    return false;
  }
  const text = (element.textContent || '').trim();
  const html = element.innerHTML.trim();
  
  const isOnlyNbsp = (html === '&nbsp;' || html === '\u00A0');
  const isOnlySpaceChar = (text === '\u00A0' || text === '');
  
  return isOnlyNbsp && isOnlySpaceChar;
}

function addSpacingAfterKeyTakeaways(doc: Document): void {
  const headings = Array.from(doc.querySelectorAll('h2'));
  let keyTakeawaysHeading: Element | null = null;
  
  for (let heading of headings) {
    const text = heading.textContent?.trim() || '';
    if (text.toLowerCase().includes('key takeaways')) {
      keyTakeawaysHeading = heading;
      break;
    }
  }
  
  if (keyTakeawaysHeading) {
    let nextSibling = keyTakeawaysHeading.nextElementSibling;
    while (nextSibling && nextSibling.tagName.toLowerCase() !== 'ul') {
      nextSibling = nextSibling.nextElementSibling;
    }
    
    if (nextSibling && nextSibling.tagName.toLowerCase() === 'ul') {
      let elementAfterUl = nextSibling.nextElementSibling;
      const hasExistingSpacing = elementAfterUl && isSpacingElement(elementAfterUl);
      if (hasExistingSpacing) {
        return;
      }
      
      const spacing = doc.createElement('p');
      spacing.textContent = '\u00A0';
      const parentNode = nextSibling.parentNode;
      if (parentNode) {
        if (elementAfterUl) {
          parentNode.insertBefore(spacing, elementAfterUl);
        } else {
          parentNode.appendChild(spacing);
        }
      }
    }
  }
}

function addSpacingBeforeHeadings(doc: Document): void {
  const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  let isFirstFaqQuestion = false;
  let foundFaqSection = false;
  
  headings.forEach((heading) => {
    const text = heading.textContent?.trim().toLowerCase() || '';
    
    if (text.includes('key takeaways')) {
      return;
    }
    
    if (text.includes('frequently asked questions') || text.includes('faq')) {
      foundFaqSection = true;
      isFirstFaqQuestion = true;
    }
    
    if (foundFaqSection && isFirstFaqQuestion && heading.tagName.toLowerCase() === 'h3') {
      isFirstFaqQuestion = false;
      return;
    }
    
    let prevSibling = heading.previousElementSibling;
    const hasExistingSpacing = prevSibling && isSpacingElement(prevSibling);
    if (hasExistingSpacing) {
      return;
    }
    
    let node = heading.previousSibling;
    while (node && node.nodeType === Node.TEXT_NODE && !(node as Text).textContent?.trim()) {
      node = node.previousSibling;
    }
    if (node && node.nodeType === Node.ELEMENT_NODE && isSpacingElement(node as Element)) {
      return;
    }
    
    const spacing = doc.createElement('p');
    spacing.innerHTML = '&nbsp;';
    const headingParent = heading.parentNode;
    if (headingParent) {
      headingParent.insertBefore(spacing, heading);
    }
  });
}

function addSpacingBeforeReadSection(doc: Document): void {
  const paragraphs = doc.querySelectorAll('p');
  
  paragraphs.forEach(p => {
    const text = p.textContent?.trim().toLowerCase() || '';
    if (text.includes('read also') || 
        text.includes('read more') || 
        text.includes('see more')) {
      
      let prevSibling = p.previousElementSibling;
      if (prevSibling && isSpacingElement(prevSibling)) {
        return;
      }
      
      let node = p.previousSibling;
      while (node && node.nodeType === Node.TEXT_NODE && !(node as Text).textContent?.trim()) {
        node = node.previousSibling;
      }
      if (node && node.nodeType === Node.ELEMENT_NODE && isSpacingElement(node as Element)) {
        return;
      }
      
      const spacing = doc.createElement('p');
      spacing.innerHTML = '&nbsp;';
      const pParent = p.parentNode;
      if (pParent) {
        pParent.insertBefore(spacing, p);
      }
    }
  });
}

function addSpacingBeforeSources(doc: Document): void {
  const paragraphs = doc.querySelectorAll('p');
  
  paragraphs.forEach(p => {
    const text = p.textContent?.trim().toLowerCase() || '';
    if ((text === 'sources' || text === 'sources:') &&
        p.previousElementSibling &&
        p.previousElementSibling.tagName.toLowerCase() === 'p') {
      
      let prevSibling = p.previousElementSibling;
      const hasExistingSpacing = prevSibling && isSpacingElement(prevSibling);
      if (hasExistingSpacing) {
        return;
      }
      
      let node = p.previousSibling;
      while (node && node.nodeType === Node.TEXT_NODE && !(node as Text).textContent?.trim()) {
        node = node.previousSibling;
      }
      if (node && node.nodeType === Node.ELEMENT_NODE && isSpacingElement(node as Element)) {
        return;
      }
      
      const spacing = doc.createElement('p');
      spacing.innerHTML = '&nbsp;';
      const pParent = p.parentNode;
      if (pParent) {
        pParent.insertBefore(spacing, p);
      }
    }
  });
}

function addSpacingBeforeDisclaimer(doc: Document): void {
  const paragraphs = doc.querySelectorAll('p');
  
  paragraphs.forEach(p => {
    const text = p.textContent?.trim().toLowerCase() || '';
    if (text === 'disclaimer' || text === 'disclaimer:') {
      
      let prevSibling = p.previousElementSibling;
      const hasExistingSpacing = prevSibling && isSpacingElement(prevSibling);
      if (hasExistingSpacing) {
        return;
      }
      
      let node = p.previousSibling;
      while (node && node.nodeType === Node.TEXT_NODE && !(node as Text).textContent?.trim()) {
        node = node.previousSibling;
      }
      if (node && node.nodeType === Node.ELEMENT_NODE && isSpacingElement(node as Element)) {
        return;
      }
      
      const spacing = doc.createElement('p');
      spacing.innerHTML = '&nbsp;';
      const pParent = p.parentNode;
      if (pParent) {
        pParent.insertBefore(spacing, p);
      }
    }
  });
}

function addSpacingBeforeAltImageText(doc: Document): void {
  const paragraphs = doc.querySelectorAll('p');
  
  paragraphs.forEach(p => {
    const text = p.textContent?.trim().toLowerCase() || '';
    if (text.includes('alt image text:')) {
      
      let prevSibling = p.previousElementSibling;
      const hasExistingSpacing = prevSibling && isSpacingElement(prevSibling);
      if (hasExistingSpacing) {
        return;
      }
      
      let node = p.previousSibling;
      while (node && node.nodeType === Node.TEXT_NODE && !(node as Text).textContent?.trim()) {
        node = node.previousSibling;
      }
      if (node && node.nodeType === Node.ELEMENT_NODE && isSpacingElement(node as Element)) {
        return;
      }
      
      const spacing = doc.createElement('p');
      spacing.innerHTML = '&nbsp;';
      const pParent = p.parentNode;
      if (pParent) {
        pParent.insertBefore(spacing, p);
      }
    }
  });
}

export function addSpacing(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    addSpacingBeforeAltImageText(doc);
    addSpacingBeforeDisclaimer(doc);
    addSpacingBeforeSources(doc);
    addSpacingBeforeReadSection(doc);
    addSpacingBeforeHeadings(doc);
    addSpacingAfterKeyTakeaways(doc);
    
    return doc.body.innerHTML;
  } catch (e) {
    console.warn('Spacing addition failed:', e);
    return html;
  }
}

