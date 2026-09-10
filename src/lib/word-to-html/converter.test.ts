import { describe, expect, it, vi } from 'vitest';
import { convertToHtml, convertWordToHtml, getUnformattedHtml, type OutputMode } from './converter';
import { cleanHtml } from './html-cleaner';
import { formatCompact } from './html-formatter';
import { sanitizeHtml } from './html-sanitizer';
import { cleanWordHtml } from './word-html-cleaner';
import { normalizeSources } from './mode-sources-normalize';
import { validateMode } from './validator';
import { normalizeLists } from './mode-list-normalize';

describe('accepted spacing formats with Word clipboard markup', () => {
  const faqHeading = 'Frequently Asked Questions About How Often Do Newborns Eat?';
  const question = 'How many times a day should a newborn eat?';
  const blankParagraphs = [
    '<p>&nbsp;</p>',
    '<p><span>&nbsp;</span></p>',
    '<p><span style="font-size:11pt">&nbsp;</span></p>',
    '<p><strong><em><span> </span></em></strong></p>',
    '<p><span>&nbsp;&nbsp;</span></p><p><br></p>',
  ];

  it.each(blankParagraphs)('keeps the first FAQ question adjacent with inherited spacing: %s', (gap) => {
    const input = `<p>Introduction.</p><h2>${faqHeading}</h2>${gap}<h3>${question}</h3><p>First answer.</p><h3>Second question?</h3><p>Second answer.</p>`;
    for (const mode of ['regular', 'blogs', 'shoppables'] as const) {
      for (const features of [{}, { spacing: true, paragraphSpacing: true }]) {
        const output = convertToHtml(cleanWordHtml(input), mode, features);
        for (const html of [output.formatted, output.unformatted]) {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const questions = doc.querySelectorAll('h3');
          expect(doc.querySelector('h2')?.nextElementSibling).toBe(questions[0]);
          expect(questions[0].textContent).toBe(question);
          if (features.spacing || mode === 'blogs') {
            expect(questions[1].previousElementSibling?.innerHTML).toBe('&nbsp;');
          }
          expect(validateMode(html, mode, features).results.find(r => r.ruleId === 'spacing-rules')?.passed).toBe(true);
        }
      }
    }
  });

  it.each(blankParagraphs)('removes inherited spacing in default Shoppables output: %s', (gap) => {
    const input = `<p>Hello<span> </span>world.</p>${gap}<h2>Product details</h2>${gap}<p>Description.</p>`;
    const output = convertToHtml(cleanWordHtml(input), 'shoppables');
    for (const html of [output.formatted, output.unformatted]) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      expect(Array.from(doc.querySelectorAll('p')).map(p => p.textContent)).toEqual(['Hello world.', 'Description.']);
      expect(doc.querySelector('br')).toBeNull();
    }
  });

  it('preserves explicitly requested Shoppables BR spacing after cleaning inherited gaps', () => {
    const input = '<p>Body.</p><p><span>&nbsp;</span></p><p>Read more: Details.</p><p><span>&nbsp;</span></p><p>Sources:</p><ol><li>Citation.</li></ol>';
    const features = { brBeforeReadMore: true, brBeforeSources: true };
    const output = getUnformattedHtml(input, 'shoppables', features);
    const doc = new DOMParser().parseFromString(output, 'text/html');
    for (const p of Array.from(doc.querySelectorAll('p')).filter(p => /^(Read more:|Sources:)/.test(p.textContent || ''))) {
      expect(p.previousElementSibling?.innerHTML).toBe('<br>');
    }
    expect(validateMode(output, 'shoppables', features).summary.failed).toBe(0);
  });
});

describe('structural and formatting regressions', () => {
  it.each(['font-weight:bold', 'font-style:italic'])('preserves all adjacent list items with %s', (style) => {
    const input = `<ul><li>First item</li></ul><ul style="${style}"><li>Second item</li><li><span style="font-weight:bold">Label:</span> Third item</li></ul>`;
    const output = getUnformattedHtml(input, 'shoppables');
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(Array.from(doc.querySelectorAll('ul > li')).map(li => li.textContent)).toEqual(['First item', 'Second item', 'Label: Third item']);
    expect(doc.querySelector('ul > strong, ul > em')).toBeNull();
    expect(doc.querySelector('li strong')?.textContent).toBe('Label:');
  });

  it('does not discard content when merging a pre-existing malformed list', () => {
    const output = normalizeLists('<ul><li>First</li></ul><ul><strong><li>Second</li></strong></ul>');
    expect(new DOMParser().parseFromString(output, 'text/html').body.textContent).toBe('FirstSecond');
  });

  it('converts styled heading lists to numbered headings', () => {
    const output = getUnformattedHtml('<ol style="font-weight:bold"><li><h3>First</h3></li><li><h3>Second</h3></li></ol>', 'blogs');
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(doc.querySelector('ol')).toBeNull();
    expect(Array.from(doc.querySelectorAll('h3')).map(h => h.textContent)).toEqual(['1. First', '2. Second']);
  });

  it('preserves table structure and cell emphasis without orphan formatting wrappers', () => {
    const output = getUnformattedHtml('<table style="font-weight:bold"><tbody><tr style="font-style:italic"><td><em>Cell A</em></td><td>Cell B</td></tr></tbody></table>', 'shoppables');
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(doc.body.children).toHaveLength(1);
    expect(doc.querySelectorAll('table > tbody > tr > td')).toHaveLength(2);
    expect(doc.querySelector('td > em')?.textContent).toBe('Cell A');
    expect(doc.querySelector('table > strong, tbody > em, tr > em')).toBeNull();
  });

  it.each(['b', 'i', 'span'])('preserves superscript/subscript on <%s>', (tag) => {
    for (const [alignment, expected] of [['super', 'sup'], ['35%', 'sup'], ['sub', 'sub'], ['-0.6em', 'sub']]) {
      const output = getUnformattedHtml(`<p>x<${tag} style="vertical-align:${alignment}">2</${tag}></p>`, 'shoppables');
      const doc = new DOMParser().parseFromString(output, 'text/html');
      expect(doc.querySelector(expected)?.textContent).toBe('2');
      if (tag === 'b') expect(doc.querySelector('strong')?.textContent).toBe('2');
      if (tag === 'i') expect(doc.querySelector('em')?.textContent).toBe('2');
    }
  });

  it('continues structural cleanup after encountering an empty Word link', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const output = getUnformattedHtml('<p><a href="https://example.com"><span> </span></a></p><ul><li><p>Item</p></li></ul>', 'shoppables');
      expect(new DOMParser().parseFromString(output, 'text/html').querySelector('li')?.innerHTML).toBe('Item');
      expect(warning).not.toHaveBeenCalled();
      expect(cleanHtml('<a href="https://example.com"> </a><ul><li><p>Item</p></li></ul>')).toContain('<li>Item</li>');
      expect(warning).not.toHaveBeenCalled();
    } finally {
      warning.mockRestore();
    }
  });

  it('preserves inline text spacing in formatted and preview output', () => {
    const output = convertToHtml('Hello <strong>world</strong> today.', 'shoppables');
    for (const html of [output.formatted, output.unformatted]) {
      expect(new DOMParser().parseFromString(html, 'text/html').body.textContent).toBe('Hello world today.');
    }
  });
});

describe('URL preservation', () => {
  it.each([
    'https://example.com/docs--v2?key=a--b#part--two',
    'https://xn--bcher-kva.example/path',
    '/products--new?query=some%20text&value=a--b',
    '../next--page',
    'mailto:editor@example.com?subject=Follow--up',
    'https://example.com/a—b?query=x+y',
  ])('preserves the exact destination: %s', (href) => {
    for (const style of ['', ' style="font-weight:bold"']) {
      const output = getUnformattedHtml(`<p${style}><a href="${href}">Link</a></p>`, 'shoppables');
      expect(new DOMParser().parseFromString(output, 'text/html').querySelector('a')?.getAttribute('href')).toBe(href);
    }
  });
});

describe('spacing within formatted links', () => {
  it.each([
    '<p>visit <a href="/how-it-works">our <strong><u>How It Works</u></strong></a> page.</p>',
    '<p>visit <a href="/how-it-works"><span style="font-size:11pt">our </span><strong><u>How It Works</u></strong></a> page.</p>',
    '<p>visit our <a href="/how-it-works"><strong><u>How It Works</u></strong> page</a>.</p>',
    '<p>visit <a href="/how-it-works"><em>our</em> <strong><u>How It Works</u></strong></a> page.</p>',
    '<p>visit <a href="/how-it-works"><em>our</em> <strong>How</strong> <u>It Works</u></a> page.</p>',
    '<p>visit our <a href="/how-it-works"><strong><u>How It Works</u></strong></a> page.</p>',
  ])('preserves word boundaries in code and preview: %s', (input) => {
    const inputLinkText = new DOMParser().parseFromString(input, 'text/html').querySelector('a')?.textContent?.trim();
    for (const mode of ['regular', 'blogs', 'shoppables'] as const) {
      for (const wrapLinksStrongUnderline of [false, true]) {
        const output = convertToHtml(cleanWordHtml(input), mode, { wrapLinksStrongUnderline });
        for (const html of [output.formatted, output.unformatted]) {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          expect(doc.body.textContent).toBe('visit our How It Works page.');
          expect(doc.querySelector('a')?.getAttribute('href')).toBe('/how-it-works');
          expect(doc.querySelector('a')?.textContent?.trim()).toBe(inputLinkText);
        }
      }
    }
  });

  it('trims only outer anchor padding while keeping inner separators', () => {
    const input = '<p><a href="/how-it-works">  <strong>How</strong> It <em>Works</em>  </a></p>';
    const output = cleanHtml(input);
    expect(output).toBe('<p><a href="/how-it-works"><strong>How</strong> It <em>Works</em></a></p>');
    expect(cleanHtml(output)).toBe(output);
  });

  it('preserves non-breaking spaces between plain and formatted anchor text', () => {
    const output = cleanHtml('<p><a href="/how-it-works">our&nbsp;<strong>How It Works</strong></a></p>');
    expect(new DOMParser().parseFromString(output, 'text/html').querySelector('a')?.textContent).toBe('our\u00a0How It Works');
  });
});

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
    expect(doc.querySelector('em em')).toBeNull();
    expect(doc.querySelector('li')?.getAttribute('style')).toBe('font-style: italic');
    const results = validateMode(output, 'blogs', {});
    expect(results.results.find(result => result.ruleId === 'sources-normalization')?.passed).toBe(true);
    expect(results.results.find(result => result.ruleId === 'sources-italic')?.passed).toBe(true);
    expect(normalizeSources(output, false)).not.toContain('style=');
  });

  it('keeps nested source lists outside inline emphasis wrappers', () => {
    const input = '<p>Sources:</p><ol><li>Main source<ul><li>Nested citation</li></ul></li></ol>';
    const output = normalizeSources(input);
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(doc.querySelector('em ul, em ol')).toBeNull();
    expect(doc.querySelector('ol > li > ul > li')?.textContent).toBe('Nested citation');
    expect(normalizeSources(output)).toBe(output);
  });
});
