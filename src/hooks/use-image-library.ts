import { useEffect, useState } from "react";
import { parseImageLibraryJson, type ImageLibraryEntry } from "@/lib/word-to-html/image-library";

export const IMAGE_LIBRARY_KEY = "word-to-html:image-library";
export const IMAGE_LIBRARY_ENABLED_KEY = "word-to-html:image-library-enabled";

// Storage can be blocked (private windows, blocked site data); the feature
// then works for the session only.
function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Blocked or full storage
  }
}

/** The saved images, kept in this browser's localStorage. */
export function useImageLibrary() {
  const [library, setLibrary] = useState<ImageLibraryEntry[]>(() => parseImageLibraryJson(readStorage(IMAGE_LIBRARY_KEY) || "[]"));
  useEffect(() => {
    writeStorage(IMAGE_LIBRARY_KEY, JSON.stringify(library));
  }, [library]);
  return [library, setLibrary] as const;
}

/**
 * Whether the image library is turned on. It is opt-in: null until the
 * person answers the trial notice, then their choice for this browser.
 */
export function useImageLibraryEnabled() {
  const [enabled, setEnabled] = useState<boolean | null>(() => {
    const stored = readStorage(IMAGE_LIBRARY_ENABLED_KEY);
    return stored === null ? null : stored === "true";
  });
  useEffect(() => {
    if (enabled !== null) writeStorage(IMAGE_LIBRARY_ENABLED_KEY, String(enabled));
  }, [enabled]);
  return [enabled, setEnabled] as const;
}
