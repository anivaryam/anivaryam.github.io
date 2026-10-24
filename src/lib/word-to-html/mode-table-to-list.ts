/**
 * Mode Utility: Table to List Conversion
 * Converts tables into structured lists, because Shopify collection pages do
 * not render tables
 *
 * Rules:
 * - The first row holds the column labels. A 2-column table without a header
 *   row (<th>, <thead> or fully bold cells) is a key/value table: one <ul>
 *   with a "Key: value" item per row
 * - Each later row becomes a heading (its name cell) followed by a <ul> with
 *   one "Label: value" item per remaining cell; blank cells are skipped
 * - The name column is the first column with content, so a blank leading
 *   column (such as images the cleaner removed) is skipped
 * - The heading is one level below the nearest heading before the table
 *   (h3 when no heading precedes it, h6 at most)
 * - A row that is one cell spanning every column (a title or group row) keeps
 *   its content as paragraphs
 * - A merged cell repeats in every row it spans; across columns it is listed once
 * - A table with a single row or a single column (such as a 1x1 callout box)
 *   cannot pair labels with values, so its cells keep their content as blocks
 * - Nested tables convert first, so no table remains
 */

import { BLOCK_ELEMENT_SET } from './html-cleaner';
import { isFullyBoldElement, wrapInlineContent } from './html-sanitizer';
import { isBlankNode } from './mode-ol-header-conversion';

/** Blocks unwrapped in a list item; lists stay as nested lists */
const LIST_ITEM_UNWRAPPED = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

type Grid = (HTMLTableCellElement | undefined)[][];

/** True when `nodes` hold anything besides blank Word filler */
function hasContent(nodes: ParentNode | undefined): nodes is ParentNode {
  return !!nodes && Array.from(nodes.childNodes).some(node => !isBlankNode(node));
}

/**
 * The table's cells by row and column. A merged cell fills every slot it
 * spans, so each column lines up with its label.
 */
function buildGrid(table: HTMLTableElement): Grid {
  const rows = Array.from(table.rows);
  const grid: Grid = rows.map(() => []);
  rows.forEach((row, r) => {
    let column = 0;
    for (const cell of Array.from(row.cells)) {
      // Skip the slots that a rowspan from an earlier row already fills
      while (grid[r][column]) column++;
      const colSpan = Math.max(1, cell.colSpan || 1);
      const rowSpan = Math.max(1, cell.rowSpan || 1);
      for (let dr = 0; dr < rowSpan && r + dr < rows.length; dr++) {
        for (let dc = 0; dc < colSpan; dc++) grid[r + dr][column + dc] = cell;
      }
      column += colSpan;
    }
  });
  const columns = Math.max(0, ...grid.map(row => row.length));
  return grid.map(row => Array.from({ length: columns }, (_, column) => row[column]));
}

/**
 * Appends `nodes` as inline content: elements in `unwrapped` are replaced by
 * their content, separated by a space unless filler already separates them.
 */
function appendInline(fragment: DocumentFragment, nodes: Node[], unwrapped: Set<string>): void {
  for (const node of nodes) {
    const isBlock = node.nodeType === Node.ELEMENT_NODE && unwrapped.has((node as Element).tagName.toLowerCase());
    // Leading filler and blank blocks carry no content
    if (isBlankNode(node) && (isBlock || !hasContent(fragment))) continue;
    if (!isBlock) {
      fragment.append(node.cloneNode(true));
      continue;
    }
    if (fragment.lastChild && hasContent(fragment) && !isBlankNode(fragment.lastChild)) fragment.append(' ');
    appendInline(fragment, Array.from(node.childNodes), unwrapped);
  }
}

/** A cell's content as inline nodes, ready for a heading or a list item */
function cellContent(cell: Element, doc: Document, unwrapped: Set<string>): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  appendInline(fragment, Array.from(cell.childNodes), unwrapped);
  while (fragment.lastChild && isBlankNode(fragment.lastChild)) fragment.lastChild.remove();
  return fragment;
}

/** Appends a cell's content as blocks: inline runs are wrapped in <p> */
function appendBlocks(output: DocumentFragment, cell: Element): void {
  const copy = cell.cloneNode(true) as Element;
  wrapInlineContent(copy, 'p');
  output.append(...Array.from(copy.childNodes).filter(node => !isBlankNode(node)));
}

/** The text of a label cell, without formatting or a trailing colon */
function labelText(cell: Element | undefined): string {
  return (cell?.textContent || '').replace(/\s+/g, ' ').trim().replace(/\s*:$/, '');
}

function isHeaderRow(row: Grid[number]): boolean {
  const cells = row.filter(hasContent);
  return cells.length > 0 && cells.every(cell =>
    cell.tagName.toLowerCase() === 'th' || cell.closest('thead') !== null || isFullyBoldElement(cell)
  );
}

/** A row that is one cell spanning every column, such as a title row */
function isFullWidthRow(row: Grid[number]): boolean {
  return !!row[0] && row.every(cell => cell === row[0]);
}

function createItem(doc: Document, label: string, cell: Element): HTMLLIElement {
  const item = doc.createElement('li');
  if (label) {
    // Bold here, as the converter bolds list labels: a label ending in "?"
    // or "." would not count as one
    const strong = doc.createElement('strong');
    strong.textContent = `${label}:`;
    item.append(strong, ' ');
  }
  item.append(cellContent(cell, doc, LIST_ITEM_UNWRAPPED));
  return item;
}

function tableToList(table: HTMLTableElement, doc: Document, headingLevel: number): DocumentFragment {
  const output = doc.createDocumentFragment();
  const grid = buildGrid(table);
  const columns = grid[0]?.length ?? 0;

  // Without two rows and two columns there are no labels to pair with values
  if (grid.length < 2 || columns < 2) {
    new Set(grid.flat()).forEach(cell => {
      if (hasContent(cell)) appendBlocks(output, cell);
    });
    return output;
  }

  let rows = grid;
  while (rows.length && isFullWidthRow(rows[0])) {
    if (hasContent(rows[0][0])) appendBlocks(output, rows[0][0]);
    rows = rows.slice(1);
  }
  if (!rows.length) return output;

  const keyValue = columns === 2 && !isHeaderRow(rows[0]);
  const labels = keyValue ? [] : rows[0].map(labelText);
  const body = keyValue ? rows : rows.slice(1);
  const nameColumn = Math.max(0, Array.from({ length: columns }, (_, column) => column)
    .findIndex(column => body.some(row => !isFullWidthRow(row) && hasContent(row[column]))));

  let list: HTMLUListElement | null = null;
  for (const row of body) {
    if (isFullWidthRow(row)) {
      if (hasContent(row[0])) appendBlocks(output, row[0]);
      list = null;
      continue;
    }
    if (keyValue) {
      if (!list) list = output.appendChild(doc.createElement('ul'));
      if (hasContent(row[1])) list.append(createItem(doc, labelText(row[0]), row[1]));
      continue;
    }

    const name = row[nameColumn];
    if (hasContent(name)) {
      const heading = doc.createElement(`h${headingLevel}`);
      // A heading holds inline content only, so lists in the cell are flattened too
      heading.append(cellContent(name, doc, BLOCK_ELEMENT_SET));
      output.append(heading);
    }
    const items = doc.createElement('ul');
    for (let column = nameColumn + 1; column < columns; column++) {
      const cell = row[column];
      // A cell merged across columns is listed under its first column only
      if (!hasContent(cell) || cell === row[column - 1]) continue;
      items.append(createItem(doc, labels[column], cell));
    }
    if (items.children.length) output.append(items);
  }
  output.querySelectorAll('ul:empty').forEach(empty => empty.remove());
  return output;
}

export function convertTablesToLists(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Document order, so each table sees the nearest heading before it
    const headingLevels = new Map<HTMLTableElement, number>();
    let sectionLevel = 2;
    doc.querySelectorAll('h1, h2, h3, h4, h5, h6, table').forEach(element => {
      if (element.tagName.toLowerCase() === 'table') {
        headingLevels.set(element as HTMLTableElement, Math.min(sectionLevel + 1, 6));
      } else {
        sectionLevel = Number(element.tagName[1]);
      }
    });

    // Innermost first: a nested table is already converted when its cell is copied
    Array.from(headingLevels).reverse().forEach(([table, level]) => {
      table.replaceWith(tableToList(table, doc, level));
    });

    return doc.body.innerHTML;
  } catch (e) {
    console.warn('Table to list conversion failed:', e);
    return html;
  }
}
