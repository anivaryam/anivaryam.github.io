import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { findDraftImages, mergeImageLibrary, parseImageLibraryJson, reconcileImageLibrary, type DraftFingerprints, type ImageLibraryEntry } from "@/lib/word-to-html/image-library";
import { encodeFingerprint, isCurrentFingerprint, loadFingerprint } from "@/lib/word-to-html/image-fingerprint";
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
  const persisted = useRef<{ json: string; library: ImageLibraryEntry[] }>({ json: "", library: [] });
  const mounted = useRef(false);
  const writeGeneration = useRef(0);
  const [library, setLibrary] = useState<ImageLibraryEntry[]>(() => {
    const parsed = parseImageLibraryJson(readStorage(IMAGE_LIBRARY_KEY) || "[]");
    persisted.current = { json: JSON.stringify(parsed), library: parsed };
    // Older libraries could save the same source under several descriptions.
    return mergeImageLibrary([], parsed).library;
  });
  // A quota failure loses the change on reload, so it is reported, once per
  // failing stretch; blocked storage stays silent as the session-only mode.
  const quotaReported = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const receiveChanges = (event: StorageEvent) => {
      if (event.key !== IMAGE_LIBRARY_KEY && event.key !== null) return;
      const json = readStorage(IMAGE_LIBRARY_KEY) || "[]";
      if (json === persisted.current.json) return;
      const before = persisted.current.library;
      const latest = mergeImageLibrary([], parseImageLibraryJson(json)).library;
      persisted.current = { json: JSON.stringify(latest), library: latest };
      setLibrary(current => reconcileImageLibrary(before, current, latest));
    };
    window.addEventListener("storage", receiveChanges);
    return () => {
      mounted.current = false;
      window.removeEventListener("storage", receiveChanges);
    };
  }, []);
  useEffect(() => {
    const generation = ++writeGeneration.current;
    const json = JSON.stringify(library);
    if (json === persisted.current.json) return;
    const before = persisted.current.library;
    const save = () => {
      // A newer render carries all pending edits. On unmount, finish the last
      // queued save instead of dropping a user's click while waiting for a lock.
      if (generation !== writeGeneration.current) return;
      const latest = parseImageLibraryJson(readStorage(IMAGE_LIBRARY_KEY) || "[]");
      const merged = reconcileImageLibrary(before, library, latest);
      const mergedJson = JSON.stringify(merged);
      const result = writeStorage(IMAGE_LIBRARY_KEY, mergedJson);
      if (result === "saved") {
        persisted.current = { json: mergedJson, library: merged };
        quotaReported.current = false;
        if (mounted.current && mergedJson !== json) {
          setLibrary(current => reconcileImageLibrary(library, current, merged));
        }
      } else if (result === "quota" && !quotaReported.current) {
        quotaReported.current = true;
        toast({
          title: "Image library not saved",
          description: "Browser storage is full, so this change lasts only until reload. Remove some images, or export the library as a backup.",
          variant: "destructive",
        });
      }
    };
    // Modern HTTPS browsers serialize the read/merge/write across tabs. The
    // synchronous fallback still merges stale snapshots where locks are absent.
    if (navigator.locks?.request) {
      void navigator.locks.request(IMAGE_LIBRARY_KEY, save).catch(() => {
        if (generation === writeGeneration.current) toast({ title: "Image library not saved", description: "Browser storage could not be updated. Export the library as a backup.", variant: "destructive" });
      });
    } else save();
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
    const controller = new AbortController();
    Promise.all(draftImages.map(async image => {
      const fingerprint = image.src ? await loadFingerprint(image.src, controller.signal) : null;
      return { ...image, fp: fingerprint ? encodeFingerprint(fingerprint) : null };
    })).then(fingerprints => {
      if (!cancelled) startTransition(() => setState({ key, fingerprints }));
    });
    return () => { cancelled = true; controller.abort(); };
  }, [key, state.key, draftImages]);
  const pending = key !== state.key;
  return useMemo(() => ({ fingerprints: state.fingerprints, pending }), [state.fingerprints, pending]);
}

/**
 * Fetches the missing fingerprints of saved entries, a few at a time, and
 * merges them into the library. New entries saved from the panel and
 * imported or pre-fingerprint entries are all filled in here. Unreadable
 * sources get two delayed retries; re-enabling allows another attempt cycle.
 * Cancelled batches remain eligible, and failures never block new sources.
 */
export function useImageLibraryFingerprintBackfill(
  library: ImageLibraryEntry[],
  setLibrary: (update: (previous: ImageLibraryEntry[]) => ImageLibraryEntry[]) => void,
  enabled: boolean
) {
  const failures = useRef(new Map<string, { attempts: number; retryAt: number }>());
  const [batch, setBatch] = useState(0);
  useEffect(() => {
    if (!enabled) {
      failures.current.clear();
      return;
    }
    const sources = new Set(library.filter(entry => !isCurrentFingerprint(entry.fp)).map(entry => entry.src));
    for (const src of failures.current.keys()) {
      if (!sources.has(src)) failures.current.delete(src);
    }
    const now = Date.now();
    let nextRetryAt = Infinity;
    const missing = Array.from(sources).filter(src => {
      const failure = failures.current.get(src);
      if (!failure) return true;
      if (failure.attempts >= 3) return false;
      if (failure.retryAt <= now) return true;
      nextRetryAt = Math.min(nextRetryAt, failure.retryAt);
      return false;
    }).slice(0, 10);
    if (missing.length === 0) {
      if (!Number.isFinite(nextRetryAt)) return;
      const timer = setTimeout(() => setBatch(previous => previous + 1), nextRetryAt - now);
      return () => clearTimeout(timer);
    }
    let cancelled = false;
    const controller = new AbortController();
    Promise.all(missing.map(async src => {
      const fingerprint = await loadFingerprint(src, controller.signal);
      return { src, fp: fingerprint ? encodeFingerprint(fingerprint) : null };
    })).then(results => {
      if (cancelled) return;
      // A cancelled effect must not suppress the replacement effect's work.
      results.forEach(({ src, fp }) => {
        if (fp) failures.current.delete(src);
        else {
          const attempts = (failures.current.get(src)?.attempts || 0) + 1;
          failures.current.set(src, { attempts, retryAt: Date.now() + 1000 * attempts });
        }
      });
      const bySrc = new Map(results.filter(result => result.fp).map(result => [result.src, result.fp as string]));
      startTransition(() => {
        if (bySrc.size > 0) {
          setLibrary(previous => previous.map(entry =>
            !isCurrentFingerprint(entry.fp) && bySrc.has(entry.src) ? { ...entry, fp: bySrc.get(entry.src) } : entry
          ));
        }
        // Failed batches do not change the library, so advance explicitly.
        setBatch(previous => previous + 1);
      });
    });
    return () => { cancelled = true; controller.abort(); };
  }, [enabled, library, setLibrary, batch]);
}
