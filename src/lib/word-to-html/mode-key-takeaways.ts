/**
 * Mode Utility: Key Takeaways Formatting
 * Removes <em> tags from Key Takeaways section for Blogs mode
 */

import { nextNonSpacingElement } from './html-spacing';

/** A section's list must follow its label, without crossing article content. */
export function findKeyTakeawaysSection(root: ParentNode): { heading: Element; list: Element } | null {
  const heading = Array.from(root.querySelectorAll('h2')).find(element =>
    /^key takeaways\s*:?$/i.test(element.textContent?.trim() || '')
  );
  if (!heading) return null;
  const list = nextNonSpacingElement(heading);
  return list?.matches('ul, ol') ? { heading, list } : null;
}

export function formatKeyTakeaways(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const section = findKeyTakeawaysSection(doc);
    if (section) {
      formatKeyTakeawaysHeading(section.heading);
      section.list.querySelectorAll('li').forEach(removeEmTags);
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
