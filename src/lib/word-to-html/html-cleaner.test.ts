import { describe, expect, it } from 'vitest';
import { trimTrailingBlockWhitespace } from './html-cleaner';

describe('trimTrailingBlockWhitespace', () => {
  it.each([
    ['<p>Hello World   </p>', '<p>Hello World</p>'],
    ['<h1>What is Happening  </h1>', '<h1>What is Happening</h1>'],
    ['<p>Hello <strong>World   </strong></p>', '<p>Hello <strong>World</strong></p>'],
    ['<p>Hello <strong>x</strong>   </p>', '<p>Hello <strong>x</strong></p>'],
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

  it('preserves non-breaking spaces', () => {
    expect(trimTrailingBlockWhitespace('<p>Hello&nbsp;&nbsp;</p>')).toBe('<p>Hello&nbsp;&nbsp;</p>');
    expect(trimTrailingBlockWhitespace('<p>&nbsp;</p>')).toBe('<p>&nbsp;</p>');
  });

  it('preserves whitespace inside pre and code', () => {
    expect(trimTrailingBlockWhitespace('<pre>code   </pre>')).toBe('<pre>code   </pre>');
    expect(trimTrailingBlockWhitespace('<p><code>x   </code></p>')).toContain('x   ');
  });

  it('keeps the intentional space after a colon label at the end of a list item', () => {
    expect(trimTrailingBlockWhitespace('<ul><li><strong>Label:</strong> </li></ul>'))
      .toBe('<ul><li><strong>Label:</strong> </li></ul>');
  });

  it('does not trim whitespace between adjacent inline elements', () => {
    const input = '<p><a href="/a">one</a> <a href="/b">two</a></p>';
    expect(trimTrailingBlockWhitespace(input)).toBe(input);
  });
});
