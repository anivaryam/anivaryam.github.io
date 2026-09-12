/**
 * Wrap Links Strong & Underline
 *
 * Wraps the text content of every non-alt-text <a> in <strong><u>...</u></strong>.
 * Skips anchors that wrap an <img> and anchors inside paragraphs that start
 * with "Alt image text:" (mirrors the validator's reliable detection at
 * validator.ts:1395).
 */

import { describe, it, expect } from 'vitest';
import { wrapLinksStrongUnderline } from './mode-wrap-links-strong-underline';

describe('wrapLinksStrongUnderline', () => {
  it('returns empty string for empty input', () => {
    expect(wrapLinksStrongUnderline('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(wrapLinksStrongUnderline('   \n  ')).toBe('');
  });

  it('wraps a plain text link in <strong><u>', () => {
    const html = '<p>See <a href="https://x.com">our site</a> for more.</p>';
    const out = wrapLinksStrongUnderline(html);
    expect(out).toContain('<strong><u>our site</u></strong>');
    expect(out).toContain('<a href="https://x.com">');
    // The original text must NOT remain outside the wrap (regression: text-node copy bug).
    expect(out).not.toMatch(/<a[^>]*>\s*our site\s*<strong>/);
  });

  it('wraps multiple links in the same paragraph', () => {
    const html = '<p><a href="https://a.com">A</a> and <a href="https://b.com">B</a></p>';
    const out = wrapLinksStrongUnderline(html);
    expect(out).toContain('<strong><u>A</u></strong>');
    expect(out).toContain('<strong><u>B</u></strong>');
  });

  it('skips image links (<a><img></a>)', () => {
    const html = '<p><a href="https://x.com"><img src="/i.png" alt="x"></a></p>';
    const out = wrapLinksStrongUnderline(html);
    expect(out).not.toContain('<strong><u>');
    expect(out).toContain('<img src="/i.png" alt="x">');
  });

  it('skips mixed image+text anchors (image-link detection wins)', () => {
    const html = '<p><a href="https://x.com"><img src="/i.png" alt="x"> caption</a></p>';
    const out = wrapLinksStrongUnderline(html);
    expect(out).not.toContain('<strong><u>');
  });

  it('skips links inside "Alt image text:" paragraph (case-insensitive prefix)', () => {
    const html = '<p>alt image text: see <a href="https://x.com">source</a> here</p>';
    const out = wrapLinksStrongUnderline(html);
    expect(out).not.toContain('<strong><u>');
    expect(out).toContain('href="https://x.com"');
  });

  it('does NOT skip when "alt image text:" appears mid-sentence (strict prefix)', () => {
    const html = '<p>Read the alt image text: docs at <a href="https://x.com">x</a>.</p>';
    const out = wrapLinksStrongUnderline(html);
    expect(out).toContain('<strong><u>x</u></strong>');
  });

  it('wraps links in normal body paragraphs even when adjacent to alt-text paragraphs', () => {
    const html =
      '<p>alt image text: <a href="https://src.com">src</a></p>' +
      '<p>See <a href="https://x.com">x</a> for more.</p>';
    const out = wrapLinksStrongUnderline(html);
    expect(out).toContain('<strong><u>x</u></strong>');
    expect(out).not.toContain('<strong><u>src</u></strong>');
  });

  it('preserves surrounding link attributes (target, rel)', () => {
    const html = '<p><a href="https://x.com" target="_blank" rel="noopener noreferrer">x</a></p>';
    const out = wrapLinksStrongUnderline(html);
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('<strong><u>x</u></strong>');
  });

  it('is idempotent (running twice does not double-wrap)', () => {
    const html = '<p><a href="https://x.com">x</a></p>';
    const once = wrapLinksStrongUnderline(html);
    const twice = wrapLinksStrongUnderline(once);
    expect(twice).toBe(once);
  });

  it.each([
    '<strong>Products</strong>',
    '<u><strong>Products</strong></u>',
    '<strong><u>Products</u></strong> and <em>details</em>',
  ])('uses one canonical wrapper around preformatted content: %s', (content) => {
    const input = `<p><a href="/products">${content}</a></p>`;
    const output = wrapLinksStrongUnderline(input);
    const doc = new DOMParser().parseFromString(output, 'text/html');
    const anchor = doc.querySelector('a')!;
    const original = new DOMParser().parseFromString(input, 'text/html').querySelector('a')!;
    expect(anchor.textContent).toBe(original.textContent);
    expect(anchor.querySelectorAll('strong')).toHaveLength(1);
    expect(anchor.querySelectorAll('u')).toHaveLength(1);
    expect(anchor.querySelectorAll('em')).toHaveLength(original.querySelectorAll('em').length);
    expect(wrapLinksStrongUnderline(output)).toBe(output);
  });

  it('handles links nested inside other elements (li, blockquote)', () => {
    const html =
      '<ul><li><a href="https://x.com">x</a></li></ul>' +
      '<blockquote><a href="https://y.com">y</a></blockquote>';
    const out = wrapLinksStrongUnderline(html);
    expect(out).toContain('<strong><u>x</u></strong>');
    expect(out).toContain('<strong><u>y</u></strong>');
  });

  it('leaves anchors without href untouched', () => {
    const html = '<p><a name="x">anchor</a></p>';
    const out = wrapLinksStrongUnderline(html);
    expect(out).not.toContain('<strong><u>');
  });
});
