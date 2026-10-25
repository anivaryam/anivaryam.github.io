import { describe, expect, it } from 'vitest';
import { AI_UTM_SOURCES, stripAiTracking, stripAiTrackingFromUrl } from './mode-strip-ai-tracking';

describe('stripAiTrackingFromUrl', () => {
  it.each(AI_UTM_SOURCES)('strips utm_source=%s', (source) => {
    expect(stripAiTrackingFromUrl(`https://store.com/collections/weed-control?utm_source=${source}`))
      .toBe('https://store.com/collections/weed-control');
  });

  it('strips the whole utm_* set the generator injected', () => {
    expect(stripAiTrackingFromUrl('https://store.com/blogs/news/post?utm_source=chatgpt.com&utm_medium=referral&utm_campaign=gpt'))
      .toBe('https://store.com/blogs/news/post');
  });

  it('keeps other parameters and the hash byte-for-byte', () => {
    expect(stripAiTrackingFromUrl('https://store.com/products/mix?variant=12%203&utm_source=chatgpt.com&ref=a--b#reviews'))
      .toBe('https://store.com/products/mix?variant=12%203&ref=a--b#reviews');
  });

  it('strips from a relative URL', () => {
    expect(stripAiTrackingFromUrl('/collections/weed-control?utm_source=perplexity'))
      .toBe('/collections/weed-control');
  });

  it('matches the source case-insensitively and percent-decoded', () => {
    expect(stripAiTrackingFromUrl('https://store.com/?UTM_SOURCE=ChatGPT%2Ecom'))
      .toBe('https://store.com/');
  });

  it.each([
    'https://store.com/collections/weed-control',
    'https://store.com/sale?utm_source=newsletter&utm_medium=email',
    'https://store.com/sale?utm_medium=referral',
    '/products/mix?variant=123',
    'https://example.com/docs--v2?key=a--b#part--two',
  ])('leaves %s untouched', (href) => {
    expect(stripAiTrackingFromUrl(href)).toBe(href);
  });
});

describe('stripAiTracking', () => {
  it('strips every tagged link and leaves the rest of the markup alone', () => {
    const output = stripAiTracking(
      '<p>Shop <a href="https://store.com/a?utm_source=chatgpt.com">one</a> and ' +
      '<a href="https://store.com/b?x=1&amp;utm_source=gemini">two</a>, read ' +
      '<a href="https://store.com/c?utm_source=newsletter">three</a>.</p>'
    );
    const links = [...new DOMParser().parseFromString(output, 'text/html').querySelectorAll('a')];
    expect(links.map(link => link.getAttribute('href'))).toEqual([
      'https://store.com/a',
      'https://store.com/b?x=1',
      'https://store.com/c?utm_source=newsletter',
    ]);
  });

  it('does not touch a bare URL in text', () => {
    const html = '<p>See https://store.com/a?utm_source=chatgpt.com for details.</p>';
    expect(stripAiTracking(html)).toBe(html);
  });
});
