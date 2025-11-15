"use client";

import { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

interface UseLocationTrackingOptions {
  enableTracking?: boolean;
  enableMotionTracking?: boolean;
  enableSensorTracking?: boolean;
  motionThreshold?: number; // meters - minimum movement to log
  idleTimeout?: number; // ms - time without movement to consider idle
}

export function useLocationTracking(options: UseLocationTrackingOptions = {}) {
  const {
    enableTracking = false,
    enableMotionTracking = false,
    enableSensorTracking = false,
    motionThreshold = 5, // 5 meters
    idleTimeout = 30000 // 30 seconds
  } = options;

  const [sessionId] = useState(() => uuidv4());
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const previousLocationRef = useRef<LocationData | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const motionStateRef = useRef<'moving' | 'idle' | 'stopped'>('idle');

  // Log location to server
  const logLocation = async (location: LocationData) => {
    try {
      await fetch('/api/tracking/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          ...location,
          timestamp: new Date().toISOString()
        })
      });
    } catch (err) {
      console.error('Failed to log location:', err);
    }
  };

  // Log motion to server
  const logMotion = async (location: LocationData) => {
    try {
      await fetch('/api/tracking/motion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          ...location,
          motionState: motionStateRef.current,
          previousLatitude: previousLocationRef.current?.latitude,
          previousLongitude: previousLocationRef.current?.longitude,
          timestamp: new Date().toISOString()
        })
      });
    } catch (err) {
      console.error('Failed to log motion:', err);
    }
  };

  // Log sensor data
  const logSensor = async (sensorType: string, x: number, y: number, z: number) => {
    try {
      await fetch('/api/tracking/sensor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          sensorType,
          x,
          y,
          z,
          timestamp: new Date().toISOString()
        })
      });
    } catch (err) {
      console.error('Failed to log sensor:', err);
    }
  };

  // Handle position update
  const handlePositionUpdate = (position: GeolocationPosition) => {
    const location: LocationData = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      altitudeAccuracy: position.coords.altitudeAccuracy,
      heading: position.coords.heading,
      speed: position.coords.speed
    };

    setCurrentLocation(location);

    // Log location
    if (enableTracking) {
      logLocation(location);
    }

    // Track motion
    if (enableMotionTracking && previousLocationRef.current) {
      const distance = calculateDistance(
        previousLocationRef.current.latitude,
        previousLocationRef.current.longitude,
        location.latitude,
        location.longitude
      );

      if (distance >= motionThreshold) {
        motionStateRef.current = 'moving';
        logMotion(location);

        // Reset idle timer
        if (idleTimerRef.current) {
          clearTimeout(idleTimerRef.current);
        }
        idleTimerRef.current = setTimeout(() => {
          motionStateRef.current = 'idle';
        }, idleTimeout);
      }
    }

    previousLocationRef.current = location;
  };

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Start tracking
  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setIsTracking(true);
    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      (err) => {
        setError(err.message);
        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 27000
      }
    );
  };

  // Stop tracking
  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    setIsTracking(false);
    motionStateRef.current = 'stopped';
  };

  // Setup sensor tracking
  useEffect(() => {
    if (!enableSensorTracking) return;

    // Accelerometer
    if ('Accelerometer' in window) {
      try {
        const accelerometer = new (window as any).Accelerometer({ frequency: 60 });
        accelerometer.addEventListener('reading', () => {
          logSensor('accelerometer', accelerometer.x, accelerometer.y, accelerometer.z);
        });
        accelerometer.start();

        return () => accelerometer.stop();
      } catch (err) {
        console.error('Accelerometer not available:', err);
      }
    }
  }, [enableSensorTracking, sessionId]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, []);

  return {
    sessionId,
    currentLocation,
    isTracking,
    error,
    startTracking,
    stopTracking
  };
}
