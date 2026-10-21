import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertToHtml, convertWordToHtml, getUnformattedHtml, type OutputMode } from './converter';
import { cleanHtml } from './html-cleaner';
import { formatCompact } from './html-formatter';
import { sanitizeHtml } from './html-sanitizer';
import { cleanWordHtml } from './word-html-cleaner';
import { createInertContainer } from './word-source-formatting';
import { normalizeSources } from './mode-sources-normalize';
import { validateMode } from './validator';
import { normalizeLists } from './mode-list-normalize';
import { convertOlHeaders } from './mode-ol-header-conversion';
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

  it.each([
    '<td class="image-cell"></td>',
    '<td style="background-image:url(photo.png)"></td>',
    '<td class="ImageCell"><img src="photo.png"></td>',
  ])('keeps an empty table cell styled as an image container in its column: %s', (cell) => {
    const input = `<table><tr class="image-row"><td>A</td>${cell}<td>C</td></tr><tr class="image-row"><td></td><td></td><td></td></tr></table>`;
    for (const mode of ['regular', 'blogs', 'shoppables'] as const) {
      const output = convertToHtml(cleanWordHtml(input), mode);
      for (const html of [output.formatted, output.unformatted]) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        expect(Array.from(doc.querySelectorAll('tr')).map(row => Array.from(row.children).map(td => td.textContent))).toEqual([['A', '', 'C'], ['', '', '']]);
        expect(doc.querySelector('img')).toBeNull();
      }
    }
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

  it('keeps merged table cells spanning the same columns and rows as the source', () => {
    const input = '<table><tr><th colspan="2">Merged</th></tr><tr><td rowspan="2">x</td><td>y</td></tr><tr><td>z</td></tr></table>';
    for (const mode of ['regular', 'blogs', 'shoppables'] as const) {
      const output = convertToHtml(cleanWordHtml(input), mode);
      for (const html of [output.formatted, output.unformatted]) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        expect(Array.from(doc.querySelectorAll('th, td')).map(cell => [cell.textContent, cell.getAttribute('colspan'), cell.getAttribute('rowspan')])).toEqual([
          ['Merged', '2', null], ['x', null, '2'], ['y', null, null], ['z', null, null],
        ]);
      }
      expect(validateMode(output.unformatted, mode, {}).results.find(r => r.ruleId === 'sanitized-structure')?.passed).toBe(true);
    }
  });

  it.each([
    '<ol><li>a</li><li></li><li>c</li></ol>',
    '<ul><li>a</li><li><strong></strong></li><li>c</li></ul>',
    '<ol><li>a<ul><li></li></ul></li></ol>',
    '<p>x</p><h2></h2><p>y</p>',
    '<p>x</p><h3><strong> </strong></h3><p>y</p>',
  ])('keeps the empty list items and headings of the preview: %s', (input) => {
    const items = (html: string) => Array.from(new DOMParser().parseFromString(html, 'text/html').querySelectorAll('li, h1, h2, h3, h4, h5, h6'))
      .map(element => [element.tagName, element.textContent?.trim()]);
    for (const mode of ['regular', 'blogs', 'shoppables'] as const) {
      const output = convertToHtml(cleanWordHtml(input), mode);
      expect(items(output.formatted)).toEqual(items(output.unformatted));
    }
  });

  it.each(['first\n\nsecond  \n  third', '  \n\n  ', '&lt;literal&gt;\n\n&amp; text'])('preserves preformatted whitespace and text: %s', (content) => {
    const output = convertToHtml(`<pre><code>${content}</code></pre>`);
    const preview = new DOMParser().parseFromString(output.unformatted, 'text/html');
    const formatted = new DOMParser().parseFromString(output.formatted, 'text/html');
    expect(formatted.querySelector('code')?.textContent).toBe(preview.querySelector('code')?.textContent);
  });

  it.each([
    ['<pre><code>first\n\nsecond  <a href="https://example.com">docs</a>\n  third</code></pre>', 'first\n\nsecond  docs\n  third'],
    ['<p>Run <code>npm  test</code><a href="https://example.com">docs</a></p>', 'npm  test'],
  ])('keeps code whitespace next to a link: %s', (input, code) => {
    for (const mode of ['regular', 'blogs', 'shoppables'] as const) {
      const output = convertToHtml(cleanWordHtml(input), mode);
      for (const html of [output.formatted, output.unformatted]) {
        expect(new DOMParser().parseFromString(html, 'text/html').querySelector('code')?.textContent).toBe(code);
      }
    }
  });

  it('keeps a non-breaking space in text next to a link', () => {
    for (const mode of ['regular', 'blogs', 'shoppables'] as const) {
      const output = convertToHtml(cleanWordHtml('<p>Take 10&nbsp;mg <a href="https://example.com">daily</a>.</p>'), mode);
      for (const html of [output.formatted, output.unformatted]) {
        expect(new DOMParser().parseFromString(html, 'text/html').querySelector('p')?.textContent).toBe('Take 10 mg daily.');
      }
    }
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

  it.each([
    ['2 chained lists', ['Alpha', 'Beta'], ''],
    ['3 chained lists', ['Alpha', 'Beta', 'Gamma'], ''],
    ['chained lists split by blank paragraphs', ['Alpha', 'Beta', 'Gamma'], '<p>&nbsp;</p>'],
  ])('numbers %s of headings as one sequence', (_, titles, separator) => {
    const input = `<h2>Steps</h2>${titles.map((title, i) => `<ol start="${i + 1}"><li><h3><b>${title}</b></h3></li></ol>`).join(separator)}<p>After.</p>`;
    for (const [mode, features] of [['regular', { headingStrong: true, olHeaderConversion: true }], ['blogs', {}], ['shoppables', {}]] as const) {
      const output = getUnformattedHtml(input, mode, features);
      const doc = new DOMParser().parseFromString(output, 'text/html');
      expect(doc.querySelector('ol')).toBeNull();
      expect(Array.from(doc.querySelectorAll('h3')).map(h => h.textContent)).toEqual(titles.map((title, i) => `${i + 1}. ${title}`));
      expect(validateMode(output, mode, features).results.find(r => r.ruleId === 'ol-header-conversion')?.passed).toBe(true);
    }
  });

  it.each([
    ['text after the heading', '<li><h3><b>Prepare</b></h3>Wash your hands first.</li><li><h3><b>Apply</b></h3><p>Use a thin layer.</p></li>'],
    ['text after the bold-wrapped heading', '<li><b><h3>Prepare</h3></b>Wash your hands first.</li><li><b><h3>Apply</h3></b><p>Use a thin layer.</p></li>'],
    ['text inside the bold wrapper', '<li><b><h3>Prepare</h3>Wash your hands first.</b></li><li><b><h3>Apply</h3><p>Use a thin layer.</p></b></li>'],
    ['a second heading', '<li><h3><b>Prepare</b></h3><h3><b>Wash your hands first.</b></h3></li><li><h3><b>Apply</b></h3><ul><li>Use a thin layer.</li></ul></li>'],
  ])('keeps heading lists with %s as lists instead of dropping the body', (_, items) => {
    const input = `<h2>Steps</h2><ol>${items}</ol>`;
    for (const [mode, features] of [['regular', { headingStrong: true, olHeaderConversion: true }], ['blogs', {}], ['shoppables', {}]] as const) {
      const output = getUnformattedHtml(input, mode, features);
      const doc = new DOMParser().parseFromString(output, 'text/html');
      expect(doc.querySelector('ol')?.textContent).toContain('Wash your hands first.');
      expect(doc.querySelector('ol')?.textContent).toContain('Use a thin layer.');
      expect(Array.from(doc.querySelectorAll('h3')).some(h => /^\d+\./.test(h.textContent || ''))).toBe(false);
      expect(validateMode(output, mode, features).results.find(r => r.ruleId === 'ol-header-conversion')?.passed).toBe(true);
    }
  });

  it('still numbers heading lists whose items hold only blank Word paragraphs besides the heading', () => {
    const output = convertOlHeaders('<ol><li><p>&nbsp;</p><h3><strong>First</strong></h3><br> </li><li><strong><h3>Second</h3><p></p></strong></li></ol>');
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(doc.querySelector('ol')).toBeNull();
    expect(Array.from(doc.querySelectorAll('h3')).map(h => h.textContent)).toEqual(['1. First', '2. Second']);
  });

  it.each<[OutputMode, { headingStrong?: boolean }, string]>([
    ['regular', {}, '<h2>Part one two</h2>'],
    ['blogs', {}, '<h2><strong>Part one two</strong></h2>'],
    ['blogs', { headingStrong: false }, '<h2>Part one two</h2>'],
  ])('handles every bold run of a heading in %s %o', (mode, features, expected) => {
    const output = getUnformattedHtml('<h2><b>Part</b> one <b>two</b></h2><p>Body.</p>', mode, features);
    expect(output).toContain(expected);
    expect(validateMode(output, mode, features).results.find(r => r.ruleId === 'heading-strong')?.passed).toBe(true);
  });

  it.each([
    [{ headingStrong: false }, '<h2>Key Takeaways:</h2>'],
    [{}, '<h2><strong>Key Takeaways:</strong></h2>'],
  ])('does not duplicate a Key Takeaways heading split into bold runs (%o)', (features, expected) => {
    const input = '<h2><b><span>Key</span></b><span> </span><b><span>Takeaways</span></b></h2><ul><li>One</li></ul>';
    const output = getUnformattedHtml(input, 'blogs', features);
    expect(output).toContain(expected);
    expect(validateMode(output, 'blogs', features).summary.failed).toBe(0);
  });

  it('keeps the inline markup of a Key Takeaways heading when adding its colon', () => {
    const output = getUnformattedHtml('<h2>Key <a href="https://example.com/takeaways">Takeaways</a></h2><ul><li>One</li></ul>', 'blogs', { headingStrong: false });
    const heading = new DOMParser().parseFromString(output, 'text/html').querySelector('h2');
    expect(heading?.textContent).toBe('Key Takeaways:');
    expect(heading?.querySelector('a')?.getAttribute('href')).toBe('https://example.com/takeaways');
  });

  it('preserves table structure and cell emphasis without orphan formatting wrappers', () => {
    const output = getUnformattedHtml('<table style="font-weight:bold"><tbody><tr style="font-style:italic"><td><em>Cell A</em></td><td>Cell B</td></tr></tbody></table>', 'shoppables');
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(doc.body.children).toHaveLength(1);
    expect(doc.querySelectorAll('table > tbody > tr > td')).toHaveLength(2);
    expect(doc.querySelector('td > em')?.textContent).toBe('Cell A');
    expect(doc.querySelector('table > strong, tbody > em, tr > em')).toBeNull();
  });

  it.each([
    ['<table><tr><td style="font-weight:bold"><p>a</p><p>b</p></td></tr></table>', 'td > p > strong', ['a', 'b']],
    ['<table><tr><td style="font-weight:bold">a<p>b</p></td></tr></table>', 'td > strong, td > p > strong', ['a', 'b']],
    ['<blockquote style="font-style:italic"><p>Quote</p></blockquote>', 'blockquote > p > em', ['Quote']],
    ['<blockquote style="font-weight:bold;text-decoration:underline"><p>One</p><ul><li>Two</li></ul></blockquote>', 'blockquote > p > u > strong, blockquote li > u > strong', ['One', 'Two']],
  ])('applies block container formatting inside each child block: %s', (input, selector, texts) => {
    for (const mode of ['regular', 'blogs', 'shoppables'] as const) {
      const output = convertToHtml(cleanWordHtml(input), mode);
      for (const html of [output.formatted, output.unformatted]) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        expect(Array.from(doc.querySelectorAll(selector)).map(wrapper => wrapper.textContent)).toEqual(texts);
        expect(doc.querySelector(':is(strong, em, u) :is(p, ul, ol, li, blockquote, table)')).toBeNull();
      }
    }
  });

  it.each([
    ['<table><caption>Table 1: Prices</caption><tr><td>a</td></tr></table>', null],
    ['<p>Intro.</p><table><caption style="font-style:italic">Table 1: <strong>Prices</strong></caption><tr><td>a</td></tr></table>', 'em'],
    ['<table><caption><p>Table 1:</p> Prices</caption><tr><td>a</td></tr></table>', null],
  ])('keeps table caption text as a paragraph directly before its table: %s', (input, emphasis) => {
    for (const mode of ['regular', 'blogs', 'shoppables'] as const) {
      const output = convertToHtml(cleanWordHtml(input), mode);
      for (const html of [output.formatted, output.unformatted]) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const table = doc.querySelector('table')!;
        const captions = Array.from(doc.body.children).slice(0, Array.from(doc.body.children).indexOf(table)).filter(p => p.textContent !== 'Intro.');
        expect(captions.map(p => p.tagName).every(tag => tag === 'P')).toBe(true);
        expect(captions.map(p => p.textContent).join(' ').replace(/\s+/g, ' ')).toBe('Table 1: Prices');
        expect(table.textContent?.trim()).toBe('a');
        expect(Array.from(doc.body.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())).toBe(false);
        if (emphasis) expect(captions[0].querySelector(emphasis)?.textContent).toBe('Table 1: Prices');
      }
      expect(validateMode(output.unformatted, mode, {}).results.find(r => r.ruleId === 'sanitized-structure')?.passed).toBe(true);
    }
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

  it.each([
    ['Just a typed line', ['Just a typed line']],
    ['First<br>Second', ['First Second']],
    ['First line<div>Second line</div>', ['First line', 'Second line']],
    ['Hello <strong>world</strong> today.<h2>Heading</h2>Tail', ['Hello world today.', 'Tail']],
  ])('wraps top-level inline content in paragraphs: %s', (input, paragraphs) => {
    for (const mode of ['regular', 'blogs', 'shoppables'] as const) {
      const output = convertToHtml(cleanWordHtml(input), mode);
      for (const html of [output.formatted, output.unformatted]) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        expect(Array.from(doc.body.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())).toBe(false);
        expect(Array.from(doc.querySelectorAll('body > p')).map(p => p.textContent).filter(text => text?.trim())).toEqual(paragraphs);
      }
      expect(validateMode(output.unformatted, mode, {}).results.find(r => r.ruleId === 'basic-structure')?.passed).toBe(true);
    }
  });

  it('keeps the numbering of a Word Online list split into one <ol> per item', () => {
    const item = (n: number, text: string) => `<div class="ListContainerWrapper"><ol start="${n}" role="list"><li role="listitem" data-aria-posinset="${n}" data-aria-level="1"><p class="Paragraph"><span>${text}</span></p></li></ol></div>`;
    const input = item(1, 'One') + item(2, 'Two') + item(3, 'Three');
    for (const mode of ['regular', 'blogs', 'shoppables'] as const) {
      const output = convertToHtml(cleanWordHtml(input), mode);
      for (const html of [output.formatted, output.unformatted]) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        expect(Array.from(doc.querySelectorAll('ol')).map(ol => ol.getAttribute('start'))).toEqual([null, '2', '3']);
        expect(Array.from(doc.querySelectorAll('ol > li')).map(li => li.textContent)).toEqual(['One', 'Two', 'Three']);
      }
      expect(validateMode(output.unformatted, mode, {}).results.find(r => r.ruleId === 'sanitized-structure')?.passed).toBe(true);
    }
  });

  it('resumes an interrupted list at its source number', () => {
    const input = '<ol><li>One</li></ol><p>Note between.</p><ol start="2"><li>Two</li></ol>';
    for (const mode of ['regular', 'blogs', 'shoppables'] as const) {
      const output = convertToHtml(cleanWordHtml(input), mode);
      for (const html of [output.formatted, output.unformatted]) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        expect(Array.from(doc.querySelectorAll('ol')).map(ol => ol.getAttribute('start'))).toEqual([null, '2']);
      }
    }
  });

  it.each([
    ['<ol><li>A</li></ol><ol><li>B</li></ol>', '<ol><li>A</li></ol><ol><li>B</li></ol>', '<ol>\n  <li>A</li>\n</ol>\n<ol>\n  <li>B</li>\n</ol>'],
    ['<ol start="1"><li>A</li></ol>', '<ol><li>A</li></ol>', '<ol>\n  <li>A</li>\n</ol>'],
  ])('keeps output unchanged when list numbering is the default: %s', (input, unformatted, formatted) => {
    for (const mode of ['regular', 'blogs', 'shoppables'] as const) {
      expect(convertToHtml(cleanWordHtml(input), mode)).toEqual({ formatted, unformatted });
    }
  });
});

describe('Word desktop list paragraphs', () => {
  // Trimmed Chrome `inputArea.innerHTML` captures. Both paths drop `mso-list`;
  // native paste keeps the class, margin and text indent, while the
  // prepareWordSource snapshot keeps the class and text indent only.
  const spacer = (count: number) => `<span style="font-size: 7pt; line-height: normal; font-family: &quot;Times New Roman&quot;;">${'&nbsp;'.repeat(count)} </span>`;
  const NATIVE_CAPTURE = [
    '<p class="MsoNormal">Intro paragraph.<o:p></o:p></p>',
    `<p class="MsoListParagraphCxSpFirst" style="margin: 0in 0in 0in 0.5in; text-indent: -0.25in;">1.${spacer(5)}First item<o:p></o:p></p>`,
    `<p class="MsoListParagraphCxSpLast" style="margin: 0in 0in 8pt 0.5in; text-indent: -0.25in;">2.${spacer(5)}Second item<o:p></o:p></p>`,
    `<p class="MsoListParagraphCxSpFirst" style="margin: 0in 0in 0in 0.5in; text-indent: -0.25in;"><span style="font-family: Symbol;">·${spacer(8)}</span>Bullet one<o:p></o:p></p>`,
    `<p class="MsoListParagraphCxSpLast" style="margin: 0in 0in 8pt 0.5in; text-indent: -0.25in;"><span style="font-family: Symbol;">·${spacer(8)}</span>Bullet two<o:p></o:p></p>`,
  ].join('');
  const snapshot = 'color: rgb(0, 0, 0); text-decoration: none; font-weight: 400; font-style: normal; font-size: 16px; vertical-align: baseline;';
  const preparedItem = (cls: string, marker: string, text: string, markerStyle = '') =>
    `<p class="MsoListParagraph${cls}" style="text-indent: -0.25in; ${snapshot}"><span style="${markerStyle}${snapshot}"><span style="${snapshot}">${marker}<span style="font: 400 9.33333px &quot;Times New Roman&quot;; color: rgb(0, 0, 0);">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; </span></span></span>${text}</p>`;
  const PREPARED_CAPTURE = [
    `<p class="MsoNormal" style="${snapshot}">Consult our article first.</p>`,
    preparedItem('CxSpFirst', '1.', 'First item'),
    preparedItem('CxSpLast', '2.', 'Second item'),
    preparedItem('CxSpFirst', '·', 'Bullet one', 'font-family: Symbol; '),
    preparedItem('CxSpLast', '·', 'Bullet two', 'font-family: Symbol; '),
  ].join('\n');
  const item = (cls: string, marker: string, body: string, style = 'margin: 0in 0in 0in 0.5in; text-indent: -0.25in;') =>
    `<p class="MsoListParagraph${cls}" style="${style}">${marker}${spacer(5)}${body}<o:p></o:p></p>`;
  const modes = ['regular', 'blogs', 'shoppables'] as const;
  /** Non-spacer top-level blocks, with each list reduced to its items. */
  const blocks = (html: string) => Array.from(new DOMParser().parseFromString(html, 'text/html').body.children)
    .filter(element => element.textContent?.trim())
    .map(element => {
      const tag = element.tagName.toLowerCase();
      if (!element.matches('ol, ul')) return `${tag}: ${element.textContent?.trim()}`;
      const start = element.getAttribute('start');
      return `${tag}${start ? `[${start}]` : ''}: ${Array.from(element.children).map(li => li.textContent?.trim()).join(' | ')}`;
    });

  it.each([
    ['native paste', NATIVE_CAPTURE, 'Intro paragraph.'],
    ['prepareWordSource', PREPARED_CAPTURE, 'Consult our article first.'],
  ])('turns %s list paragraphs into lists in every mode', (_path, input, intro) => {
    for (const mode of modes) {
      const output = convertToHtml(cleanWordHtml(input), mode);
      for (const html of [output.formatted, output.unformatted]) {
        expect(blocks(html)).toEqual([`p: ${intro}`, 'ol: First item | Second item', 'ul: Bullet one | Bullet two']);
      }
      expect(validateMode(output.unformatted, mode, {}).results.filter(r => !r.passed).map(r => r.ruleId)).toEqual([]);
    }
  });

  it('keeps the inline formatting and links of bulleted items', () => {
    const input = item('CxSpFirst', '·', 'See <a href="https://example.com/guide">the guide</a> now') +
      item('CxSpLast', '<span style="font-family: Symbol;">·</span>', '<b>Bold</b> lead');
    for (const mode of modes) {
      const output = convertToHtml(cleanWordHtml(input), mode);
      for (const html of [output.formatted, output.unformatted]) {
        expect(blocks(html)).toEqual(['ul: See the guide now | Bold lead']);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        expect(doc.querySelector('ul > li:first-child > a')?.getAttribute('href')).toBe('https://example.com/guide');
        expect(doc.querySelector('ul > li:last-child > strong')?.textContent).toBe('Bold');
      }
    }
  });

  it.each([
    ['3.', '4.', '3', null],
    ['c)', 'd)', '3', 'a'],
    ['C.', 'D.', '3', 'A'],
    ['iv.', 'v.', '4', 'i'],
    ['(IV)', '(V)', '4', 'I'],
  ])('starts an ordered list at the Word number %s with its numbering type', (first, second, start, type) => {
    const input = item('CxSpFirst', first, 'One') + item('CxSpLast', second, 'Two');
    for (const mode of modes) {
      const output = convertToHtml(cleanWordHtml(input), mode);
      for (const html of [output.formatted, output.unformatted]) {
        expect(blocks(html)).toEqual([`ol[${start}]: One | Two`]);
        expect(new DOMParser().parseFromString(html, 'text/html').querySelector('ol')?.getAttribute('type')).toBe(type);
      }
      expect(validateMode(output.unformatted, mode, {}).results.find(r => r.ruleId === 'sanitized-structure')?.passed).toBe(true);
    }
  });

  it('keeps list-like text outside Word list paragraphs as paragraphs', () => {
    const input = `<p class="MsoNormal">1.${spacer(3)}Not a list</p><p>· Plain bullet text</p>` +
      '<p class="MsoListParagraph" style="margin-left: 0.5in">Indented note without a marker</p>';
    for (const mode of modes) {
      const output = convertToHtml(cleanWordHtml(input), mode);
      for (const html of [output.formatted, output.unformatted]) {
        expect(blocks(html)).toEqual(['p: 1.    Not a list', 'p: · Plain bullet text', 'p: Indented note without a marker']);
      }
    }
  });

  it.each([
    'A. Smith wrote the study.',
    'J. K. Rowling wrote the series.',
    '<b>A.</b> Smith wrote the study.',
    'iv. Typed with one space',
  ])('keeps a list paragraph without Word\'s marker spacer as a paragraph: %s', (body) => {
    const input = `<p class="MsoListParagraph" style="margin-left:.5in">${body}</p>`;
    const text = new DOMParser().parseFromString(body, 'text/html').body.textContent;
    for (const mode of modes) {
      const output = convertToHtml(cleanWordHtml(input), mode);
      for (const html of [output.formatted, output.unformatted]) {
        expect(blocks(html)).toEqual([`p: ${text}`]);
      }
    }
  });

  it.each([
    ['a tab', '1.<span style="mso-tab-count:1">\t</span>'],
    ['a separate spacer span', '1.<span style="font:7.0pt &quot;Times New Roman&quot;">&nbsp;</span>'],
    ['the mso-list:Ignore span', '<span style="mso-list:Ignore">1. </span>'],
  ])('recognizes Word\'s marker spacer as %s', (_form, marker) => {
    const input = `<p class="MsoListParagraphCxSpFirst" style="margin-left:.5in">${marker}First</p>` +
      `<p class="MsoListParagraphCxSpLast" style="margin-left:.5in">${marker.replace('1.', '2.')}Second</p>`;
    for (const mode of modes) {
      const output = convertToHtml(cleanWordHtml(input), mode);
      for (const html of [output.formatted, output.unformatted]) {
        expect(blocks(html)).toEqual(['ol: First | Second']);
      }
    }
  });

  it('keeps two lists separated by a normal paragraph apart', () => {
    const input = item('CxSpFirst', '1.', 'One') + item('CxSpLast', '2.', 'Two') +
      '<p class="MsoNormal">Between</p>' + item('', '1.', 'Again');
    for (const mode of modes) {
      const output = convertToHtml(cleanWordHtml(input), mode);
      for (const html of [output.formatted, output.unformatted]) {
        expect(blocks(html)).toEqual(['ol: One | Two', 'p: Between', 'ol: Again']);
      }
    }
  });

  it.each([
    ['indent steps', (level: number) => `margin: 0in 0in 0in ${level * 0.5}in; text-indent: -0.25in;`],
    ['resumed outer numbering', () => 'text-indent: -0.25in;'],
  ])('nests a Word sub-list detected by %s', (_signal, style) => {
    // The last sub-list ends the run, so only the earlier nesting identifies it.
    const input = item('CxSpFirst', '1.', 'One', style(1)) + item('CxSpMiddle', 'a.', 'Sub one', style(2)) +
      item('CxSpMiddle', 'b.', 'Sub two', style(2)) + item('CxSpMiddle', '2.', 'Two', style(1)) +
      item('CxSpLast', 'a.', 'Last sub', style(2));
    for (const mode of modes) {
      const output = convertToHtml(cleanWordHtml(input), mode);
      for (const html of [output.formatted, output.unformatted]) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        expect(Array.from(doc.querySelectorAll('body > ol > li')).map(li => li.firstChild?.textContent?.trim())).toEqual(['One', 'Two']);
        expect(Array.from(doc.querySelectorAll('body > ol > li > ol')).map(ol => Array.from(ol.children).map(li => li.textContent)))
          .toEqual([['Sub one', 'Sub two'], ['Last sub']]);
        expect(doc.querySelectorAll('body > ol')).toHaveLength(1);
      }
    }
  });

  it('nests a sub-list when only the deeper items kept an inline margin', () => {
    // The prepareWordSource snapshot drops the class margin of level 1, but
    // Word writes deeper levels inline. The sub-list also ends the run.
    const nested = 'margin-left: 1in; text-indent: -0.25in;';
    const input = '<h2>Key Takeaways</h2>' + item('CxSpFirst', '1.', 'Prepare the seat', 'text-indent: -0.25in;') +
      item('CxSpMiddle', 'a.', 'Vacuum it', nested) + item('CxSpLast', 'b.', 'Test a spot', nested) +
      '<p class="MsoTitle">How to Clean Car Seats</p><p class="MsoNormal">Intro paragraph.</p>';
    for (const mode of modes) {
      const output = convertToHtml(cleanWordHtml(input), mode);
      for (const html of [output.formatted, output.unformatted]) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        expect(Array.from(doc.querySelectorAll('body > ol > li')).map(li => li.firstChild?.textContent?.trim())).toEqual(['Prepare the seat']);
        expect(Array.from(doc.querySelectorAll('body > ol > li > ol > li')).map(li => li.textContent)).toEqual(['Vacuum it', 'Test a spot']);
        expect(doc.querySelectorAll('body > ol')).toHaveLength(1);
        expect(doc.body.textContent?.includes('How to Clean Car Seats')).toBe(mode !== 'blogs');
      }
    }
  });

  it('starts a new list for a different marker family without indent evidence', () => {
    const style = 'text-indent: -0.25in;';
    const input = item('CxSpFirst', '1.', 'One', style) + item('CxSpMiddle', '2.', 'Two', style) +
      item('CxSpMiddle', '·', 'Dot', style) + item('CxSpLast', '·', 'Dot two', style);
    for (const mode of modes) {
      const output = convertToHtml(cleanWordHtml(input), mode);
      for (const html of [output.formatted, output.unformatted]) {
        expect(blocks(html)).toEqual(['ol: One | Two', 'ul: Dot | Dot two']);
      }
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

  it.each([
    ['//cdn.example.com/guide?a=1#part', '/guide?a=1#part'],
    ['https://example.com/guide', '/guide'],
  ])('converts %s to the relative path the validator expects', (href, expected) => {
    const features = { relativePaths: true };
    for (const mode of ['regular', 'blogs', 'shoppables'] as const) {
      const output = getUnformattedHtml(`<p>See <a href="${href}">guide</a></p>`, mode, features);
      expect(new DOMParser().parseFromString(output, 'text/html').querySelector('a')?.getAttribute('href')).toBe(expected);
      expect(validateMode(output, mode, features).results.find(r => r.ruleId === 'relative-paths')?.passed).toBe(true);
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

  it.each([
    '<p><a href="https://example.com/a">Twitter</a> <a href="https://example.com/b">Facebook</a></p>',
    '<p><strong>Note</strong> <a href="https://example.com/a">Twitter</a> <em>Facebook</em></p>',
  ])('keeps an existing separator outside neighboring links and formatting: %s', (input) => {
    const source = new DOMParser().parseFromString(input, 'text/html');
    const texts = (doc: Document) => Array.from(doc.querySelectorAll('a, strong, em')).map(el => el.textContent);
    for (const mode of ['regular', 'blogs', 'shoppables'] as const) {
      const output = convertToHtml(cleanWordHtml(input), mode);
      for (const html of [output.formatted, output.unformatted]) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        expect(doc.body.textContent).toBe(source.body.textContent);
        expect(texts(doc)).toEqual(texts(source));
      }
    }
  });

  it.each([
    ['<p>The <a href="https://example.com/fda">FDA</a>-approved drug<a href="#fn1"><sup>1</sup></a> per <a href="https://example.com/study">study</a><sup>2</sup>.</p>', 'The FDA-approved drug1 per study2.'],
    ['<p>All <a href="https://example.com/fda">FDA</a>s agree.</p>', 'All FDAs agree.'],
    ['<p>See <a href="https://example.com/a">our article </a>today.</p>', 'See our article today.'],
    ['<p><span>See </span><a href="https://example.com/a"><span style="color:blue">our article </span></a><span>today.</span></p>', 'See our article today.'],
  ])('keeps the source word boundaries around a link: %s', (input, text) => {
    for (const mode of ['regular', 'blogs', 'shoppables'] as const) {
      const output = convertToHtml(cleanWordHtml(input), mode);
      for (const html of [output.formatted, output.unformatted]) {
        expect(new DOMParser().parseFromString(html, 'text/html').body.textContent).toBe(text);
      }
      expect(validateMode(output.unformatted, mode, {}).results.find(r => r.ruleId === 'link-spacing')?.passed).toBe(true);
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

  it.each([
    '<p>See <a href="https://example.com" target="_self">link</a></p>',
    '<p>See <a href="https://example.com" rel="noopener,noreferrer">link</a></p>',
    '<p>See <a href="https://example.com" target="_blank" rel="noopener,noreferrer">link</a></p>',
  ])('gives every link the Link Attributes target and rel tokens: %s', (input) => {
    for (const mode of ['blogs', 'shoppables'] as const) {
      const output = getUnformattedHtml(input, mode);
      const link = new DOMParser().parseFromString(output, 'text/html').querySelector('a');
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(link?.getAttribute('rel')?.split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
      const results = validateMode(output, mode, {}).results;
      expect(results.find(r => r.ruleId === 'link-attributes')?.passed).toBe(true);
      expect(results.find(r => r.ruleId === 'link-safety')?.passed).toBe(true);
    }
  });

  it.each([
    ['abc', null], [' 4 ', '4'], ['007', '7'], ['+3', '3'], ['2.5', '2'], ['0', '0'], ['-2', '-2'],
    ['99999999999', null], ['', null], ['3abc', '3'], ['1e3', null], ['0x10', '0'],
    ['2147483647', '2147483647'], ['2147483648', null], ['-2147483648', '-2147483648'], ['-2147483649', null],
  ])('reduces <ol start="%s"> to the browser-rendered integer', (value, expected) => {
    const ol = new DOMParser().parseFromString(sanitizeHtml(`<ol start="${value}"><li>x</li></ol>`), 'text/html').querySelector('ol');
    expect(ol?.textContent).toBe('x');
    expect(ol?.getAttribute('start')).toBe(expected);
  });

  it.each([
    ['<ol reversed start="3"><li>x</li></ol>', '3'],
    ['<ol reversed><li>x</li></ol>', null],
    ['<ol reversed start="1"><li>x</li></ol>', '1'],
    ['<ol reversed="reversed"><li>x</li></ol>', null],
  ])('keeps reversed numbering on %s', (input, start) => {
    const ol = new DOMParser().parseFromString(sanitizeHtml(input), 'text/html').querySelector('ol');
    expect(ol?.getAttribute('reversed')).toBe('');
    expect(ol?.getAttribute('start')).toBe(start);
  });

  it.each([
    ['a', 'a'], ['A', 'A'], ['i', 'i'], ['I', 'I'], ['1', null],
    ['b', null], ['disc', null], ['lower-alpha', null], ['', null], ['aa', null],
  ])('keeps only a valid numbering type on <ol type="%s">', (value, expected) => {
    const ol = new DOMParser().parseFromString(sanitizeHtml(`<ol type="${value}"><li>x</li></ol>`), 'text/html').querySelector('ol');
    expect(ol?.textContent).toBe('x');
    expect(ol?.getAttribute('type')).toBe(expected);
  });

  it.each([
    ['<ol style="list-style-type:lower-alpha"><li>x</li></ol>', 'a'],
    ['<ol style="list-style-type: upper-roman"><li>x</li></ol>', 'I'],
    // Google Docs sets the type on every item.
    ['<ol><li style="list-style-type:upper-alpha">x</li><li style="list-style-type:upper-alpha">y</li></ol>', 'A'],
    ['<ol style="list-style-type:lower-alpha"><li style="list-style-type:lower-roman">x</li></ol>', 'i'],
    ['<ol type="a" style="list-style-type:decimal"><li>x</li></ol>', null],
    ['<ol style="list-style-type:disc"><li>x</li></ol>', null],
  ])('maps CSS list numbering to the <ol> type: %s', (input, expected) => {
    for (const html of [sanitizeHtml(input), getUnformattedHtml(input)]) {
      expect(new DOMParser().parseFromString(html, 'text/html').querySelector('ol')?.getAttribute('type')).toBe(expected);
    }
  });

  it.each([
    ['<ul start="2" reversed><li>x</li></ul>', '<ul><li>x</li></ul>'],
    ['<ol><li start="2" reversed>x</li></ol>', '<ol><li>x</li></ol>'],
    ['<p start="2" reversed>x</p>', '<p>x</p>'],
    ['<ul type="a"><li type="a">x</li></ul>', '<ul><li>x</li></ul>'],
  ])('removes list numbering attributes outside <ol>: %s', (input, expected) => {
    expect(sanitizeHtml(input)).toBe(expected);
  });

  it.each([
    ['colspan', '2', '2'], ['colspan', ' 3 ', '3'], ['colspan', '02', '2'], ['colspan', '2.5', '2'], ['colspan', '+4', '4'],
    ['colspan', '1', null], ['colspan', '0', null], ['colspan', '-2', null], ['colspan', 'abc', null], ['colspan', '', null],
    ['colspan', '1001', '1000'], ['rowspan', '3', '3'], ['rowspan', '0', '0'], ['rowspan', '1', null], ['rowspan', '-1', null],
    ['rowspan', '65535', '65534'],
  ])('reduces <td %s="%s"> to the browser-rendered span', (name, value, expected) => {
    for (const tag of ['td', 'th']) {
      const cell = new DOMParser().parseFromString(sanitizeHtml(`<table><tr><${tag} ${name}="${value}">x</${tag}></tr></table>`), 'text/html').querySelector(tag);
      expect(cell?.textContent).toBe('x');
      expect(cell?.getAttribute(name)).toBe(expected);
    }
  });

  it.each([
    ['<p colspan="2" rowspan="2">x</p>', '<p>x</p>'],
    ['<table><tbody><tr colspan="2" rowspan="2"><td>x</td></tr></tbody></table>', '<table><tbody><tr><td>x</td></tr></tbody></table>'],
  ])('removes table span attributes outside cells: %s', (input, expected) => {
    expect(sanitizeHtml(input)).toBe(expected);
  });

  it('preserves combined bold and italic Word formatting', () => {
    const output = getUnformattedHtml('<p><span style="font-weight: bold; font-style: italic">Both</span></p>');
    const doc = new DOMParser().parseFromString(output, 'text/html');
    expect(doc.querySelector('strong')?.textContent).toBe('Both');
    expect(doc.querySelector('em')?.textContent).toBe('Both');
  });

  it.each([
    ['<p style="font-style:italic">Book <span style="font-style:normal">Title</span> here</p>', 'Book Title here', [], ['Book', 'here']],
    ['<p><b>Bold <span style="font-weight:normal">plain</span> end</b></p>', 'Bold plain end', ['Bold', 'end'], []],
    ['<p><span style="font-weight:700">Bold <a href="/x"><span style="font-weight:400">plain</span></a> end</span></p>', 'Bold plain end', ['Bold', 'end'], []],
    ['<p><strong><em>Both <span style="font-style:normal;font-weight:normal">plain</span></em></strong></p>', 'Both plain', ['Both'], ['Both']],
    ['<table><tr><td style="font-weight:bold"><p>Head <span style="font-weight:normal">note</span></p><p>Next</p></td></tr></table>', 'Head noteNext', ['Head', 'Next'], []],
    ['<b style="font-weight:normal"><p>Docs paragraph</p><p><span style="font-weight:700">Bold</span> text</p></b>', 'Docs paragraphBold text', ['Bold'], []],
    ['<p><i style="font-style:normal">Upright</i> and <em style="font-style:normal">plain</em></p>', 'Upright and plain', [], []],
    ['<p><b>Bold <span style="font-weight:600">semibold</span></b></p>', 'Bold semibold', ['Bold semibold'], []],
    ['<p><b>Bold <span style="font-style:normal">still</span></b></p>', 'Bold still', ['Bold still'], []],
  ])('keeps an explicit normal weight or style inside bold or italic: %s', (input, text, strong, em) => {
    for (const mode of ['regular', 'blogs', 'shoppables'] as const) {
      const output = convertToHtml(cleanWordHtml(input), mode);
      for (const html of [output.formatted, output.unformatted]) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        expect(Array.from(doc.querySelectorAll('p, td')).filter(block => !block.querySelector('p')).map(block => block.textContent?.trim()).join('')).toBe(text);
        expect(Array.from(doc.querySelectorAll('strong')).map(wrapper => wrapper.textContent?.trim())).toEqual(strong);
        expect(Array.from(doc.querySelectorAll('em')).map(wrapper => wrapper.textContent?.trim())).toEqual(em);
        expect(doc.querySelector(':is(strong, em) :is(p, a), a :is(strong, em)')).toBeNull();
      }
    }
  });

  it('keeps an explicit normal weight inside bold in direct sanitizer input', () => {
    expect(sanitizeHtml('<p><b>Bold <span style="font-weight:normal">plain</span></b></p>')).toBe('<p><strong>Bold </strong>plain</p>');
    expect(sanitizeHtml('<b style="font-weight:normal"><p>Docs paragraph</p></b>')).toBe('<p>Docs paragraph</p>');
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

  it('keeps a single space between adjacent source links once they are removed', () => {
    const input = '<p>Sources:</p><ol><li><a href="https://example.com/a">A</a> <a href="https://example.com/b">B</a></li></ol>';
    for (const mode of ['blogs', 'shoppables'] as const) {
      const output = getUnformattedHtml(input, mode);
      expect(new DOMParser().parseFromString(output, 'text/html').querySelector('li')?.textContent).toBe('A B');
    }
  });

  it('leaves no link styling on Sources citations when links are wrapped', () => {
    const input = '<p>Read the <a href="https://example.com/body">guide</a>.</p><p>Sources:</p><ol><li><a href="https://example.com/nih">NIH article</a></li></ol>';
    const features = { wrapLinksStrongUnderline: true };
    for (const mode of ['blogs', 'shoppables'] as const) {
      const output = getUnformattedHtml(input, mode, features);
      const doc = new DOMParser().parseFromString(output, 'text/html');
      expect(doc.querySelector('li')?.innerHTML).toBe('<em>NIH article</em>');
      expect(doc.querySelector('a > strong > u')?.textContent).toBe('guide');
      expect(validateMode(output, mode, features).summary.failed).toBe(0);
    }
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

describe('trailing whitespace before block end tags', () => {
  it.each(['regular', 'blogs', 'shoppables'] as const)(
    'trims trailing whitespace from both outputs in %s mode',
    (mode) => {
      const output = convertToHtml(
        cleanWordHtml('<p>Hello World   </p><h1>What is Happening  </h1><p>Hello <strong>World   </strong></p>'),
        mode,
      );
      for (const html of [output.formatted, output.unformatted]) {
        expect(html).not.toMatch(/[ \t]+<\/(p|h[1-6]|li|strong)>/);
        expect(html).toContain('<p>Hello World</p>');
        expect(html).toContain('What is Happening');
      }
    },
  );

  it('keeps inline spacing that separates words', () => {
    const output = convertToHtml(cleanWordHtml('<p>Hello <strong>World </strong>more</p>'), 'regular');
    for (const html of [output.formatted, output.unformatted]) {
      expect(html).toContain('World </strong>more');
    }
  });

  it('keeps the list-label separator so pipeline output still validates', () => {
    const output = convertToHtml(cleanWordHtml('<ul><li><strong>Label:</strong></li></ul>'), 'blogs');
    for (const html of [output.formatted, output.unformatted]) {
      expect(html).toContain('Label:</strong> </li>');
    }
    const results = validateMode(output.unformatted, 'blogs', {});
    expect(results.results.find(result => result.ruleId === 'list-normalization')?.passed).toBe(true);
  });
});

describe('inert parsing of untrusted markup', () => {
  // jsdom runs inline handlers; <details open> fires toggle without user interaction.
  const marker = (id: string) => `data-bug1-${id}`;
  const details = (id: string) => `<details open ontoggle="document.documentElement.setAttribute('${marker(id)}','1')">x</details>`;
  const settle = () => new Promise(resolve => setTimeout(resolve, 100));
  const handlerRan = (id: string) => document.documentElement.hasAttribute(marker(id));

  // Positive control: the same payload runs its handler when parsed in the live document.
  async function expectHandlerToRunInLiveDocument(id: string, html: string) {
    const live = document.createElement('div');
    live.innerHTML = html;
    await settle();
    expect(handlerRan(id)).toBe(true);
  }

  afterEach(() => {
    for (const { name } of Array.from(document.documentElement.attributes)) {
      if (name.startsWith('data-bug1-')) document.documentElement.removeAttribute(name);
    }
  });

  it('parses untrusted markup in an inert no-quirks container', async () => {
    const container = createInertContainer();
    // Quirks mode would keep a <table> inside an open <p>, unlike the live document.
    expect(container.ownerDocument.compatMode).toBe('CSS1Compat');
    const html = details('container');
    container.innerHTML = html;
    await settle();
    expect(handlerRan('container')).toBe(false);
    await expectHandlerToRunInLiveDocument('container', html);
  });

  it('runs no inline handler from cleanWordHtml input', async () => {
    const html = `<p>Hello</p>${details('clean')}`;
    cleanWordHtml(html);
    await settle();
    expect(handlerRan('clean')).toBe(false);
    await expectHandlerToRunInLiveDocument('clean', html);
  });

  // Each site re-parses serialized content into a replacement element.
  const REPARSE_SITES = [
    ['font', `<font color="red">${details('font')}</font>`,
      '<p><font color="red">a<noscript><b>x</b></noscript></font></p>',
      '<p><span style="color: red">a<noscript><b>x</b></noscript></span></p>'],
    ['italic', `<div><span style="font-style:italic">${details('italic')}</span></div>`,
      '<p><span style="font-style:italic">a<noscript><b>x</b></noscript></span></p>',
      '<p><em>a<noscript><b>x</b></noscript></em></p>'],
    ['bold', `<div><span style="font-weight:bold">${details('bold')}</span></div>`,
      '<p><span style="font-weight:bold">a<noscript><b>x</b></noscript></span></p>',
      '<p><strong>a<noscript><b>x</b></noscript></strong></p>'],
  ] as const;

  it.each(REPARSE_SITES)('runs no inline handler at the %s re-parse site', async (id, payload) => {
    cleanWordHtml(payload);
    await settle();
    expect(handlerRan(id)).toBe(false);
    await expectHandlerToRunInLiveDocument(id, payload);
  });

  it.each(REPARSE_SITES)('re-parses %s content with the same <noscript> semantics as the first parse', (_id, _payload, input, expected) => {
    // Mixing scripting-disabled and scripting-enabled parses serializes <noscript> children as escaped text.
    expect(cleanWordHtml(input)).toBe(expected);
  });

  describe.each(['regular', 'blogs', 'shoppables'] as const)('in %s mode', (mode) => {
    it.each([
      ['11', '<p>Body</p><noscript><p class=MsoNormal><font color=red>legacy</font></p></noscript>', '<p>Body</p>', '<p>Body</p>'],
      ['N1', '<p>Intro</p><p><noscript><img src="/lazy.jpg"></noscript></p><p>After</p>', '<p>Intro</p>\n<p>After</p>', '<p>Intro</p><p>After</p>'],
      ['S7', '<font color="red"><noscript><!--</noscript><img src="/nope.png" alt="hidden">--></noscript></font>', '', ''],
    ])('preserves the final output of <noscript> input %s', (_id, input, formatted, unformatted) => {
      expect(convertToHtml(cleanWordHtml(input), mode)).toEqual({ formatted, unformatted });
    });
  });
});
