/**
 * Mode Utility: Sources Normalization
 * Normalizes Sources section formatting for Blogs and Shoppables modes
 */

export function normalizeSources(html: string, sourcesItalic: boolean = true): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const paragraphs = doc.querySelectorAll('p');
    
    paragraphs.forEach(p => {
      const text = p.textContent?.trim() || '';
      const lowerText = text.toLowerCase();
      
      if (lowerText === 'sources' || lowerText === 'sources:' || lowerText.startsWith('sources:')) {
        normalizeSourcesParagraph(p, doc);
        
        let nextSibling = p.nextElementSibling;
        while (nextSibling && nextSibling.tagName.toLowerCase() !== 'ol') {
          nextSibling = nextSibling.nextElementSibling;
        }
        
        if (nextSibling && nextSibling.tagName.toLowerCase() === 'ol') {
          normalizeSourcesListItems(nextSibling, doc, sourcesItalic);
        }
      }
    });
    
    return doc.body.innerHTML;
  } catch (e) {
    console.warn('Sources normalization failed:', e);
    return html;
  }
}

function normalizeSourcesParagraph(paragraph: Element, doc: Document): void {
  if (!paragraph) return;
  
  paragraph.innerHTML = '';
  
  const strong = doc.createElement('strong');
  const em = doc.createElement('em');
  em.textContent = 'Sources:';
  
  strong.appendChild(em);
  paragraph.appendChild(strong);
}

function normalizeSourcesListItems(olElement: Element, doc: Document, sourcesItalic: boolean = true): void {
  if (!olElement || !doc) return;
  
  const listItems = olElement.querySelectorAll('li');
  
  listItems.forEach(li => {
    // Skip if already properly formatted with EM wrapping all content
    const emChild = li.querySelector(':scope > em');
    if (emChild && li.querySelectorAll(':scope > a').length === 0) {
      return;
    }
    
    // Skip if already has EM - preserve existing formatting (bold, EM, etc.)
    if (li.querySelector('em')) {
      return;
    }
    
    // Gather direct text content only (not text inside child elements like anchors)
    const textContent = Array.from(li.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent || '')
      .join('');
    const anchors = Array.from(li.querySelectorAll('a'));
    
    // Clear the li and rebuild properly
    li.innerHTML = '';
    
    // Wrap ALL text and anchors in one em tag
    const em = doc.createElement('em');
    em.textContent = textContent;
    
    anchors.forEach(anchor => {
      em.appendChild(anchor);
    });
    
    li.appendChild(em);

    // Add italic style to li when sourcesItalic is enabled
    if (sourcesItalic) {
      li.setAttribute('style', 'font-style: italic');
    }
  });
}

