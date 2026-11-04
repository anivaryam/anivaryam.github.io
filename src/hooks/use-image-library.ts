import { useEffect, useMemo, useRef, useState } from "react";
import { findDraftImages, mergeImageLibrary, parseImageLibraryJson, type DraftFingerprints, type ImageLibraryEntry } from "@/lib/word-to-html/image-library";
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
    // Older libraries could save the same source under several descriptions.
    return mergeImageLibrary([], parsed).library;
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
 * off. An unreadable image records null and is never matched by its alt text.
 */
export function useDraftImageFingerprints(inputHtml: string, enabled: boolean) {
  const [state, setState] = useState<{ key: string; fingerprints: DraftFingerprints }>({ key: "[]", fingerprints: [] });
  const draftImages = useMemo(() => (enabled && inputHtml ? findDraftImages(inputHtml) : []), [enabled, inputHtml]);
  // Compare full sources: equal-length data URIs can differ only in the middle.
  // Alt text is deliberately absent from both discovery records and this key.
  const key = useMemo(() => JSON.stringify(draftImages), [draftImages]);
  useEffect(() => {
    if (key === state.key) return;
    if (draftImages.length === 0) {
      setState({ key, fingerprints: [] });
      return;
    }
    let cancelled = false;
    Promise.all(draftImages.map(async image => {
      const fingerprint = image.src ? await loadFingerprint(image.src) : null;
      return { ...image, fp: fingerprint ? encodeFingerprint(fingerprint) : null };
    })).then(fingerprints => {
      if (!cancelled) setState({ key, fingerprints });
    });
    return () => { cancelled = true; };
  }, [key, state.key, draftImages]);
  const pending = key !== state.key;
  return useMemo(() => ({ fingerprints: state.fingerprints, pending }), [state.fingerprints, pending]);
}

/**
 * Fetches the missing fingerprints of saved entries, a few at a time, and
 * merges them into the library. New entries saved from the panel and
 * imported or pre-fingerprint entries are all filled in here; a source that
 * cannot be read is attempted once per session. Cancelled batches remain
 * eligible for retry; completing a failed batch still advances the queue.
 */
export function useImageLibraryFingerprintBackfill(
  library: ImageLibraryEntry[],
  setLibrary: (update: (previous: ImageLibraryEntry[]) => ImageLibraryEntry[]) => void,
  enabled: boolean
) {
  const completed = useRef(new Set<string>());
  const [batch, setBatch] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const missing = Array.from(new Set(library
      .filter(entry => !entry.fp && !completed.current.has(entry.src))
      .map(entry => entry.src))).slice(0, 10);
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map(async src => {
      const fingerprint = await loadFingerprint(src);
      return { src, fp: fingerprint ? encodeFingerprint(fingerprint) : null };
    })).then(results => {
      if (cancelled) return;
      // A cancelled effect must not suppress the replacement effect's work.
      results.forEach(result => completed.current.add(result.src));
      const bySrc = new Map(results.filter(result => result.fp).map(result => [result.src, result.fp as string]));
      if (bySrc.size > 0) {
        setLibrary(previous => previous.map(entry =>
          !entry.fp && bySrc.has(entry.src) ? { ...entry, fp: bySrc.get(entry.src) } : entry
        ));
      }
      // Failed batches do not change the library, so advance explicitly.
      setBatch(previous => previous + 1);
    });
    return () => { cancelled = true; };
  }, [enabled, library, setLibrary, batch]);
}
