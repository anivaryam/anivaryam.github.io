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
   * Selector for the wrapper element
   * @default 'html'
   */
  wrapper?: Window | HTMLElement | string;
  /**
   * Selector for the content element
   * @default 'html, body'
   */
  content?: string | HTMLElement | Window;
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
    normalizeWheel = false,
    smooth = true,
    className = "lenis",
    wrapper = typeof window !== "undefined" ? window : undefined,
    content = typeof window !== "undefined" ? document.documentElement : undefined,
    resize = true,
    transform = false,
    errorCallback,
    on,
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
        smoothTouch,
        normalizeWheel,
        smooth,
        className,
        wrapper,
        content,
        resize,
        transform,
        on,
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
    normalizeWheel,
    smooth,
    className,
    wrapper,
    content,
    resize,
    transform,
    on,
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
