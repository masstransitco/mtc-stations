"use client";

import { useEffect } from "react";

/**
 * Hook to lock body scroll using position:fixed technique
 * Prevents iOS from scrolling the body when keyboard appears
 * Based on mtc-app reference implementation
 *
 * @param isActive Whether the scroll lock should be active
 */
export function useBodyScrollLock(isActive: boolean = true) {
  useEffect(() => {
    if (isActive) {
      // Calculate scrollbar width to prevent layout shift
      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;

      // Save original styles
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      const originalTop = document.body.style.top;
      const originalWidth = document.body.style.width;
      const originalPaddingRight = document.body.style.paddingRight;

      // Get current scroll position before locking
      const scrollY = window.scrollY;

      // Apply scroll lock with position:fixed for iOS compatibility
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";

      // Add padding to prevent layout shift when scrollbar disappears
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }

      // Clean up when the effect is re-run or the component unmounts
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.top = originalTop;
        document.body.style.width = originalWidth;
        document.body.style.paddingRight = originalPaddingRight;

        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [isActive]);
}
