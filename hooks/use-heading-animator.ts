"use client";

import { useRef, useCallback, useEffect } from "react";

// Ease-out cubic for natural deceleration
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// Normalize heading to 0-360 range
const norm360 = (h: number) => ((h % 360) + 360) % 360;

// Calculate shortest angular delta in [-180, 180]
// e.g., 350° to 10° returns +20° (not -340°)
const shortestDelta = (from: number, to: number) =>
  ((to - from + 540) % 360) - 180;

interface UseHeadingAnimatorOptions {
  /** Animation duration in milliseconds. Default: 140ms */
  durationMs?: number;
  /** Minimum delta to trigger animation. Default: 0.5 degrees */
  minDelta?: number;
}

/**
 * Hook that provides smooth animated heading transitions for Google Maps.
 * Instead of snapping instantly, interpolates over multiple frames with easing.
 */
export function useHeadingAnimator(
  map: google.maps.Map | null,
  options: UseHeadingAnimatorOptions = {}
) {
  const { durationMs = 140, minDelta = 0.5 } = options;

  const rafRef = useRef<number | null>(null);
  const startHeadingRef = useRef(0);
  const deltaRef = useRef(0);
  const startTimeRef = useRef(0);

  // Cancel any in-progress animation
  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Animate to target heading
  const setHeadingSmooth = useCallback(
    (target: number) => {
      if (!map) return;

      // Cancel any existing animation
      stop();

      const start = norm360(map.getHeading() ?? 0);
      const end = norm360(target);
      const delta = shortestDelta(start, end);

      // If change is tiny, snap directly
      if (Math.abs(delta) < minDelta) {
        map.setHeading(end);
        return;
      }

      startHeadingRef.current = start;
      deltaRef.current = delta;
      startTimeRef.current = performance.now();

      const tick = () => {
        const elapsed = performance.now() - startTimeRef.current;
        const t = Math.min(1, elapsed / durationMs);
        const eased = easeOutCubic(t);
        const nextHeading = norm360(
          startHeadingRef.current + deltaRef.current * eased
        );

        map.setHeading(nextHeading);

        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          rafRef.current = null;
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    [map, durationMs, minDelta, stop]
  );

  // Clean up on unmount
  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { setHeadingSmooth, stop };
}
