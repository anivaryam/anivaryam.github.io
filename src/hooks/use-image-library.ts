import { useEffect, useMemo, useRef, useState } from "react";
import { findDraftImages, normalizeAltText, parseImageLibraryJson, type DraftFingerprints, type ImageLibraryEntry } from "@/lib/word-to-html/image-library";
import { encodeFingerprint, loadFingerprint } from "@/lib/word-to-html/image-fingerprint";
import { toast } from "@/hooks/use-toast";

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

function writeStorage(key: string, value: string): "saved" | "quota" | "blocked" {
  try {
    localStorage.setItem(key, value);
    return "saved";
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" ? "quota" : "blocked";
  }
}

/** The saved images, kept in this browser's localStorage. */
export function useImageLibrary() {
  const persisted = useRef("");
  const [library, setLibrary] = useState<ImageLibraryEntry[]>(() => {
    const parsed = parseImageLibraryJson(readStorage(IMAGE_LIBRARY_KEY) || "[]");
    persisted.current = JSON.stringify(parsed);
    return parsed;
  });
  // A quota failure loses the change on reload, so it is reported, once per
  // failing stretch; blocked storage stays silent as the session-only mode.
  const quotaReported = useRef(false);
  useEffect(() => {
    const json = JSON.stringify(library);
    if (json === persisted.current) return;
    const result = writeStorage(IMAGE_LIBRARY_KEY, json);
    if (result === "saved") {
      persisted.current = json;
      quotaReported.current = false;
    } else if (result === "quota" && !quotaReported.current) {
      quotaReported.current = true;
      toast({
        title: "Image library not saved",
        description: "Browser storage is full, so this change lasts only until reload. Remove some images, or export the library as a backup.",
        variant: "destructive",
      });
    }
  }, [library]);
  return [library, setLibrary] as const;
}

/** Whether the image library is on: the saved choice, on by default. */
export function useImageLibraryEnabled() {
  const [enabled, setEnabled] = useState<boolean>(() => readStorage(IMAGE_LIBRARY_ENABLED_KEY) !== "false");
  useEffect(() => {
    writeStorage(IMAGE_LIBRARY_ENABLED_KEY, String(enabled));
  }, [enabled]);
  return [enabled, setEnabled] as const;
}

/**
 * Fingerprints of the draft's own images, computed before the cleaner strips
 * them. While `pending` the fingerprints are not complete, so matching holds
 * off rather than inserting an image by alt text alone. An unreadable image
 * records null and the pipeline falls back to alt-text matching for it.
 */
export function useDraftImageFingerprints(inputHtml: string, enabled: boolean) {
  const [state, setState] = useState<{ key: string; fingerprints: DraftFingerprints }>({ key: "", fingerprints: {} });
  const draftImages = useMemo(() => (enabled && inputHtml ? findDraftImages(inputHtml) : []), [enabled, inputHtml]);
  // Data-URI sources run to megabytes, so the identity key samples them
  const key = useMemo(
    () => draftImages.map(image => `${normalizeAltText(image.alt)}#${image.src.length}:${image.src.slice(0, 64)}${image.src.slice(-64)}`).join("|"),
    [draftImages]
  );
  useEffect(() => {
    if (key === state.key) return;
    if (draftImages.length === 0) {
      setState({ key, fingerprints: {} });
      return;
    }
    let cancelled = false;
    Promise.all(draftImages.map(async image => {
      const fingerprint = await loadFingerprint(image.src);
      return [normalizeAltText(image.alt), fingerprint ? encodeFingerprint(fingerprint) : null] as const;
    })).then(pairs => {
      if (!cancelled) setState({ key, fingerprints: Object.fromEntries(pairs) });
    });
    return () => { cancelled = true; };
  }, [key, state.key, draftImages]);
  return { fingerprints: state.fingerprints, pending: key !== state.key };
}

/**
 * Fetches the missing fingerprints of saved entries, a few at a time, and
 * merges them into the library. New entries saved from the panel and
 * imported or pre-fingerprint entries are all filled in here; a source that
 * cannot be read is attempted once per session.
 */
export function useImageLibraryFingerprintBackfill(
  library: ImageLibraryEntry[],
  setLibrary: (update: (previous: ImageLibraryEntry[]) => ImageLibraryEntry[]) => void,
  enabled: boolean
) {
  const attempted = useRef(new Set<string>());
  useEffect(() => {
    if (!enabled) return;
    const missing = library
      .filter(entry => !entry.fp && !attempted.current.has(entry.src))
      .slice(0, 10);
    if (missing.length === 0) return;
    missing.forEach(entry => attempted.current.add(entry.src));
    let cancelled = false;
    Promise.all(missing.map(async entry => {
      const fingerprint = await loadFingerprint(entry.src);
      return { src: entry.src, fp: fingerprint ? encodeFingerprint(fingerprint) : null };
    })).then(results => {
      if (cancelled) return;
      const bySrc = new Map(results.filter(result => result.fp).map(result => [result.src, result.fp as string]));
      if (bySrc.size === 0) return;
      setLibrary(previous => previous.map(entry =>
        !entry.fp && bySrc.has(entry.src) ? { ...entry, fp: bySrc.get(entry.src) } : entry
      ));
    });
    return () => { cancelled = true; };
  }, [enabled, library, setLibrary]);
}
