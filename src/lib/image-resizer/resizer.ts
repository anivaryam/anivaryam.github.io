export type ResizeMode = 'exact' | 'fit' | 'fill';
export type OutputFormat = 'jpeg' | 'png' | 'webp';

export interface ResizeOptions {
  width: number;
  height: number;
  mode: ResizeMode;
  format: OutputFormat;
  quality: number; // 0–1
  fitBackground?: string; // CSS color for letterbox padding, default white
}

export async function resizeImage(file: File, options: ResizeOptions): Promise<Blob> {
  const { width, height, mode, format, quality, fitBackground = '#ffffff' } = options;

  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  canvas.width = width;
  canvas.height = height;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, width, height);

  if (mode === 'exact') {
    ctx.drawImage(img, 0, 0, width, height);
  } else if (mode === 'fit') {
    const scale = Math.min(width / img.width, height / img.height);
    const scaledW = Math.round(img.width * scale);
    const scaledH = Math.round(img.height * scale);
    const offsetX = Math.round((width - scaledW) / 2);
    const offsetY = Math.round((height - scaledH) / 2);
    ctx.fillStyle = fitBackground;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH);
  } else {
    // fill: scale to cover, center-crop
    const scale = Math.max(width / img.width, height / img.height);
    const scaledW = Math.round(img.width * scale);
    const scaledH = Math.round(img.height * scale);
    const offsetX = Math.round((width - scaledW) / 2);
    const offsetY = Math.round((height - scaledH) / 2);
    ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH);
  }

  return canvasToBlob(canvas, format, quality);
}

export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

export function mimeToFormat(mime: string): OutputFormat {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpeg';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create blob'));
      },
      `image/${format}`,
      format === 'png' ? undefined : quality
    );
  });
}
