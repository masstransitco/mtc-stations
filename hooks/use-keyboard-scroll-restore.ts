"use client";

import { useRef, useCallback, useEffect, RefObject } from "react";

interface UseKeyboardScrollRestoreOptions {
  sheetContentRef?: RefObject<HTMLElement>;
  threshold?: number;
}

/**
 * Hook to handle scroll position restoration when mobile keyboard opens/closes.
 * Works on both iOS and Android by using visualViewport API with fallback.
 *
 * Key features:
 * - Captures window and bottom sheet scroll positions on input focus
 * - Detects keyboard open/close via viewport height changes
 * - Restores scroll positions when keyboard is dismissed
 * - Uses requestAnimationFrame to coalesce resize events and avoid race conditions
 * - Handles manual keyboard dismiss (swipe down, tap outside)
 */
export function useKeyboardScrollRestore(options: UseKeyboardScrollRestoreOptions = {}) {
  const { sheetContentRef, threshold = 100 } = options;

  // Scroll position refs
  const lastWindowScrollX = useRef(0);
  const lastWindowScrollY = useRef(0);
  const lastSheetScroll = useRef(0);

  // Viewport tracking refs
  const baselineHeight = useRef<number | undefined>(undefined);
  const prevHeight = useRef<number | undefined>(undefined);
  const keyboardOpen = useRef(false);

  // RAF refs for coalescing
  const restoreRaf = useRef<number | undefined>(undefined);
  const resizeRaf = useRef<number | undefined>(undefined);

  // Schedule scroll restoration with RAF to avoid multiple calls
  const scheduleRestore = useCallback(() => {
    if (restoreRaf.current) return;

    restoreRaf.current = requestAnimationFrame(() => {
      restoreRaf.current = undefined;

      // Restore window scroll
      window.scrollTo({
        top: lastWindowScrollY.current,
        left: lastWindowScrollX.current,
        behavior: "auto"
      });

      // Also set these directly for iOS Safari compatibility
      document.body.scrollTop = lastWindowScrollY.current;
      document.documentElement.scrollTop = lastWindowScrollY.current;

      // Restore bottom sheet content scroll if ref provided
      if (sheetContentRef?.current) {
        sheetContentRef.current.scrollTo({
          top: lastSheetScroll.current,
          left: 0,
          behavior: "auto"
        });
      }
    });
  }, [sheetContentRef]);

  // Handle viewport resize events
  const handleResize = useCallback(() => {
    // Cancel any pending resize handler
    if (resizeRaf.current) {
      cancelAnimationFrame(resizeRaf.current);
    }

    resizeRaf.current = requestAnimationFrame(() => {
      const vv = window.visualViewport;
      const currentHeight = vv?.height ?? window.innerHeight;

      // Initialize baseline if not set
      if (baselineHeight.current === undefined) {
        baselineHeight.current = currentHeight;
      }

      const baseline = baselineHeight.current;

      // Detect keyboard closing: was open and height is now near baseline
      const isClosing = keyboardOpen.current && currentHeight >= baseline - threshold;

      // Detect keyboard opening: height decreased significantly below baseline
      const isOpening = currentHeight < baseline - threshold;

      if (isOpening && !keyboardOpen.current) {
        keyboardOpen.current = true;
      }

      if (isClosing) {
        keyboardOpen.current = false;
        scheduleRestore();
      }

      prevHeight.current = currentHeight;
    });
  }, [scheduleRestore, threshold]);

  // Setup resize listeners
  useEffect(() => {
    const vv = window.visualViewport;
    const initialHeight = vv?.height ?? window.innerHeight;

    // Initialize with current viewport height to avoid first-resize bug
    baselineHeight.current = initialHeight;
    prevHeight.current = initialHeight;

    // Listen to visualViewport resize (preferred, more accurate)
    if (vv) {
      vv.addEventListener("resize", handleResize, { passive: true });
    }

    // Also listen to window resize as fallback
    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      if (vv) {
        vv.removeEventListener("resize", handleResize);
      }
      window.removeEventListener("resize", handleResize);

      // Cleanup pending RAF
      if (resizeRaf.current) {
        cancelAnimationFrame(resizeRaf.current);
      }
      if (restoreRaf.current) {
        cancelAnimationFrame(restoreRaf.current);
      }
    };
  }, [handleResize]);

  // onFocus handler - capture scroll positions and update baseline
  const onFocus = useCallback(() => {
    const vv = window.visualViewport;
    const currentHeight = vv?.height ?? window.innerHeight;

    // Update baseline to current height (fresh baseline pre-keyboard)
    // This handles orientation changes and avoids stale baseline values
    baselineHeight.current = currentHeight;

    // Capture current scroll positions
    lastWindowScrollX.current = window.scrollX;
    lastWindowScrollY.current = window.scrollY;
    lastSheetScroll.current = sheetContentRef?.current?.scrollTop ?? 0;
  }, [sheetContentRef]);

  // onBlur handler - schedule restore with delay to catch manual dismiss
  const onBlur = useCallback(() => {
    // Use a short timeout to handle cases where blur fires before the final
    // viewport resize event (e.g., manual keyboard dismiss)
    setTimeout(() => {
      scheduleRestore();
    }, 150);
  }, [scheduleRestore]);

  return { onFocus, onBlur };
}
