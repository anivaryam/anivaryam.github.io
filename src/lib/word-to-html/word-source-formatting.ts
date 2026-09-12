import DOMPurify from 'dompurify';
import { BLOCK_ELEMENT_SET } from './html-cleaner';
import { findArticleTitleAfterKeyTakeaways, getArticleTitleCandidate, normalizeArticleTitle } from './mode-h1-removal';

interface LinkRun {
  linked: boolean;
  nodes: Node[];
}

/**
 * Resolve source link appearance and article titles before cleanup drops CSS.
 * An isolated document is necessary: the application's preview styles would
 * otherwise make even deliberately plain source links look like links.
 */
export function prepareWordSource(root: HTMLElement, inlineSourceStyles = false): boolean {
  const candidate = getArticleTitleCandidate(root);
  if (!root.querySelector('a[href]') && !candidate?.matches('p, div')) return false;

  const frame = document.createElement('iframe');
  frame.hidden = true;
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('sandbox', 'allow-same-origin');
  document.body.appendChild(frame);

  try {
    const doc = frame.contentDocument!;
    doc.open();
    // Source CSS may be read, but cannot fetch fonts, images, imports, or scripts.
    doc.write('<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"></head><body></body></html>');
    doc.close();
    const source = doc.createElement('div');
    source.innerHTML = DOMPurify.sanitize(root.innerHTML, { ADD_ATTR: ['target'], FORCE_BODY: true });
    doc.body.appendChild(source);
    const view = frame.contentWindow!;
    const styles = new Map<Element, CSSStyleDeclaration>();
    const copies = new Map<Element, HTMLElement[]>();
    const styleOf = (element: Element): CSSStyleDeclaration => {
      let style = styles.get(element);
      if (!style) {
        style = view.getComputedStyle(element);
        styles.set(element, style);
      }
      return style;
    };

    const title = findArticleTitleAfterKeyTakeaways(source, styleOf);
    const normalizeTitle = title && title.tagName.toLowerCase() !== 'h1';

    // Inspect every link before mutating the document, so sibling CSS selectors
    // and inherited formatting are evaluated against the original source tree.
    const replacements = Array.from(source.querySelectorAll('a[href]')).map(anchor => {
      let block = anchor.parentElement!;
      while (block !== source && !BLOCK_ELEMENT_SET.has(block.tagName.toLowerCase())) {
        block = block.parentElement!;
      }
      const bodyColor = styleOf(block).color;
      const isLinked = (element: Element): boolean => {
        if (styleOf(element).color !== bodyColor) return true;
        // Underlines on ancestors are painted through descendants even when a
        // descendant declares text-decoration:none. Include wrapping <u>/spans.
        for (let node: Element | null = element; node && node !== block; node = node.parentElement) {
          const style = styleOf(node);
          if ((style.textDecorationLine || style.textDecoration).split(/\s+/).includes('underline')) return true;
        }
        return false;
      };

      const split = (parent: Element): LinkRun[] => {
        const runs: LinkRun[] = [];
        const append = (linked: boolean, node: Node) => {
          const last = runs[runs.length - 1];
          if (last?.linked === linked) last.nodes.push(node);
          else runs.push({ linked, nodes: [node] });
        };
        for (const child of Array.from(parent.childNodes)) {
          if (child.nodeType === Node.ELEMENT_NODE) {
            if (!child.hasChildNodes()) {
              append(isLinked(child as Element), child.cloneNode(true));
              continue;
            }
            for (const run of split(child as Element)) {
              const wrapper = child.cloneNode(false) as HTMLElement;
              const original = child as Element;
              copies.set(original, [...(copies.get(original) || []), wrapper]);
              run.nodes.forEach(node => wrapper.appendChild(node));
              append(run.linked, wrapper);
            }
          } else if (child.nodeType === Node.TEXT_NODE) {
            append(isLinked(parent), child.cloneNode(true));
          }
        }
        return runs;
      };
      return { anchor, runs: split(anchor) };
    });

    const changed = normalizeTitle || replacements.some(({ runs }) => runs.some(run => !run.linked));
    if (!changed) return false;

    if (inlineSourceStyles) {
      // Native paste may discard inherited CSS. Snapshot source appearance for
      // the editable input, then remove stylesheets before insertion in the app.
      // Compute first: writing an ancestor's style must not affect later reads.
      const properties = ['color', 'text-decoration', 'text-decoration-line', 'font-weight', 'font-style', 'font-size', 'vertical-align'];
      const snapshots = Array.from(source.querySelectorAll<HTMLElement>('*')).map(element => ({
        element,
        values: properties.map(property => styleOf(element).getPropertyValue(property)),
      }));
      for (const { element, values } of snapshots) {
        for (const target of [element, ...(copies.get(element) || [])]) {
          properties.forEach((property, index) => {
            if (values[index]) target.style.setProperty(property, values[index]);
          });
        }
      }
    }

    for (const { anchor, runs } of replacements) {
      const fragment = doc.createDocumentFragment();
      for (const run of runs) {
        if (run.linked && run.nodes.some(node => node.textContent?.trim())) {
          const link = anchor.cloneNode(false);
          run.nodes.forEach(node => link.appendChild(node));
          fragment.appendChild(link);
        } else {
          run.nodes.forEach(node => fragment.appendChild(node));
        }
      }
      anchor.replaceWith(fragment);
    }
    if (normalizeTitle) normalizeArticleTitle(title);
    if (inlineSourceStyles) source.querySelectorAll('style').forEach(style => style.remove());
    root.innerHTML = source.innerHTML;
    return true;
  } finally {
    frame.remove();
  }
}
