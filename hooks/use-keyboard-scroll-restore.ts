"use client";

import { useRef, useCallback, useEffect, RefObject } from "react";

interface UseKeyboardScrollRestoreOptions {
  sheetContentRef?: RefObject<HTMLElement>;
  /** Threshold as percentage of baseline height (default 0.15 = 15%) */
  thresholdRatio?: number;
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
 * - Handles orientation changes by detecting width changes
 */
export function useKeyboardScrollRestore(options: UseKeyboardScrollRestoreOptions = {}) {
  const { sheetContentRef, thresholdRatio = 0.15 } = options;

  // Scroll position refs
  const lastWindowScrollX = useRef(0);
  const lastWindowScrollY = useRef(0);
  const lastSheetScroll = useRef(0);

  // Viewport tracking refs
  const baselineHeight = useRef<number | undefined>(undefined);
  const baselineWidth = useRef<number | undefined>(undefined);
  const keyboardOpen = useRef(false);
  const inputFocused = useRef(false);

  // RAF refs for coalescing
  const restoreRaf = useRef<number | undefined>(undefined);
  const resizeRaf = useRef<number | undefined>(undefined);

  // Timeout ref for blur handler
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
      const currentWidth = vv?.width ?? window.innerWidth;

      // Initialize baseline if not set
      if (baselineHeight.current === undefined) {
        baselineHeight.current = currentHeight;
        baselineWidth.current = currentWidth;
      }

      // Detect orientation change: width changed significantly
      // Reset baseline and keyboard state on orientation change
      if (baselineWidth.current !== undefined) {
        const widthChange = Math.abs(currentWidth - baselineWidth.current);
        if (widthChange > 50) {
          // Orientation changed - reset everything
          baselineHeight.current = currentHeight;
          baselineWidth.current = currentWidth;
          keyboardOpen.current = false;
          return;
        }
      }

      const baseline = baselineHeight.current;
      // Use relative threshold based on baseline height
      const threshold = baseline * thresholdRatio;

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
    });
  }, [scheduleRestore, thresholdRatio]);

  // Setup resize listeners
  useEffect(() => {
    const vv = window.visualViewport;
    const initialHeight = vv?.height ?? window.innerHeight;
    const initialWidth = vv?.width ?? window.innerWidth;

    // Initialize with current viewport dimensions to avoid first-resize bug
    baselineHeight.current = initialHeight;
    baselineWidth.current = initialWidth;

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
      // Cleanup blur timeout
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, [handleResize]);

  // onFocus handler - capture scroll positions and update baseline
  const onFocus = useCallback(() => {
    // Clear any pending blur timeout (user moved to another input)
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = undefined;
    }

    inputFocused.current = true;

    const vv = window.visualViewport;
    const currentHeight = vv?.height ?? window.innerHeight;
    const currentWidth = vv?.width ?? window.innerWidth;

    // Update baseline to current dimensions (fresh baseline pre-keyboard)
    // This handles orientation changes and avoids stale baseline values
    baselineHeight.current = currentHeight;
    baselineWidth.current = currentWidth;

    // Capture current scroll positions
    lastWindowScrollX.current = window.scrollX;
    lastWindowScrollY.current = window.scrollY;
    lastSheetScroll.current = sheetContentRef?.current?.scrollTop ?? 0;
  }, [sheetContentRef]);

  // onBlur handler - schedule restore with delay to catch manual dismiss
  const onBlur = useCallback(() => {
    inputFocused.current = false;

    // Clear any existing blur timeout
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }

    // Use a short timeout to handle cases where blur fires before the final
    // viewport resize event (e.g., manual keyboard dismiss)
    blurTimeoutRef.current = setTimeout(() => {
      blurTimeoutRef.current = undefined;

      // Only restore if keyboard was open and is now closed
      // Check current viewport height against baseline to verify keyboard is actually closed
      const vv = window.visualViewport;
      const currentHeight = vv?.height ?? window.innerHeight;
      const baseline = baselineHeight.current ?? currentHeight;
      const threshold = baseline * thresholdRatio;

      // Only restore if viewport height is back near baseline (keyboard closed)
      if (currentHeight >= baseline - threshold) {
        keyboardOpen.current = false;
        scheduleRestore();
      }
    }, 200);
  }, [scheduleRestore, thresholdRatio]);

  return { onFocus, onBlur };
}
