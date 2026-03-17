/**
 * Mode Utility: Key Takeaways Formatting
 * Removes <em> tags from Key Takeaways section for Blogs mode
 */

export function formatKeyTakeaways(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const headings = Array.from(doc.querySelectorAll('h2'));
    let keyTakeawaysHeading: Element | null = null;
    
    for (const heading of headings) {
      const text = heading.textContent?.trim() || '';
      if (text.toLowerCase().includes('key takeaways')) {
        keyTakeawaysHeading = heading;
        break;
      }
    }
    
    if (keyTakeawaysHeading) {
      formatKeyTakeawaysHeading(keyTakeawaysHeading);
      
      let nextSibling = keyTakeawaysHeading.nextElementSibling;
      while (nextSibling && nextSibling.tagName.toLowerCase() !== 'ul') {
        nextSibling = nextSibling.nextElementSibling;
      }
      
      if (nextSibling && nextSibling.tagName.toLowerCase() === 'ul') {
        const listItems = nextSibling.querySelectorAll('li');
        listItems.forEach(li => {
          removeEmTags(li);
        });
      }
    }
    
    return doc.body.innerHTML;
  } catch (e) {
    console.warn('Key Takeaways formatting failed:', e);
    return html;
  }
}

function formatKeyTakeawaysHeading(heading: Element): void {
  if (!heading) return;
  
  removeEmTags(heading);
  const text = heading.textContent?.trim() || '';
  
  if (!text.endsWith(':')) {
    const strongTag = heading.querySelector('strong');
    if (strongTag) {
      strongTag.textContent = text + ':';
    } else {
      heading.textContent = text + ':';
    }
  }
}

function removeEmTags(element: Element): void {
  if (!element) return;
  
  const emTags = element.querySelectorAll('em');
  
  emTags.forEach(em => {
    const parent = em.parentNode;
    if (parent) {
      while (em.firstChild) {
        parent.insertBefore(em.firstChild, em);
      }
      parent.removeChild(em);
    }
  });
  
  if (element.tagName.toLowerCase() === 'em') {
    const parent = element.parentNode;
    if (parent) {
      while (element.firstChild) {
        parent.insertBefore(element.firstChild, element);
      }
      parent.removeChild(element);
    }
  }
}

