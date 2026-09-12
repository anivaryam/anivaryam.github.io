import { nextNonSpacingElement } from './html-spacing';

export interface SourcesSection {
  label: Element;
  list: Element | null;
}

export function isSourcesLabel(element: Element | null): boolean {
  return !!element?.matches('p, h1, h2, h3, h4, h5, h6') &&
    /^sources(?:\s*:|$)/i.test(element.textContent?.trim() || '');
}

/** Only an adjacent list belongs to Sources; never cross another content block. */
export function findSourcesSections(root: ParentNode): SourcesSection[] {
  return Array.from(root.querySelectorAll('p, h1, h2, h3, h4, h5, h6'))
    .filter(isSourcesLabel)
    .map(label => {
      const next = nextNonSpacingElement(label);
      return { label, list: next?.matches('ol, ul') ? next : null };
    });
}
