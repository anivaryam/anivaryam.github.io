import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import Lenis from "lenis";

/**
 * Context value type
 */
interface LenisContextValue {
  lenis: Lenis | null;
  isReady: boolean;
}

/**
 * Default context value
 */
const LenisContext = createContext<LenisContextValue>({
  lenis: null,
  isReady: false,
});

/**
 * Use the global Lenis instance
 */
export function useLenis() {
  return useContext(LenisContext);
}

/**
 * Options for LenisProvider
 */
export interface LenisProviderProps {
  /**
   * Whether to enable smooth scrolling
   * @default true
   */
  enabled?: boolean;
  /**
   * Scroll duration in seconds
   * @default 1.2
   */
  duration?: number;
  /**
   * Easing function
   * @default easeOutQuart
   */
  easing?: (t: number) => number;
  /**
   * Enable smooth wheel
   * @default true
   */
  smoothWheel?: boolean;
  /**
   * Enable smooth touch
   * @default false
   */
  smoothTouch?: boolean;
  /**
   * Normalize wheel
   * @default false
   */
  normalizeWheel?: boolean;
  /**
   * Children to render
   */
  children: React.ReactNode;
}

/**
 * LenisProvider - A global provider that enables smooth scrolling across the entire app
 * 
 * This should be placed at the root of your app to enable smooth scrolling globally.
 * 
 * @example
 * // In your App.tsx or main entry file
 * <LenisProvider duration={1.2} smoothWheel>
 *   <App />
 * </LenisProvider>
 */
export function LenisProvider({
  enabled = true,
  duration = 1.2,
  easing = (t) => 1 - Math.pow(1 - t, 4),
  smoothWheel = true,
  smoothTouch = false,
  normalizeWheel = false,
  children,
}: LenisProviderProps) {
  const lenisRef = useRef<Lenis | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Create global Lenis instance
    const lenis = new Lenis({
      duration,
      easing,
      smoothWheel,
      smoothTouch,
      normalizeWheel,
      smooth: true,
      className: "lenis",
    });

    // Handle scroll events - ignore elements with data-lenisIgnore attribute
    lenis.on('scroll', (e) => {
      // Check if the scroll target has data-lenisIgnore
      const target = e.target;
      if (target instanceof Element && target.hasAttribute('data-lenisIgnore')) {
        e.stopPropagation();
      }
    });

    // Override wheel event handler to ignore specific elements
    const originalWheel = lenis.onWheel;
    lenis.onWheel = function(e) {
      // Check if event target should be ignored
      const target = e.target;
      if (target instanceof Element) {
        const ignoreElement = target.closest('[data-lenisIgnore]');
        if (ignoreElement) {
          return; // Let native scroll work
        }
      }
      // @ts-ignore - call original handler
      originalWheel?.call(this, e);
    };

    lenisRef.current = lenis;
    setIsReady(true);

    // Animation loop
    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    const animationId = requestAnimationFrame(raf);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      lenis.destroy();
      lenisRef.current = null;
      setIsReady(false);
    };
  }, [enabled, duration, easing, smoothWheel, smoothTouch, normalizeWheel]);

  return (
    <LenisContext.Provider value={{ lenis: lenisRef.current, isReady }}>
      {children}
    </LenisContext.Provider>
  );
}

export default LenisProvider;
