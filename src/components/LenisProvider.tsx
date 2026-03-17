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

    // Check if element should be ignored by Lenis
    const shouldIgnoreElement = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof Element)) return false;
      return target.hasAttribute('data-lenisIgnore') || 
             target.closest('[data-lenisIgnore]') !== null;
    };

    // Listen to wheel events at window level to intercept before Lenis
    // This is more reliable than overriding lenis.onWheel
    const wheelHandler = (e: WheelEvent) => {
      if (shouldIgnoreElement(e.target)) {
        e.stopImmediatePropagation();
        // Also prevent Lenis from seeing this event by stopping propagation
        e.stopPropagation();
      }
    };
    
    // Use capture phase to run before Lenis's listener
    window.addEventListener('wheel', wheelHandler, { capture: true });

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
      window.removeEventListener('wheel', wheelHandler, { capture: true });
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
