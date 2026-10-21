import { describe, expect, it } from 'vitest';
import { trimTrailingBlockWhitespace } from './html-cleaner';

describe('trimTrailingBlockWhitespace', () => {
  it.each([
    ['<p>Hello World   </p>', '<p>Hello World</p>'],
    ['<h1>What is Happening  </h1>', '<h1>What is Happening</h1>'],
    ['<p>Hello <strong>World   </strong></p>', '<p>Hello <strong>World</strong></p>'],
    ['<p>Hello <strong>x</strong>   </p>', '<p>Hello <strong>x</strong></p>'],
    ['<p>Text <strong>Bold </strong> </p>', '<p>Text <strong>Bold</strong></p>'],
    ['<p>Text <strong> </strong></p>', '<p>Text</p>'],
    ['<p><em>Last word </em><em> <u> </u></em></p>', '<p><em>Last word</em></p>'],
    ['<p>Word <em></em> </p>', '<p>Word<em></em></p>'],
    ['<p>Text <img src="x.png"> </p>', '<p>Text <img src="x.png"></p>'],
    ['<div><p>Nested   </p></div>', '<div><p>Nested</p></div>'],
    ['<div><p>foo </p>bar </div>', '<div><p>foo</p>bar</div>'],
    ['<ul><li>Item   </li></ul>', '<ul><li>Item</li></ul>'],
    ['<p>a</p><p>b</p>', '<p>a</p><p>b</p>'],
  ])('trims block-end whitespace in %s', (input, expected) => {
    expect(trimTrailingBlockWhitespace(input)).toBe(expected);
  });

  it('preserves inline spacing that separates words', () => {
    const input = '<p>Hello <strong>World </strong>more</p>';
    expect(trimTrailingBlockWhitespace(input)).toBe(input);
  });

  it.each([
    ['<p>Hello&nbsp;&nbsp;</p>', '<p>Hello</p>'],
    ['<p>end word \u00A0</p>', '<p>end word</p>'],
    ['<p><strong>end word&nbsp;</strong>&nbsp;</p>', '<p><strong>end word</strong></p>'],
    ['<h2>Heading\u200B</h2>', '<h2>Heading</h2>'],
    ['<p>end\u2002\u2009\u200A</p>', '<p>end</p>'],
    ['<p>end\u3000</p>', '<p>end</p>'],
    ['<p>end\uFEFF</p>', '<p>end</p>'],
    ['<div><p>foo</p>&nbsp;</div>', '<div><p>foo</p></div>'],
    ['<ul><li><strong>Label:</strong>&nbsp;</li></ul>', '<ul><li><strong>Label:</strong> </li></ul>'],
  ])('trims non-breaking and Unicode spaces at the end of a block with content: %s', (input, expected) => {
    expect(trimTrailingBlockWhitespace(input)).toBe(expected);
  });

  it.each([
    '<p>&nbsp;</p>',
    '<p>&nbsp;&nbsp;</p>',
    '<p><em>&nbsp;</em></p>',
    '<p class="gap">&nbsp;</p>',
    '<div>\u200B</div>',
    '<table><tbody><tr><td>&nbsp;</td></tr></tbody></table>',
    '<p>Take 10&nbsp;kg daily</p>',
    '<pre>code&nbsp;</pre>',
    '<p>Run <code>x&nbsp;</code></p>',
  ])('keeps blank spacer blocks, interior and code non-breaking spaces: %s', (input) => {
    expect(trimTrailingBlockWhitespace(input)).toBe(input);
  });

  it('preserves whitespace inside pre and code', () => {
    expect(trimTrailingBlockWhitespace('<pre>code   </pre>')).toBe('<pre>code   </pre>');
    expect(trimTrailingBlockWhitespace('<p><code>x   </code></p>')).toContain('x   ');
  });

  it('keeps the intentional space after a colon label at the end of a list item', () => {
    expect(trimTrailingBlockWhitespace('<ul><li><strong>Label:</strong> </li></ul>'))
      .toBe('<ul><li><strong>Label:</strong> </li></ul>');
    expect(trimTrailingBlockWhitespace('<ul><li><strong>Label:</strong> <em> </em></li></ul>'))
      .toBe('<ul><li><strong>Label:</strong> </li></ul>');
  });

  it('does not trim whitespace between adjacent inline elements', () => {
    const input = '<p><a href="/a">one</a> <a href="/b">two</a></p>';
    expect(trimTrailingBlockWhitespace(input)).toBe(input);
  });
});
