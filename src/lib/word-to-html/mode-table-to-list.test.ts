/**
 * Table to List Conversion
 *
 * Converts tables into a heading per row followed by a "Label: value" list,
 * because Shopify collection pages do not render tables.
 */

import { describe, it, expect } from 'vitest';
import { convertTablesToLists } from './mode-table-to-list';

const productTable = '<table><tbody>'
  + '<tr><td><p>Product</p></td><td><p>Package Capacity</p></td><td><p>Price</p></td></tr>'
  + '<tr><td><p>Skittles Candy (3lb bag)</p></td><td><p>3 lbs.</p></td><td><p>$18.00</p></td></tr>'
  + '<tr><td><p>Mike &amp; Ike (10.8 lb)</p></td><td><p>10.8 lbs.</p></td><td><p>$49.00</p></td></tr>'
  + '</tbody></table>';

describe('convertTablesToLists', () => {
  it('returns empty string for empty input', () => {
    expect(convertTablesToLists('')).toBe('');
  });

  it('turns each data row into a heading and a list of labelled cells', () => {
    expect(convertTablesToLists(`<h2>Shop</h2>${productTable}<p>After.</p>`)).toBe(
      '<h2>Shop</h2>'
      + '<h3>Skittles Candy (3lb bag)</h3><ul><li><strong>Package Capacity:</strong> 3 lbs.</li><li><strong>Price:</strong> $18.00</li></ul>'
      + '<h3>Mike &amp; Ike (10.8 lb)</h3><ul><li><strong>Package Capacity:</strong> 10.8 lbs.</li><li><strong>Price:</strong> $49.00</li></ul>'
      + '<p>After.</p>'
    );
  });

  it.each([
    ['', 'h3'],
    ['<h1>Title</h1>', 'h2'],
    ['<h3>Section</h3><p>Body.</p>', 'h4'],
    ['<h6>Deep</h6>', 'h6'],
  ])('places row headings one level below the preceding heading: %s', (before, tag) => {
    const doc = new DOMParser().parseFromString(convertTablesToLists(before + productTable), 'text/html');
    expect(Array.from(doc.querySelectorAll(`${tag}`)).map(heading => heading.textContent)).toContain('Skittles Candy (3lb bag)');
  });

  it('keeps inline formatting and links but drops the label formatting and colon', () => {
    const html = '<table><tr><td><strong>Name</strong></td><td><strong>Link:</strong></td></tr>'
      + '<tr><td><a href="https://example.com/p">Product</a></td><td>See <em>details</em></td></tr></table>';
    expect(convertTablesToLists(html)).toBe(
      '<h3><a href="https://example.com/p">Product</a></h3><ul><li><strong>Link:</strong> See <em>details</em></li></ul>'
    );
  });

  it('bolds labels that end in a question mark or period', () => {
    const html = '<table><tr><th>Name</th><th>In stock?</th><th>Wt.</th></tr><tr><td>Item</td><td>Yes</td><td>3 lb</td></tr></table>';
    expect(convertTablesToLists(html)).toBe('<h3>Item</h3><ul><li><strong>In stock?:</strong> Yes</li><li><strong>Wt.:</strong> 3 lb</li></ul>');
  });

  it('skips blank cells and joins cell paragraphs with a space', () => {
    const html = '<table><tr><td>Name</td><td>Size</td><td>Notes</td></tr>'
      + '<tr><td><p>Item</p></td><td><p>&nbsp;</p></td><td><p>One</p><p></p><p>Two</p></td></tr></table>';
    expect(convertTablesToLists(html)).toBe('<h3>Item</h3><ul><li><strong>Notes:</strong> One Two</li></ul>');
  });

  it('lists a cell without a column label as its value only', () => {
    const html = '<table><tr><td>Name</td><td></td><td>Size</td></tr><tr><td>Item</td><td>Value</td><td>Big</td></tr></table>';
    expect(convertTablesToLists(html)).toBe('<h3>Item</h3><ul><li>Value</li><li><strong>Size:</strong> Big</li></ul>');
  });

  it('flattens a list in the name cell, since a heading holds inline content only', () => {
    const html = '<table><tr><th>Name</th><th>Price</th></tr><tr><td><ul><li>Skittles</li><li>Sour</li></ul></td><td>$18</td></tr></table>';
    expect(convertTablesToLists(html)).toBe('<h3>Skittles Sour</h3><ul><li><strong>Price:</strong> $18</li></ul>');
  });

  it('names rows from the first column with content', () => {
    const html = '<table><tr><td>Image</td><td>Name</td><td>Price</td></tr><tr><td></td><td>Item</td><td>$5</td></tr></table>';
    expect(convertTablesToLists(html)).toBe('<h3>Item</h3><ul><li><strong>Price:</strong> $5</li></ul>');
  });

  it('lines merged cells up with their labels', () => {
    const html = '<table><tr><th>Name</th><th>Type</th><th>Size</th><th>Price</th></tr>'
      + '<tr><td>A</td><td rowspan="2">Candy</td><td colspan="2">Ask</td></tr>'
      + '<tr><td>B</td><td>1 lb</td><td>$5</td></tr></table>';
    expect(convertTablesToLists(html)).toBe(
      '<h3>A</h3><ul><li><strong>Type:</strong> Candy</li><li><strong>Size:</strong> Ask</li></ul>'
      + '<h3>B</h3><ul><li><strong>Type:</strong> Candy</li><li><strong>Size:</strong> 1 lb</li><li><strong>Price:</strong> $5</li></ul>'
    );
  });

  it('keeps title and group rows that span every column as paragraphs', () => {
    const html = '<table><tr><td colspan="3"><strong>Candy Comparison</strong></td></tr>'
      + '<tr><td>Name</td><td>Size</td><td>Price</td></tr><tr><td>A</td><td>1 lb</td><td>$5</td></tr>'
      + '<tr><td colspan="3">Sour</td></tr><tr><td>B</td><td>2 lb</td><td>$9</td></tr></table>';
    expect(convertTablesToLists(html)).toBe(
      '<p><strong>Candy Comparison</strong></p>'
      + '<h3>A</h3><ul><li><strong>Size:</strong> 1 lb</li><li><strong>Price:</strong> $5</li></ul>'
      + '<p>Sour</p>'
      + '<h3>B</h3><ul><li><strong>Size:</strong> 2 lb</li><li><strong>Price:</strong> $9</li></ul>'
    );
  });

  describe('2-column tables', () => {
    it('treat a table without a header row as key/value pairs', () => {
      const html = '<table><tr><td><p>Weight</p></td><td><p>3 lbs</p></td></tr><tr><td><p>Price</p></td><td><p>$18</p></td></tr></table>';
      expect(convertTablesToLists(html)).toBe('<ul><li><strong>Weight:</strong> 3 lbs</li><li><strong>Price:</strong> $18</li></ul>');
    });

    it.each([
      ['<tr><td><p><strong>Product</strong></p></td><td><strong>Price</strong></td></tr>'],
      ['<tr><th>Product</th><th>Price</th></tr>'],
      ['<thead><tr><td>Product</td><td>Price</td></tr></thead>'],
    ])('use a bold or <th> first row as the header: %s', (header) => {
      const html = `<table>${header}<tbody><tr><td>Skittles</td><td>$18</td></tr></tbody></table>`;
      expect(convertTablesToLists(html)).toBe('<h3>Skittles</h3><ul><li><strong>Price:</strong> $18</li></ul>');
    });

    it('treat a partly bold first row as data', () => {
      const html = '<table><tr><td><strong>Weight</strong> (net)</td><td>3 lbs</td></tr><tr><td>Price</td><td>$18</td></tr></table>';
      expect(convertTablesToLists(html)).toBe('<ul><li><strong>Weight (net):</strong> 3 lbs</li><li><strong>Price:</strong> $18</li></ul>');
    });
  });

  it.each([
    ['a 1x1 callout box', '<table><tr><td><p><strong>Tip:</strong> Rotate stock.</p><p>Check dates.</p><ul><li>Weekly</li></ul></td></tr></table>',
      '<p><strong>Tip:</strong> Rotate stock.</p><p>Check dates.</p><ul><li>Weekly</li></ul>'],
    ['a single row', '<table><tr><td>One</td><td>Two</td></tr></table>', '<p>One</p><p>Two</p>'],
    ['a single column', '<table><tr><td>One</td></tr><tr><td></td></tr><tr><td><p>Two</p></td></tr></table>', '<p>One</p><p>Two</p>'],
  ])('keeps the cell content of %s as blocks', (_name, html, expected) => {
    expect(convertTablesToLists(html)).toBe(expected);
  });

  it('converts a nested table first, so no table remains', () => {
    const html = '<table><tr><th>Name</th><th>Details</th></tr><tr><td>Item</td><td>'
      + '<table><tr><th>Size</th><th>Weight</th></tr><tr><td>Large</td><td>3 lb</td></tr></table></td></tr></table>';
    expect(convertTablesToLists(html)).toBe(
      '<h3>Item</h3><ul><li><strong>Details:</strong> Large<ul><li><strong>Weight:</strong> 3 lb</li></ul></li></ul>'
    );
  });

  it('removes a table without content', () => {
    expect(convertTablesToLists('<p>A</p><table><tr><td></td><td>&nbsp;</td></tr><tr><td></td><td></td></tr></table>')).toBe('<p>A</p>');
  });

  it('converts every table in the document', () => {
    const doc = new DOMParser().parseFromString(convertTablesToLists(`${productTable}<h4>More</h4>${productTable}`), 'text/html');
    expect(doc.querySelector('table')).toBeNull();
    expect(doc.querySelectorAll('h3')).toHaveLength(2);
    expect(doc.querySelectorAll('h5')).toHaveLength(2);
  });
});
