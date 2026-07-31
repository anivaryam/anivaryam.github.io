if (typeof globalThis.createImageBitmap === "undefined") {
  (globalThis as unknown as { createImageBitmap: typeof createImageBitmap }).createImageBitmap = async (
    _blob: Blob,
  ): Promise<ImageBitmap> => {
    const fake = document.createElement("canvas");
    fake.width = 2;
    fake.height = 2;
    (fake as unknown as { close: () => void }).close = () => {};
    return fake as unknown as ImageBitmap;
  };
}
