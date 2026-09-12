import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { WordToHtmlConverter } from './WordToHtmlConverter';
import { toast } from '@/hooks/use-toast';

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
    enterHtml('<p>Sources: Citation.</p><h2>Products</h2><ol><li>Option: <a href="/product">Buy product</a></li></ol>');
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
});
