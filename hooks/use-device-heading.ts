"use client";

import { useEffect, useRef, useState } from 'react';

// Extend DeviceOrientationEvent to include webkit properties
interface DeviceOrientationEventWithWebkit extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

interface UseDeviceHeadingOptions {
  enabled?: boolean;
}

export function useDeviceHeading(options: UseDeviceHeadingOptions = {}) {
  const { enabled = false } = options;

  const [heading, setHeading] = useState<number | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listenerAttachedRef = useRef(false);

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

  // Handle device orientation event
  const handleOrientation = (event: DeviceOrientationEvent) => {
    const webkitEvent = event as DeviceOrientationEventWithWebkit;
    if (webkitEvent.webkitCompassHeading !== undefined) {
      // iOS provides webkitCompassHeading (0-360, 0 = North)
      setHeading(webkitEvent.webkitCompassHeading);
    } else if (event.alpha !== null) {
      // Android/other devices use alpha
      // Alpha is 0-360 where 0/360 = North, but we need to convert it
      // because alpha is relative to the device's orientation
      // For compass heading: heading = 360 - alpha
      const compassHeading = event.alpha !== null ? 360 - event.alpha : null;
      if (compassHeading !== null) {
        setHeading(compassHeading);
      }
    }
  };

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
  };

  // Stop tracking heading
  const stopTracking = () => {
    if (!listenerAttachedRef.current) return;

    window.removeEventListener('deviceorientation', handleOrientation, true);
    listenerAttachedRef.current = false;
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
  }, [enabled]);

  return {
    heading,
    permissionGranted,
    error,
    requestPermission,
    startTracking,
    stopTracking,
  };
}
