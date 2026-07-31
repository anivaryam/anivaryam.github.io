import JSZip from "jszip";

const ABSOLUTE_IMAGE_SOURCE = /^(?:https?|data|blob|file):/i;

const EXTENSION_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  avif: "image/avif",
};

function inferMimeFromName(name: string): string | null {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!match) return null;
  return EXTENSION_TO_MIME[match[1]!] ?? null;
}

function resolvePath(base: string, relative: string): string {
  const segments = `${base}/${relative}`.replaceAll("\\", "/").split("/");
  const resolved: string[] = [];

  for (const segment of segments) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }

  return resolved.join("/");
}

export async function loadZipAsHtml(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(file);
  let htmlPath: string | null = null;

  zip.forEach((path, entry) => {
    if (htmlPath === null && path.endsWith(".html") && !entry.dir) {
      htmlPath = entry.name;
    }
  });

  const htmlEntry = htmlPath === null ? null : zip.file(htmlPath);
  if (htmlEntry === null) {
    throw new Error("No HTML file found in the zip");
  }

  const html = await htmlEntry.async("text");
  const doc = new DOMParser().parseFromString(html, "text/html");
  const separatorIndex = htmlEntry.name.lastIndexOf("/");
  const htmlDirectory = separatorIndex < 0 ? "" : htmlEntry.name.slice(0, separatorIndex);

  for (const image of Array.from(doc.querySelectorAll("img"))) {
    const source = image.getAttribute("src");
    if (source === null || source === "" || ABSOLUTE_IMAGE_SOURCE.test(source)) continue;

    const imageEntry = zip.file(resolvePath(htmlDirectory, source));
    if (imageEntry === null) continue;

    const rawBlob = await imageEntry.async("blob");
    const mime = inferMimeFromName(imageEntry.name);
    const blob = rawBlob.type || !mime ? rawBlob : new Blob([await rawBlob.arrayBuffer()], { type: mime });
    image.setAttribute("src", URL.createObjectURL(blob));
  }

  return doc.documentElement.outerHTML;
}
