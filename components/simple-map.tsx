"use client";

import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useState, useRef, useMemo } from "react";
import { Navigation, Sun, Moon, Compass } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useLocationTracking } from "@/hooks/use-location-tracking";
import { BuildingOverlayPMTiles } from "@/components/building-overlay-pmtiles";
import AddressSearch from "@/components/address-search";
import BottomSheet from "@/components/bottom-sheet";
import NearbyCarparksList from "@/components/nearby-carparks-list";
import IndoorCarparkDetails from "@/components/indoor-carpark-details";
import TrendingCarparks from "@/components/trending-carparks";
import MeteredCarparkDetails from "@/components/metered-carpark-details";
import ConnectedCarparkDetails from "@/components/connected-carpark-details";
import DispatchCarparkDetails from "@/components/dispatch-carpark-details";
import Image from "next/image";
import Box3DIcon from "@/components/icons/box-3d-icon";
import LoadingSpinner from "@/components/loading-spinner";
import { useOptimizedMarkers } from "@/hooks/use-optimized-markers";
import {
  createIndoorCarparkMarker,
  createMeteredCarparkMarker,
  createConnectedCarparkMarker,
  createDispatchCarparkMarker,
  createParkingSpaceMarker,
} from "@/lib/marker-factories";
import type { CarparkWithVacancy, CarparkWithDistance } from "@/types/indoor-carpark";
import type { ParkingSpace } from "@/types/parking-space";
import type { MeteredCarpark } from "@/types/metered-carpark";
import type { ConnectedCarpark } from "@/types/connected-carpark";
import type { DispatchCarpark } from "@/types/dispatch-carpark";
import { useCarparkActions, getCarparkManager } from "@/hooks/use-carpark-actions";
import type { CarparkUnion } from "@/store/carparkSlice";

interface SearchLocation {
  lat: number;
  lng: number;
  address: string;
}

// Helper function to safely get vacancy from any carpark type
function getCarparkVacancy(carpark: CarparkUnion): number {
  if ('vacancy' in carpark) {
    return carpark.vacancy;
  }
  // Default vacancy for carparks without vacancy info (metered, connected, dispatch)
  return 50; // Medium occupancy as default
}

// Compass button component with map access
function CompassButton({ isDarkMode }: { isDarkMode: boolean }) {
  const map = useMap();
  const [mapHeading, setMapHeading] = useState(0);

  // Track map heading changes
  useEffect(() => {
    if (!map) return;

    const headingListener = map.addListener('heading_changed', () => {
      const heading = map.getHeading() || 0;
      setMapHeading(heading);
    });

    // Get initial heading
    const initialHeading = map.getHeading() || 0;
    setMapHeading(initialHeading);

    return () => {
      google.maps.event.removeListener(headingListener);
    };
  }, [map]);

  // Handle compass button click - reset to north
  const handleCompassClick = () => {
    if (!map) return;
    map.setHeading(0);
    map.setTilt(0);
  };

  return (
    <button
      onClick={handleCompassClick}
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 10,
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
        border: isDarkMode ? '2px solid #374151' : '2px solid #e5e7eb',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.1)';
        e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      }}
      title="Reset to North"
    >
      <Compass
        size={24}
        color={isDarkMode ? '#f3f4f6' : '#111827'}
        style={{
          transform: `rotate(${mapHeading}deg)`,
          transition: 'transform 0.3s ease',
        }}
      />
    </button>
  );
}

// Component to handle map reference with optimized markers
function MapContent({
  carparks,
  currentLocation,
  isTracking,
  getMarkerColor,
  getMeteredMarkerColor,
  isDarkMode,
  show3DBuildings,
  parkingSpaces,
  showParkingSpaces,
  selectedParkingSpace,
  setSelectedParkingSpace,
  meteredCarparks,
  showMeteredCarparks,
  connectedCarparks,
  showConnectedCarparks,
  dispatchCarparks,
  showDispatchCarparks,
  showIndoorCarparks
}: {
  carparks: CarparkWithVacancy[];
  currentLocation: any;
  isTracking: boolean;
  getMarkerColor: (vacancy: number) => string;
  getMeteredMarkerColor: (vacancy: number) => string;
  isDarkMode: boolean;
  show3DBuildings: boolean;
  parkingSpaces: ParkingSpace[];
  showParkingSpaces: boolean;
  selectedParkingSpace: ParkingSpace | null;
  setSelectedParkingSpace: (space: ParkingSpace | null) => void;
  meteredCarparks: MeteredCarpark[];
  showMeteredCarparks: boolean;
  connectedCarparks: ConnectedCarpark[];
  showConnectedCarparks: boolean;
  dispatchCarparks: DispatchCarpark[];
  showDispatchCarparks: boolean;
  showIndoorCarparks: boolean;
}) {
  // Access Redux state and actions within MapContent
  const {
    selectedCarpark,
    selectedCarparkId,
    selectedCarparkType,
    bottomSheetHeight,
    searchLocation,
    handleMarkerClick,
  } = useCarparkActions();
  const map = useMap();
  const prevHeightRef = useRef(100);

  // Convert data to MarkerItem format for optimized hooks
  // IMPORTANT: Include isSelected in the item data so shouldUpdate can detect selection changes
  const indoorCarparkItems = useMemo(
    () =>
      showIndoorCarparks
        ? (carparks || []).map((carpark) => ({
            id: `${carpark.park_id}-${carpark.vehicle_type}`,
            latitude: carpark.latitude,
            longitude: carpark.longitude,
            data: {
              ...carpark,
              isSelected: selectedCarparkType === 'indoor' && selectedCarparkId === carpark.park_id,
            },
          }))
        : [],
    [carparks, showIndoorCarparks, selectedCarparkId, selectedCarparkType]
  );

  const meteredCarparkItems = useMemo(
    () =>
      showMeteredCarparks
        ? (meteredCarparks || []).map((carpark) => ({
            id: carpark.carpark_id,
            latitude: carpark.latitude,
            longitude: carpark.longitude,
            data: {
              ...carpark,
              isSelected: selectedCarparkType === 'metered' && selectedCarparkId === carpark.carpark_id,
            },
          }))
        : [],
    [meteredCarparks, showMeteredCarparks, selectedCarparkId, selectedCarparkType]
  );

  const connectedCarparkItems = useMemo(
    () =>
      (connectedCarparks || []).map((carpark) => ({
        id: carpark.park_id,
        latitude: carpark.latitude,
        longitude: carpark.longitude,
        data: {
          ...carpark,
          isSelected: selectedCarparkType === 'connected' && selectedCarparkId === carpark.park_id,
        },
      })),
    [connectedCarparks, selectedCarparkId, selectedCarparkType]
  );

  const dispatchCarparkItems = useMemo(
    () =>
      (dispatchCarparks || []).map((carpark) => ({
        id: carpark.id,
        latitude: carpark.latitude,
        longitude: carpark.longitude,
        data: {
          ...carpark,
          isSelected: selectedCarparkType === 'dispatch' && selectedCarparkId === carpark.id,
        },
      })),
    [dispatchCarparks, selectedCarparkId, selectedCarparkType]
  );

  const parkingSpaceItems = useMemo(
    () =>
      (parkingSpaces || []).map((space) => ({
        id: space.feature_id.toString(),
        latitude: space.latitude,
        longitude: space.longitude,
        data: space,
      })),
    [parkingSpaces]
  );

  // Optimized marker rendering hooks
  const indoorCarparksMarkers = useOptimizedMarkers(
    indoorCarparkItems,
    {
      createMarkerElement: (item) => {
        return createIndoorCarparkMarker(
          item.data,
          getMarkerColor,
          async (carpark) => {
            const manager = await getCarparkManager();
            manager.handleMarkerClick(carpark, 'indoor');
          },
          item.data.isSelected
        );
      },
      getZIndex: (item) => {
        return item.data.isSelected ? 99999 : item.data.vacancy;
      },
      getPriority: (item) => (
        item.data.isSelected ? 'required' : 'optional'
      ),
      shouldUpdate: (item, prevItem) => {
        // Check both vacancy AND selection state changes
        return item.data.vacancy !== prevItem.data.vacancy ||
               item.data.isSelected !== prevItem.data.isSelected;
      },
    },
    {
      minZoom: 14,
    }
  );

  const meteredCarparksMarkers = useOptimizedMarkers(
    meteredCarparkItems,
    {
      createMarkerElement: (item) => {
        return createMeteredCarparkMarker(
          item.data,
          getMeteredMarkerColor,
          async (carpark) => {
            const manager = await getCarparkManager();
            manager.handleMarkerClick(carpark, 'metered');
          },
          item.data.isSelected
        );
      },
      getZIndex: (item) => {
        return item.data.isSelected ? 99999 : item.data.vacant_spaces;
      },
      getPriority: (item) => (
        item.data.isSelected ? 'required' : 'optional'
      ),
      shouldUpdate: (item, prevItem) => {
        // Check both vacant_spaces AND selection state changes
        return item.data.vacant_spaces !== prevItem.data.vacant_spaces ||
               item.data.isSelected !== prevItem.data.isSelected;
      },
    },
    {
      enabled: showMeteredCarparks,
      minZoom: 16,
    }
  );

  const connectedCarparksMarkers = useOptimizedMarkers(
    connectedCarparkItems,
    {
      createMarkerElement: (item) => {
        return createConnectedCarparkMarker(
          item.data,
          async (carpark) => {
            const manager = await getCarparkManager();
            manager.handleMarkerClick(carpark, 'connected');
          },
          item.data.isSelected
        );
      },
      getZIndex: (item) => {
        return item.data.isSelected ? 99999 : 100;
      },
      getPriority: (item) => (
        item.data.isSelected ? 'required' : 'optional'
      ),
      shouldUpdate: (item, prevItem) => {
        // Check selection state changes - theme changes handled in marker factory
        return item.data.isSelected !== prevItem.data.isSelected;
      },
    },
    {
      enabled: showConnectedCarparks,
    }
  );

  const dispatchCarparksMarkers = useOptimizedMarkers(
    dispatchCarparkItems,
    {
      createMarkerElement: (item) => {
        return createDispatchCarparkMarker(
          item.data,
          async (carpark) => {
            const manager = await getCarparkManager();
            manager.handleMarkerClick(carpark, 'dispatch');
          },
          item.data.isSelected
        );
      },
      getZIndex: (item) => {
        return item.data.isSelected ? 99999 : 150;
      },
      getPriority: (item) => (
        item.data.isSelected ? 'required' : 'optional'
      ),
      shouldUpdate: (item, prevItem) => {
        // Check selection state changes - theme changes handled in marker factory
        return item.data.isSelected !== prevItem.data.isSelected;
      },
    },
    {
      enabled: showDispatchCarparks,
    }
  );

  const parkingSpacesMarkers = useOptimizedMarkers(
    parkingSpaceItems,
    {
      createMarkerElement: (item) => createParkingSpaceMarker(item.data, setSelectedParkingSpace),
      getZIndex: (item) => (item.data.is_vacant ? 10 : 5),
      getPriority: (item) => (selectedParkingSpace?.feature_id.toString() === item.id ? 'required' : 'optional'),
    },
    { enabled: showParkingSpaces, minZoom: 16 }
  );

  // Handle bottom sheet height changes with map padding and pan compensation
  useEffect(() => {
    if (!map) return;

    const delta = bottomSheetHeight - prevHeightRef.current;

    // Apply Google Maps padding to account for bottom sheet
    map.setOptions({
      padding: { top: 0, left: 0, right: 0, bottom: bottomSheetHeight }
    } as google.maps.MapOptions);

    // Apply pan compensation for smooth transitions
    // Positive delta = sheet expanding (moving up) -> pan map up to keep center stable
    if (delta !== 0) {
      map.panBy(0, delta / 2);
    }

    // Update previous height reference
    prevHeightRef.current = bottomSheetHeight;
  }, [map, bottomSheetHeight]);

  // Auto-pan to user location when tracking starts and location is available
  useEffect(() => {
    if (isTracking && currentLocation && map) {
      map.panTo({
        lat: currentLocation.latitude,
        lng: currentLocation.longitude
      });
      map.setZoom(15);
    }
  }, [isTracking, currentLocation, map]);

  // Auto-pan to search location when set
  useEffect(() => {
    if (searchLocation && map) {
      map.panTo({
        lat: searchLocation.lat,
        lng: searchLocation.lng
      });
      map.setZoom(15);
    }
  }, [searchLocation, map]);

  // Note: Camera animation for selected carpark is now handled by carparkSelectionManager
  // The manager handles batched Redux updates + camera animation in selectCarpark()

  return (
    <>
      {/* 3D Building Overlay - PMTiles version */}
      <BuildingOverlayPMTiles visible={show3DBuildings} opacity={0.8} />

      {/* Note: Optimized markers are managed by useOptimizedMarkers hooks above */}
      {/* Only special markers that need React state are rendered here */}

      {/* User Location Marker */}
      {currentLocation && (
        <AdvancedMarker
          position={{
            lat: currentLocation.latitude,
            lng: currentLocation.longitude
          }}
          zIndex={10000}
        >
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#3b82f6',
            border: '4px solid white',
            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.5)',
            position: 'relative'
          }}>
            {/* Pulsing ring animation */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              animation: 'pulse 2s ease-out infinite'
            }} />
          </div>
        </AdvancedMarker>
      )}

      {/* Search Location Marker */}
      {searchLocation && (
        <AdvancedMarker
          position={{
            lat: searchLocation.lat,
            lng: searchLocation.lng
          }}
          zIndex={9999}
        >
          <div style={{
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            left: '-12px',  // Shift entire marker left so circle is at anchor
            top: '-12px',   // Shift entire marker up so circle is at anchor
          }}>
            {/* Circle with ring - this is the anchor point */}
            <div style={{
              position: 'relative',
              width: '24px',
              height: '24px',
              flexShrink: 0,
            }}>
              {/* Outer pulsing ring */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: isDarkMode ? 'rgba(147, 197, 253, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                animation: 'pulse 2s ease-out infinite'
              }} />

              {/* Static ring */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: `3px solid ${isDarkMode ? '#93c5fd' : '#3b82f6'}`,
                backgroundColor: isDarkMode ? 'rgba(147, 197, 253, 0.1)' : 'rgba(59, 130, 246, 0.1)',
              }} />

              {/* Center circle */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: isDarkMode ? '#93c5fd' : '#3b82f6',
                border: '3px solid white',
                boxShadow: `0 2px 8px ${isDarkMode ? 'rgba(147, 197, 253, 0.5)' : 'rgba(59, 130, 246, 0.5)'}`,
              }} />
            </div>

            {/* Label - positioned to the right of the circle */}
            <div style={{
              padding: '6px 12px',
              backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
              border: isDarkMode ? '2px solid #374151' : '2px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
              fontSize: '13px',
              fontWeight: 600,
              color: isDarkMode ? '#f3f4f6' : '#111827',
              whiteSpace: 'nowrap',
              maxWidth: '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {searchLocation.address}
            </div>
          </div>
        </AdvancedMarker>
      )}

    </>
  );
}

// Bottom sheet view states
type BottomSheetView = 'home' | 'nearby' | 'station' | 'metered-carpark' | 'connected-carpark' | 'dispatch-carpark';

export default function SimpleMap() {
  // Redux state and actions for carpark selection
  const {
    selectedCarpark,
    selectedCarparkType,
    bottomSheetView,
    isBottomSheetOpen,
    bottomSheetHeight,
    searchLocation,
    nearbyCarparks,
    bottomSheetTitle,
    showBackButton,
    handleSelectCarpark,
    handleMarkerClick,
    handleBack,
    handleSetBottomSheetHeight,
    handleSetSearchLocation,
    handleSetNearbyCarparks,
  } = useCarparkActions();

  // Local state for data fetching and UI
  const [carparks, setCarparks] = useState<CarparkWithVacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapCenter] = useState({ lat: 22.3193, lng: 114.1694 });
  const [show3DBuildings, setShow3DBuildings] = useState(true);
  const [loadingNearby, setLoadingNearby] = useState(false);

  // Theme selector expansion state
  const [isThemeSelectorOpen, setIsThemeSelectorOpen] = useState(false);

  // Indoor carparks visibility state
  const [showIndoorCarparks, setShowIndoorCarparks] = useState(true);

  // Parking spaces state
  const [parkingSpaces, setParkingSpaces] = useState<ParkingSpace[]>([]);
  const [showParkingSpaces, setShowParkingSpaces] = useState(true);
  const [selectedParkingSpace, setSelectedParkingSpace] = useState<ParkingSpace | null>(null);

  // Metered carparks state
  const [meteredCarparks, setMeteredCarparks] = useState<MeteredCarpark[]>([]);
  const [showMeteredCarparks, setShowMeteredCarparks] = useState(true);

  // Connected carparks state (EV charging)
  const [connectedCarparks, setConnectedCarparks] = useState<ConnectedCarpark[]>([]);
  const [showConnectedCarparks, setShowConnectedCarparks] = useState(true);

  // Dispatch carparks state
  const [dispatchCarparks] = useState<DispatchCarpark[]>([
    {
      id: 'auto-plaza',
      name: 'Auto Plaza',
      address: '65 Mody Road, Tsim Sha Tsui East, Kowloon, Hong Kong',
      latitude: 22.29856,
      longitude: 114.17654
    }
  ]);
  const [showDispatchCarparks, setShowDispatchCarparks] = useState(true);

  const { isDarkMode } = useTheme();

  const apiKey = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();
  const mapId = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "").trim();

  // Initialize location tracking
  const { currentLocation, isTracking, startTracking, stopTracking } = useLocationTracking({
    enableTracking: true,
    enableMotionTracking: true,
    enableSensorTracking: false, // Enable if needed
    motionThreshold: 5,
    idleTimeout: 30000
  });

  useEffect(() => {
    fetch("/api/carparks", {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache'
      }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCarparks(data);
        } else {
          console.error("Carparks API returned non-array data:", data);
          setCarparks([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading car parks:", err);
        setCarparks([]);
        setLoading(false);
      });

    // Fetch parking spaces
    fetch("/api/parking-spaces?status=vacant", {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache'
      }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setParkingSpaces(data);
        } else {
          console.error("Parking spaces API returned non-array data:", data);
          setParkingSpaces([]);
        }
      })
      .catch(err => {
        console.error("Error loading parking spaces:", err);
        setParkingSpaces([]);
      });

    // Fetch metered carparks
    fetch("/api/metered-carparks", {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache'
      }
    })
      .then(res => res.json())
      .then(data => {
        // Ensure data is an array before setting state
        if (Array.isArray(data)) {
          setMeteredCarparks(data);
        } else {
          console.error("Metered carparks API returned non-array data:", data);
          setMeteredCarparks([]);
        }
      })
      .catch(err => {
        console.error("Error loading metered carparks:", err);
        setMeteredCarparks([]);
      });

    // Fetch connected carparks (EV charging)
    fetch("/api/connected-carparks", {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache'
      }
    })
      .then(res => res.json())
      .then(data => {
        // Ensure data is an array before setting state
        if (Array.isArray(data)) {
          setConnectedCarparks(data);
        } else {
          console.error("Connected carparks API returned non-array data:", data);
          setConnectedCarparks([]);
        }
      })
      .catch(err => {
        console.error("Error loading connected carparks:", err);
        setConnectedCarparks([]);
      });
  }, []);

  const getMarkerColor = (vacancy: number) => {
    if (vacancy > 50) return "#0ea5e9";  // Light blue - high availability
    if (vacancy > 20) return "#0284c7";  // Sky blue - good availability
    if (vacancy > 10) return "#0369a1";  // Medium blue - moderate availability
    if (vacancy > 5) return "#075985";   // Deep blue - low availability
    if (vacancy > 0) return "#0c4a6e";   // Dark blue - very low
    return "#991b1b";                     // Dark muted red - full/closed
  };

  const getMeteredMarkerColor = (vacancy: number) => {
    // Neutral gray shades - lighter for more vacancies, darker for fewer
    if (vacancy >= 4) return "#d1d5db";  // Light gray (gray-300) - good availability (4+)
    if (vacancy === 3) return "#9ca3af"; // Medium-light gray (gray-400) - moderate (3)
    if (vacancy === 2) return "#6b7280"; // Medium gray (gray-500) - low (2)
    if (vacancy === 1) return "#4b5563"; // Dark gray (gray-600) - very low (1)
    return "#374151";                     // Darker gray (gray-700) - full/closed (0)
  };

  // Handle "My Location" button click
  const handleMyLocation = () => {
    if (isTracking) {
      stopTracking();
    } else {
      startTracking();
    }
  };

  // Handle place selection from search - now using Redux
  const handlePlaceSelected = async (place: google.maps.places.PlaceResult) => {
    if (!place.geometry?.location) return;

    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const address = place.formatted_address || place.name || "";

    handleSetSearchLocation({ lat, lng, address });
    setLoadingNearby(true);

    try {
      const response = await fetch(
        `/api/carparks/nearby?lat=${lat}&lng=${lng}&radius=2&limit=20`
      );
      const data = await response.json();
      handleSetNearbyCarparks(data);
    } catch (error) {
      console.error("Error fetching nearby carparks:", error);
    } finally {
      setLoadingNearby(false);
    }
  };

  // Handle clearing the search - now using Redux
  const handleClearSearch = () => {
    handleSetSearchLocation(null);
    handleSetNearbyCarparks([]);
  };

  // Handle clicking on a nearby carpark - now using manager
  const handleNearbyCarparkClick = (carpark: CarparkWithDistance) => {
    handleSelectCarpark(carpark, 'indoor');
  };

  // Handle clicking on a trending carpark - now using manager
  const handleTrendingCarparkClick = (carpark: CarparkWithVacancy) => {
    handleSelectCarpark(carpark, 'indoor');
  };

  const { theme, setTheme } = useTheme();

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {loading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10
        }}>
          <LoadingSpinner size="md" />
        </div>
      )}

      {/* Top Right - Theme Selector Button */}
      <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10 }}>
        <button
          onClick={() => setIsThemeSelectorOpen(!isThemeSelectorOpen)}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
            border: isDarkMode ? '2px solid #374151' : '2px solid #e5e7eb',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
          }}
          title="Theme Selector"
        >
          <Image
            src="/logos/bolt.svg"
            alt="Theme Selector"
            width={28}
            height={28}
            style={{
              filter: isDarkMode ? 'brightness(0) invert(1)' : 'none'
            }}
          />
        </button>

        {/* Expandable Theme Options */}
        {isThemeSelectorOpen && (
          <div style={{
            position: 'absolute',
            top: '0',
            right: '60px',
            display: 'flex',
            gap: '8px',
            transition: 'all 0.3s ease',
          }}>
            {/* Light Mode Button */}
            <button
              onClick={() => {
                setTheme('light');
                setIsThemeSelectorOpen(false);
              }}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: !isDarkMode ? '#3b82f6' : (isDarkMode ? '#1f2937' : '#ffffff'),
                border: isDarkMode ? '2px solid #374151' : '2px solid #e5e7eb',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
              }}
              title="Light Mode"
            >
              <Sun size={24} color="#ffffff" />
            </button>

            {/* Dark Mode Button */}
            <button
              onClick={() => {
                setTheme('dark');
                setIsThemeSelectorOpen(false);
              }}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: isDarkMode ? '#3b82f6' : (isDarkMode ? '#1f2937' : '#ffffff'),
                border: isDarkMode ? '2px solid #374151' : '2px solid #e5e7eb',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
              }}
              title="Dark Mode"
            >
              <Moon size={24} color={isDarkMode ? '#ffffff' : '#111827'} />
            </button>
          </div>
        )}
      </div>

      {/* Top Right Stack - Indoor Carparks Button */}
      <button
        onClick={() => setShowIndoorCarparks(!showIndoorCarparks)}
        style={{
          position: 'absolute',
          top: '80px',
          right: '20px',
          zIndex: 10,
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
          border: isDarkMode ? '2px solid #374151' : '2px solid #e5e7eb',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        }}
        title="Toggle Indoor Carparks"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={showIndoorCarparks ? '#3b82f6' : (isDarkMode ? '#9ca3af' : '#6b7280')}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>
        </svg>
      </button>

      {/* Top Right Stack - Metered Carparks Button */}
      <button
        onClick={() => setShowMeteredCarparks(!showMeteredCarparks)}
        style={{
          position: 'absolute',
          top: '140px',
          right: '20px',
          zIndex: 10,
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
          border: isDarkMode ? '2px solid #374151' : '2px solid #e5e7eb',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        }}
        title="Toggle Metered Carparks"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={showMeteredCarparks ? '#3b82f6' : (isDarkMode ? '#9ca3af' : '#6b7280')}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 15h2"/>
          <path d="M12 12v3"/>
          <path d="M12 19v3"/>
          <path d="M15.282 19a1 1 0 0 0 .948-.68l2.37-6.988a7 7 0 1 0-13.2 0l2.37 6.988a1 1 0 0 0 .948.68z"/>
          <path d="M9 9a3 3 0 1 1 6 0"/>
        </svg>
      </button>

      {/* Top Right Stack - 3D Buildings Button */}
      <button
        onClick={() => setShow3DBuildings(!show3DBuildings)}
        style={{
          position: 'absolute',
          top: '200px',
          right: '20px',
          zIndex: 10,
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
          border: isDarkMode ? '2px solid #374151' : '2px solid #e5e7eb',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        }}
        title="Toggle 3D Buildings"
      >
        <Box3DIcon
          size={24}
          color={show3DBuildings ? '#3b82f6' : (isDarkMode ? '#9ca3af' : '#6b7280')}
        />
      </button>

      {/* Top Right Stack - My Location Button */}
      <button
        onClick={handleMyLocation}
        style={{
          position: 'absolute',
          top: '260px',
          right: '20px',
          zIndex: 10,
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
          border: isDarkMode ? '2px solid #374151' : '2px solid #e5e7eb',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        }}
        title="My Location"
      >
        <Navigation
          size={24}
          color={isTracking ? '#3b82f6' : (isDarkMode ? '#f3f4f6' : '#111827')}
          fill={isTracking ? '#3b82f6' : 'none'}
        />
      </button>

      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={mapCenter}
          defaultZoom={11}
          defaultTilt={0}
          defaultHeading={0}
          mapId={mapId}
          colorScheme={isDarkMode ? 'DARK' : 'LIGHT'}
          style={{ width: "100%", height: "100%" }}
          gestureHandling="greedy"
          disableDefaultUI={true}
          zoomControl={false}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          tiltInteractionEnabled={true}
          headingInteractionEnabled={true}
        >
          <CompassButton isDarkMode={isDarkMode} />
          <MapContent
            carparks={carparks}
            currentLocation={currentLocation}
            isTracking={isTracking}
            getMarkerColor={getMarkerColor}
            getMeteredMarkerColor={getMeteredMarkerColor}
            isDarkMode={isDarkMode}
            show3DBuildings={show3DBuildings}
            parkingSpaces={parkingSpaces}
            showParkingSpaces={showParkingSpaces}
            selectedParkingSpace={selectedParkingSpace}
            setSelectedParkingSpace={setSelectedParkingSpace}
            meteredCarparks={meteredCarparks}
            showMeteredCarparks={showMeteredCarparks}
            connectedCarparks={connectedCarparks}
            showConnectedCarparks={showConnectedCarparks}
            dispatchCarparks={dispatchCarparks}
            showDispatchCarparks={showDispatchCarparks}
            showIndoorCarparks={showIndoorCarparks}
          />
        </Map>

        {/* Bottom Sheet - Now Redux-controlled */}
        <BottomSheet
          isOpen={isBottomSheetOpen}
          onClose={() => {
            // Clear selection using manager
            handleBack();
          }}
          title={bottomSheetTitle}
          showBackButton={showBackButton}
          onBack={handleBack}
          onHeightChange={handleSetBottomSheetHeight}
        >
          {/* Home View - Search + Trending */}
          {bottomSheetView === 'home' && (
            <>
              <div style={{ marginBottom: '20px' }}>
                <AddressSearch
                  onPlaceSelected={handlePlaceSelected}
                  onClear={handleClearSearch}
                />
              </div>

              <TrendingCarparks
                onCarparkClick={handleTrendingCarparkClick}
                getMarkerColor={getMarkerColor}
              />
            </>
          )}

          {/* Nearby View - Search Results */}
          {bottomSheetView === 'nearby' && (
            <>
              <div style={{ marginBottom: '20px' }}>
                <AddressSearch
                  onPlaceSelected={handlePlaceSelected}
                  onClear={handleClearSearch}
                />
              </div>

              {nearbyCarparks.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <NearbyCarparksList
                    carparks={nearbyCarparks}
                    onCarparkClick={handleNearbyCarparkClick}
                    loading={loadingNearby}
                  />
                </div>
              )}
            </>
          )}

          {/* Station View - Selected Indoor Carpark Details */}
          {bottomSheetView === 'station' && selectedCarpark && selectedCarparkType === 'indoor' && (
            <IndoorCarparkDetails
              carpark={selectedCarpark as CarparkWithVacancy}
              getMarkerColor={getMarkerColor}
            />
          )}

          {/* Metered Carpark View - Selected Metered Carpark Details */}
          {bottomSheetView === 'metered-carpark' && selectedCarpark && selectedCarparkType === 'metered' && (
            <MeteredCarparkDetails
              carpark={selectedCarpark as MeteredCarpark}
              getMarkerColor={getMeteredMarkerColor}
            />
          )}

          {/* Connected Carpark View - Selected Connected Carpark Details */}
          {bottomSheetView === 'connected-carpark' && selectedCarpark && selectedCarparkType === 'connected' && (
            <ConnectedCarparkDetails
              carpark={selectedCarpark as ConnectedCarpark}
            />
          )}

          {/* Dispatch Carpark View - Selected Dispatch Carpark Details */}
          {bottomSheetView === 'dispatch-carpark' && selectedCarpark && selectedCarparkType === 'dispatch' && (
            <DispatchCarparkDetails
              carpark={selectedCarpark as DispatchCarpark}
            />
          )}
        </BottomSheet>
      </APIProvider>
    </div>
  );
}
