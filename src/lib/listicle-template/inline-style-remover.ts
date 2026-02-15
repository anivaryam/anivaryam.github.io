const TARGET_TAGS = [
  'body',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p',
  'div',
  'section',
  'article',
  'main',
  'header',
  'footer',
  'nav',
  'aside',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'a',
  'span',
  'strong', 'em', 'b', 'i', 'u',
  'img',
  'figure', 'figcaption',
  'blockquote',
  'pre', 'code',
];

const TARGET_CONTAINERS = [
  'container',
  'wrapper',
  'content',
  'main-content',
  'article-content',
  'post-content',
  'entry-content',
  'page-content',
  'body-content',
];

export interface InlineStyleRemoverOptions {
  removeInlineStyles?: boolean;
}

function getTagName(element: Element): string {
  return element.tagName.toLowerCase();
}

function hasContainerClass(element: Element): boolean {
  const classList = element.classList;
  for (const cls of classList) {
    const lower = cls.toLowerCase();
    if (TARGET_CONTAINERS.some(c => lower.includes(c))) {
      return true;
    }
  }
  return false;
}

function shouldRemoveStyles(element: Element): boolean {
  const tagName = getTagName(element);
  
  if (TARGET_TAGS.includes(tagName)) {
    return true;
  }
  
  if (hasContainerClass(element)) {
    return true;
  }
  
  return false;
}

export function removeInlineStyles(html: string, options: InlineStyleRemoverOptions = {}): string {
  if (!html || !html.trim()) return '';
  if (!options.removeInlineStyles) return html;
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const allElements = doc.querySelectorAll('*');
  
  allElements.forEach(element => {
    if (shouldRemoveStyles(element)) {
      element.removeAttribute('style');
    }
  });
  
  return doc.body.innerHTML;
}

export function removeInlineStylesFromHtml(html: string): string {
  if (typeof DOMParser !== 'undefined') {
    return removeInlineStyles(html, { removeInlineStyles: true });
  }
  
  return html.replace(/\s*style="[^"]*"/gi, '');
}
