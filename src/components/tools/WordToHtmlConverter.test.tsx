import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { WordToHtmlConverter } from './WordToHtmlConverter';
import { toast } from '@/hooks/use-toast';
import { getUnformattedHtml } from '@/lib/word-to-html/converter';
import { stripSpacerMarkers } from '@/lib/word-to-html/spacer';

vi.mock('lenis', () => ({
  default: class {
    raf = vi.fn();
    destroy = vi.fn();
  },
}));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function enterHtml(html: string) {
  const input = document.querySelector('[contenteditable="true"]') as HTMLElement;
  input.innerHTML = html;
  fireEvent.input(input);
}

/** Copy every block as HTML, in order, and return the clipboard payloads. */
function copyAllBlocks(writeText: ReturnType<typeof vi.fn>): string[] {
  fireEvent.click(screen.getByTitle('Copy blocks'));
  screen.getAllByTitle('Copy as HTML code with CSS').forEach(button => fireEvent.click(button));
  return writeText.mock.calls.map(call => String(call[0]));
}

/** True when the copied block holds more than spacers. */
function hasText(html: string): boolean {
  return !!new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim();
}

describe('WordToHtmlConverter', () => {
  it('adds link underline markup only when the explicit wrapping option is enabled', () => {
    render(<WordToHtmlConverter />);
    enterHtml('<p><u>Plain text</u> <a href="/products"><span style="text-decoration:underline">Products</span></a></p>');
    fireEvent.click(screen.getByRole('radio', { name: 'Shoppables' }));
    const preview = document.querySelector('.output-preview')!;
    expect(preview.querySelector('a u, u a')).toBeNull();
    expect(preview.querySelector('p > u')?.textContent).toContain('Plain text');
    fireEvent.click(screen.getByRole('button', { name: 'Shoppables Features:' }));
    const toggle = screen.getByRole('checkbox', { name: 'Wrap Links Strong & Underline' });
    fireEvent.click(toggle);
    expect(preview.querySelector('a > strong > u')?.textContent).toBe('Products');
    expect(preview.querySelectorAll('a u')).toHaveLength(1);
    fireEvent.click(toggle);
    expect(preview.querySelector('a u, u a')).toBeNull();
    expect(preview.querySelector('p > u')?.textContent).toContain('Plain text');
  });

  it('replaces a fully selected document and removes paste-boundary nodes restored by undo', () => {
    render(<WordToHtmlConverter />);
    const input = screen.getByRole('textbox', { name: 'Word document content' });
    enterHtml('<h2>Old heading</h2><p>Old body</p>');
    const range = document.createRange();
    range.selectNodeContents(input);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    const html = '<h2>Key Takeaways:</h2><ul><li>Point</li></ul><p class="MsoTitle">New title</p><p>New body</p>';
    fireEvent.paste(input, { clipboardData: { getData: (type: string) => type === 'text/html' ? html : '' } });
    expect(input.querySelector('h2 ul, h2 p, [data-word-paste-boundary]')).toBeNull();
    expect(input.textContent).not.toContain('Old body');
    expect(input.querySelector('h1')?.textContent).toBe('New title');
    // Native undo restores the original DOM, including the temporary boundary.
    input.innerHTML = '<br data-word-paste-boundary><h2>Old heading</h2><p>Old body</p>';
    fireEvent.input(input, { inputType: 'historyUndo' });
    expect(input.innerHTML).toBe('<h2>Old heading</h2><p>Old body</p>');
  });

  it('keeps unselected image content when replacing all selected text', () => {
    render(<WordToHtmlConverter />);
    const input = screen.getByRole('textbox', { name: 'Word document content' });
    enterHtml('<p>Old text</p><img alt="Keep this image">');
    const range = document.createRange();
    range.selectNodeContents(input.querySelector('p')!);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    const html = '<a href="/concealed" style="color:black;text-decoration:none">Replacement</a>';
    fireEvent.paste(input, { clipboardData: { getData: (type: string) => type === 'text/html' ? html : '' } });
    expect(input.textContent).toBe('Replacement');
    expect(input.querySelector('img')?.getAttribute('alt')).toBe('Keep this image');
    expect(input.querySelector('a, [data-word-paste-boundary]')).toBeNull();
  });

  it('inserts a prepared paste once when insertHTML inserts but reports false', () => {
    render(<WordToHtmlConverter />);
    const input = screen.getByRole('textbox', { name: 'Word document content' });
    const execCommand = vi.fn((_command: string, _showUi?: boolean, value?: string) => {
      input.insertAdjacentHTML('beforeend', value ?? '');
      return false;
    });
    const original = Object.getOwnPropertyDescriptor(document, 'execCommand');
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
    try {
      const html = '<p>Read <a href="/concealed" style="color:black;text-decoration:none">our guide</a> first.</p>';
      fireEvent.paste(input, { clipboardData: { getData: (type: string) => type === 'text/html' ? html : '' } });
      expect(execCommand).toHaveBeenCalledWith('insertHTML', false, expect.any(String));
      expect(input.textContent?.split('our guide')).toHaveLength(2);
    } finally {
      if (original) Object.defineProperty(document, 'execCommand', original);
      else delete (document as { execCommand?: unknown }).execCommand;
    }
  });

  it('aborts a pending link check when the converter unmounts', () => {
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    const view = render(<WordToHtmlConverter />);
    enterHtml('<p><a href="https://example.com">Link</a></p>');
    fireEvent.click(screen.getByTitle('Check Links'));
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
  });

  it('sends only absolute links to the link checker and reports relative ones', () => {
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    render(<WordToHtmlConverter />);
    enterHtml('<p><a href="/products/a">A</a> and <a href="https://example.com/b">B</a></p>');
    fireEvent.click(screen.getByTitle('Check Links'));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ links: ['https://example.com/b'] });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Relative links not checked' }));
  });

  it('does not send links made relative by Relative Paths to the link checker', () => {
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    render(<WordToHtmlConverter />);
    enterHtml('<p><a href="https://shop.example.com/products/a">Product</a></p>');
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Relative Paths' }));
    expect(document.querySelector('.output-preview a')?.getAttribute('href')).toBe('/products/a');
    fireEvent.click(screen.getByTitle('Check Links'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'No checkable links' }));
  });

  it('clears a completed link-check status when document content changes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ total: 1, good: 1, broken: 0, serverErrors: 0, blocked: 0, goodLinks: [{ url: 'https://example.com/old', status: 200 }], brokenLinks: [], serverErrorLinks: [], blockedLinks: [] }),
    }));
    render(<WordToHtmlConverter />);
    enterHtml('<p><a href="https://example.com/old">Old link</a></p>');
    fireEvent.click(screen.getByTitle('Check Links'));
    fireEvent.keyDown(await screen.findByRole('dialog', { name: 'Link Check Results' }), { key: 'Escape' });
    expect(screen.getByTitle('Check Links').getAttribute('aria-label')).toBe('Check Links: all valid');
    enterHtml('<p><a href="https://example.com/new">Unchecked link</a></p>');
    expect(screen.getByTitle('Check Links').getAttribute('aria-label')).toBe('Check Links');
    expect(screen.queryByRole('dialog', { name: 'Link Check Results' })).toBeNull();
  });

  it('aborts outdated checks and ignores their responses even if the server finishes later', async () => {
    let resolveOld: (value: unknown) => void;
    const oldResponse = new Promise(resolve => { resolveOld = resolve; });
    const fetchMock = vi.fn().mockReturnValueOnce(oldResponse).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ total: 1, good: 1, broken: 0, serverErrors: 0, blocked: 0, goodLinks: [{ url: 'https://example.com/new', status: 200 }], brokenLinks: [], serverErrorLinks: [], blockedLinks: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<WordToHtmlConverter />);
    enterHtml('<p><a href="https://example.com/old">Old link</a></p>');
    fireEvent.click(screen.getByTitle('Check Links'));
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    enterHtml('<p><a href="https://example.com/new">New link</a></p>');
    expect(signal.aborted).toBe(true);
    expect((screen.getByTitle('Check Links') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTitle('Check Links'));
    const dialog = await screen.findByRole('dialog', { name: 'Link Check Results' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await act(async () => {
      resolveOld({ ok: true, json: async () => ({ total: 1, good: 0, broken: 1, serverErrors: 0, blocked: 0, goodLinks: [], brokenLinks: [{ url: 'https://example.com/old', status: 404 }], serverErrorLinks: [], blockedLinks: [] }) });
    });
    expect(screen.getByTitle('Check Links').getAttribute('aria-label')).toBe('Check Links: all valid');
    expect(screen.queryByRole('dialog', { name: 'Link Check Results' })).toBeNull();
  });

  it('keeps unrelated product links and highlights their own list-label warnings', () => {
    render(<WordToHtmlConverter />);
    // A label split across elements is left for the warning rather than bolded.
    enterHtml('<p>Sources: Citation.</p><h2>Products</h2><ol><li><em>Best</em> option: <a href="/product">Buy product</a></li></ol>');
    fireEvent.click(screen.getByRole('radio', { name: 'Shoppables' }));
    const preview = document.querySelector('.output-preview')!;
    expect(preview.querySelector('a')?.getAttribute('href')).toBe('/product');
    expect(preview.querySelector('li')?.getAttribute('data-warning')).toBe('Missing bold label before colon');
    fireEvent.click(screen.getByTitle('Copy blocks'));
    const sourceBlock = screen.getByText('Sources', { exact: true }).closest('.group');
    expect(sourceBlock?.textContent).not.toContain('Buy product');
  });

  it.each(['class="MsoTitle"', 'style="font-size:20pt"'])('recognizes a pasted title (%s) and retains it when the toggle is off', (attributes) => {
    render(<WordToHtmlConverter />);
    const input = screen.getByRole('textbox', { name: 'Word document content' });
    const html = `<h2>Key Takeaways:</h2><ul><li>Point</li></ul><p><span>&nbsp;</span></p><p ${attributes}>Draft article title</p><p style="font-size:11pt">The introduction remains.</p>`;
    fireEvent.paste(input, { clipboardData: { getData: (type: string) => type === 'text/html' ? html : '' } });
    expect(input.querySelector('h1')?.textContent).toBe('Draft article title');
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    const preview = document.querySelector('.output-preview')!;
    expect(preview.textContent).not.toContain('Draft article title');
    expect(preview.textContent).toContain('The introduction remains.');
    fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Remove article title after Key Takeaways' }));
    expect(preview.querySelector('h1')?.textContent).toBe('Draft article title');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Remove article title after Key Takeaways' }));
    expect(preview.textContent).not.toContain('Draft article title');
    expect(input.querySelector('h1')?.textContent).toBe('Draft article title');
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('removes concealed links using the original clipboard formatting', () => {
    render(<WordToHtmlConverter />);
    const input = screen.getByRole('textbox', { name: 'Word document content' });
    const html = '<p style="color:black">Consult <a href="https://example.com/closet" style="color:black;text-decoration:none">our article <span style="color:#1155cc;text-decoration:underline">Closet Measurements</span></a> while recording dimensions.</p>';
    fireEvent.paste(input, { clipboardData: { getData: (type: string) => type === 'text/html' ? html : '' } });
    const preview = document.querySelector('.output-preview')!;
    expect(preview.textContent).toBe('Consult our article Closet Measurements while recording dimensions.');
    expect(Array.from(preview.querySelectorAll('a')).map(a => a.textContent)).toEqual(['Closet Measurements']);
    expect(input.querySelector('a')?.textContent).toBe('Closet Measurements');
    expect(document.querySelector('iframe')).toBeNull();

    // Editing the pasted text must not restore the concealed link.
    fireEvent.input(input);
    expect(Array.from(preview.querySelectorAll('a')).map(a => a.textContent)).toEqual(['Closet Measurements']);
  });

  it.each([
    ['declined', '<p>Hello</p>', ''],
    ['handled', '<p>See <a href="/x" style="color:black;text-decoration:none">plain</a></p>', 'See plainx'],
  ])('runs no inline handler from pasted clipboard HTML (%s paste)', async (branch, content, insertedText) => {
    const marker = `data-bug1-paste-${branch}`;
    const html = `${content}<details open ontoggle="document.documentElement.setAttribute('${marker}','1')">x</details>`;
    try {
      render(<WordToHtmlConverter />);
      const input = screen.getByRole('textbox', { name: 'Word document content' });
      fireEvent.paste(input, { clipboardData: { getData: (type: string) => type === 'text/html' ? html : '' } });
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 100)); });
      expect(document.documentElement.hasAttribute(marker)).toBe(false);
      expect(input.textContent).toBe(insertedText);
      expect(input.innerHTML).not.toContain('ontoggle');

      // Positive control: the same payload runs its handler when parsed in the live document.
      const live = document.createElement('div');
      live.innerHTML = html;
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(document.documentElement.hasAttribute(marker)).toBe(true);
    } finally {
      document.documentElement.removeAttribute(marker);
    }
  });

  it('copies a complete inline sentence as one paragraph', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      render(<WordToHtmlConverter />);
      enterHtml('Hello <strong>world</strong> today.');
      fireEvent.click(screen.getByTitle('Copy blocks'));
      fireEvent.click(screen.getByTitle('Copy as HTML code with CSS'));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith('<p>Hello <strong>world</strong> today.</p>'));
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('converts typed plain text into a valid paragraph in Regular mode', () => {
    render(<WordToHtmlConverter />);
    enterHtml('Just a typed line');
    expect(document.querySelector('.output-preview p')?.textContent).toBe('Just a typed line');
    expect(screen.queryByText(/^Failed:/)).toBeNull();
  });

  it('keeps the accepted FAQ and Shoppables spacing in the UI', () => {
    render(<WordToHtmlConverter />);
    enterHtml('<p>Body.</p><h2>Frequently Asked Questions About How Often Do Newborns Eat?</h2><p><span>&nbsp;</span></p><h3>How many times a day should a newborn eat?</h3><p>Answer.</p>');
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    const preview = document.querySelector('.output-preview')!;
    expect(preview.querySelector('h2')?.nextElementSibling).toBe(preview.querySelector('h3'));
    fireEvent.click(screen.getByRole('radio', { name: 'Shoppables' }));
    expect(Array.from(preview.querySelectorAll('p')).every(p => !!p.textContent?.trim())).toBe(true);
    expect(screen.queryByText(/^Failed:/)).toBeNull();
  });

  it('highlights structural failures using the same detection as the validator', () => {
    render(<WordToHtmlConverter />);
    enterHtml('<ol><strong><li>Item</li></strong></ol>');
    const list = document.querySelector('.output-preview ol');
    expect(list?.getAttribute('data-warning')).toContain('Invalid child structure');
  });

  it('highlights the list items the bold-label rule counts', () => {
    render(<WordToHtmlConverter />);
    enterHtml('<ol><li><em>Step</em> one: preheat</li><li><strong>Step two:</strong> serve</li></ol>');
    fireEvent.click(screen.getByRole('radio', { name: 'Shoppables' }));
    const items = Array.from(document.querySelector('.output-preview')!.querySelectorAll('li'));
    expect(items.map(li => li.getAttribute('data-warning'))).toEqual(['Missing bold label before colon', null]);
    enterHtml('<ul><li><em>Step</em> one: preheat</li><li>Meet at 9:30 am</li><li>Step two: serve</li></ul>');
    const bulleted = Array.from(document.querySelector('.output-preview')!.querySelectorAll('ul > li'));
    expect(bulleted.map(li => li.getAttribute('data-warning'))).toEqual(['Missing bold label before colon', null, null]);
    expect(bulleted[2].querySelector('strong')?.textContent).toBe('Step two:');
  });

  it('does not highlight a source Disclaimer that is already normalized when normalization is off', () => {
    render(<WordToHtmlConverter />);
    enterHtml('<p>Disclaimers matter.</p><p>Body.</p><p><strong><em>Disclaimer:</em></strong> Not advice.</p>');
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Normalize Disclaimer' }));
    const preview = document.querySelector('.output-preview')!;
    const paragraphs = Array.from(preview.querySelectorAll('p')).filter(p => /^Disclaimer/.test(p.textContent || ''));
    expect(paragraphs.map(p => p.hasAttribute('data-warning'))).toEqual([false, false]);
  });

  it('shows the same warning in both toolbars and restores focus inside maximized output', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        total: 1, good: 0, broken: 0, serverErrors: 1, blocked: 0,
        goodLinks: [], brokenLinks: [], blockedLinks: [],
        serverErrorLinks: [{ url: 'https://example.com/unavailable', status: 503 }],
      }),
    }));
    render(<WordToHtmlConverter />);
    enterHtml('<p><a href="https://example.com/unavailable">Example</a></p>');
    const mainCheckButton = screen.getByTitle('Check Links');
    fireEvent.click(screen.getByTitle('Maximize Output'));
    const outputDialog = screen.getByRole('dialog', { name: 'Output - Code' });
    const modalCheckButton = within(outputDialog).getByTitle('Check Links');
    fireEvent.click(modalCheckButton);
    const resultsDialog = await screen.findByRole('dialog', { name: 'Link Check Results' });
    fireEvent.keyDown(resultsDialog, { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(modalCheckButton));
    expect(mainCheckButton.getAttribute('aria-label')).toBe('Check Links: issues found');
    expect(modalCheckButton.getAttribute('aria-label')).toBe('Check Links: issues found');
    expect(modalCheckButton.querySelector('.text-yellow-500')).toBeTruthy();
  });

  it('reports clipboard failures from the output copy button', async () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } });
    try {
      render(<WordToHtmlConverter />);
      enterHtml('<p>Text</p>');
      fireEvent.click(screen.getByTitle('Copy HTML'));
      await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Error', variant: 'destructive' })));
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('shows server-error links using the worker response contract', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        total: 1, good: 0, broken: 0, serverErrors: 1, blocked: 0,
        goodLinks: [], brokenLinks: [], blockedLinks: [],
        serverErrorLinks: [{ url: 'https://example.com/unavailable', status: 503 }],
      }),
    }));
    render(<WordToHtmlConverter />);
    enterHtml('<p><a href="https://example.com/unavailable">Example</a></p>');
    fireEvent.click(screen.getByTitle('Check Links'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Status: 503')).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: 'https://example.com/unavailable' })).toBeTruthy();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTitle('Check Links')));
  });

  it('reports failed link-check requests without opening a results dialog', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: 'Unavailable' }) }));
    render(<WordToHtmlConverter />);
    enterHtml('<p><a href="https://example.com">Example</a></p>');
    fireEvent.click(screen.getByTitle('Check Links'));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Error checking links' })));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((screen.getByTitle('Check Links') as HTMLButtonElement).disabled).toBe(false);
  });

  it('includes tables and code in copyable blocks', () => {
    render(<WordToHtmlConverter />);
    enterHtml('<table><tbody><tr><td>Cell</td></tr></tbody></table><pre><code>sample()</code></pre>');
    fireEvent.click(screen.getByTitle('Copy blocks'));
    const block = screen.getByText('Content', { exact: true }).closest('.group');
    expect(block?.querySelector('td')?.textContent).toBe('Cell');
    expect(block?.querySelector('code')?.textContent).toBe('sample()');
  });

  it('accepts the Regular heading toggle and resets paragraph spacing when switching modes', () => {
    render(<WordToHtmlConverter />);
    enterHtml('<h2>Title</h2><p>First</p><p>Second</p>');
    fireEvent.click(screen.getByRole('button', { name: 'Features:' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Heading Strong Tags' }));
    expect(document.querySelector('.output-preview h2 strong')?.textContent).toBe('Title');
    expect(screen.queryByText(/^Failed:/)).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Paragraph Spacing' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Shoppables' }));
    fireEvent.click(screen.getByRole('button', { name: 'Shoppables Features:' }));
    expect(screen.getByRole('checkbox', { name: 'Paragraph Spacing' }).getAttribute('data-state')).toBe('unchecked');
  });

  it('uses the configured custom spacer instead of the default blank paragraph', () => {
    render(<WordToHtmlConverter />);
    enterHtml('<p>Body text.</p><p>Sources:</p><ol><li>Source one</li></ol>');
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));

    const preview = document.querySelector('.output-preview')!;
    expect(preview.querySelector('p[style]')).toBeNull();
    expect(preview.innerHTML).toContain('&nbsp;');

    fireEvent.change(screen.getByRole('textbox', { name: 'Custom Spacer' }), {
      target: { value: '<div style="height:10px;"></div>' },
    });

    expect(preview.querySelector('div[style="height:10px;"]')).not.toBeNull();
    expect(preview.innerHTML).not.toContain('&nbsp;');
    expect(screen.queryByText(/^Failed:/)).toBeNull();
  });

  it('shows and copies the custom spacer markup without the internal marker', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      const customSpacer = '<div style="height:10px;"></div>';
      render(<WordToHtmlConverter />);
      enterHtml('<p>Body text.</p><p>Sources:</p><ol><li>Source one</li></ol>');
      fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
      fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Custom Spacer' }), {
        target: { value: customSpacer },
      });

      const preview = document.querySelector('.output-preview')!;
      expect(preview.innerHTML).toContain(customSpacer);
      expect(preview.innerHTML).not.toContain('data-w2h-spacer');

      fireEvent.click(screen.getByTitle('Copy HTML'));
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getAllByTitle('Preview')[0]);
      fireEvent.click(screen.getByTitle('Copy Formatted HTML'));
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
      for (const [html] of writeText.mock.calls) {
        expect(html).toContain(customSpacer);
        expect(html).not.toContain('data-w2h-spacer');
      }
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('keeps the custom spacer in the copyable blocks', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      const input = '<p>Body text.</p><p>Sources:</p><ol><li>Source one</li></ol>';
      const customSpacer = '<div style="height:10px;"></div>';
      render(<WordToHtmlConverter />);
      enterHtml(input);
      fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
      fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Custom Spacer' }), {
        target: { value: customSpacer },
      });

      const payloads = copyAllBlocks(writeText);
      await waitFor(() => expect(writeText).toHaveBeenCalled());
      expect(payloads.join('')).toBe(stripSpacerMarkers(getUnformattedHtml(input, 'blogs', { customSpacer })));
      expect(payloads.join('').match(/height:10px/g)).toHaveLength(1);
      expect(payloads.join('')).not.toContain('data-w2h-spacer');
      expect(payloads.join('')).not.toContain('&nbsp;');
      expect(payloads.every(hasText)).toBe(true);
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('keeps the default spacer in the copyable blocks', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      const input = '<p>Body text.</p><p>Sources:</p><ol><li>Source one</li></ol>';
      render(<WordToHtmlConverter />);
      enterHtml(input);
      fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));

      const payloads = copyAllBlocks(writeText);
      await waitFor(() => expect(writeText).toHaveBeenCalled());
      expect(payloads.join('')).toBe(getUnformattedHtml(input, 'blogs'));
      expect(payloads.join('').match(/&nbsp;/g)).toHaveLength(1);
      expect(payloads.every(hasText)).toBe(true);
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it.each([
    '<p>First para.</p><p>Second para.</p><h2>Heading</h2><h3>Sub</h3><p>Read more: x</p><p>Third para.</p><p>Disclaimer: y</p>',
    '<p>Read more: x</p><p>First para.</p><p>Second para.</p>',
  ])('copies every spacer once, without spacer-only blocks, with paragraph spacing: %s', async (input) => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      render(<WordToHtmlConverter />);
      enterHtml(input);
      fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
      fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Paragraph Spacing' }));

      const payloads = copyAllBlocks(writeText);
      await waitFor(() => expect(writeText).toHaveBeenCalled());
      const expected = getUnformattedHtml(input, 'blogs', { paragraphSpacing: true });
      expect(expected).toContain('<p>First para.</p><p>&nbsp;</p><p>Second para.</p>');
      expect(payloads.join('')).toBe(expected);
      expect(payloads.every(hasText)).toBe(true);
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('keeps the configured custom spacer across a mode switch', () => {
    render(<WordToHtmlConverter />);
    enterHtml('<p>Body text.</p>');
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Custom Spacer' }), {
      target: { value: '<div style="height:10px;"></div>' },
    });

    fireEvent.click(screen.getByRole('radio', { name: 'Regular' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));

    if (!screen.queryByRole('textbox', { name: 'Custom Spacer' })) {
      fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
    }
    expect((screen.getByRole('textbox', { name: 'Custom Spacer' }) as HTMLInputElement).value)
      .toBe('<div style="height:10px;"></div>');
  });

  it('warns about dangerous custom spacer markup', () => {
    render(<WordToHtmlConverter />);
    enterHtml('<p>Body text.</p>');
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));

    const input = screen.getByRole('textbox', { name: 'Custom Spacer' });
    fireEvent.change(input, { target: { value: '<div style="height:10px;"></div>' } });
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.change(input, { target: { value: '<img src="x" onerror="window.__XSS=1">' } });
    const warning = screen.getByRole('alert');
    expect(warning.textContent).toContain('onerror');
    expect(warning.textContent).toContain('verbatim');
  });

  it('sanitizes the custom spacer markup when the opt-in is enabled', () => {
    render(<WordToHtmlConverter />);
    enterHtml('<p>Body text.</p><p>Sources:</p><ol><li>Source one</li></ol>');
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));

    const preview = document.querySelector('.output-preview')!;
    fireEvent.change(screen.getByRole('textbox', { name: 'Custom Spacer' }), {
      target: { value: '<img src="x" onerror="window.__XSS=1">' },
    });
    expect(preview.querySelector('img')?.getAttribute('onerror')).toBe('window.__XSS=1');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Sanitize the spacer markup' }));
    expect(preview.querySelector('img')?.getAttribute('onerror')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says when the custom spacer markup falls back to the default spacer', () => {
    render(<WordToHtmlConverter />);
    enterHtml('<p>Body text.</p><p>Sources:</p><ol><li>Source one</li></ol>');
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));

    const preview = document.querySelector('.output-preview')!;
    const input = screen.getByRole('textbox', { name: 'Custom Spacer' });
    fireEvent.change(input, { target: { value: '<p>&nbsp;</p><p>&nbsp;</p>' } });
    expect(preview.innerHTML).toContain('<p>Body text.</p><p>&nbsp;</p><p>');
    expect(screen.getByText(/not a single element, so the default spacer is used/)).toBeTruthy();

    fireEvent.change(input, { target: { value: '<div style="height:10px;"></div>' } });
    expect(screen.queryByText(/so the default spacer is used/)).toBeNull();
  });

  it.each([
    [`<div style='height:10px'></div>`, false],
    ['<br/>', false],
    ['<img src="x" onerror="window.__XSS=1">', true],
  ])('reports a sanitizer change only when the spacer used differs: %s', (markup, changed) => {
    render(<WordToHtmlConverter />);
    enterHtml('<p>Body text.</p><p>Sources:</p><ol><li>Source one</li></ol>');
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Custom Spacer' }), { target: { value: markup } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sanitize the spacer markup' }));

    expect(!!screen.queryByText(/The sanitizer changed the markup/)).toBe(changed);
    expect(screen.queryByText(/so the default spacer is used/)).toBeNull();
  });
});
