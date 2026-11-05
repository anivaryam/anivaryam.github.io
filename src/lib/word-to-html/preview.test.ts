import { describe, expect, it } from 'vitest';
import { LIST_STYLE_TYPES } from './html-sanitizer';
import { ORDERED_LIST_PREVIEW_CSS, PREVIEW_LIST_TYPE_ATTRIBUTE, preparePreviewHtml, removePreviewAttributes } from './preview';

describe('Word to HTML preview', () => {
  it('neutralizes only inserted raw spacers while preserving ordinary selection boundaries', () => {
    const html = '<p>Alpha</p><div><!--selected--><span>Beta</span></div><div data-w2h-spacer="1"><style>body{display:none}</style><img src=x onerror="throw 1"></div>';
    const preview = preparePreviewHtml(html);
    expect(preview).toContain('<div><!--selected--><span>Beta</span></div>');
    expect(preview).not.toMatch(/onerror|<style|data-w2h-spacer/);
    expect(html).toContain('onerror');
  });

  it('uses the sanitizer numbering map for case-sensitive preview styles and removes copy metadata', () => {
    const types = [...new Set(Object.values(LIST_STYLE_TYPES))];
    const doc = new DOMParser().parseFromString(preparePreviewHtml(types.map(type => `<ol type="${type}"><li>x</li></ol>`).join('')), 'text/html');
    expect(Array.from(doc.querySelectorAll('ol'), list => list.getAttribute(PREVIEW_LIST_TYPE_ATTRIBUTE))).toEqual(types);
    for (const type of types) expect(ORDERED_LIST_PREVIEW_CSS).toContain(`[${PREVIEW_LIST_TYPE_ATTRIBUTE}="${type}"]`);
    removePreviewAttributes(doc.body);
    expect(doc.body.innerHTML).not.toContain(PREVIEW_LIST_TYPE_ATTRIBUTE);
    expect(Array.from(doc.querySelectorAll('ol'), list => list.getAttribute('type'))).toEqual(types);
  });
});
