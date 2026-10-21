/**
 * Mode Utility: Link Attributes
 * Adds target="_blank" rel="noopener noreferrer" to all links
 */

export function addLinkAttributes(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const links = doc.querySelectorAll('a[href]');
    
    links.forEach(link => {
      // The feature promises new-tab links, so a pasted target (e.g. _self) is replaced
      link.setAttribute('target', '_blank');
      
      if (!link.hasAttribute('rel')) {
        link.setAttribute('rel', 'noopener noreferrer');
      } else {
        const rel = link.getAttribute('rel') || '';
        let newRel = rel;
        
        if (!rel.includes('noopener')) {
          newRel = newRel ? newRel + ' noopener' : 'noopener';
        }
        if (!rel.includes('noreferrer')) {
          newRel = newRel ? newRel + ' noreferrer' : 'noreferrer';
        }
        
        if (newRel !== rel) {
          link.setAttribute('rel', newRel);
        }
      }
    });
    
    return doc.body.innerHTML;
  } catch (e) {
    console.warn('Link attributes addition failed:', e);
    return html;
  }
}

