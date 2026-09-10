import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
