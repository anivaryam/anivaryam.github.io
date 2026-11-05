import { afterEach, describe, expect, it, vi } from 'vitest';
import { htmlToPlainText, writeRichHtml } from './clipboard';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Word to HTML clipboard', () => {
  it('keeps block boundaries, line breaks, entities and preformatted whitespace', () => {
    expect(htmlToPlainText('<h2>Title</h2><p>A &amp; B<br>Next</p><ul><li>One</li><li>Two</li></ul>')).toBe('Title\nA & B\nNext\nOne\nTwo');
    expect(htmlToPlainText('<pre>  first\n\n  last\n</pre>')).toBe('  first\n\n  last\n');
    expect(htmlToPlainText('<p>Keep</p><script>throw 1</script><style>body{display:none}</style>')).not.toMatch(/throw|display/);
  });

  it('writes HTML and plain text together', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { write } });
    vi.stubGlobal('ClipboardItem', class { constructor(public data: Record<string, Blob>) {} });
    expect(await writeRichHtml('<p>Hello</p><p>World</p>')).toBe(true);
    const [{ data }] = write.mock.calls[0][0];
    expect(await data['text/html'].text()).toBe('<p>Hello</p><p>World</p>');
    expect(await data['text/plain'].text()).toBe('Hello\nWorld');
  });

  it('keeps the code fallback and propagates total denial to the caller', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { write: vi.fn().mockRejectedValue(new Error('denied')), writeText } });
    expect(await writeRichHtml('<p>Hello</p>')).toBe(false);
    expect(writeText).toHaveBeenCalledWith('<p>Hello</p>');
    writeText.mockRejectedValue(new Error('denied'));
    await expect(writeRichHtml('<p>Hello</p>')).rejects.toThrow('denied');
  });
});
