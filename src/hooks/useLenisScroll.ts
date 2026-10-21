import { useEffect, useRef, useCallback } from "react";
import Lenis from "lenis";

/**
 * Options for the Lenis scroll instance
 */
export interface UseLenisOptions {
  /**
   * Scroll duration in seconds
   * @default 1.2
   */
  duration?: number;
  /**
   * Easing function name
   * @default 'easeOutQuart'
   */
  easing?: (t: number) => number;
  /**
   * Orientation of scroll
   * @default 'vertical'
   */
  orientation?: "vertical" | "horizontal";
  /**
   * Gesture orientation
   * @default 'vertical'
   */
  gestureOrientation?: "vertical" | "horizontal";
  /**
   * Mouse wheel smooth scroll
   * @default true
   */
  smoothWheel?: boolean;
  /**
   * Touch smooth scroll
   * @default true
   */
  smoothTouch?: boolean;
  /**
   * Normalize wheel scroll
   * @default false
   */
  normalizeWheel?: boolean;
  /**
   * Smooth scroll on document ready
   * @default true
   */
  smooth?: boolean;
  /**
   * Callback when requestAnimationFrame fires
   */
  on?: (instance: Lenis) => void;
  /**
   * Error callback
   */
  errorCallback?: (error: Error) => void;
  /**
   * Class name for the root element
   * @default 'lenis'
   */
  className?: string;
  /**
   * The scroll wrapper
   * @default window
   */
  wrapper?: Window | HTMLElement;
  /**
   * The scroll content
   * @default document.documentElement
   */
  content?: HTMLElement;
  /**
   * Auto-resize on window resize
   * @default true
   */
  resize?: boolean;
  /**
   * Use transform for position
   * @default false
   */
  transform?: boolean;
  /**
   * Use requestAnimationFrame
   * @default true
   */
  rafRaf?: (callback: FrameRequestCallback) => number;
  /**
   * Cancel requestAnimationFrame
   * @default cancelAnimationFrame
   */
  rafCancel?: (id: number) => void;
}

/**
 * useLenisScroll - A React hook for smooth scrolling with Lenis
 * 
 * @param options - Configuration options for Lenis
 * @returns { lenis: Lenis | null, isReady: boolean }
 * 
 * @example
 * // Basic usage on a container
 * const { lenis, isReady } = useLenisScroll({
 *   wrapper: scrollRef.current,
 *   content: scrollRef.current,
 * });
 * 
 * @example
 * // Global smooth scroll on window
 * const { lenis, isReady } = useLenisScroll();
 */
export function useLenisScroll(options: UseLenisOptions = {}) {
  const lenisRef = useRef<Lenis | null>(null);
  const isReadyRef = useRef(false);

  const {
    duration = 1.2,
    easing = (t) => 1 - Math.pow(1 - t, 4),
    orientation = "vertical",
    gestureOrientation = "vertical",
    smoothWheel = true,
    smoothTouch = false,
    wrapper = typeof window !== "undefined" ? window : undefined,
    content = typeof window !== "undefined" ? document.documentElement : undefined,
    resize = true,
    errorCallback,
  } = options;

  const initLenis = useCallback(() => {
    if (lenisRef.current) return;

    try {
      const lenis = new Lenis({
        duration,
        easing,
        orientation,
        gestureOrientation,
        smoothWheel,
        // Lenis 1.x renamed smoothTouch and resize to syncTouch and autoResize, and
        // has no normalizeWheel, smooth, className, transform or on option.
        syncTouch: smoothTouch,
        wrapper,
        content,
        autoResize: resize,
      });

      lenisRef.current = lenis;
      isReadyRef.current = true;
    } catch (error) {
      if (errorCallback && error instanceof Error) {
        errorCallback(error);
      }
    }
  }, [
    duration,
    easing,
    orientation,
    gestureOrientation,
    smoothWheel,
    smoothTouch,
    wrapper,
    content,
    resize,
    errorCallback,
  ]);

  useEffect(() => {
    initLenis();

    return () => {
      if (lenisRef.current) {
        lenisRef.current.destroy();
        lenisRef.current = null;
        isReadyRef.current = false;
      }
    };
  }, [initLenis]);

  return {
    lenis: lenisRef.current,
    isReady: isReadyRef.current,
  };
}

export default useLenisScroll;
