import { BLOCK_ELEMENT_SET } from './html-cleaner';

/** Clipboard plain text without executing HTML or joining adjacent paragraphs. */
export function htmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const isBlock = (node: Node) => node.nodeType === Node.ELEMENT_NODE && BLOCK_ELEMENT_SET.has((node as Element).tagName.toLowerCase());
  const read = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = (node as Element).tagName.toLowerCase();
    if (['script', 'style', 'iframe', 'object', 'embed'].includes(tag)) return '';
    if (tag === 'br') return '\n';
    if (tag === 'pre' || tag === 'code') return node.textContent || '';
    let text = '';
    let previous: Node | null = null;
    for (const child of Array.from(node.childNodes)) {
      const value = read(child);
      if (previous && (isBlock(previous) || isBlock(child)) && !text.endsWith('\n') && !value.startsWith('\n')) text += '\n';
      text += value;
      previous = child;
    }
    return text;
  };
  return read(doc.body);
}

/** Rich copy must also paste into editors that accept only plain text. */
export async function writeRichHtml(html: string): Promise<boolean> {
  try {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([htmlToPlainText(html)], { type: 'text/plain' }),
    })]);
    return true;
  } catch {
    // Preserve the existing HTML-code fallback when rich clipboard APIs are unavailable.
    await navigator.clipboard.writeText(html);
    return false;
  }
}
