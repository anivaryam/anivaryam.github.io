import { describe, expect, it, vi } from 'vitest';
import { convertToHtml, convertWordToHtml, getUnformattedHtml, type OutputMode } from './converter';
import { cleanHtml } from './html-cleaner';
import { formatCompact } from './html-formatter';
import { sanitizeHtml } from './html-sanitizer';
import { cleanWordHtml } from './word-html-cleaner';
import { normalizeSources } from './mode-sources-normalize';
import { validateMode } from './validator';
import { normalizeLists } from './mode-list-normalize';
import { removeH1AfterKeyTakeaways } from './mode-h1-removal';

describe('text preservation during structural cleanup', () => {
  it.each([
    ['<p>First<br>Second</p>', 'First Second'],
    ['<ul><li><p><strong>Hello</strong> <em>world</em></p></li></ul>', 'Hello world'],
    ['<ul><li><p>First</p><p>Second</p></li></ul>', 'First Second'],
    ['<ul><li>Before<p>Middle</p>After</li></ul>', 'Before Middle After'],
  ])('preserves word boundaries in %s', (input, text) => {
    for (const mode of ['regular', 'blogs', 'shoppables'] as const) {
      const output = convertToHtml(cleanWordHtml(input), mode);
      for (const html of [output.formatted, output.unformatted]) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        expect((doc.querySelector('li') || doc.querySelector('p'))?.textContent).toBe(text);
        expect(doc.querySelector('br, li p')).toBeNull();
      }
    }
  });

  it('preserves paragraph boundaries in adjacent and nested layout blocks', () => {
    const output = getUnformattedHtml('<div>First</div><div><strong>Second</strong><div>Third</div>Fourth</div>');
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(Array.from(doc.querySelectorAll('p')).map(p => p.textContent)).toEqual(['First', 'Second', 'Third', 'Fourth']);
    expect(doc.querySelector('strong')?.textContent).toBe('Second');
  });

  it('keeps caption text while removing images and empty image wrappers', () => {
    const output = getUnformattedHtml('<div class="image"><img src="photo.png"><p class="image-caption">Important caption</p></div><div class="image"><img src="other.png"></div><p style="background-image:url(photo.png)">Body</p>');
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(Array.from(doc.querySelectorAll('p')).map(p => p.textContent)).toEqual(['Important caption', 'Body']);
    expect(doc.querySelector('img, [style], [class]')).toBeNull();
  });

  it.each(['text-decoration:underline', 'text-decoration-line:underline', 'text-decoration:underline solid red'])('preserves CSS underlining: %s', (style) => {
    const output = getUnformattedHtml(`<p><span style="${style};font-weight:bold;font-style:italic">Important</span></p>`);
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(doc.querySelector('u')?.textContent).toBe('Important');
    expect(doc.querySelector('strong')?.textContent).toBe('Important');
    expect(doc.querySelector('em')?.textContent).toBe('Important');
  });
});

describe('formatted-output content parity', () => {
  it('retains empty table cells and rows in the same columns as the preview', () => {
    const output = convertToHtml('<table><tr><th>A</th><th></th><th>C</th></tr><tr><td>1</td><td></td><td>3</td></tr><tr><td></td><td></td><td></td></tr></table>');
    for (const html of [output.formatted, output.unformatted]) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      expect(Array.from(doc.querySelectorAll('tr')).map(row => Array.from(row.children).map(cell => cell.textContent))).toEqual([
        ['A', '', 'C'], ['1', '', '3'], ['', '', ''],
      ]);
    }
  });

  it.each(['first\n\nsecond  \n  third', '  \n\n  ', '&lt;literal&gt;\n\n&amp; text'])('preserves preformatted whitespace and text: %s', (content) => {
    const output = convertToHtml(`<pre><code>${content}</code></pre>`);
    const preview = new DOMParser().parseFromString(output.unformatted, 'text/html');
    const formatted = new DOMParser().parseFromString(output.formatted, 'text/html');
    expect(formatted.querySelector('code')?.textContent).toBe(preview.querySelector('code')?.textContent);
  });

  it('does not truncate large documents in the copied code', () => {
    const text = 'a'.repeat(1000000) + ' END';
    const output = convertToHtml(`<p>${text}</p>`);
    for (const html of [output.formatted, output.unformatted]) {
      expect(new DOMParser().parseFromString(html, 'text/html').querySelector('p')?.textContent).toBe(text);
    }
  });

  it('preserves links and emphasis when numbering headings', () => {
    const output = getUnformattedHtml('<ol><li><h3><a href="https://example.com/product">Product <em>name</em></a> H<sub>2</sub>O</h3></li></ol>', 'shoppables');
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(doc.querySelector('h3')?.textContent).toBe('1. Product name H2O');
    expect(doc.querySelector('a')?.getAttribute('href')).toBe('https://example.com/product');
    expect(doc.querySelector('a em')?.textContent).toBe('name');
    expect(doc.querySelector('sub')?.textContent).toBe('2');
  });
});

describe('article titles after Key Takeaways', () => {
  const takeaways = '<h2>Key Takeaways:</h2><ul><li>One point</li></ul>';
  const intro = '<p style="font-size:11pt">The introduction must remain.</p>';
  const title = 'How To Measure Your Closet Before You Buy An Organizer System';
  const titleVariants = [
    `<h1>${title}</h1>`,
    `<p class="title"><span style="font-size:20pt;font-weight:700">${title}</span></p>`,
    `<p class="MsoTitle">${title}</p>`,
    `<p style="mso-style-name:Title">${title}</p>`,
    `<p style="font-size:20pt">${title}</p>`,
    `<p><span style="font-size:20pt">${title}</span></p>`,
    `<div style="font-size:32px">${title}</div>`,
    `<p><span style="font-size:24px">How To Measure </span><strong style="font-size:28px">Your Closet</strong></p>`,
  ];

  it.each(titleVariants)('removes only the article title: %s', (heading) => {
    const input = takeaways + '<p><span>&nbsp;</span></p><br>' + heading + intro + '<h1>A later heading</h1>';
    const expectedTitle = new DOMParser().parseFromString(heading, 'text/html').body.textContent;
    for (const html of [convertWordToHtml(input, 'blogs'), getUnformattedHtml(input, 'blogs')]) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      expect(doc.body.textContent).not.toContain(expectedTitle);
      expect(doc.body.textContent).toContain('The introduction must remain.');
      expect(doc.querySelector('h1')?.textContent).toBe('A later heading');
      expect(validateMode(html, 'blogs', {}).results.find(r => r.ruleId === 'h1-after-key-takeaways')?.passed).toBe(true);
    }
  });

  it.each(titleVariants)('retains the title when disabled and in default Regular/Shoppables: %s', (heading) => {
    const input = takeaways + heading + intro;
    const expectedTitle = new DOMParser().parseFromString(heading, 'text/html').body.textContent;
    for (const [mode, features] of [['blogs', { h1Removal: false }], ['regular', {}], ['shoppables', {}]] as const) {
      const output = getUnformattedHtml(input, mode, features);
      expect(new DOMParser().parseFromString(output, 'text/html').querySelector('h1')?.textContent).toBe(expectedTitle);
      expect(validateMode(output, mode, features).results.find(r => r.ruleId === 'h1-after-key-takeaways')?.passed).toBe(true);
    }
  });

  it('recognizes the Google Docs draft title through stylesheet classes', () => {
    const input = `<style>.title {font-size:26pt} .draft-title {font-size:20pt;font-weight:700} .body {font-size:11pt}</style>${takeaways}<p class="title"><span class="draft-title">${title}</span></p><p class="body">A premium organizer can only perform as intended when it fits the space it was selected for.</p>`;
    expect(getUnformattedHtml(input, 'blogs')).not.toContain(title);
    expect(getUnformattedHtml(input, 'blogs', { h1Removal: false })).toContain(title);
  });

  it('recognizes manually sized text through stylesheet classes without a Title label', () => {
    const input = `<style>.large {font-size:20pt} .body {font-size:11pt}</style>${takeaways}<p><span class="large">${title}</span></p><p class="body">Introduction.</p>`;
    expect(getUnformattedHtml(input, 'blogs')).not.toContain(title);
  });

  it.each([
    '<p>Ordinary introductory text.</p>',
    '<p><strong>ORDINARY BOLD INTRODUCTION.</strong></p>',
    '<p style="font-size:16pt">A smaller paragraph.</p>',
    '<p><span style="font-size:28pt">One</span> <span style="font-size:11pt">enlarged word is not a title.</span></p>',
    '<h2 style="font-size:26pt">A genuine section heading</h2>',
    '<div><p style="font-size:24pt">First paragraph.</p><p>Second paragraph.</p></div>',
  ])('keeps non-title content: %s', (content) => {
    const input = takeaways + content + intro;
    const expected = new DOMParser().parseFromString(content, 'text/html').body.textContent;
    expect(new DOMParser().parseFromString(getUnformattedHtml(input, 'blogs'), 'text/html').body.textContent).toContain(expected);
  });

  it('requires both the absolute minimum and the body-size ratio', () => {
    const input = takeaways + `<p style="font-size:20pt">${title}</p><p style="font-size:16pt">Large body text.</p>`;
    expect(getUnformattedHtml(input, 'blogs')).toContain(title);
    const boundary = takeaways + `<p style="font-size:18pt">${title}</p><p style="font-size:12pt">Body.</p>`;
    expect(getUnformattedHtml(boundary, 'blogs')).not.toContain(title);
  });

  it('requires body-text evidence for manually enlarged text', () => {
    expect(getUnformattedHtml(takeaways + `<p style="font-size:24pt">${title}</p>`, 'blogs')).toContain(title);
  });

  it('does not search beyond the first real content block', () => {
    expect(getUnformattedHtml(takeaways + intro + `<p class="title">${title}</p>`, 'blogs')).toContain(title);
  });

  it.each(['<h2>Another section</h2>', '<p>Ordinary content.</p>'])('does not attach a later list across %s', (boundary) => {
    const input = '<h2>Key Takeaways:</h2>' + boundary + `<ul><li>Unrelated list</li></ul><h1>${title}</h1>`;
    expect(getUnformattedHtml(input, 'blogs')).toContain(title);
  });

  it('handles an ordered Takeaways list and wrapped clipboard content', () => {
    const input = `<div><h2>Key Takeaways:</h2><ol><li>Point</li></ol><p class="title">${title}</p>${intro}</div>`;
    const output = getUnformattedHtml(input, 'blogs');
    expect(output).not.toContain(title);
    expect(validateMode(output, 'blogs', {}).summary.failed).toBe(0);
  });

  it('honors explicit removal in Regular/Blogs and works independently of Takeaways formatting', () => {
    for (const mode of ['regular', 'blogs'] as const) {
      const features = { h1Removal: true, keyTakeaways: false };
      const output = getUnformattedHtml(takeaways + titleVariants[2] + intro, mode, features);
      expect(output).not.toContain(title);
      expect(validateMode(output, mode, features).results.find(r => r.ruleId === 'h1-after-key-takeaways')?.passed).toBe(true);
    }
  });

  it('skips real spacing nodes in the shared removal utility', () => {
    expect(removeH1AfterKeyTakeaways(takeaways + '<p><span>&nbsp;</span></p><br><h1>Title</h1>' + intro)).not.toContain('<h1>');
  });

  it('preserves source link boundaries when the same document has a visual article title', () => {
    const input = takeaways + `<p style="font-size:20pt">${title}</p><p style="font-size:11pt;color:black">Consult <a href="https://example.com/article" style="color:inherit;text-decoration:none">our article <span style="color:#1155cc;text-decoration:underline">Reference title</span></a> for details.</p>`;
    const output = getUnformattedHtml(input, 'blogs');
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(doc.body.textContent).not.toContain(title);
    expect(doc.body.textContent).toContain('Consult our article Reference title for details.');
    expect(Array.from(doc.querySelectorAll('a')).map(a => a.textContent)).toEqual(['Reference title']);
  });
});

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

describe('source-visible link boundaries', () => {
  const href = 'https://example.com/closet-details';
  const title = 'Closet Measurements: Rod Heights, Shelf Depth & Valet Rods';
  const cases = [
    {
      name: 'adjacent anchors with class-based source styles',
      // jsdom 28 miscomputes stylesheet text-decoration shorthand after ancestor
      // style reads; longhand exercises the equivalent cascade here.
      html: `<style>p { color: black } .source-link { color: inherit; text-decoration-line: none } .visible { color: #1155cc; text-decoration-line: underline }</style><p>Consult <span><a class="source-link" href="${href}">our article </a></span><span class="visible"><a class="source-link" href="${href}">${title.replace('&', '&amp;')}</a></span> while recording dimensions.</p>`,
      text: `Consult our article ${title} while recording dimensions.`,
      links: [title],
    },
    {
      name: 'inline clipboard formatting within a single anchor',
      html: `<p>See <a href="${href}" style="color: inherit; text-decoration: none"><span>our </span><span style="color:#1155cc;text-decoration:underline"><strong>Products</strong></span></a> today.</p>`,
      text: 'See our Products today.',
      links: ['Products'],
    },
    {
      name: 'entire link styled as normal text',
      html: `<p>See <a href="${href}" style="color:inherit;text-decoration:none">our Products</a> today.</p>`,
      text: 'See our Products today.',
      links: [],
    },
    {
      name: 'plain text between two visible runs in one anchor',
      html: `<p><a href="${href}" style="color:inherit;text-decoration:none"><u>First</u> and <em><u>Second</u></em></a></p>`,
      text: 'First and Second',
      links: ['First', 'Second'],
    },
    {
      name: 'normal browser link appearance without explicit CSS',
      html: `<p><a href="${href}">Products</a></p>`,
      text: 'Products',
      links: ['Products'],
    },
    {
      name: 'color-only link indicator',
      html: `<p><a href="${href}" style="color:#1155cc;text-decoration:none">Products</a></p>`,
      text: 'Products',
      links: ['Products'],
    },
    {
      name: 'matching non-black body color is ordinary text',
      html: `<p style="color:#333333"><a href="${href}" style="color:#333333;text-decoration:none">Products</a></p>`,
      text: 'Products',
      links: [],
    },
  ];

  it.each(cases)('$name', ({ html, text, links }) => {
    for (const mode of ['regular', 'blogs', 'shoppables'] as const) {
      const output = convertToHtml(cleanWordHtml(html), mode, { wrapLinksStrongUnderline: true });
      for (const result of [output.formatted, output.unformatted]) {
        const doc = new DOMParser().parseFromString(result, 'text/html');
        expect(doc.querySelector('p')?.textContent).toBe(text);
        expect(Array.from(doc.querySelectorAll('a')).map(a => a.textContent)).toEqual(links);
        doc.querySelectorAll('a').forEach(a => expect(a.getAttribute('href')).toBe(href));
      }
      expect(document.querySelector('iframe')).toBeNull();
    }
  });

  it('preserves nested emphasis while splitting an anchor', () => {
    const doc = new DOMParser().parseFromString(getUnformattedHtml(cases[1].html), 'text/html');
    expect(doc.querySelector('a strong')?.textContent).toBe('Products');
  });

  it('does not use the application theme to classify source links', () => {
    const style = document.createElement('style');
    style.textContent = 'a { color: red !important; text-decoration: underline !important; }';
    document.head.appendChild(style);
    try {
      const output = getUnformattedHtml(cases[2].html);
      expect(new DOMParser().parseFromString(output, 'text/html').querySelector('a')).toBeNull();
    } finally {
      style.remove();
    }
  });
});

describe('non-redundant link underlining', () => {
  const cases = [
    '<p><a href="/products" style="text-decoration:underline">Products</a></p>',
    '<p><a href="/products"><span style="text-decoration:underline">Products</span></a></p>',
    '<p><a href="/products"><strong><u>Products</u></strong></a></p>',
    '<p><span style="text-decoration:underline"><a href="/products">Products</a></span></p>',
  ];

  it.each(cases)('omits redundant underlining by default: %s', (input) => {
    for (const mode of ['regular', 'blogs', 'shoppables'] as const) {
      const output = convertToHtml(cleanWordHtml(input), mode);
      for (const html of [output.formatted, output.unformatted]) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        expect(doc.querySelector('a')?.getAttribute('href')).toBe('/products');
        expect(doc.querySelector('a')?.textContent).toBe('Products');
        expect(doc.querySelector('u')).toBeNull();
      }
    }
  });

  it('keeps non-link underlining and nested emphasis around a linked portion', () => {
    const input = '<p><u><strong>Our <a href="/products"><em>Products</em></a> today</strong></u></p>';
    const output = getUnformattedHtml(input);
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(doc.querySelector('p')?.textContent).toBe('Our Products today');
    expect(doc.querySelector('strong a em')?.textContent).toBe('Products');
    expect(doc.querySelector('a u, u a')).toBeNull();
    expect(Array.from(doc.querySelectorAll('u')).map(u => u.textContent?.trim())).toEqual(['Our', 'today']);
  });

  it('retains underline markup on ordinary text and anchors without a destination', () => {
    const output = sanitizeHtml('<p><u>Plain</u> <a><u>Named anchor</u></a> <a href="javascript:alert(1)"><u>Unsafe destination</u></a></p>');
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(Array.from(doc.querySelectorAll('u')).map(u => u.textContent)).toEqual(['Plain', 'Named anchor', 'Unsafe destination']);
    expect(doc.querySelector('a[href]')).toBeNull();
  });

  it.each(cases)('adds exactly one explicit wrapper when the option is enabled: %s', (input) => {
    for (const mode of ['blogs', 'shoppables'] as const) {
      const output = getUnformattedHtml(input, mode, { wrapLinksStrongUnderline: true });
      const doc = new DOMParser().parseFromString(output, 'text/html');
      expect(doc.querySelector('a > strong > u')?.textContent).toBe('Products');
      expect(doc.querySelectorAll('u')).toHaveLength(1);
      expect(doc.querySelectorAll('a strong')).toHaveLength(1);
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
  it.each(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])('recognizes a <%s> Sources label', (tag) => {
    for (const mode of ['blogs', 'shoppables'] as const) {
      const input = `<p>Body.</p><${tag}>Sources:</${tag}><ol><li><a href="https://example.com/study">Study</a></li></ol>`;
      const output = getUnformattedHtml(input, mode);
      const doc = new DOMParser().parseFromString(output, 'text/html');
      expect(doc.querySelector('a')).toBeNull();
      expect(doc.querySelector('p > strong > em')?.textContent).toBe('Sources:');
      expect(doc.querySelector('li > em')?.textContent).toBe('Study');
      expect(validateMode(output, mode, {}).summary.failed).toBe(0);
    }
  });

  it.each(['<h2>Recommended products</h2>', '<p>Unrelated introduction.</p>', 'Unrelated plain text'])('does not cross %s into an unrelated list', (boundary) => {
    const input = `<p>Sources: <a href="https://example.com/study">Study</a>.</p>${boundary}<ol><li><a href="https://example.com/product">Buy product</a></li></ol>`;
    const output = getUnformattedHtml(input, 'shoppables');
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(Array.from(doc.querySelectorAll('a')).map(a => a.getAttribute('href'))).toEqual(['https://example.com/product']);
    expect(doc.querySelector('ol li')?.hasAttribute('style')).toBe(false);
  });

  it('handles multiple Sources sections, unordered lists, and nested citations', () => {
    const input = '<p>Sources:</p><ol><li><a href="/one">One</a></li></ol><h2>Other section</h2><p>Body.</p><h3>sources:</h3><p>&nbsp;</p><ul><li><a href="/two">Two</a><ol><li><a href="/three">Three</a></li></ol></li></ul>';
    const output = getUnformattedHtml(input, 'shoppables');
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(doc.querySelector('a')).toBeNull();
    expect(doc.querySelectorAll('li[style="font-style: italic"]')).toHaveLength(3);
    expect(validateMode(output, 'shoppables', {}).summary.failed).toBe(0);
  });

  it('removes source links independently of label normalization and supports heading BR spacing', () => {
    const features = { sourcesNormalize: false, brBeforeSources: true };
    const output = getUnformattedHtml('<p>Body.</p><h2>Sources:</h2><ul><li><a href="/study">Study</a></li></ul>', 'shoppables', features);
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(doc.querySelector('h2')?.textContent).toBe('Sources:');
    expect(doc.querySelector('h2')?.previousElementSibling?.innerHTML).toBe('<br>');
    expect(doc.querySelector('a')).toBeNull();
    expect(validateMode(output, 'shoppables', features).summary.failed).toBe(0);
  });

  it('preserves source links when removal is disabled', () => {
    const output = getUnformattedHtml('<h2>Sources:</h2><ol><li><a href="/study">Study</a></li></ol>', 'shoppables', { removeSourcesLinks: false });
    expect(new DOMParser().parseFromString(output, 'text/html').querySelector('a')?.getAttribute('href')).toBe('/study');
  });

  it('does not classify ordinary headings containing the word Sources as references', () => {
    const output = getUnformattedHtml('<h2>Sources of wood</h2><ol><li><a href="/product">Product</a></li></ol>', 'shoppables');
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(doc.querySelector('h2')?.textContent).toBe('Sources of wood');
    expect(doc.querySelector('a')?.getAttribute('href')).toBe('/product');
  });

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
