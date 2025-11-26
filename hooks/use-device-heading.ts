"use client";

import { useEffect, useRef, useState, useCallback } from 'react';

// Extend DeviceOrientationEvent to include webkit properties
interface DeviceOrientationEventWithWebkit extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

interface UseDeviceHeadingOptions {
  enabled?: boolean;
  /** Smoothing factor (0-1). Higher = more smoothing, slower response. Default: 0.3 */
  smoothingFactor?: number;
  /** Minimum heading change in degrees to trigger an update. Default: 1.5 */
  minDelta?: number;
  /** Target updates per second. Default: 20 (every 50ms) */
  targetFps?: number;
}

// Calculate shortest angular distance between two angles
function angleDelta(from: number, to: number): number {
  let delta = to - from;
  // Normalize to -180 to 180
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

// Exponential moving average for smooth heading
function smoothHeading(current: number, target: number, factor: number): number {
  const delta = angleDelta(current, target);
  let result = current + delta * factor;
  // Normalize to 0-360
  while (result < 0) result += 360;
  while (result >= 360) result -= 360;
  return result;
}

export function useDeviceHeading(options: UseDeviceHeadingOptions = {}) {
  const {
    enabled = false,
    smoothingFactor = 0.3,
    minDelta = 1.5,
    targetFps = 20
  } = options;

  const [heading, setHeading] = useState<number | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listenerAttachedRef = useRef(false);

  // Refs for smoothing logic
  const rawHeadingRef = useRef<number | null>(null);
  const smoothedHeadingRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastEmittedHeadingRef = useRef<number | null>(null);

  const minUpdateInterval = 1000 / targetFps;

  // Request permission for iOS 13+ devices
  const requestPermission = async (): Promise<boolean> => {
    // Check if we're on iOS and need permission
    if (
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        const granted = permission === 'granted';
        setPermissionGranted(granted);
        return granted;
      } catch (err) {
        console.error('Error requesting device orientation permission:', err);
        setError('Failed to request device orientation permission');
        setPermissionGranted(false);
        return false;
      }
    } else {
      // Not iOS or older device - no permission needed
      setPermissionGranted(true);
      return true;
    }
  };

  // Handle device orientation event - just capture raw value
  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    const webkitEvent = event as DeviceOrientationEventWithWebkit;
    let newHeading: number | null = null;

    if (webkitEvent.webkitCompassHeading !== undefined) {
      // iOS provides webkitCompassHeading (0-360, 0 = North)
      newHeading = webkitEvent.webkitCompassHeading;
    } else if (event.alpha !== null) {
      // Android/other devices use alpha
      // For compass heading: heading = 360 - alpha
      newHeading = 360 - event.alpha;
    }

    if (newHeading !== null) {
      rawHeadingRef.current = newHeading;
    }
  }, []);

  // Animation loop for smooth heading updates
  const updateLoop = useCallback(() => {
    const now = performance.now();
    const elapsed = now - lastUpdateTimeRef.current;

    if (elapsed >= minUpdateInterval && rawHeadingRef.current !== null) {
      const raw = rawHeadingRef.current;

      // Initialize smoothed heading if needed
      if (smoothedHeadingRef.current === null) {
        smoothedHeadingRef.current = raw;
        lastEmittedHeadingRef.current = raw;
        setHeading(raw);
      } else {
        // Apply exponential smoothing
        const smoothed = smoothHeading(smoothedHeadingRef.current, raw, smoothingFactor);
        smoothedHeadingRef.current = smoothed;

        // Only emit if change exceeds minimum delta
        const lastEmitted = lastEmittedHeadingRef.current ?? smoothed;
        const delta = Math.abs(angleDelta(lastEmitted, smoothed));

        if (delta >= minDelta) {
          lastEmittedHeadingRef.current = smoothed;
          setHeading(Math.round(smoothed * 10) / 10); // Round to 1 decimal
        }
      }

      lastUpdateTimeRef.current = now;
    }

    animationFrameRef.current = requestAnimationFrame(updateLoop);
  }, [smoothingFactor, minDelta, minUpdateInterval]);

  // Start tracking heading
  const startTracking = async () => {
    if (listenerAttachedRef.current) return;

    const hasPermission = await requestPermission();
    if (!hasPermission) {
      setError('Permission denied for device orientation');
      return;
    }

    window.addEventListener('deviceorientation', handleOrientation, true);
    listenerAttachedRef.current = true;
    setError(null);

    // Start the animation loop for smooth updates
    lastUpdateTimeRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(updateLoop);
  };

  // Stop tracking heading
  const stopTracking = () => {
    if (!listenerAttachedRef.current) return;

    window.removeEventListener('deviceorientation', handleOrientation, true);
    listenerAttachedRef.current = false;

    // Stop animation loop
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Reset refs
    rawHeadingRef.current = null;
    smoothedHeadingRef.current = null;
    lastEmittedHeadingRef.current = null;
    setHeading(null);
  };

  // Auto start/stop based on enabled prop
  useEffect(() => {
    if (enabled) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => {
      stopTracking();
    };
  }, [enabled, updateLoop, handleOrientation]);

  return {
    heading,
    permissionGranted,
    error,
    requestPermission,
    startTracking,
    stopTracking,
  };
}
