import { describe, expect, it } from 'vitest';
import { convertToHtml, convertWordToHtml, getUnformattedHtml, type OutputMode } from './converter';
import { cleanHtml } from './html-cleaner';
import { formatCompact } from './html-formatter';
import { sanitizeHtml } from './html-sanitizer';
import { cleanWordHtml } from './word-html-cleaner';
import { normalizeSources } from './mode-sources-normalize';
import { validateMode } from './validator';

describe('Word-to-HTML pipeline regressions', () => {
  it.each<OutputMode>(['regular', 'blogs', 'shoppables'])('preserves literal markup as text in %s output', (mode) => {
    const input = '<p>Use &lt;img src=x onerror=alert(1)&gt; &amp; &amp;copy; literally.</p>';
    const output = convertToHtml(input, mode);
    const formatted = new DOMParser().parseFromString(output.formatted, 'text/html');
    const preview = new DOMParser().parseFromString(output.unformatted, 'text/html');

    expect(formatted.body.textContent).toBe(preview.body.textContent);
    expect(formatted.querySelector('img')).toBeNull();
    expect(output.formatted).toContain('&lt;img');
    expect(output.formatted).toContain('&amp;copy;');
  });

  it('escapes top-level text when formatting', () => {
    const output = formatCompact('&lt;script&gt;literal&lt;/script&gt; &amp; text');
    expect(output).toBe('&lt;script&gt;literal&lt;/script&gt; &amp; text');
  });

  it('sanitizes descendants of styled semantic elements and preserves their formatting', () => {
    const input = '<p style="font-weight: bold"><span style="font-style: italic" onclick="alert(1)">Keep</span> <a href="javascript:alert(1)" onmouseover="alert(1)">link</a></p>';
    const output = sanitizeHtml(input);
    const doc = new DOMParser().parseFromString(output, 'text/html');

    expect(doc.querySelector('p > strong em')?.textContent).toBe('Keep');
    expect(doc.body.textContent).toBe('Keep link');
    expect(doc.querySelector('[style], span, [onclick], [onmouseover], [href]')).toBeNull();
  });

  it('drops script and stylesheet contents instead of turning them into document text', () => {
    expect(sanitizeHtml('<p>Keep</p><script>alert(1)</script><style>p { color: red }</style>')).toBe('<p>Keep</p>');
  });

  it('retains noopener after rejecting an unsafe rel value', () => {
    const output = sanitizeHtml('<a href="https://example.com" target="_blank" rel="opener">link</a>');
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(doc.querySelector('a')?.getAttribute('rel')).toBe('noopener');
  });

  it('preserves combined bold and italic Word formatting', () => {
    const output = getUnformattedHtml('<p><span style="font-weight: bold; font-style: italic">Both</span></p>');
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(doc.querySelector('strong')?.textContent).toBe('Both');
    expect(doc.querySelector('em')?.textContent).toBe('Both');
  });

  it.each(['-35%', '-0.6em', 'sub'])('keeps %s vertical alignment as subscript', (alignment) => {
    const output = getUnformattedHtml(`<p>H<span style="vertical-align: ${alignment}">2</span>O</p>`);
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(doc.querySelector('sub')?.textContent).toBe('2');
    expect(doc.querySelector('sup')).toBeNull();
  });

  it('preserves spaces between Word spans', () => {
    const output = convertWordToHtml('<p><span style="color: red">Hello</span> <span style="color: red">world</span></p>');
    expect(output).toBe('<p>Hello world</p>');
  });

  it('preserves whitespace-only inline spans between words', () => {
    const output = convertWordToHtml('<p>Hello<span> </span>world</p>');
    expect(output).toBe('<p>Hello world</p>');
  });

  it('keeps all text and emphasis in mixed bold/italic list items', () => {
    const output = cleanHtml('<ul><li><strong>Before <em>middle</em> after</strong></li></ul>');
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(doc.querySelector('li')?.textContent).toBe('Before middle after');
    expect(doc.querySelector('strong')?.textContent).toBe('Before middle after');
    expect(doc.querySelector('em')?.textContent).toBe('middle');
  });

  it('still normalizes fully nested bold/italic list content', () => {
    expect(cleanHtml('<ul><li><strong><em>Both</em></strong></li></ul>')).toBe('<ul><li><em><strong>Both</strong></em></li></ul>');
  });

  it.each(['<p></p>', '<h2></h2>', '<script>alert(1)</script>'])('handles input with no remaining content: %s', (input) => {
    expect(convertToHtml(cleanWordHtml(input))).toEqual({ formatted: '', unformatted: '' });
  });

  it('keeps optional transformations disabled by default in Regular mode', () => {
    const output = getUnformattedHtml('<h2>Key Takeaways</h2><ul><li><em>Point</em></li></ul><h1>Title</h1><p>Sources:</p><ol><li><a href="https://example.com">Source</a></li></ol>');
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(doc.querySelector('h2')?.innerHTML).toBe('Key Takeaways');
    expect(doc.querySelector('h1')?.textContent).toBe('Title');
    expect(doc.querySelector('ul em')?.textContent).toBe('Point');
    expect(doc.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
    expect(doc.querySelector('a')?.hasAttribute('target')).toBe(false);
  });

  it.each<OutputMode>(['regular', 'blogs', 'shoppables'])('honors paragraph spacing in %s mode', (mode) => {
    const output = getUnformattedHtml('<p>First</p><p>Second</p>', mode, { paragraphSpacing: true });
    expect(output).toBe('<p>First</p><p>&nbsp;</p><p>Second</p>');
  });
});

describe('Sources content preservation', () => {
  it('preserves citations in the Sources paragraph itself', () => {
    const input = '<p><strong>Sources:</strong> <a href="https://example.com">Study</a> by Author.</p>';
    const output = normalizeSources(input);
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(doc.querySelector('p')?.textContent).toBe('Sources: Study by Author.');
    expect(doc.querySelector('p > strong > em')?.textContent).toBe('Sources:');
    expect(doc.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
    expect(normalizeSources(output)).toBe(output);
  });

  it('preserves inline text, formatting, links, and their original order', () => {
    const input = '<p>Sources:</p><ol><li><strong>Author</strong>, <a href="https://example.com">Study</a>, 2026.</li></ol>';
    const output = normalizeSources(input);
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(doc.querySelector('li')?.textContent).toBe('Author, Study, 2026.');
    expect(doc.querySelector('li > em > strong')?.textContent).toBe('Author');
    expect(doc.querySelector('li > em > a')?.getAttribute('href')).toBe('https://example.com');
    expect(normalizeSources(output)).toBe(output);
  });

  it('applies Sources Italic to already emphasized citations', () => {
    const output = normalizeSources('<p>Sources:</p><ol><li><em>Study</em> by Author</li></ol>');
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(doc.querySelector('li > em')?.textContent).toBe('Study by Author');
    expect(doc.querySelector('li')?.getAttribute('style')).toBe('font-style: italic');
    const results = validateMode(output, 'blogs', {});
    expect(results.results.find(result => result.ruleId === 'sources-normalization')?.passed).toBe(true);
    expect(results.results.find(result => result.ruleId === 'sources-italic')?.passed).toBe(true);
    expect(normalizeSources(output, false)).not.toContain('style=');
  });
});
