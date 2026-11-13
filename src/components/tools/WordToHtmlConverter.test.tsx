import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { WordToHtmlConverter } from './WordToHtmlConverter';
import { toast } from '@/hooks/use-toast';
import { getUnformattedHtml } from '@/lib/word-to-html/converter';
import * as converter from '@/lib/word-to-html/converter';
import { stripSpacerMarkers } from '@/lib/word-to-html/spacer';
import Lenis, { type LenisOptions } from 'lenis';
import { IMAGE_LIBRARY_ENABLED_KEY, useDraftImageFingerprints, useImageLibrary, useImageLibraryFingerprintBackfill } from '@/hooks/use-image-library';
import * as imageFingerprint from '@/lib/word-to-html/image-fingerprint';
import { createServer } from 'node:http';

vi.mock('lenis', () => ({
  default: vi.fn(),
}));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
/* Image loading needs a real browser; tests encode the fingerprint in the
 * src as #fp<n>, and a src without one is unreadable. */
vi.mock('@/lib/word-to-html/image-fingerprint', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/word-to-html/image-fingerprint')>();
  return {
    ...actual,
    loadFingerprint: async (src: string) => {
      const match = src.match(/#fp(\d+)/);
      return match ? new Uint8Array(actual.FINGERPRINT_LENGTH).fill(Number(match[1])) : null;
    },
  };
});

/** Output a test stands in for the converter's; null runs the real converter. */
const converterOutput = vi.hoisted(() => ({ html: null as string | null }));
vi.mock('@/lib/word-to-html/converter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/word-to-html/converter')>();
  return {
    ...actual,
    convertToHtml: (...args: Parameters<typeof actual.convertToHtml>) => converterOutput.html === null
      ? actual.convertToHtml(...args)
      : { formatted: converterOutput.html, unformatted: converterOutput.html },
  };
});

beforeEach(() => {
  vi.mocked(Lenis).mockImplementation((options: LenisOptions) => ({
    options,
    limit: 0,
    animatedScroll: 0,
    targetScroll: 0,
    isStopped: false,
    isLocked: false,
    raf: vi.fn(),
    destroy: vi.fn(),
    resize: vi.fn(),
  } as unknown as Lenis));
  vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  // The image library is on by default; keep it off for unrelated tests
  localStorage.setItem(IMAGE_LIBRARY_ENABLED_KEY, 'false');
});

afterEach(() => {
  converterOutput.html = null;
  cleanup();
  localStorage.clear();
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

function copySelection(preview: Element, select: (range: Range) => void, reverse = false, expectedPlain?: string): Record<string, string> {
  const range = document.createRange();
  select(range);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  if (reverse) selection.setBaseAndExtent(range.endContainer, range.endOffset, range.startContainer, range.startOffset);
  const liveRange = selection.getRangeAt(0);
  const endpoints = [liveRange.startContainer, liveRange.startOffset, liveRange.endContainer, liveRange.endOffset];
  const direction = [selection.anchorNode, selection.anchorOffset, selection.focusNode, selection.focusOffset];
  const plain = selection.toString();
  const previewHtml = preview.innerHTML;
  const input = screen.getByRole('textbox', { name: 'Word document content' });
  const inputHtml = input.innerHTML;
  const setData = vi.fn();
  expect(fireEvent.copy(preview, { clipboardData: { setData } })).toBe(false);
  const payload = Object.fromEntries(setData.mock.calls) as Record<string, string>;
  expect(payload['text/plain']).toBe(expectedPlain ?? plain);
  expect(selection.getRangeAt(0)).toBe(liveRange);
  expect([liveRange.startContainer, liveRange.startOffset, liveRange.endContainer, liveRange.endOffset]).toEqual(endpoints);
  expect([selection.anchorNode, selection.anchorOffset, selection.focusNode, selection.focusOffset]).toEqual(direction);
  expect(preview.innerHTML).toBe(previewHtml);
  expect(input.innerHTML).toBe(inputHtml);
  return payload;
}

describe('WordToHtmlConverter', () => {
  describe('normal-preview wheel limits', () => {
    function previewLenis(): Lenis {
      return vi.mocked(Lenis).mock.results.map(result => result.value as Lenis)
        .find(instance => instance.options.wrapper === document.querySelector('.output-preview'))!;
    }

    it('uses live dimensions and reconciliation only for the normal preview', () => {
      render(<WordToHtmlConverter />);
      const instances = vi.mocked(Lenis).mock.results.map(result => result.value as Lenis);
      expect(instances).toHaveLength(3);
      const preview = previewLenis();
      expect(preview.options.naiveDimensions).toBe(true);
      expect(preview.options.virtualScroll).toBeTypeOf('function');
      for (const instance of instances) {
        expect(instance.options.content).toBe(instance.options.wrapper);
        expect(instance.options.duration).toBe(1.2);
        expect(instance.options.smoothWheel).toBe(true);
        expect(instance.options.easing?.(0.5)).toBe(Math.min(1, 1.001 - Math.pow(2, -5)));
        expect(instance.options.autoRaf).toBeUndefined();
        if (instance !== preview) {
          expect(instance.options.naiveDimensions).toBeUndefined();
          expect(instance.options.virtualScroll).toBeUndefined();
        }
      }
    });

    it.each([
      [-1, 300], [200, -1], [1001, 800], [400, 1001], [4309, 4309],
    ])('rebases invalid animated/target state (%s, %s) before an ordinary wheel without integrating its delta', (animatedScroll, targetScroll) => {
      render(<WordToHtmlConverter />);
      const preview = previewLenis();
      Object.assign(preview, { limit: 1000, animatedScroll, targetScroll });
      vi.mocked(preview.resize).mockImplementation(() => {
        preview.animatedScroll = preview.targetScroll = 800;
      });
      const event = new WheelEvent('wheel', { deltaY: -100, cancelable: true });
      expect(preview.options.virtualScroll).toBeTypeOf('function');
      expect(preview.options.virtualScroll!({ deltaX: 0, deltaY: -100, event })).toBe(true);
      expect(preview.resize).toHaveBeenCalledTimes(1);
      expect([preview.animatedScroll, preview.targetScroll]).toEqual([800, 800]);
      expect(event.defaultPrevented).toBe(false);
      expect(event).not.toHaveProperty('lenisStopPropagation');
    });

    it.each([[0, 0], [1000, 1000], [400, 900], [900, 400], [0, 1000]])('preserves valid coasting and boundary state (%s, %s)', (animatedScroll, targetScroll) => {
      render(<WordToHtmlConverter />);
      const preview = previewLenis();
      Object.assign(preview, { limit: 1000, animatedScroll, targetScroll });
      expect(preview.options.virtualScroll).toBeTypeOf('function');
      for (const deltaY of [100, -100]) {
        expect(preview.options.virtualScroll!({ deltaX: 0, deltaY, event: new WheelEvent('wheel', { deltaY }) })).toBe(true);
      }
      expect(preview.resize).not.toHaveBeenCalled();
      expect([preview.animatedScroll, preview.targetScroll]).toEqual([animatedScroll, targetScroll]);
    });

    it.each(['ctrl', 'zero', 'horizontal', 'touch', 'stopped', 'locked'])('does not reconcile an excluded %s gesture/state even when positions are invalid', (state) => {
      render(<WordToHtmlConverter />);
      const preview = previewLenis();
      Object.assign(preview, { animatedScroll: 1200, targetScroll: 1500, isStopped: state === 'stopped', isLocked: state === 'locked' });
      const readLimit = vi.fn(() => 1000);
      Object.defineProperty(preview, 'limit', { get: readLimit });
      const deltaX = state === 'horizontal' ? 100 : 0;
      const deltaY = state === 'horizontal' || state === 'zero' ? 0 : 100;
      const event = state === 'touch' ? new TouchEvent('touchmove') : new WheelEvent('wheel', { deltaX, deltaY, ctrlKey: state === 'ctrl' });
      expect(preview.options.virtualScroll).toBeTypeOf('function');
      expect(preview.options.virtualScroll!({ deltaX, deltaY, event })).toBe(true);
      expect(readLimit).not.toHaveBeenCalled();
      expect(preview.resize).not.toHaveBeenCalled();
      expect([preview.animatedScroll, preview.targetScroll]).toEqual([1200, 1500]);
    });

    it('reads the current limit on each wheel, including empty and re-grown output', () => {
      render(<WordToHtmlConverter />);
      const preview = previewLenis();
      Object.assign(preview, { limit: 1000, animatedScroll: 400, targetScroll: 900 });
      const gesture = { deltaX: 0, deltaY: -100, event: new WheelEvent('wheel', { deltaY: -100 }) };
      expect(preview.options.virtualScroll).toBeTypeOf('function');
      preview.options.virtualScroll!(gesture);
      expect(preview.resize).not.toHaveBeenCalled();
      Object.assign(preview, { limit: 0 });
      vi.mocked(preview.resize).mockImplementation(() => {
        preview.animatedScroll = preview.targetScroll = 0;
      });
      preview.options.virtualScroll!(gesture);
      expect(preview.resize).toHaveBeenCalledTimes(1);
      preview.options.virtualScroll!(gesture);
      expect(preview.resize).toHaveBeenCalledTimes(1);
      Object.assign(preview, { limit: 2000, animatedScroll: 400, targetScroll: 1900 });
      preview.options.virtualScroll!(gesture);
      expect(preview.resize).toHaveBeenCalledTimes(1);
      expect(preview.targetScroll).toBe(1900);
    });

    it('retains one shared RAF and destroys the same instances once after view/content changes', () => {
      const view = render(<WordToHtmlConverter />);
      const instances = vi.mocked(Lenis).mock.results.map(result => result.value as Lenis);
      // Radix also schedules frames; identify the converter's shared loop.
      const loops = vi.mocked(requestAnimationFrame).mock.calls.filter(([callback]) => callback.name === 'raf');
      expect(loops).toHaveLength(1);
      const raf = loops[0][0];
      vi.mocked(requestAnimationFrame).mockReturnValueOnce(2);
      act(() => raf(16));
      instances.forEach(instance => {
        expect(instance.raf).toHaveBeenCalledTimes(1);
        expect(instance.raf).toHaveBeenCalledWith(16);
      });
      enterHtml('<h2>Section</h2><p>Body</p>');
      fireEvent.click(screen.getByTitle('Preview'));
      fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
      fireEvent.click(screen.getByTitle('Code'));
      expect(Lenis).toHaveBeenCalledTimes(3);
      expect(vi.mocked(requestAnimationFrame).mock.calls.filter(([callback]) => callback === raf)).toHaveLength(2);
      view.unmount();
      expect(cancelAnimationFrame).toHaveBeenCalledWith(2);
      instances.forEach(instance => expect(instance.destroy).toHaveBeenCalledTimes(1));
    });
  });

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

  it('asks about converting tables to lists for each Shoppables paste that holds a table', async () => {
    render(<WordToHtmlConverter />);
    fireEvent.click(screen.getByRole('radio', { name: 'Shoppables' }));
    const input = screen.getByRole('textbox', { name: 'Word document content' });
    const preview = document.querySelector('.output-preview')!;
    // The concealed link sends the paste through the prepared (synchronous) paste path.
    const pasteDocument = (name: string) => {
      const range = document.createRange();
      range.selectNodeContents(input);
      window.getSelection()!.removeAllRanges();
      window.getSelection()!.addRange(range);
      const html = `<p style="color:black">Shop <a href="/shop" style="color:black;text-decoration:none">${name}</a>.</p><table><tr><th>Product</th><th>Price</th></tr><tr><td>${name} candy</td><td>$18.00</td></tr></table>`;
      fireEvent.paste(input, { clipboardData: { getData: (type: string) => type === 'text/html' ? html : '' } });
    };

    pasteDocument('First');
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Yes, convert to lists' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(preview.querySelector('table')).toBeNull();
    expect(preview.querySelector('h3')?.textContent).toBe('First candy');

    // A new document with the same number of tables asks again, and "no" keeps them.
    pasteDocument('Second');
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'No, keep tables' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(preview.querySelector('th')?.textContent).toBe('Product');
    fireEvent.click(screen.getByRole('button', { name: 'Shoppables Features:' }));
    expect(screen.getByRole('checkbox', { name: 'Convert Tables to Lists' }).getAttribute('aria-checked')).toBe('false');

    // Editing the document, or pasting content without a table, does not ask again.
    enterHtml(input.innerHTML.replace('Second candy', 'Second candy bag'));
    fireEvent.paste(input, { clipboardData: { getData: (type: string) => type === 'text/html' ? '<p style="color:black">See <a href="/more" style="color:black;text-decoration:none">more</a>.</p>' : '' } });
    expect(screen.queryByRole('alertdialog')).toBeNull();
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

  it.each([['', 'H1'], ['<p><br></p>', 'P'], ['<br>', 'BR']])('removes document-header whitespace from a prepared paste while keeping leading markup: %s', (leading, firstTag) => {
    render(<WordToHtmlConverter />);
    const input = screen.getByRole('textbox', { name: 'Word document content' });
    const html = '<html>\n<head>\n<meta charset="utf-8">\n<style>h1{font-size:20pt}</style>\n</head>\n<body>\n'
      + `${leading}<h1>Green Hexagon Tile</h1><p>  Looking for a tile? <a href="/concealed" style="color:black;text-decoration:none">Plain source text</a></p>`
      + '\n\n<pre>  Indented\nText\n</pre>\n</body>\n</html>';
    fireEvent.paste(input, { clipboardData: { getData: (type: string) => type === 'text/html' ? html : '' } });
    expect(input.firstChild).toBe(input.firstElementChild);
    expect(input.firstElementChild?.tagName).toBe(firstTag);
    if (leading === '<p><br></p>') expect(input.firstElementChild?.innerHTML).toContain('<br');
    expect(input.querySelector('h1')?.textContent).toBe('Green Hexagon Tile');
    expect(input.querySelector('h1')?.style.fontSize).not.toBe('');
    expect(input.querySelector('h1 + p')?.textContent).toBe('  Looking for a tile? Plain source text');
    expect(input.querySelector('pre')?.previousSibling?.textContent).toBe('\n\n');
    expect(input.querySelector('pre')?.textContent).toBe('  Indented\nText\n');
    expect(input.querySelector('meta, style')).toBeNull();
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
      const html = '<html>\n<head>\n<meta charset="utf-8">\n</head>\n<body>\n<p>Read <a href="/concealed" style="color:black;text-decoration:none">our guide</a> first.</p></body></html>';
      fireEvent.paste(input, { clipboardData: { getData: (type: string) => type === 'text/html' ? html : '' } });
      expect(execCommand).toHaveBeenCalledWith('insertHTML', false, expect.any(String));
      expect(execCommand.mock.calls[0][2]).toMatch(/^<p[ >]/);
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
    ['"', '"', true], ['“', '”', true], ['"', '"', false],
  ] as const)('preserves the pasted closing quote boundary in preview, Code and Blocks (%s…%s, originally linked: %s)', async (opening, closing, inside) => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      render(<WordToHtmlConverter />);
      const input = screen.getByRole('textbox', { name: 'Word document content' });
      const title = "What's the Best Protein for Dogs?";
      const quote = `<span style="color:black;text-decoration-line:none">${closing}</span>`;
      const html = '<p style="color:black">See <a href="https://example.com/protein" style="color:inherit;text-decoration-line:none">our article '
        + `<span style="color:#1155cc;text-decoration-line:underline">${opening}${title}</span>${inside ? quote : ''}</a>${inside ? '' : quote} for details.</p>`;
      const expected = `${opening}${title}${inside ? closing : ''}`;
      fireEvent.paste(input, { clipboardData: { getData: (type: string) => type === 'text/html' ? html : '' } });
      expect(input.querySelector('a')?.textContent).toBe(expected);
      fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
      const preview = document.querySelector('.output-preview')!;
      expect(preview.querySelector('a')?.textContent).toBe(expected);
      expect(preview.textContent).toBe(`See our article ${opening}${title}${closing} for details.`);
      fireEvent.input(input);
      expect(preview.querySelector('a')?.textContent).toBe(expected);
      fireEvent.click(screen.getByTitle('Copy HTML'));
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
      const code = new DOMParser().parseFromString(writeText.mock.calls[0][0], 'text/html');
      expect(code.querySelector('a')?.textContent).toBe(expected);
      writeText.mockClear();
      const blocks = new DOMParser().parseFromString(copyAllBlocks(writeText).join(''), 'text/html');
      expect(blocks.body.innerHTML).toBe(code.body.innerHTML);
      expect(document.querySelector('iframe')).toBeNull();
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
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

  it.each(['Alt Text Image:', 'Image Alt Text -'])('groups a "%s" paragraph and its link into one image block', async (label) => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      render(<WordToHtmlConverter />);
      enterHtml(`<p>Body.</p><p>${label} Shop Grass Seed</p><p>Link to: <a href="https://lawnsynergy.com/collections/grass-seed">grass seed</a></p><h2>Next</h2>`);
      fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
      expect(document.querySelector('.output-preview [data-warning]')).toBeNull();
      expect(screen.queryByText(/^Failed:/)).toBeNull();
      const payloads = copyAllBlocks(writeText);
      await waitFor(() => expect(writeText).toHaveBeenCalled());
      const imageBlock = payloads.find(html => html.includes('Shop Grass Seed'));
      expect(imageBlock).toContain('Link to:');
      expect(imageBlock).not.toContain('Body.');
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

  it('preserves multiline plain-text paste as paragraphs without interpreting HTML', () => {
    render(<WordToHtmlConverter />);
    const input = screen.getByRole('textbox', { name: 'Word document content' });
    fireEvent.paste(input, { clipboardData: { getData: (type: string) => type === 'text/plain' ? 'First\r\nSecond\n\n<img src=x onerror="throw 1">' : '' } });
    const paragraphs = document.querySelectorAll('.output-preview p');
    expect(Array.from(paragraphs, p => p.textContent)).toEqual(['First', 'Second', '<img src=x onerror="throw 1">']);
    expect(input.querySelector('img')).toBeNull();
    expect(document.querySelector('.output-preview img')).toBeNull();
  });

  it.each(['a', 'A', 'i', 'I'])('keeps %s list metadata out of native selection copies', type => {
    render(<WordToHtmlConverter />);
    enterHtml(`<ol type="${type}"><li>One</li></ol>`);
    const preview = document.querySelector('.output-preview')!;
    expect(preview.querySelector('ol')?.getAttribute('data-w2h-list-type')).toBe(type);
    const copied = copySelection(preview, range => range.selectNodeContents(preview));
    expect(copied['text/html']).toBe(`<ol type="${type}"><li>One</li></ol>`);
    expect(copied['text/html']).not.toContain('data-w2h-list-type');
  });

  it('keeps complete selectable code and token styling across view-only updates', () => {
    render(<WordToHtmlConverter />);
    enterHtml('<p>Code &amp; text</p>');
    const code = document.querySelector('pre code')!;
    const text = code.textContent;
    const token = code.querySelector('.token.tag')!;
    expect(token).toBeTruthy();
    expect(token.hasAttribute('style')).toBe(false);
    expect(window.getComputedStyle(token).color).not.toBe('');
    fireEvent.click(screen.getByTitle('Preview'));
    expect(document.querySelector('pre code')).toBe(code);
    expect(code.querySelector('.token.tag')).toBe(token);
    expect(code.textContent).toBe(text);
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

  it.each([
    [false, ''], [true, ''], [false, '<div style="height:10px;"></div>'], [true, '<div style="height:10px;"></div>'],
  ] as const)('keeps fully bold paragraph spacing in Code/preview/selection/Blocks (first: %s, spacer: %s)', async (first, customSpacer) => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      render(<WordToHtmlConverter />);
      const prefix = first ? '' : '<p>Intro.</p>';
      const bold = '<p><strong>Something</strong></p>';
      enterHtml(prefix + bold + '<p>After.</p>');
      fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
      if (customSpacer) {
        fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Custom Spacer' }), { target: { value: customSpacer } });
      }
      const expected = prefix + (customSpacer || '<p>&nbsp;</p>') + bold + '<p>After.</p>';
      const preview = document.querySelector('.output-preview')!;
      expect(preview.innerHTML).toBe(expected);
      expect(preview.querySelector('[data-warning]')).toBeNull();
      expect(screen.queryByText(/^Failed:/)).toBeNull();
      fireEvent.click(screen.getByTitle('Copy HTML'));
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
      expect(writeText.mock.calls[0][0].replace(/>\s+</g, '><')).toBe(expected);
      fireEvent.click(screen.getAllByTitle('Preview')[0]);
      expect(copySelection(preview, range => range.selectNodeContents(preview))['text/html']).toBe(expected);
      fireEvent.click(screen.getByTitle('Copy Formatted HTML'));
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
      expect(writeText.mock.calls[1][0]).toBe(expected);
      writeText.mockClear();
      const payloads = copyAllBlocks(writeText);
      await waitFor(() => expect(writeText).toHaveBeenCalled());
      // Preserve the existing Blocks representation, including leading spacing.
      expect(payloads.join('')).toBe(expected);
      expect(payloads).toHaveLength(1);
      expect(payloads.join('')).not.toMatch(/data-warning|data-w2h-spacer/);
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it.each(['Blogs', 'Shoppables'])('highlights only truly missing fully bold paragraph spacing in %s and strips it on selection copy', (mode) => {
    converterOutput.html = '<p><strong>Whole.</strong></p><p><strong>Part</strong> body.</p><p>&nbsp;</p><p><strong>Spaced.</strong></p>';
    render(<WordToHtmlConverter />);
    enterHtml(converterOutput.html);
    fireEvent.click(screen.getByRole('radio', { name: mode }));
    if (mode === 'Shoppables') {
      fireEvent.click(screen.getByRole('button', { name: 'Shoppables Features:' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Spacing Rules' }));
    }
    const preview = document.querySelector('.output-preview')!;
    expect(Array.from(preview.querySelectorAll('p')).map(p => p.getAttribute('data-warning'))).toEqual([
      'Missing spacing before fully bold paragraph: "Whole...."', null, null, null,
    ]);
    expect(copySelection(preview, range => range.selectNodeContents(preview))['text/html']).toBe(converterOutput.html);
  });

  it('amended blank/text toggling shares warning eligibility while heading/section warnings remain', () => {
    converterOutput.html = '<p><strong>Whole.</strong></p><h2><strong>Section</strong></h2><p>Body.</p><p><strong>Sources:</strong></p><ol><li>Citation.</li></ol>';
    render(<WordToHtmlConverter />);
    enterHtml(converterOutput.html);
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
    const field = screen.getByRole('textbox', { name: 'Custom Spacer' });
    for (const [customSpacer, generic] of [['<p>Gap</p>', false], ['<div style="height:10px;"></div>', true], ['<p><strong>G</strong>ap</p>', false], ['<p>&#8203;</p>', true]] as const) {
      fireEvent.change(field, { target: { value: customSpacer } });
      const preview = document.querySelector('.output-preview')!;
      expect(preview.firstElementChild?.getAttribute('data-warning')?.includes('fully bold paragraph') || false).toBe(generic);
      expect(preview.querySelector('h2')?.getAttribute('data-warning')).toContain('Missing spacing before heading');
      expect(Array.from(preview.querySelectorAll('p')).find(p => p.textContent === 'Sources:')?.getAttribute('data-warning')).toContain('Missing spacing before "Sources:" section');
      expect(copySelection(preview, range => range.selectNodeContents(preview))['text/html']).toBe(converterOutput.html);
    }
  });

  it.each(['links', 'trim'])('does not falsely highlight fully bold paragraph spacing after late %s normalization', (kind) => {
    render(<WordToHtmlConverter />);
    enterHtml(kind === 'links' ? '<p><a href="/guide">Something</a></p>' : '<p><strong>Something</strong>\u200B</p>');
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    if (kind === 'links') {
      fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Wrap Links Strong & Underline' }));
    }
    const preview = document.querySelector('.output-preview')!;
    expect(preview.firstElementChild?.innerHTML).toBe('&nbsp;');
    expect(preview.lastElementChild?.textContent).toBe('Something');
    expect(preview.querySelector('[data-warning]')).toBeNull();
    expect(screen.queryByText(/^Failed:/)).toBeNull();
  });

  it.each(['<div><p><strong>Gap</strong></p></div>', '<p style="height:10px"><strong>Gap</strong></p>'])('amended text setting retains legacy content through UI selection/Code/Blocks copies: %s', async (customSpacer) => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      render(<WordToHtmlConverter />);
      fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
      fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Custom Spacer' }), { target: { value: customSpacer } });
      const source = '<p><strong>First.</strong></p><p>After.</p>';
      enterHtml(source);
      expect(document.querySelector('.output-preview')!.innerHTML).toBe(source);
      let input = customSpacer + source;
      const expected = '<p><strong>Gap</strong></p>' + source;
      for (let cycle = 0; cycle < 3; cycle++) {
        enterHtml(input);
        const preview = document.querySelector('.output-preview')!;
        expect(preview.innerHTML).toBe(expected);
        expect(preview.querySelector('[data-warning]')).toBeNull();
        expect(screen.queryByText(/^Failed:/)).toBeNull();
        input = copySelection(preview, range => range.selectNodeContents(preview))['text/html'];
        expect(input).toBe(expected);
        expect(input).not.toMatch(/data-warning|data-w2h-spacer/);
      }
      fireEvent.click(screen.getByTitle('Copy HTML'));
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
      expect(writeText.mock.calls[0][0].replace(/>\s+</g, '><')).toBe(expected);
      writeText.mockClear();
      expect(copyAllBlocks(writeText).join('')).toBe(expected);
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it.each(['', '<div style="height:10px;"></div>'])('keeps consecutive headings adjacent in preview and copied blocks: %s', async (customSpacer) => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      render(<WordToHtmlConverter />);
      enterHtml('<H2>Hello World</H2>\n<H3>The world is beautiful</H3><p>Actual body.</p><h3>Later section</h3>');
      fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
      if (customSpacer) {
        fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Custom Spacer' }), { target: { value: customSpacer } });
      }
      const preview = document.querySelector('.output-preview')!;
      expect(preview.querySelector('h2')?.nextElementSibling).toBe(preview.querySelector('h3'));
      expect(Array.from(preview.children).map(node => node.tagName)).toEqual(['H2', 'H3', 'P', customSpacer ? 'DIV' : 'P', 'H3']);
      expect(preview.querySelector('[data-warning]')).toBeNull();
      expect(screen.queryByText(/^Failed:/)).toBeNull();
      const expected = '<h2><strong>Hello World</strong></h2>\n<h3><strong>The world is beautiful</strong></h3><p>Actual body.</p>'
        + (customSpacer || '<p>&nbsp;</p>') + '<h3><strong>Later section</strong></h3>';
      expect(copySelection(preview, range => range.selectNodeContents(preview))['text/html']).toBe(expected);
      const payloads = copyAllBlocks(writeText);
      await waitFor(() => expect(writeText).toHaveBeenCalled());
      expect(payloads.join('')).toBe(expected.replace(/>\s+</g, '><'));
      expect(payloads.every(hasText)).toBe(true);
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it.each(['Blogs', 'Shoppables'])('maps consecutive-heading validation warnings only to real missing body separation in %s', (mode) => {
    // Stand in unspaced output to exercise both the no-warning and real-warning paths.
    converterOutput.html = '<h2><strong>Hello World</strong></h2><h3><strong>The world is beautiful</strong></h3><p>Actual body.</p><h3><strong>Later section</strong></h3>';
    render(<WordToHtmlConverter />);
    enterHtml(converterOutput.html);
    fireEvent.click(screen.getByRole('radio', { name: mode }));
    if (mode === 'Shoppables') {
      fireEvent.click(screen.getByRole('button', { name: 'Shoppables Features:' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Spacing Rules' }));
    }
    const headings = document.querySelector('.output-preview')!.querySelectorAll('h3');
    expect(Array.from(headings).map(node => node.getAttribute('data-warning'))).toEqual([null, 'Missing spacing before heading: "Later section..."']);
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

  it('highlights the list items the list-normalization rule counts', () => {
    // Converter output always spaces a bold label, so stand in output that does not.
    converterOutput.html = '<ul><li><strong>Tip:</strong>glued</li><li><strong>Done:</strong> dry</li></ul>';
    render(<WordToHtmlConverter />);
    enterHtml('<ul><li>Tip: glued</li></ul>');
    const items = Array.from(document.querySelector('.output-preview')!.querySelectorAll('li'));
    expect(items.map(li => li.getAttribute('data-warning'))).toEqual(['List item missing space after </strong> in "Tip:..."', null]);
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

  it.each(['preview', 'blocks', 'maximized blocks'])('copies both clipboard representations from %s', async view => {
    const write = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { write } });
    vi.stubGlobal('ClipboardItem', class { constructor(public data: Record<string, Blob>) {} });
    render(<WordToHtmlConverter />);
    enterHtml('<p>First</p><p>Second</p>');
    if (view === 'preview') {
      fireEvent.click(screen.getByTitle('Preview'));
      fireEvent.click(screen.getByTitle('Copy Formatted HTML'));
    } else {
      fireEvent.click(screen.getByTitle('Copy blocks'));
      if (view === 'maximized blocks') fireEvent.click(screen.getByTitle('Maximize Output'));
      const root = view === 'maximized blocks' ? within(screen.getByRole('dialog')) : screen;
      fireEvent.click(root.getByTitle('Copy as formatted HTML'));
    }
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    const [{ data }] = write.mock.calls[0][0];
    expect(await data['text/plain'].text()).toBe('First\nSecond');
    expect(await data['text/html'].text()).toContain('<p>First</p><p>Second</p>');
  });

  it('reports total clipboard denial from maximized formatted block copy', async () => {
    vi.stubGlobal('navigator', { clipboard: { write: vi.fn().mockRejectedValue(new Error('Denied')), writeText: vi.fn().mockRejectedValue(new Error('Denied')) } });
    render(<WordToHtmlConverter />);
    enterHtml('<p>Text</p>');
    fireEvent.click(screen.getByTitle('Copy blocks'));
    fireEvent.click(screen.getByTitle('Maximize Output'));
    fireEvent.click(within(screen.getByRole('dialog')).getByTitle('Copy as formatted HTML'));
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Error', description: 'Failed to copy block', variant: 'destructive' }));
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Copied!' }));
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

  it('labels client errors by category and shows their actual HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      total: 1, good: 0, broken: 1, serverErrors: 0, blocked: 0,
      goodLinks: [], brokenLinks: [{ url: 'https://example.com/private', status: 401 }], serverErrorLinks: [], blockedLinks: [],
    }) }));
    render(<WordToHtmlConverter />);
    enterHtml('<p><a href="https://example.com/private">Private</a></p>');
    fireEvent.click(screen.getByTitle('Check Links'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Client Errors \(4xx\)/)).toBeTruthy();
    expect(within(dialog).getByText('Status: 401')).toBeTruthy();
    expect(within(dialog).queryByText(/404/)).toBeNull();
  });

  it('does not duplicate server errors from an older worker in the client-error category', async () => {
    const server = { url: 'https://example.com/unavailable', status: 503 };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      total: 1, good: 0, broken: 1, serverErrors: 1, blocked: 0,
      goodLinks: [], brokenLinks: [server], serverErrorLinks: [server], blockedLinks: [],
    }) }));
    render(<WordToHtmlConverter />);
    enterHtml('<p><a href="https://example.com/unavailable">Unavailable</a></p>');
    fireEvent.click(screen.getByTitle('Check Links'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByText('Status: 503')).toHaveLength(1);
    expect(within(dialog).queryByText(/Client Errors/)).toBeNull();
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

  it('keeps the link attributes in the Blocks view and its maximized view', () => {
    render(<WordToHtmlConverter />);
    enterHtml('<p>Read <a href="https://example.com/guide">our guide</a> first.</p>');
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
    expect(screen.getByRole('checkbox', { name: 'Link Attributes' }).getAttribute('data-state')).toBe('checked');
    fireEvent.click(screen.getByTitle('Copy blocks'));
    const attributes = (link: Element | null | undefined) => [link?.getAttribute('target'), link?.getAttribute('rel')];
    const block = screen.getByText('Content', { exact: true }).closest('.group');
    expect(attributes(block?.querySelector('a'))).toEqual(['_blank', 'noopener noreferrer']);
    fireEvent.click(screen.getByTitle('Maximize Output'));
    const outputDialog = screen.getByRole('dialog', { name: 'Output - Blocks' });
    expect(attributes(outputDialog.querySelector('a[href="https://example.com/guide"]'))).toEqual(['_blank', 'noopener noreferrer']);
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

  it('copies a selection of the rendered preview without warning highlights or spacer markers', () => {
    render(<WordToHtmlConverter />);
    // A label split across elements is left unbolded, so the preview keeps a warning to strip.
    enterHtml('<p>Intro.</p><h2>Products</h2><ol><li><em>Top</em> option: <a href="/product">Buy product</a></li></ol>');
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Custom Spacer' }), {
      target: { value: '<div style="height:10px;"></div>' },
    });
    const preview = document.querySelector('.output-preview')!;
    const item = preview.querySelector('li')!;
    expect(item.getAttribute('data-warning')).toBe('Missing bold label before colon');

    const all = copySelection(preview, range => range.selectNodeContents(preview));
    expect(all['text/html']).toContain('<div style="height:10px;"></div>');
    expect(all['text/html']).toContain('<a href="/product"');
    expect(all['text/plain']).toContain('Buy product');
    const part = copySelection(preview, range => range.selectNodeContents(item.firstChild!));
    expect(part['text/html']).toBe('<ol><li><em>Top</em></li></ol>');
    for (const html of [all['text/html'], part['text/html']]) {
      expect(html).not.toContain('data-warning');
      expect(html).not.toContain('data-w2h-spacer');
    }
    expect(item.getAttribute('data-warning')).toBe('Missing bold label before colon');
  });

  describe('preview selection copy boundaries', () => {
    function renderPreview(html: string) {
      // Keep structural/empty-node fixtures intact instead of testing conversion cleanup.
      converterOutput.html = html;
      render(<WordToHtmlConverter />);
      enterHtml(html);
      return document.querySelector('.output-preview')!;
    }

    it.each(['p', 'h2'])('excludes an endpoint-only following %s shell', (tag) => {
      render(<WordToHtmlConverter />);
      enterHtml(`<p>Alpha selected paragraph.</p><${tag}>Beta following section.</${tag}>`);
      const preview = document.querySelector('.output-preview')!;
      const following = preview.children[1];
      for (const end of [following, following.firstChild!]) {
        const payload = copySelection(preview, range => {
          range.setStart(preview.firstChild!.firstChild!, 0);
          range.setEnd(end, 0);
        });
        expect(payload['text/html']).toBe('<p>Alpha selected paragraph.</p>');
      }
    });

    it('excludes nested following list shells without flattening selected ancestry', () => {
      const preview = renderPreview('<ol><li><em>Top</em></li><li><strong><span>Following</span></strong></li></ol>');
      const payload = copySelection(preview, range => {
        range.setStart(preview.querySelector('em')!.firstChild!, 0);
        range.setEnd(preview.querySelector('span')!.firstChild!, 0);
      });
      expect(payload['text/html']).toBe('<ol><li><em>Top</em></li></ol>');
    });

    it('lifts first-child inline endpoints only as far as selected preceding text', () => {
      const preview = renderPreview('<p>Alpha <strong><em>Following</em></strong></p>');
      const payload = copySelection(preview, range => {
        range.setStart(preview.querySelector('p')!.firstChild!, 0);
        range.setEnd(preview.querySelector('em')!.firstChild!, 0);
      });
      expect(payload['text/html']).toBe('<p>Alpha </p>');
    });

    it.each(['<br><hr>', ' \n', '<!--selected-->', '<i></i>', '<img alt="Selected">'])('preserves selected predecessors and their outer DIV: %s', (predecessors) => {
      const preview = renderPreview(`<p>Alpha</p><div style="height:10px;">${predecessors}<span>Spacer label</span></div>`);
      const payload = copySelection(preview, range => {
        range.setStart(preview.querySelector('p')!.firstChild!, 0);
        range.setEnd(preview.querySelector('span')!.firstChild!, 0);
      });
      expect(payload['text/html']).toBe(`<p>Alpha</p><div style="height:10px;">${predecessors}</div>`);
    });

    it('retains fully selected empty paragraphs, spacers, breaks and media', () => {
      const selected = '<p>Alpha</p><p></p><div style="height:10px;"></div><br><hr><img alt="Selected">';
      const preview = renderPreview(`${selected}<p>Following</p>`);
      const payload = copySelection(preview, range => {
        range.setStart(preview.firstChild!.firstChild!, 0);
        range.setEnd(preview.lastChild!.firstChild!, 0);
      });
      expect(payload['text/html']).toBe(selected);
    });

    it.each(['<p></p>', '<div style="height:10px;"></div>', '<br>', '<hr>', '<img alt="Selected">'])('leaves an ambiguous direct empty/void endpoint unchanged: %s', (leaf) => {
      const preview = renderPreview(`<p>Alpha</p>${leaf}<p>Following</p>`);
      const payload = copySelection(preview, range => {
        range.setStart(preview.firstChild!.firstChild!, 0);
        range.setEnd(preview.childNodes[1], 0);
      });
      expect(payload['text/html']).toBe(`<p>Alpha</p>${leaf}`);
    });

    it('preserves root-end, before-node and ordinary partial-word selections', () => {
      const html = '<p>Alpha selected paragraph.</p><p>Beta following paragraph.</p>';
      const preview = renderPreview(html);
      expect(copySelection(preview, range => range.selectNodeContents(preview))['text/html']).toBe(html);
      expect(copySelection(preview, range => {
        range.setStart(preview.firstChild!.firstChild!, 0);
        range.setEndBefore(preview.lastChild!);
      })['text/html']).toBe('<p>Alpha selected paragraph.</p>');
      expect(copySelection(preview, range => {
        range.setStart(preview.firstChild!.firstChild!, 2);
        range.setEnd(preview.firstChild!.firstChild!, 5);
      })['text/html']).toBe('<p>pha</p>');
    });

    it.each([
      ['parent', false], ['parent', true], ['following', false], ['following', true],
    ] as const)('excludes hidden output panels when the last paragraph selection ends at %s (reverse: %s)', (endpoint, reverse) => {
      const lastParagraph = '<p>Not by themselves. Light colors make a room feel more open.</p>';
      const preview = renderPreview(`<h1>Small Hexagon Tile</h1><p>Earlier section.</p>${lastParagraph}`);
      fireEvent.click(screen.getByTitle('Preview'));
      const output = preview.parentElement!;
      const following = document.createElement('p');
      following.textContent = 'Next visible area';
      output.after(following);
      // Both inactive output views remain mounted after the rendered preview.
      expect(output.querySelectorAll('.hidden')).toHaveLength(2);
      const payload = copySelection(preview, range => {
        range.setStart(preview.lastChild!.firstChild!, 0);
        if (endpoint === 'parent') range.setEnd(output, output.childNodes.length);
        else range.setEnd(following, 0);
      }, reverse);
      expect(payload['text/html']).toBe(lastParagraph);
    });

    it.each([
      ['<p>Alpha</p>', 'Alpha\n\n', 'Alpha'],
      ['<h2><strong>Alpha</strong></h2>', 'Alpha\n', 'Alpha'],
      ['<p>Alpha<br>Beta</p>', 'Alpha\nBeta\n\n', 'Alpha\nBeta'],
      ['<p> Alpha </p>', ' Alpha \n\n', ' Alpha '],
      ['<p>Alpha</p><p>Beta</p>', 'Alpha\n\nBeta\n\n', 'Alpha\n\nBeta'],
      ['<p>Alpha<br></p>', 'Alpha\n\n', 'Alpha\n\n'],
      ['<pre>Alpha\n</pre>', 'Alpha\n\n', 'Alpha\n\n'],
      ['<p>Alpha</p><p></p>', 'Alpha\n\n', 'Alpha\n\n'],
    ])('removes only implicit trailing selection line breaks for %s', (html, nativePlain, expectedPlain) => {
      const preview = renderPreview(`${html}<p>Following</p>`);
      // jsdom omits the rendered block separators included by browser selections.
      vi.spyOn(window.getSelection()!, 'toString').mockReturnValue(nativePlain);
      const payload = copySelection(preview, range => {
        range.setStart(preview.firstChild!.firstChild!, 0);
        range.setEnd(preview.lastChild!, 0);
      }, false, expectedPlain);
      expect(payload['text/html']).toBe(html);
    });

    it.each([false, true])('removes implicit trailing selection line breaks at the preview end (reverse: %s)', (reverse) => {
      const preview = renderPreview('<p>Alpha</p>');
      vi.spyOn(window.getSelection()!, 'toString').mockReturnValue('Alpha\n\n');
      const payload = copySelection(preview, range => {
        range.setStart(preview.firstChild!.firstChild!, 0);
        range.setEnd(preview.parentElement!, preview.parentElement!.childNodes.length);
      }, reverse, 'Alpha');
      expect(payload['text/html']).toBe('<p>Alpha</p>');
    });

    it('preserves an explicitly selected trailing newline inside text', () => {
      const preview = renderPreview('<pre>Alpha\nBeta\n</pre>');
      const payload = copySelection(preview, range => range.selectNodeContents(preview.firstChild!.firstChild!));
      expect(payload['text/plain']).toBe('Alpha\nBeta\n');
    });

    it('retains the first selected following character', () => {
      const preview = renderPreview('<p>Alpha</p><p>Beta</p>');
      const payload = copySelection(preview, range => {
        range.setStart(preview.firstChild!.firstChild!, 0);
        range.setEnd(preview.lastChild!.firstChild!, 1);
      });
      expect(payload['text/html']).toBe('<p>Alpha</p><p>B</p>');
    });

    it('normalizes reverse selections without changing live anchor/focus or plain text', () => {
      const preview = renderPreview('<p>Alpha</p><p>Beta</p>');
      const payload = copySelection(preview, range => {
        range.setStart(preview.firstChild!.firstChild!, 0);
        range.setEnd(preview.lastChild!, 0);
      }, true);
      expect(payload['text/html']).toBe('<p>Alpha</p>');
    });

    it('does not move before the original start or collapse a structural selection', () => {
      const preview = renderPreview('<p><span>Following</span></p>');
      expect(copySelection(preview, range => {
        range.setStart(preview, 0);
        range.setEnd(preview.firstChild!, 0);
        expect(range.collapsed).toBe(false);
      })['text/html']).toBe('<p></p>');
      expect(copySelection(preview, range => {
        range.setStart(preview.querySelector('span')!, 0);
        range.setEnd(preview.querySelector('span')!.firstChild!, 0);
        expect(range.collapsed).toBe(false);
      })['text/html']).toBe('<p><span></span></p>');
    });

    it('leaves wholly outside and cross-boundary ranges on the existing serialization path', () => {
      const preview = renderPreview('<p>Alpha</p><p>Beta</p>');
      const input = screen.getByRole('textbox', { name: 'Word document content' });
      expect(copySelection(preview, range => {
        range.setStart(input.firstChild!.firstChild!, 0);
        range.setEnd(input.lastChild!, 0);
      })['text/html']).toBe('<p>Alpha</p><p></p>');
      const outside = document.createElement('p');
      outside.textContent = 'Outside';
      preview.before(outside);
      let originalHtml = '';
      const payload = copySelection(preview, range => {
        range.setStart(outside.firstChild!, 0);
        range.setEnd(preview.firstChild!, 0);
        const container = document.createElement('div');
        container.appendChild(range.cloneContents());
        originalHtml = container.innerHTML;
      });
      expect(payload['text/html']).toBe(originalHtml);
    });

    it.each(['missing', 'empty', 'collapsed'])('does not intercept a %s selection', (state) => {
      const preview = renderPreview('<p>Alpha</p>');
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      if (state === 'missing') vi.spyOn(window, 'getSelection').mockReturnValue(null);
      if (state === 'collapsed') selection.collapse(preview.firstChild!.firstChild!, 0);
      const setData = vi.fn();
      expect(fireEvent.copy(preview, { clipboardData: { setData } })).toBe(true);
      expect(setData).not.toHaveBeenCalled();
    });

    it('continues serializing every range and uses the original multi-range plain text', () => {
      const preview = renderPreview('<p>Alpha</p><p>Beta</p><p>Gamma</p>');
      const ranges = [0, 1].map(index => {
        const range = document.createRange();
        range.setStart(preview.childNodes[index].firstChild!, 0);
        range.setEnd(preview.childNodes[index + 1], 0);
        return range;
      });
      vi.spyOn(window, 'getSelection').mockReturnValue({
        isCollapsed: false, rangeCount: ranges.length,
        getRangeAt: (index: number) => ranges[index],
        toString: () => 'Original multi-range plain text',
      } as unknown as Selection);
      const setData = vi.fn();
      fireEvent.copy(preview, { clipboardData: { setData } });
      expect(Object.fromEntries(setData.mock.calls)).toEqual({
        'text/html': '<p>Alpha</p><p>Beta</p>',
        'text/plain': 'Original multi-range plain text',
      });
      ranges.forEach((range, index) => {
        expect(range.startContainer).toBe(preview.childNodes[index].firstChild);
        expect(range.endContainer).toBe(preview.childNodes[index + 1]);
        expect(range.startOffset).toBe(0);
        expect(range.endOffset).toBe(0);
      });
    });
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

  it('keeps executable custom spacers only in export, never in any preview', () => {
    render(<WordToHtmlConverter />);
    enterHtml('<h2>First</h2><p>Body</p><h2>Next</h2>');
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Custom Spacer' }), { target: { value: '<div><style>body{display:none}</style><img src="x" onerror="window.__SPACER=1"></div>' } });
    expect(document.querySelector('pre code')?.textContent).toContain('onerror');
    const safe = () => expect(document.querySelectorAll('.output-preview [onerror], .output-preview style, .output-preview script, .output-preview iframe')).toHaveLength(0);
    safe();
    fireEvent.click(screen.getByTitle('Copy blocks'));
    safe();
    fireEvent.click(screen.getByTitle('Maximize Output'));
    safe();
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
    expect(preview.querySelector('img')?.getAttribute('onerror')).toBeNull();
    expect(document.querySelector('pre code')?.textContent).toContain('onerror="window.__XSS=1"');

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

  it('saves Shopify images in this browser and reuses them for matching Blogs image CTAs', async () => {
    localStorage.clear();
    const src = 'https://cdn.shopify.com/s/files/1/0609/1168/1674/files/Kill_Weeds.png?v=1#fp30';
    const href = 'https://lawnsynergy.com/collections/weed-killer-for-lawns';
    const draft = (alt: string, draftSrc: string) => `<p>Body text.</p><p><img src="${draftSrc}">Alt Image Text: ${alt}</p><p>Link to: <a href="${href}">${href}</a></p><h2>Final Thoughts</h2><p>Done.</p>`;
    const { unmount } = render(<WordToHtmlConverter />);
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
    const shopifyHtml = `<div style="text-align: center;"><a href="${href}" target="_blank" rel="noopener"><img src="${src}" alt="Kill Weeds. Keep Your Lawn. Shop Weed Killer For Lawns." style="float: none;"></a></div>`;
    fireEvent.change(screen.getByRole('textbox', { name: 'Shopify HTML' }), { target: { value: shopifyHtml } });
    fireEvent.click(screen.getByRole('button', { name: 'Save images' }));
    expect(screen.getByText('Image Library (1)')).toBeTruthy();
    expect(toast).toHaveBeenLastCalledWith({ title: '1 new image saved', description: undefined });
    // Saving the same article again adds no duplicate
    fireEvent.change(screen.getByRole('textbox', { name: 'Shopify HTML' }), { target: { value: shopifyHtml } });
    fireEvent.click(screen.getByRole('button', { name: 'Save images' }));
    expect(screen.getByText('Image Library (1)')).toBeTruthy();
    expect(toast).toHaveBeenLastCalledWith({ title: '0 new images saved', description: '1 already saved.' });
    unmount();

    // The saved image survives a reload and matches a punctuation variant
    // with the same picture (exact picture match required)
    render(<WordToHtmlConverter />);
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    enterHtml(draft('Kill Weeds. Keep Your Lawn: Shop Weed Killer For Lawns', 'https://lh7-rt.googleusercontent.com/docsz/d#fp30'));
    const preview = document.querySelector('.output-preview')!;
    await waitFor(() => expect(preview.querySelector('img')).not.toBeNull(), { timeout: 5000 });
    const image = preview.querySelector(`div[style="text-align: center;"] > a[href="${href}"] > img[style="float: none;"]`);
    expect(image?.getAttribute('src')).toBe(src);
    // The alt text always comes from the current draft, not the saved entry
    expect(image?.getAttribute('alt')).toBe('Kill Weeds. Keep Your Lawn: Shop Weed Killer For Lawns');
    expect(preview.textContent).not.toMatch(/Alt Image Text|Link to/);
    expect(preview.querySelector('[data-warning]')).toBeNull();
    expect(screen.queryByText(/^Failed:/)).toBeNull();

    // An image CTA matching no saved picture stays as text,
    // reported in the validation panel, not highlighted in the preview
    enterHtml(draft('Shop Grass Seed', 'https://lh7-rt.googleusercontent.com/docsz/d#fp200'));
    await waitFor(() => expect(screen.queryByText(/^Failed:/)).not.toBeNull(), { timeout: 5000 });
    expect(preview.querySelector('img')).toBeNull();
    expect(preview.textContent).toContain('Alt Image Text: Shop Grass Seed');
    expect(preview.querySelector('[data-warning]')).toBeNull();
  }, 20000);

  it('imports several JSON files in one pick and merges them', async () => {
    localStorage.clear();
    render(<WordToHtmlConverter />);
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
    const entry = (alt: string, src: string) => ({ host: 'lawnsynergy.com', alt, src });
    const file = (name: string, entries: object[]) =>
      new File([JSON.stringify(entries)], name, { type: 'application/json' });
    const fileA = file('a.json', [entry('Shop Weed Killer', 'https://cdn.shopify.com/a.png')]);
    const fileB = file('b.json', [
      entry('Shop Weed Killer', 'https://cdn.shopify.com/a.png'),
      entry('Shop Grass Seed', 'https://cdn.shopify.com/b.png'),
    ]);
    fireEvent.change(screen.getByLabelText('Import saved images'), { target: { files: [fileA, fileB] } });
    await waitFor(() => expect(screen.getByText('Image Library (2)')).toBeTruthy());
    expect(toast).toHaveBeenLastCalledWith({ title: '2 new images saved', description: '1 already saved.' });
  });

  it('reports unreadable and invalid imports while retaining valid files and existing images', async () => {
    localStorage.clear();
    render(<WordToHtmlConverter />);
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
    const invalid = new File(['not JSON'], 'broken.json', { type: 'application/json' });
    const unreadable = new File(['[]'], 'unreadable.json', { type: 'application/json' });
    vi.spyOn(unreadable, 'text').mockRejectedValue(new Error('read failed'));
    const valid = new File([JSON.stringify([{ host: 'store.com', alt: 'Keep', src: 'https://cdn.shopify.com/keep.png' }])], 'valid.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText('Import saved images'), { target: { files: [invalid, unreadable, valid] } });
    await waitFor(() => expect(screen.getByText('Image Library (1)')).toBeTruthy());
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Image library import failed', description: expect.stringContaining('broken.json, unreadable.json'), variant: 'destructive' }));
    vi.mocked(toast).mockClear();
    fireEvent.change(screen.getByLabelText('Import saved images'), { target: { files: [invalid] } });
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Image library import failed' })));
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: '0 new images saved' }));
    expect(screen.getByText('Image Library (1)')).toBeTruthy();
  });

  it.each(['save', 'remove'] as const)('preserves a %s made while a library import is being read', async action => {
    localStorage.clear();
    const entry = (alt: string) => ({
      host: 'lawnsynergy.com', alt, src: `https://cdn.shopify.com/${alt}.png#fp30`,
      fp: imageFingerprint.encodeFingerprint(new Uint8Array(imageFingerprint.FINGERPRINT_LENGTH).fill(30)),
    });
    localStorage.setItem('word-to-html:image-library', JSON.stringify([entry('A')]));
    render(<WordToHtmlConverter />);
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
    let finishRead!: (text: string) => void;
    const pending = new Promise<string>(resolve => { finishRead = resolve; });
    const file = new File([''], 'library.json', { type: 'application/json' });
    vi.spyOn(file, 'text').mockReturnValue(pending);
    fireEvent.change(screen.getByLabelText('Import saved images'), { target: { files: [file] } });

    if (action === 'save') {
      fireEvent.change(screen.getByRole('textbox', { name: 'Shopify HTML' }), {
        target: { value: `<a href="https://lawnsynergy.com/x"><img src="${entry('B').src}" alt="B"></a>` },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save images' }));
    } else {
      fireEvent.click(screen.getByTitle('Remove "A"'));
    }
    const saved = () => JSON.parse(localStorage.getItem('word-to-html:image-library') || '[]');
    expect(saved().map((image: { alt: string }) => image.alt)).toEqual(action === 'save' ? ['A', 'B'] : []);

    await act(async () => { finishRead(JSON.stringify([entry('C')])); });
    expect(saved().map((image: { alt: string }) => image.alt)).toEqual(action === 'save' ? ['A', 'B', 'C'] : ['C']);
    expect(toast).toHaveBeenLastCalledWith({ title: '1 new image saved', description: undefined });
  });

  it.each([false, true])('merges overlapping library imports without duplicate notifications in Strict Mode (reverse: %s)', async reverse => {
    localStorage.clear();
    const entry = (alt: string) => ({
      host: 'lawnsynergy.com', alt, src: `https://cdn.shopify.com/${alt}.png`,
      fp: imageFingerprint.encodeFingerprint(new Uint8Array(imageFingerprint.FINGERPRINT_LENGTH).fill(30)),
    });
    localStorage.setItem('word-to-html:image-library', JSON.stringify([entry('A')]));
    render(<StrictMode><WordToHtmlConverter /></StrictMode>);
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
    const finishReads: ((text: string) => void)[] = [];
    const files = ['first.json', 'second.json'].map(name => {
      const pending = new Promise<string>(resolve => { finishReads.push(resolve); });
      const file = new File([''], name, { type: 'application/json' });
      vi.spyOn(file, 'text').mockReturnValue(pending);
      return file;
    });
    files.forEach(file => fireEvent.change(screen.getByLabelText('Import saved images'), { target: { files: [file] } }));

    await act(async () => {
      for (const index of reverse ? [1, 0] : [0, 1]) {
        finishReads[index](JSON.stringify(index === 0 ? [entry('B')] : [entry('B'), entry('C')]));
      }
    });
    const saved = JSON.parse(localStorage.getItem('word-to-html:image-library') || '[]');
    expect(saved).toEqual([entry('A'), entry('B'), entry('C')]);
    expect(toast).toHaveBeenCalledTimes(2);
    expect(toast).toHaveBeenLastCalledWith({
      title: reverse ? '0 new images saved' : '1 new image saved',
      description: '1 already saved.',
    });
  });

  it('keeps a removal during import when a fingerprint update is already queued', async () => {
    localStorage.clear();
    const entry = { host: 'lawnsynergy.com', alt: 'A', src: 'https://cdn.shopify.com/A.png' };
    localStorage.setItem('word-to-html:image-library', JSON.stringify([entry]));
    let finishLoad!: (pixels: Uint8Array) => void;
    vi.spyOn(imageFingerprint, 'loadFingerprint').mockReturnValue(new Promise(resolve => { finishLoad = resolve; }));
    render(<WordToHtmlConverter />);
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
    let finishRead!: (text: string) => void;
    const file = new File([''], 'library.json', { type: 'application/json' });
    vi.spyOn(file, 'text').mockReturnValue(new Promise(resolve => { finishRead = resolve; }));
    fireEvent.change(screen.getByLabelText('Import saved images'), { target: { files: [file] } });
    const pixels = new Uint8Array(imageFingerprint.FINGERPRINT_LENGTH).fill(30);
    const incoming = { ...entry, alt: 'C', src: 'https://cdn.shopify.com/C.png', fp: imageFingerprint.encodeFingerprint(pixels) };
    await act(async () => {
      finishLoad(pixels);
      await Promise.resolve();
      await Promise.resolve();
      fireEvent.click(screen.getByTitle('Remove "A"'));
      finishRead(JSON.stringify([incoming]));
    });
    const saved = JSON.parse(localStorage.getItem('word-to-html:image-library') || '[]');
    expect(saved.map((image: { alt: string }) => image.alt)).toEqual(['C']);
  });

  it('reports a full browser storage once instead of losing the save silently', () => {
    localStorage.clear();
    render(<WordToHtmlConverter />);
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    try {
      const save = (src: string) => {
        fireEvent.change(screen.getByRole('textbox', { name: 'Shopify HTML' }), {
          target: { value: `<div><a href="https://lawnsynergy.com/collections/x"><img src="${src}" alt="Shop X"></a></div>` },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Save images' }));
      };
      save('https://cdn.shopify.com/x.png');
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Image library not saved', variant: 'destructive' }));
      // The warning is not repeated while storage stays full
      save('https://cdn.shopify.com/y.png');
      expect(vi.mocked(toast).mock.calls.filter(([args]) => args.title === 'Image library not saved')).toHaveLength(1);
    } finally {
      setItem.mockRestore();
    }
  });

  it('runs the image library by default and remembers the checkbox turning it off', async () => {
    localStorage.clear();
    localStorage.setItem('word-to-html:image-library', JSON.stringify([
      { host: 'lawnsynergy.com', alt: 'Shop Grass Seed', src: 'https://cdn.shopify.com/s/files/1/seed.png#fp40' },
    ]));
    const draftHtml = '<p>Body text.</p><p><img src="https://lh7-rt.googleusercontent.com/docsz/d#fp40">Alt Image Text: Shop Grass Seed</p><p>Link to: <a href="https://lawnsynergy.com/collections/grass-seed">link</a></p>';
    const { unmount } = render(<WordToHtmlConverter />);
    enterHtml(draftHtml);
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    // No notice; the saved image applies out of the box on an exact match
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await waitFor(
      () => expect(document.querySelector('.output-preview img')?.getAttribute('src')).toBe('https://cdn.shopify.com/s/files/1/seed.png#fp40'),
      { timeout: 5000 }
    );

    // The checkbox turns the library off, and the choice is remembered
    fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Image Library (Shopify)' }));
    expect(document.querySelector('.output-preview img')).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Shopify HTML' })).toBeNull();
    unmount();

    render(<WordToHtmlConverter />);
    enterHtml(draftHtml);
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    expect(document.querySelector('.output-preview img')).toBeNull();
    expect(document.querySelector('.output-preview')?.textContent).toContain('Alt Image Text: Shop Grass Seed');
  }, 20000);

  it('lets the pictures decide a match and refuses a same-alt different picture', async () => {
    localStorage.clear();
    localStorage.setItem(IMAGE_LIBRARY_ENABLED_KEY, 'true');
    localStorage.setItem('word-to-html:image-library', JSON.stringify([
      { host: 'lawnsynergy.com', alt: 'Old Banner Wording', src: 'https://cdn.shopify.com/s/files/1/a.png#fp10' },
      { host: 'lawnsynergy.com', alt: 'Shop Fungicide', src: 'https://cdn.shopify.com/s/files/1/b.png#fp120' },
    ]));
    const href = 'https://lawnsynergy.com/collections/x';
    const draft = (alt: string, draftSrc: string) =>
      `<p>Body text.</p><p><img src="${draftSrc}">Alt Image Text: ${alt}</p><p>Link to: <a href="${href}">${href}</a></p><p>Done.</p>`;
    render(<WordToHtmlConverter />);
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    const preview = document.querySelector('.output-preview')!;

    // Picture matches a saved image under a reworded alt text
    enterHtml(draft('Completely New Wording', 'https://lh7-rt.googleusercontent.com/docsz/img#fp12'));
    await waitFor(() => expect(preview.querySelector('img')).not.toBeNull(), { timeout: 5000 });
    expect(preview.querySelector('img')?.getAttribute('src')).toBe('https://cdn.shopify.com/s/files/1/a.png#fp10');
    expect(preview.querySelector('img')?.getAttribute('alt')).toBe('Completely New Wording');

    // Same alt text, different picture (matching no saved image): nothing
    // inserted; the hold shows in the validation panel, not as a preview
    // highlight (highlighting is for errors)
    enterHtml(draft('Shop Fungicide', 'https://lh7-rt.googleusercontent.com/docsz/img#fp200'));
    await waitFor(() => expect(screen.queryByText(/^Failed:/)).not.toBeNull(), { timeout: 5000 });
    expect(preview.querySelector('img')).toBeNull();
    expect(preview.textContent).toContain('Alt Image Text: Shop Fungicide');
    expect(preview.querySelector('[data-warning]')).toBeNull();

    // Unreadable draft picture: the alt-only match is never applied
    enterHtml(draft('Shop Fungicide', 'https://lh7-rt.googleusercontent.com/docsz/unreadable'));
    await waitFor(() => expect(screen.queryByText(/^Failed:/)).not.toBeNull(), { timeout: 5000 });
    expect(preview.querySelector('img')).toBeNull();
    expect(preview.querySelector('[data-warning]')).toBeNull();
  }, 20000);

  it('backfills missing fingerprints of saved entries and stores them', async () => {
    localStorage.clear();
    localStorage.setItem(IMAGE_LIBRARY_ENABLED_KEY, 'true');
    localStorage.setItem('word-to-html:image-library', JSON.stringify([
      { host: 'lawnsynergy.com', alt: 'Shop Grass Seed', src: 'https://cdn.shopify.com/s/files/1/c.png#fp30' },
    ]));
    render(<WordToHtmlConverter />);
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    await waitFor(() => {
      const [entry] = JSON.parse(localStorage.getItem('word-to-html:image-library') || '[]');
      expect(typeof entry.fp).toBe('string');
    }, { timeout: 5000 });
  }, 20000);

  it('starts image fingerprint work only in enabled Blogs with saved images', async () => {
    localStorage.clear();
    const load = vi.spyOn(imageFingerprint, 'loadFingerprint');
    const { unmount } = render(<WordToHtmlConverter />);
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    enterHtml('<p><img src="https://draft.test/a#fp10"></p>');
    await act(async () => {});
    expect(load).not.toHaveBeenCalled();
    unmount();

    localStorage.setItem('word-to-html:image-library', JSON.stringify([
      { host: 'lawnsynergy.com', alt: 'Saved', src: 'https://cdn.shopify.com/a.png#fp10' },
    ]));
    render(<WordToHtmlConverter />);
    enterHtml('<p><img src="https://draft.test/a#fp10"></p>');
    fireEvent.click(screen.getByRole('radio', { name: 'Shoppables' }));
    await act(async () => {});
    expect(load).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    await waitFor(() => expect(document.querySelector('.output-preview img')).not.toBeNull());
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('keeps image matching and conversion cached across view-only changes', async () => {
    localStorage.clear();
    localStorage.setItem('word-to-html:image-library', JSON.stringify([{
      host: 'lawnsynergy.com', alt: 'Saved', src: 'https://cdn.shopify.com/a.png',
      fp: imageFingerprint.encodeFingerprint(new Uint8Array(imageFingerprint.FINGERPRINT_LENGTH).fill(10)),
    }]));
    render(<WordToHtmlConverter />);
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    enterHtml('<p>Body</p><p><img src="https://draft.test/a#fp10"></p>');
    await waitFor(() => expect(document.querySelector('.output-preview img')).not.toBeNull());
    const convert = vi.spyOn(converter, 'convertToHtml');
    fireEvent.click(screen.getByTitle('Preview'));
    fireEvent.click(screen.getByTitle('Copy blocks'));
    expect(convert).not.toHaveBeenCalled();
  });

  it('matches unlabelled pictures independently of repeated or edited alt text', async () => {
    localStorage.clear();
    const fp = (value: number) => imageFingerprint.encodeFingerprint(new Uint8Array(imageFingerprint.FINGERPRINT_LENGTH).fill(value));
    const srcA = 'https://cdn.shopify.com/a.png';
    const srcB = 'https://cdn.shopify.com/b.png';
    localStorage.setItem('word-to-html:image-library', JSON.stringify([
      { host: 'lawnsynergy.com', alt: 'Same', src: srcA, fp: fp(10) },
      { host: 'lawnsynergy.com', alt: 'Same', src: srcB, fp: fp(200) },
    ]));
    const load = vi.spyOn(imageFingerprint, 'loadFingerprint');
    const draft = (alt: string) => `<p>Body text.</p><p><img src="https://draft.test/a#fp10" ${alt}></p>`
      + `<p><img src="https://draft.test/b#fp200" ${alt}></p>`;
    render(<WordToHtmlConverter />);
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    enterHtml(draft('alt="Same"'));
    const preview = document.querySelector('.output-preview')!;
    const sources = () => Array.from(preview.querySelectorAll('img'), image => image.getAttribute('src'));
    await waitFor(() => expect(sources()).toEqual([srcA, srcB]));
    expect(load).toHaveBeenCalledTimes(2);
    enterHtml(draft('alt="Different description"'));
    await waitFor(() => expect(sources()).toEqual([srcA, srcB]));
    enterHtml(draft(''));
    await waitFor(() => expect(sources()).toEqual([srcA, srcB]));
    expect(load).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/^Failed:/)).toBeNull();
  });

  it('keeps matched table-cell image links in preview, Code and Blocks copies', async () => {
    localStorage.clear();
    const href = 'https://lawnsynergy.com/collections/seed';
    const src = 'https://cdn.shopify.com/seed.png';
    const entry = {
      host: 'lawnsynergy.com', alt: 'Saved description', src,
      fp: imageFingerprint.encodeFingerprint(new Uint8Array(imageFingerprint.FINGERPRINT_LENGTH).fill(30)),
    };
    localStorage.setItem('word-to-html:image-library', JSON.stringify([entry]));
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      render(<WordToHtmlConverter />);
      fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
      const input = '<table><tr><td>Before<img src="https://draft.test/seed#fp30"><p>Alt Text: Draft description</p>'
        + `<p>Link to: <a href="${href}">Shop now</a></p><p>After.</p></td><td>Other cell</td></tr></table>`;
      enterHtml(input);
      const inputHtml = screen.getByRole('textbox', { name: 'Word document content' }).innerHTML;
      const preview = document.querySelector('.output-preview')!;
      await waitFor(() => expect(preview.querySelector('td > a > img')?.getAttribute('src')).toBe(src));
      expect(preview.querySelector('td > a')?.getAttribute('href')).toBe(href);
      expect(preview.textContent).not.toMatch(/Alt Text|Link to|Shop now/);
      expect(screen.queryByText(/^Failed:/)).toBeNull();
      fireEvent.click(screen.getByTitle('Copy HTML'));
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
      const code = new DOMParser().parseFromString(writeText.mock.calls[0][0], 'text/html');
      expect(code.querySelector('td > a > img')?.getAttribute('src')).toBe(src);
      expect(code.querySelector('td > a')?.getAttribute('href')).toBe(href);
      writeText.mockClear();
      const blocks = new DOMParser().parseFromString(copyAllBlocks(writeText).join(''), 'text/html');
      expect(blocks.body.innerHTML).toBe(code.body.innerHTML.replace(/>\s+</g, '><'));
      expect(screen.getByRole('textbox', { name: 'Word document content' }).innerHTML).toBe(inputHtml);
    } finally {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('loads legacy descriptions of one source once while preserving distinct same-alt pictures', () => {
    const fp = imageFingerprint.encodeFingerprint(new Uint8Array(imageFingerprint.FINGERPRINT_LENGTH).fill(10));
    const first = { host: 'store.com', src: 'https://cdn.shopify.com/a.png', alt: 'Old description', fp };
    const renamed = { ...first, alt: 'Same', fp: undefined };
    const other = { ...first, src: 'https://cdn.shopify.com/b.png', alt: 'Same' };
    localStorage.setItem('word-to-html:image-library', JSON.stringify([first, renamed, other]));
    const { result } = renderHook(() => useImageLibrary());
    const expected = [{ ...renamed, fp }, other];
    expect(result.current[0]).toEqual(expected);
    expect(JSON.parse(localStorage.getItem('word-to-html:image-library')!)).toEqual(expected);
  });

  it('recomputes picture identity when only the middle of a long source changes', async () => {
    const source = (value: number) => `https://draft.test/${'a'.repeat(80)}#fp${value}${'z'.repeat(80)}`;
    const html = (value: number) => `<p><img src="${source(value)}"></p>`;
    const { result, rerender } = renderHook(({ input }) => useDraftImageFingerprints(input, true), {
      initialProps: { input: html(100) },
    });
    await waitFor(() => expect(result.current.pending).toBe(false));
    rerender({ input: html(200) });
    expect(result.current.pending).toBe(true);
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.fingerprints).toEqual([{
      src: source(200), href: null,
      fp: imageFingerprint.encodeFingerprint(new Uint8Array(imageFingerprint.FINGERPRINT_LENGTH).fill(200)),
    }]);
  });

  it('keeps text and toggles interactive while images finish and discards an older draft', async () => {
    localStorage.clear();
    const saved = { host: 'store.com', alt: 'Saved', src: 'https://cdn.shopify.com/saved.png',
      fp: imageFingerprint.encodeFingerprint(new Uint8Array(imageFingerprint.FINGERPRINT_LENGTH).fill(20)) };
    localStorage.setItem('word-to-html:image-library', JSON.stringify([saved]));
    let finishOld!: (pixels: Uint8Array) => void;
    let finishNew!: (pixels: Uint8Array) => void;
    const load = vi.spyOn(imageFingerprint, 'loadFingerprint')
      .mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
      .mockImplementationOnce(() => new Promise(resolve => { finishNew = resolve; }));
    render(<WordToHtmlConverter />);
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
    const draft = (name: string) => `<h2>${name}</h2><p><img src="https://draft.test/${name}" alt="${name}"></p><p>Link to: <a href="https://store.com/products/item">Shop</a></p>`;
    enterHtml(draft('First'));
    expect(document.querySelector('.output-preview h2')?.textContent).toBe('First');
    expect(document.querySelector('.output-preview img')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByTitle('Preview'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Heading Strong Tags' }));
    expect(document.querySelector('.output-preview h2 strong')).toBeNull();

    const oldSignal = load.mock.calls[0][1];
    enterHtml(draft('Second'));
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => { finishOld(new Uint8Array(imageFingerprint.FINGERPRINT_LENGTH).fill(20)); });
    expect(document.querySelector('.output-preview h2')?.textContent).toBe('Second');
    expect(document.querySelector('.output-preview img')).toBeNull();
    await act(async () => { finishNew(new Uint8Array(imageFingerprint.FINGERPRINT_LENGTH).fill(20)); });
    await waitFor(() => expect(document.querySelector('.output-preview img')?.getAttribute('src')).toBe(saved.src));
    expect(document.querySelector('.output-preview img')?.getAttribute('alt')).toBe('Second');
    expect(document.querySelector('.output-preview h2 strong')).toBeNull();
  });

  it('reports unreadable unlabelled pictures even with no output text', async () => {
    localStorage.clear();
    localStorage.setItem('word-to-html:image-library', JSON.stringify([
      { host: 'lawnsynergy.com', alt: '', src: 'https://cdn.shopify.com/a.png#fp10' },
    ]));
    render(<WordToHtmlConverter />);
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    enterHtml('<p><img src="https://draft.test/unreadable"></p>');
    await waitFor(() => expect(screen.queryByText(/^Failed:/)).not.toBeNull());
    expect(document.querySelector('.output-preview img')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByText('1 draft image(s) without a verified saved picture match')).toBeTruthy();
  });
});

describe('saved image fingerprint queue', () => {
  const entry = (index: number) => ({ host: 'store.com', alt: `Image ${index}`, src: `https://cdn.shopify.com/${index}.png` });
  const pixels = (value: number) => new Uint8Array(imageFingerprint.FINGERPRINT_LENGTH).fill(value);
  const useBackfill = (enabled: boolean) => {
    const [library, setLibrary] = useImageLibrary();
    useImageLibraryFingerprintBackfill(library, setLibrary, enabled);
    return { library, setLibrary };
  };

  afterEach(() => { vi.useRealTimers(); });

  it('recovers a newly saved image after a temporary fingerprint failure without reloading', async () => {
    vi.useFakeTimers();
    const load = vi.spyOn(imageFingerprint, 'loadFingerprint').mockResolvedValue(pixels(20))
      .mockResolvedValueOnce(null);
    const { result } = renderHook(() => useBackfill(true));
    act(() => result.current.setLibrary([entry(0)]));
    await act(async () => {});
    expect(load).toHaveBeenCalledTimes(1);
    expect(result.current.library[0].fp).toBeUndefined();

    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    const expected = imageFingerprint.encodeFingerprint(pixels(20));
    expect(result.current.library[0].fp).toBe(expected);
    expect(JSON.parse(localStorage.getItem('word-to-html:image-library')!)[0].fp).toBe(expected);
    expect(load).toHaveBeenCalledTimes(2);

    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('backfills legacy grayscale fingerprints without removing the saved image', async () => {
    const legacy = btoa(String.fromCharCode(...new Uint8Array(imageFingerprint.FINGERPRINT_WIDTH * imageFingerprint.FINGERPRINT_HEIGHT).fill(20)));
    localStorage.setItem('word-to-html:image-library', JSON.stringify([{ ...entry(0), fp: legacy }]));
    const load = vi.spyOn(imageFingerprint, 'loadFingerprint').mockResolvedValue(pixels(20));
    const { result } = renderHook(() => useBackfill(true));
    expect(result.current.library[0].fp).toBe(legacy);
    await waitFor(() => expect(result.current.library[0].fp).toBe(imageFingerprint.encodeFingerprint(pixels(20))));
    expect(load).toHaveBeenCalledTimes(1);
    expect(result.current.library[0].src).toBe(entry(0).src);
  });

  it('retries interrupted loads on re-enable and ignores their late results', async () => {
    localStorage.setItem('word-to-html:image-library', JSON.stringify([entry(0)]));
    let finishOld!: (value: Uint8Array) => void;
    const oldLoad = new Promise<Uint8Array>(resolve => { finishOld = resolve; });
    const load = vi.spyOn(imageFingerprint, 'loadFingerprint').mockResolvedValue(pixels(20))
      .mockImplementationOnce(() => oldLoad);
    const { result, rerender } = renderHook(({ enabled }) => useBackfill(enabled), { initialProps: { enabled: true } });
    expect(load).toHaveBeenCalledTimes(1);
    const oldSignal = load.mock.calls[0][1];
    rerender({ enabled: false });
    expect(oldSignal?.aborted).toBe(true);
    rerender({ enabled: true });
    const expected = imageFingerprint.encodeFingerprint(pixels(20));
    await waitFor(() => expect(result.current.library[0].fp).toBe(expected));
    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => { finishOld(pixels(10)); });
    expect(result.current.library[0].fp).toBe(expected);
    expect(JSON.parse(localStorage.getItem('word-to-html:image-library')!)[0].fp).toBe(expected);
  });

  it('retries interrupted loads after library edits without losing the edits', async () => {
    localStorage.setItem('word-to-html:image-library', JSON.stringify([entry(0)]));
    let finishOld!: (value: Uint8Array) => void;
    const oldLoad = new Promise<Uint8Array>(resolve => { finishOld = resolve; });
    const load = vi.spyOn(imageFingerprint, 'loadFingerprint').mockResolvedValue(pixels(20))
      .mockImplementationOnce(() => oldLoad);
    const { result } = renderHook(() => useBackfill(true));
    act(() => result.current.setLibrary(previous => [{ ...previous[0], alt: 'Edited description' }, entry(1)]));
    const expected = imageFingerprint.encodeFingerprint(pixels(20));
    await waitFor(() => expect(result.current.library.map(image => image.fp)).toEqual([expected, expected]));
    expect(load).toHaveBeenCalledTimes(3);
    await act(async () => { finishOld(pixels(10)); });
    expect(result.current.library).toEqual([{ ...entry(0), alt: 'Edited description', fp: expected }, { ...entry(1), fp: expected }]);
  });

  it('advances through failed batches and retries only unreadable sources on re-enable', async () => {
    const entries = Array.from({ length: 21 }, (_, index) => entry(index));
    localStorage.setItem('word-to-html:image-library', JSON.stringify(entries));
    const load = vi.spyOn(imageFingerprint, 'loadFingerprint').mockImplementation(async src =>
      src === entry(20).src ? pixels(20) : null);
    const { result, rerender } = renderHook(({ enabled }) => useBackfill(enabled), { initialProps: { enabled: true } });
    const expected = imageFingerprint.encodeFingerprint(pixels(20));
    await waitFor(() => expect(result.current.library[20].fp).toBe(expected));
    expect(result.current.library.slice(0, 20).every(image => !image.fp)).toBe(true);
    expect(load).toHaveBeenCalledTimes(21);
    rerender({ enabled: false });
    rerender({ enabled: true });
    await act(async () => {});
    expect(load).toHaveBeenCalledTimes(41);
    expect(load.mock.calls.slice(21).every(([src]) => src !== entry(20).src)).toBe(true);
  });

  it('bounds automatic retries and allows recovery on re-enable without reloading successful images', async () => {
    vi.useFakeTimers();
    localStorage.setItem('word-to-html:image-library', JSON.stringify([entry(0), entry(1)]));
    let recovered = false;
    const load = vi.spyOn(imageFingerprint, 'loadFingerprint').mockImplementation(async src =>
      src === entry(1).src || recovered ? pixels(20) : null);
    const { result, rerender } = renderHook(({ enabled }) => useBackfill(enabled), { initialProps: { enabled: true } });
    await act(async () => {});
    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(999); });
    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(load).toHaveBeenCalledTimes(3);
    await act(async () => { await vi.advanceTimersByTimeAsync(1999); });
    expect(load).toHaveBeenCalledTimes(3);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(load).toHaveBeenCalledTimes(4);
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(load).toHaveBeenCalledTimes(4);
    expect(result.current.library[0].fp).toBeUndefined();

    recovered = true;
    rerender({ enabled: false });
    rerender({ enabled: true });
    await act(async () => {});
    expect(result.current.library.every(image => image.fp === imageFingerprint.encodeFingerprint(pixels(20)))).toBe(true);
    expect(load).toHaveBeenCalledTimes(5);
    expect(load.mock.calls.filter(([src]) => src === entry(1).src)).toHaveLength(1);
  });

  it('does not let a waiting retry block new images or restart its delay after library edits', async () => {
    vi.useFakeTimers();
    localStorage.setItem('word-to-html:image-library', JSON.stringify([entry(0)]));
    const load = vi.spyOn(imageFingerprint, 'loadFingerprint').mockResolvedValue(pixels(20))
      .mockResolvedValueOnce(null);
    const { result } = renderHook(() => useBackfill(true));
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    act(() => result.current.setLibrary(previous => [...previous, entry(1)]));
    await act(async () => {});
    expect(load.mock.calls.map(([src]) => src)).toEqual([entry(0).src, entry(1).src]);
    expect(result.current.library[1].fp).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(result.current.library.every(image => image.fp)).toBe(true);
    expect(load.mock.calls.map(([src]) => src)).toEqual([entry(0).src, entry(1).src, entry(0).src]);
  });

  it.each(['remove', 'disable', 'unmount'])('cancels a waiting fingerprint retry on %s', async action => {
    vi.useFakeTimers();
    localStorage.setItem('word-to-html:image-library', JSON.stringify([entry(0)]));
    const load = vi.spyOn(imageFingerprint, 'loadFingerprint').mockResolvedValue(null);
    const { result, rerender, unmount } = renderHook(({ enabled }) => useBackfill(enabled), { initialProps: { enabled: true } });
    await act(async () => {});
    if (action === 'remove') act(() => result.current.setLibrary([]));
    else if (action === 'disable') rerender({ enabled: false });
    else unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(load).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem('word-to-html:image-library')!)).toEqual(action === 'remove' ? [] : [entry(0)]);
  });

  it('loads at most ten distinct sources per batch and shares results across stores', async () => {
    const entries = [entry(0), { ...entry(0), host: 'other-store.com' }, ...Array.from({ length: 10 }, (_, index) => entry(index + 1))];
    localStorage.setItem('word-to-html:image-library', JSON.stringify(entries));
    let finishFirst!: (value: Uint8Array) => void;
    const firstLoad = new Promise<Uint8Array>(resolve => { finishFirst = resolve; });
    const load = vi.spyOn(imageFingerprint, 'loadFingerprint').mockResolvedValue(pixels(20))
      .mockImplementationOnce(() => firstLoad);
    const { result } = renderHook(() => useBackfill(true));
    expect(load.mock.calls.map(([src]) => src)).toEqual(Array.from({ length: 10 }, (_, index) => entry(index).src));
    await act(async () => { finishFirst(pixels(20)); });
    await waitFor(() => expect(result.current.library.every(image => !!image.fp)).toBe(true));
    expect(load).toHaveBeenCalledTimes(11);
    expect(result.current.library[0].fp).toBe(result.current.library[1].fp);
  });

  it('does not save results or start another batch after unmount', async () => {
    const entries = Array.from({ length: 11 }, (_, index) => entry(index));
    const initial = JSON.stringify(entries);
    localStorage.setItem('word-to-html:image-library', initial);
    let finish!: (value: Uint8Array) => void;
    const pending = new Promise<Uint8Array>(resolve => { finish = resolve; });
    const load = vi.spyOn(imageFingerprint, 'loadFingerprint').mockReturnValue(pending);
    const { unmount } = renderHook(() => useBackfill(true));
    const signal = load.mock.calls[0][1];
    unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => { finish(pixels(20)); });
    expect(localStorage.getItem('word-to-html:image-library')).toBe(initial);
    expect(load).toHaveBeenCalledTimes(10);
  });
});

describe('image library cross-tab persistence', () => {
  const key = 'word-to-html:image-library';
  const image = (name: string) => ({ host: 'store.com', src: `https://cdn.shopify.com/${name}.png`, alt: name });

  it('merges a stale local save into the latest stored entries', () => {
    const { result } = renderHook(() => useImageLibrary());
    localStorage.setItem(key, JSON.stringify([image('red')]));
    act(() => result.current[1]([image('green')]));
    expect(result.current[0]).toEqual([image('red'), image('green')]);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([image('red'), image('green')]);
  });

  it('receives remote additions and removals instead of writing stale state back', () => {
    localStorage.setItem(key, JSON.stringify([image('red')]));
    const { result } = renderHook(() => useImageLibrary());
    localStorage.setItem(key, JSON.stringify([image('green')]));
    act(() => window.dispatchEvent(new StorageEvent('storage', { key })));
    expect(result.current[0]).toEqual([image('green')]);
    localStorage.removeItem(key);
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: null })));
    expect(result.current[0]).toEqual([]);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it.each([false, true])('finishes only the latest queued edit on unmount (removed: %s)', async removed => {
    const writes: (() => void)[] = [];
    const request = vi.fn((_name: string, save: () => void) => new Promise<void>(resolve => {
      writes.push(() => { save(); resolve(); });
    }));
    vi.stubGlobal('navigator', { locks: { request } });
    const { result, unmount } = renderHook(() => useImageLibrary());
    act(() => result.current[1]([image('red')]));
    if (removed) act(() => result.current[1]([]));
    unmount();
    await act(async () => writes.forEach(save => save()));
    expect(JSON.parse(localStorage.getItem(key) || '[]')).toEqual(removed ? [] : [image('red')]);
    expect(request).toHaveBeenCalledWith(key, expect.any(Function));
  });

  it('serializes pending writes and retains remote additions', async () => {
    const writes: (() => void)[] = [];
    vi.stubGlobal('navigator', { locks: { request: (_name: string, save: () => void) => new Promise<void>(resolve => {
      writes.push(() => { save(); resolve(); });
    }) } });
    const { result } = renderHook(() => useImageLibrary());
    act(() => result.current[1]([image('red')]));
    act(() => result.current[1](previous => [...previous, image('green')]));
    localStorage.setItem(key, JSON.stringify([image('blue')]));
    await act(async () => writes.forEach(save => save()));
    expect(result.current[0]).toEqual([image('blue'), image('red'), image('green')]);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(result.current[0]);
  });
});

describe('Word to HTML link checker worker', () => {
  it('retries unsupported HEAD responses and keeps HTTP categories disjoint against real local endpoints', async () => {
    const calls: string[] = [];
    const server = createServer((request, response) => {
      calls.push(`${request.method} ${request.url}`);
      const unsupported = request.url === '/head405' ? 405 : request.url === '/head501' ? 501 : 0;
      response.statusCode = unsupported && request.method === 'HEAD' ? unsupported
        : request.url === '/missing' ? 404 : request.url === '/private' ? 401
        : request.url === '/server' ? 503 : request.url === '/blocked' ? 403 : 200;
      response.end();
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Local test server did not start');
      const links = ['/good', '/head405', '/head501', '/missing', '/private', '/server', '/blocked'].map(path => `http://127.0.0.1:${address.port}${path}`);
      const { default: worker } = await import('../../../link-checker-worker/index.js');
      const response = await worker.fetch(new Request('https://worker.test', { method: 'POST', body: JSON.stringify({ links }) }), {}, {});
      const results = await response.json();
      expect(results).toMatchObject({ total: 7, good: 3, broken: 2, serverErrors: 1, blocked: 1 });
      expect(results.brokenLinks.map((link: { status: number }) => link.status)).toEqual([404, 401]);
      expect(results.serverErrorLinks.map((link: { status: number }) => link.status)).toEqual([503]);
      expect(calls.filter(call => call.startsWith('GET'))).toEqual(['GET /head405', 'GET /head501']);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it('fetches page content for the GitHub Pages origin and adds CORS headers', async () => {
    const upstreamFetch = vi.fn().mockResolvedValue(
      new Response('<h1>Journal</h1>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
    );
    vi.stubGlobal('fetch', upstreamFetch);
    const { default: worker } = await import('../../../link-checker-worker/index.js');

    const response = await worker.fetch(new Request('https://worker.test', {
      method: 'POST',
      headers: {
        Origin: 'https://anivaryam.github.io',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'fetch-page',
        url: 'https://store.example/products/journal',
      }),
    }), {}, {});

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    await expect(response.json()).resolves.toEqual({ contents: '<h1>Journal</h1>' });
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
    expect(upstreamFetch.mock.calls[0][0].href).toBe('https://store.example/products/journal');
    expect(upstreamFetch.mock.calls[0][1]).toMatchObject({ method: 'GET', redirect: 'manual' });
    expect(upstreamFetch.mock.calls[0][1].headers).toMatchObject({
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': expect.stringContaining('Mozilla/5.0'),
    });
  });

  it('rejects unapproved origins and private page targets without fetching them', async () => {
    const upstreamFetch = vi.fn();
    vi.stubGlobal('fetch', upstreamFetch);
    const { default: worker } = await import('../../../link-checker-worker/index.js');

    const unapprovedOrigin = await worker.fetch(new Request('https://worker.test', {
      method: 'POST',
      headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'fetch-page', url: 'https://store.example/products/journal' }),
    }), {}, {});
    expect(unapprovedOrigin.status).toBe(403);

    const privateTarget = await worker.fetch(new Request('https://worker.test', {
      method: 'POST',
      headers: { Origin: 'https://anivaryam.github.io', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'fetch-page', url: 'http://127.0.0.1/private' }),
    }), {}, {});
    expect(privateTarget.status).toBe(400);
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it('blocks cross-origin redirects and applies the per-IP rate limit', async () => {
    const upstreamFetch = vi.fn().mockResolvedValue(
      new Response(null, { status: 302, headers: { Location: 'https://other.example/page' } }),
    );
    vi.stubGlobal('fetch', upstreamFetch);
    const { default: worker } = await import('../../../link-checker-worker/index.js');

    const redirectResponse = await worker.fetch(new Request('https://worker.test', {
      method: 'POST',
      headers: {
        Origin: 'https://anivaryam.github.io',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'fetch-page',
        url: 'https://store.example/products/journal',
      }),
    }), {}, {});
    expect(redirectResponse.status).toBe(403);

    const limiter = { limit: vi.fn().mockResolvedValue({ success: false }) };
    const limitedResponse = await worker.fetch(new Request('https://worker.test', {
      method: 'POST',
      headers: {
        Origin: 'https://anivaryam.github.io',
        'CF-Connecting-IP': '203.0.113.42',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'fetch-page',
        url: 'https://store.example/products/journal',
      }),
    }), { RELATED_PRODUCT_FETCH_LIMITER: limiter }, {});
    expect(limitedResponse.status).toBe(429);
    expect(limiter.limit).toHaveBeenCalledWith({ key: '203.0.113.42' });
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
  });
});
