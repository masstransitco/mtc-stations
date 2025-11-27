"use client";

import { useEffect, useRef } from "react";

/**
 * Hook to restore scroll position when iOS keyboard is dismissed
 * Addresses iOS Chrome's viewport shift issues when keyboard appears/disappears
 *
 * Based on mtc-app reference implementation - simple and effective
 */
export function useKeyboardScrollRestore() {
  const previousViewportHeightRef = useRef<number>(0);
  const isIOSRef = useRef<boolean>(false);

  useEffect(() => {
    // Detect iOS
    isIOSRef.current = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (!isIOSRef.current || !window.visualViewport) return;

    const handleResize = () => {
      // When viewport height increases (keyboard dismissed), restore scroll
      if (window.visualViewport!.height > previousViewportHeightRef.current) {
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
      }
      previousViewportHeightRef.current = window.visualViewport!.height;
    };

    // Initialize with current height
    previousViewportHeightRef.current = window.visualViewport.height;

    window.visualViewport.addEventListener("resize", handleResize);

    return () => {
      window.visualViewport?.removeEventListener("resize", handleResize);
    };
  }, []);

  const restoreScroll = () => {
    if (!isIOSRef.current) return;

    // Force scroll to top after a small delay to allow browser to settle
    setTimeout(() => {
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    }, 100);
  };

  return { restoreScroll };
}
