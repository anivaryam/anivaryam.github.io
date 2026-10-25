import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { WordToHtmlConverter } from './WordToHtmlConverter';
import { toast } from '@/hooks/use-toast';
import { getUnformattedHtml } from '@/lib/word-to-html/converter';
import { stripSpacerMarkers } from '@/lib/word-to-html/spacer';
import Lenis, { type LenisOptions } from 'lenis';
import { IMAGE_LIBRARY_ENABLED_KEY } from '@/hooks/use-image-library';

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
  // A returning visitor who declined the image library trial: the notice stays closed
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

function copySelection(preview: Element, select: (range: Range) => void, reverse = false): Record<string, string> {
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
  expect(payload['text/plain']).toBe(plain);
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

  it('saves Shopify images in this browser and reuses them for matching Blogs image CTAs', async () => {
    localStorage.clear();
    const src = 'https://cdn.shopify.com/s/files/1/0609/1168/1674/files/Kill_Weeds.png?v=1#fp30';
    const href = 'https://lawnsynergy.com/collections/weed-killer-for-lawns';
    const draft = (alt: string, draftSrc: string) => `<p>Body text.</p><p><img src="${draftSrc}">Alt Image Text: ${alt}</p><p>Link to: <a href="${href}">${href}</a></p><h2>Final Thoughts</h2><p>Done.</p>`;
    const { unmount } = render(<WordToHtmlConverter />);
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Use Image Library' }));
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

    // An image CTA matching no saved picture or alt text stays as text
    enterHtml(draft('Shop Grass Seed', 'https://lh7-rt.googleusercontent.com/docsz/d#fp200'));
    await waitFor(() => expect(preview.querySelector('[data-warning]')).not.toBeNull(), { timeout: 5000 });
    expect(preview.querySelector('img')).toBeNull();
    expect(preview.querySelector('[data-warning]')?.getAttribute('data-warning'))
      .toBe('No saved image for "Shop Grass Seed" on lawnsynergy.com');
  }, 20000);

  it('asks about the image library trial only in Blogs mode and keeps it off when declined', async () => {
    localStorage.clear();
    localStorage.setItem('word-to-html:image-library', JSON.stringify([
      { host: 'lawnsynergy.com', alt: 'Shop Grass Seed', src: 'https://cdn.shopify.com/s/files/1/seed.png#fp40' },
    ]));
    const draftHtml = '<p>Body text.</p><p><img src="https://lh7-rt.googleusercontent.com/docsz/d#fp40">Alt Image Text: Shop Grass Seed</p><p>Link to: <a href="https://lawnsynergy.com/collections/grass-seed">link</a></p>';
    const { unmount } = render(<WordToHtmlConverter />);
    enterHtml(draftHtml);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Shoppables' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    const notice = screen.getByRole('alertdialog');
    expect(notice.textContent).toMatch(/Shopify only/);
    fireEvent.click(within(notice).getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    // Off: the saved image is not used and no panel is shown
    expect(document.querySelector('.output-preview img')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
    expect(screen.queryByRole('textbox', { name: 'Shopify HTML' })).toBeNull();
    unmount();

    // The answer is remembered; the checkbox turns the library on later
    render(<WordToHtmlConverter />);
    enterHtml(draftHtml);
    fireEvent.click(screen.getByRole('radio', { name: 'Blogs' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Blogs Features:' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Image Library (Shopify only, trial)' }));
    await waitFor(
      () => expect(document.querySelector('.output-preview img')?.getAttribute('src')).toBe('https://cdn.shopify.com/s/files/1/seed.png#fp40'),
      { timeout: 5000 }
    );
    expect(screen.getByRole('textbox', { name: 'Shopify HTML' })).toBeTruthy();
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
    // inserted, conflict warned
    enterHtml(draft('Shop Fungicide', 'https://lh7-rt.googleusercontent.com/docsz/img#fp200'));
    await waitFor(() => expect(preview.querySelector('[data-warning]')).not.toBeNull(), { timeout: 5000 });
    expect(preview.querySelector('img')).toBeNull();
    expect(preview.querySelector('[data-warning]')?.getAttribute('data-warning'))
      .toBe('The draft picture differs from the saved image for "Shop Fungicide" on lawnsynergy.com');

    // Unreadable draft picture: the alt-only match is never applied, and
    // the hold says why
    enterHtml(draft('Shop Fungicide', 'https://lh7-rt.googleusercontent.com/docsz/unreadable'));
    await waitFor(() => expect(preview.querySelector('[data-warning]')).not.toBeNull(), { timeout: 5000 });
    expect(preview.querySelector('img')).toBeNull();
    expect(preview.querySelector('[data-warning]')?.getAttribute('data-warning'))
      .toBe('Picture for "Shop Fungicide" on lawnsynergy.com not verified; image not applied');
  }, 20000);

  it('backfills missing fingerprints of saved entries and stores them', async () => {
    localStorage.clear();
    localStorage.setItem(IMAGE_LIBRARY_ENABLED_KEY, 'true');
    localStorage.setItem('word-to-html:image-library', JSON.stringify([
      { host: 'lawnsynergy.com', alt: 'Shop Grass Seed', src: 'https://cdn.shopify.com/s/files/1/c.png#fp30' },
    ]));
    render(<WordToHtmlConverter />);
    await waitFor(() => {
      const [entry] = JSON.parse(localStorage.getItem('word-to-html:image-library') || '[]');
      expect(typeof entry.fp).toBe('string');
    }, { timeout: 5000 });
  }, 20000);
});
