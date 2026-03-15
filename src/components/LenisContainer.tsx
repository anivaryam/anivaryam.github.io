import React, { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import Lenis from "lenis";

/**
 * Props for LenisContainer component
 */
export interface LenisContainerProps extends React.HTMLAttributes<HTMLDivElement> {
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
   * Gesture orientation
   * @default 'vertical'
   */
  gestureOrientation?: "vertical" | "horizontal";
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
   * Class name to add to the container
   * @default 'lenis-container'
   */
  className?: string;
  /**
   * Children to render
   */
  children: React.ReactNode;
  /**
   * Callback when Lenis is ready
   */
  onReady?: (lenis: Lenis) => void;
}

/**
 * Exposed methods via ref
 */
export interface LenisContainerRef {
  /**
   * Get the Lenis instance
   */
  getLenis: () => Lenis | null;
  /**
   * Start scrolling
   */
  start: () => void;
  /**
   * Stop scrolling
   */
  stop: () => void;
  /**
   * Scroll to a specific position
   */
  scrollTo: (target: number | string | HTMLElement) => void;
}

/**
 * LenisContainer - A wrapper component that adds smooth scrolling to any scrollable element
 * 
 * @example
 * <LenisContainer className="overflow-y-auto">
 *   <div>Scrollable content here</div>
 * </LenisContainer>
 * 
 * @example
 * // With ref for programmatic control
 * const containerRef = useRef<LenisContainerRef>(null);
 * 
 * <LenisContainer ref={containerRef} className="overflow-y-auto">
 *   <div>Content</div>
 * </LenisContainer>
 * 
 * // Later, to scroll programmatically:
 * containerRef.current?.scrollTo(0);
 */
export const LenisContainer = forwardRef<LenisContainerRef, LenisContainerProps>(
  (
    {
      enabled = true,
      duration = 1.2,
      easing = (t) => 1 - Math.pow(1 - t, 4),
      gestureOrientation = "vertical",
      smoothWheel = true,
      smoothTouch = false,
      className = "",
      children,
      onReady,
      style,
      ...props
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const lenisRef = useRef<Lenis | null>(null);

    useImperativeHandle(ref, () => ({
      getLenis: () => lenisRef.current,
      start: () => lenisRef.current?.start(),
      stop: () => lenisRef.current?.stop(),
      scrollTo: (target) => lenisRef.current?.scrollTo(target),
    }));

    useEffect(() => {
      if (!enabled || !containerRef.current) {
        return;
      }

      // Create Lenis instance scoped to this container
      // Use the container as both wrapper and content since it's the scrolling element
      lenisRef.current = new Lenis({
        duration,
        easing,
        gestureOrientation,
        smoothWheel,
        smoothTouch,
        wrapper: containerRef.current,
        content: containerRef.current,
        smooth: true,
        className: "lenis",
      });

      // Notify when ready
      if (onReady) {
        onReady(lenisRef.current);
      }

      // Cleanup
      return () => {
        if (lenisRef.current) {
          lenisRef.current.destroy();
          lenisRef.current = null;
        }
      };
    }, [
      enabled,
      duration,
      easing,
      gestureOrientation,
      smoothWheel,
      smoothTouch,
      onReady,
    ]);

    // Keep Lenis RAF in sync with React
    useEffect(() => {
      if (!enabled || !lenisRef.current) return;

      const lenis = lenisRef.current;

      function raf(time: number) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }

      const animationId = requestAnimationFrame(raf);

      return () => {
        cancelAnimationFrame(animationId);
      };
    }, [enabled]);

    return (
      <div
        ref={containerRef}
        className={`lenis-container ${className}`}
        style={style}
        {...props}
      >
        <div ref={contentRef} className="lenis-content">
          {children}
        </div>
      </div>
    );
  }
);

LenisContainer.displayName = "LenisContainer";

export default LenisContainer;
