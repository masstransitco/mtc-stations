"use client";

import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useState, useRef, useMemo } from "react";
import { Navigation, Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useLocationTracking } from "@/hooks/use-location-tracking";
import { BuildingOverlay } from "@/components/building-overlay";
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
  createSelectedCarparkMarker,
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

interface SearchLocation {
  lat: number;
  lng: number;
  address: string;
}

// Component to handle map reference with optimized markers
function MapContent({
  carparks,
  selectedCarpark,
  setSelectedCarpark,
  currentLocation,
  isTracking,
  getMarkerColor,
  isDarkMode,
  show3DBuildings,
  searchLocation,
  onCarparkMarkerClick,
  onMeteredCarparkMarkerClick,
  bottomSheetHeight,
  parkingSpaces,
  showParkingSpaces,
  selectedParkingSpace,
  setSelectedParkingSpace,
  meteredCarparks,
  showMeteredCarparks,
  selectedMeteredCarpark,
  setSelectedMeteredCarpark,
  connectedCarparks,
  showConnectedCarparks,
  selectedConnectedCarpark,
  setSelectedConnectedCarpark,
  onConnectedCarparkMarkerClick,
  dispatchCarparks,
  showDispatchCarparks,
  selectedDispatchCarpark,
  setSelectedDispatchCarpark,
  onDispatchCarparkMarkerClick,
  showIndoorCarparks
}: {
  carparks: CarparkWithVacancy[];
  selectedCarpark: CarparkWithVacancy | null;
  setSelectedCarpark: (carpark: CarparkWithVacancy | null) => void;
  currentLocation: any;
  isTracking: boolean;
  getMarkerColor: (vacancy: number) => string;
  isDarkMode: boolean;
  show3DBuildings: boolean;
  searchLocation: SearchLocation | null;
  onCarparkMarkerClick: (carpark: CarparkWithVacancy) => void;
  onMeteredCarparkMarkerClick: (carpark: MeteredCarpark) => void;
  bottomSheetHeight: number;
  parkingSpaces: ParkingSpace[];
  showParkingSpaces: boolean;
  selectedParkingSpace: ParkingSpace | null;
  setSelectedParkingSpace: (space: ParkingSpace | null) => void;
  meteredCarparks: MeteredCarpark[];
  showMeteredCarparks: boolean;
  selectedMeteredCarpark: MeteredCarpark | null;
  setSelectedMeteredCarpark: (carpark: MeteredCarpark | null) => void;
  connectedCarparks: ConnectedCarpark[];
  showConnectedCarparks: boolean;
  selectedConnectedCarpark: ConnectedCarpark | null;
  setSelectedConnectedCarpark: (carpark: ConnectedCarpark | null) => void;
  onConnectedCarparkMarkerClick: (carpark: ConnectedCarpark) => void;
  dispatchCarparks: DispatchCarpark[];
  showDispatchCarparks: boolean;
  selectedDispatchCarpark: DispatchCarpark | null;
  setSelectedDispatchCarpark: (carpark: DispatchCarpark | null) => void;
  onDispatchCarparkMarkerClick: (carpark: DispatchCarpark) => void;
  showIndoorCarparks: boolean;
}) {
  const map = useMap();
  const prevHeightRef = useRef(100);

  // Convert data to MarkerItem format for optimized hooks
  const indoorCarparkItems = useMemo(
    () =>
      showIndoorCarparks
        ? (carparks || []).map((carpark) => ({
            id: `${carpark.park_id}-${carpark.vehicle_type}`,
            latitude: carpark.latitude,
            longitude: carpark.longitude,
            data: carpark,
          }))
        : [],
    [carparks, showIndoorCarparks]
  );

  const meteredCarparkItems = useMemo(
    () =>
      showMeteredCarparks
        ? (meteredCarparks || []).map((carpark) => ({
            id: carpark.carpark_id,
            latitude: carpark.latitude,
            longitude: carpark.longitude,
            data: carpark,
          }))
        : [],
    [meteredCarparks, showMeteredCarparks]
  );

  const connectedCarparkItems = useMemo(
    () =>
      (connectedCarparks || []).map((carpark) => ({
        id: carpark.park_id,
        latitude: carpark.latitude,
        longitude: carpark.longitude,
        data: carpark,
      })),
    [connectedCarparks]
  );

  const dispatchCarparkItems = useMemo(
    () =>
      (dispatchCarparks || []).map((carpark) => ({
        id: carpark.id,
        latitude: carpark.latitude,
        longitude: carpark.longitude,
        data: carpark,
      })),
    [dispatchCarparks]
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
  const indoorCarparksMarkers = useOptimizedMarkers(indoorCarparkItems, {
    createMarkerElement: (item) =>
      createIndoorCarparkMarker(item.data, getMarkerColor, (carpark) => {
        setSelectedCarpark(carpark);
        onCarparkMarkerClick(carpark);
      }),
    getZIndex: (item) => item.data.vacancy,
    getPriority: (item) => (selectedCarpark?.park_id === item.data.park_id ? 'required' : 'optional'),
    shouldUpdate: (item, prevItem) => item.data.vacancy !== prevItem.data.vacancy,
  });

  const meteredCarparksMarkers = useOptimizedMarkers(
    meteredCarparkItems,
    {
      createMarkerElement: (item) =>
        createMeteredCarparkMarker(item.data, getMarkerColor, (carpark) => {
          setSelectedMeteredCarpark(carpark);
          onMeteredCarparkMarkerClick(carpark);
        }),
      getZIndex: (item) => item.data.vacant_spaces,
      getPriority: (item) => (selectedMeteredCarpark?.carpark_id === item.data.carpark_id ? 'required' : 'optional'),
      shouldUpdate: (item, prevItem) => item.data.vacant_spaces !== prevItem.data.vacant_spaces,
    },
    { enabled: showMeteredCarparks, minZoom: 12 }
  );

  const connectedCarparksMarkers = useOptimizedMarkers(
    connectedCarparkItems,
    {
      createMarkerElement: (item) =>
        createConnectedCarparkMarker(item.data, isDarkMode, (carpark) => {
          setSelectedConnectedCarpark(carpark);
          onConnectedCarparkMarkerClick(carpark);
        }),
      getZIndex: () => 100,
      getPriority: (item) => (selectedConnectedCarpark?.park_id === item.data.park_id ? 'required' : 'optional'),
    },
    { enabled: showConnectedCarparks }
  );

  const dispatchCarparksMarkers = useOptimizedMarkers(
    dispatchCarparkItems,
    {
      createMarkerElement: (item) =>
        createDispatchCarparkMarker(item.data, (carpark) => {
          setSelectedDispatchCarpark(carpark);
          onDispatchCarparkMarkerClick(carpark);
        }),
      getZIndex: () => 150,
      getPriority: (item) => (selectedDispatchCarpark?.id === item.data.id ? 'required' : 'optional'),
    },
    { enabled: showDispatchCarparks }
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

  // Auto-pan to selected carpark when set
  useEffect(() => {
    if (selectedCarpark && map) {
      map.panTo({
        lat: selectedCarpark.latitude,
        lng: selectedCarpark.longitude
      });
      map.setZoom(17);
    }
  }, [selectedCarpark, map]);

  return (
    <>
      {/* 3D Building Overlay */}
      <BuildingOverlay visible={show3DBuildings} opacity={0.8} />

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

      {/* Selected Carpark Marker with Breathing Animation */}
      {selectedCarpark && (
        <AdvancedMarker
          position={{
            lat: selectedCarpark.latitude,
            lng: selectedCarpark.longitude
          }}
          zIndex={99999}
        >
          <style>{`
            @keyframes breathe {
              0%, 100% {
                transform: scale(1);
                opacity: 1;
              }
              50% {
                transform: scale(1.15);
                opacity: 0.9;
              }
            }
            @keyframes breatheRing {
              0%, 100% {
                transform: scale(1);
                opacity: 0.6;
              }
              50% {
                transform: scale(1.3);
                opacity: 0.3;
              }
            }
          `}</style>
          <div style={{
            width: '50px',
            height: '50px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            position: 'relative'
          }}>
            {/* Outer breathing ring */}
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: `${getMarkerColor(selectedCarpark.vacancy)}30`,
              animation: 'breatheRing 2s ease-in-out infinite',
            }} />

            {/* Middle glassmorphic ring */}
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: `${getMarkerColor(selectedCarpark.vacancy)}20`,
              backdropFilter: 'blur(8px)',
              border: `3px solid ${getMarkerColor(selectedCarpark.vacancy)}`,
              boxShadow: `0 4px 16px ${getMarkerColor(selectedCarpark.vacancy)}60, 0 0 0 1px ${getMarkerColor(selectedCarpark.vacancy)}30`,
              animation: 'breathe 2s ease-in-out infinite',
            }} />

            {/* Inner circle with parking icon */}
            <div style={{
              position: 'relative',
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: getMarkerColor(selectedCarpark.vacancy),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 3px 12px ${getMarkerColor(selectedCarpark.vacancy)}70`,
              animation: 'breathe 2s ease-in-out infinite',
            }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>
              </svg>
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
  const [carparks, setCarparks] = useState<CarparkWithVacancy[]>([]);
  const [selectedCarpark, setSelectedCarpark] = useState<CarparkWithVacancy | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapCenter] = useState({ lat: 22.3193, lng: 114.1694 });
  const [show3DBuildings, setShow3DBuildings] = useState(true);
  const [searchLocation, setSearchLocation] = useState<SearchLocation | null>(null);
  const [nearbyCarparks, setNearbyCarparks] = useState<CarparkWithDistance[]>([]);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [bottomSheetView, setBottomSheetView] = useState<BottomSheetView>('home');
  const [bottomSheetHeight, setBottomSheetHeight] = useState(100); // Start with minimized height

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
  const [selectedMeteredCarpark, setSelectedMeteredCarpark] = useState<MeteredCarpark | null>(null);

  // Connected carparks state (EV charging)
  const [connectedCarparks, setConnectedCarparks] = useState<ConnectedCarpark[]>([]);
  const [showConnectedCarparks, setShowConnectedCarparks] = useState(true);
  const [selectedConnectedCarpark, setSelectedConnectedCarpark] = useState<ConnectedCarpark | null>(null);

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
  const [selectedDispatchCarpark, setSelectedDispatchCarpark] = useState<DispatchCarpark | null>(null);

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

  // Handle "My Location" button click
  const handleMyLocation = () => {
    if (isTracking) {
      stopTracking();
    } else {
      startTracking();
    }
  };

  // Handle place selection from search
  const handlePlaceSelected = async (place: google.maps.places.PlaceResult) => {
    if (!place.geometry?.location) return;

    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const address = place.formatted_address || place.name || "";

    setSearchLocation({ lat, lng, address });
    setIsBottomSheetOpen(true);
    setBottomSheetView('nearby');
    setLoadingNearby(true);

    try {
      const response = await fetch(
        `/api/carparks/nearby?lat=${lat}&lng=${lng}&radius=2&limit=20`
      );
      const data = await response.json();
      setNearbyCarparks(data);
    } catch (error) {
      console.error("Error fetching nearby carparks:", error);
    } finally {
      setLoadingNearby(false);
    }
  };

  // Handle clearing the search
  const handleClearSearch = () => {
    setSearchLocation(null);
    setNearbyCarparks([]);
    setBottomSheetView('home');
  };

  // Handle clicking on a nearby carpark
  const handleNearbyCarparkClick = (carpark: CarparkWithDistance) => {
    setSelectedCarpark(carpark);
    setBottomSheetView('station');
  };

  // Handle clicking on a trending carpark
  const handleTrendingCarparkClick = (carpark: CarparkWithVacancy) => {
    setSelectedCarpark(carpark);
    setBottomSheetView('station');
    setIsBottomSheetOpen(true);
  };

  // Handle back button in bottom sheet
  const handleBottomSheetBack = () => {
    if (bottomSheetView === 'station') {
      setBottomSheetView(nearbyCarparks.length > 0 ? 'nearby' : 'home');
      setSelectedCarpark(null);
    } else if (bottomSheetView === 'metered-carpark') {
      setBottomSheetView('home');
      setSelectedMeteredCarpark(null);
    } else if (bottomSheetView === 'connected-carpark') {
      setBottomSheetView('home');
      setSelectedConnectedCarpark(null);
    } else if (bottomSheetView === 'dispatch-carpark') {
      setBottomSheetView('home');
      setSelectedDispatchCarpark(null);
    } else if (bottomSheetView === 'nearby') {
      setBottomSheetView('home');
      setSearchLocation(null);
      setNearbyCarparks([]);
    }
  };

  // Get bottom sheet title based on current view
  const getBottomSheetTitle = () => {
    if (bottomSheetView === 'station') return 'Indoor Carpark';
    if (bottomSheetView === 'metered-carpark') return 'Metered Carpark';
    if (bottomSheetView === 'connected-carpark') return 'EV Charging Station';
    if (bottomSheetView === 'dispatch-carpark') return 'Dispatch Carpark';
    if (bottomSheetView === 'nearby') return 'Nearby Carparks';
    return 'Search Carparks';
  };

  // Handle marker click on map
  const handleCarparkMarkerClick = (carpark: CarparkWithVacancy) => {
    setBottomSheetView('station');
    setIsBottomSheetOpen(true);
  };

  // Handle metered carpark marker click
  const handleMeteredCarparkMarkerClick = (carpark: MeteredCarpark) => {
    setSelectedMeteredCarpark(carpark);
    setBottomSheetView('metered-carpark');
    setIsBottomSheetOpen(true);
  };

  // Handle connected carpark marker click
  const handleConnectedCarparkMarkerClick = (carpark: ConnectedCarpark) => {
    setSelectedConnectedCarpark(carpark);
    setBottomSheetView('connected-carpark');
    setIsBottomSheetOpen(true);
  };

  // Handle dispatch carpark marker click
  const handleDispatchCarparkMarkerClick = (carpark: DispatchCarpark) => {
    setSelectedDispatchCarpark(carpark);
    setBottomSheetView('dispatch-carpark');
    setIsBottomSheetOpen(true);
  };

  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

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
                if (isDarkMode) toggleTheme();
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
              <Sun size={24} color={!isDarkMode ? '#ffffff' : '#111827'} />
            </button>

            {/* Dark Mode Button */}
            <button
              onClick={() => {
                if (!isDarkMode) toggleTheme();
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
          <MapContent
            carparks={carparks}
            selectedCarpark={selectedCarpark}
            setSelectedCarpark={setSelectedCarpark}
            currentLocation={currentLocation}
            isTracking={isTracking}
            getMarkerColor={getMarkerColor}
            isDarkMode={isDarkMode}
            show3DBuildings={show3DBuildings}
            searchLocation={searchLocation}
            onCarparkMarkerClick={handleCarparkMarkerClick}
            onMeteredCarparkMarkerClick={handleMeteredCarparkMarkerClick}
            bottomSheetHeight={bottomSheetHeight}
            parkingSpaces={parkingSpaces}
            showParkingSpaces={showParkingSpaces}
            selectedParkingSpace={selectedParkingSpace}
            setSelectedParkingSpace={setSelectedParkingSpace}
            meteredCarparks={meteredCarparks}
            showMeteredCarparks={showMeteredCarparks}
            selectedMeteredCarpark={selectedMeteredCarpark}
            setSelectedMeteredCarpark={setSelectedMeteredCarpark}
            connectedCarparks={connectedCarparks}
            showConnectedCarparks={showConnectedCarparks}
            selectedConnectedCarpark={selectedConnectedCarpark}
            setSelectedConnectedCarpark={setSelectedConnectedCarpark}
            onConnectedCarparkMarkerClick={handleConnectedCarparkMarkerClick}
            dispatchCarparks={dispatchCarparks}
            showDispatchCarparks={showDispatchCarparks}
            selectedDispatchCarpark={selectedDispatchCarpark}
            setSelectedDispatchCarpark={setSelectedDispatchCarpark}
            onDispatchCarparkMarkerClick={handleDispatchCarparkMarkerClick}
            showIndoorCarparks={showIndoorCarparks}
          />
        </Map>

        {/* Bottom Sheet - Always Mounted */}
        <BottomSheet
          isOpen={isBottomSheetOpen}
          onClose={() => {
            setIsBottomSheetOpen(false);
            setBottomSheetView('home');
            setSelectedCarpark(null);
            setSelectedMeteredCarpark(null);
            setSelectedConnectedCarpark(null);
            setSelectedDispatchCarpark(null);
            setSearchLocation(null);
            setNearbyCarparks([]);
          }}
          title={getBottomSheetTitle()}
          showBackButton={bottomSheetView !== 'home'}
          onBack={handleBottomSheetBack}
          onHeightChange={setBottomSheetHeight}
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

          {/* Station View - Selected Carpark Details */}
          {bottomSheetView === 'station' && selectedCarpark && (
            <IndoorCarparkDetails
              carpark={selectedCarpark}
              getMarkerColor={getMarkerColor}
            />
          )}

          {/* Metered Carpark View - Selected Metered Carpark Details */}
          {bottomSheetView === 'metered-carpark' && selectedMeteredCarpark && (
            <MeteredCarparkDetails
              carpark={selectedMeteredCarpark}
              getMarkerColor={getMarkerColor}
            />
          )}

          {/* Connected Carpark View - Selected Connected Carpark Details */}
          {bottomSheetView === 'connected-carpark' && selectedConnectedCarpark && (
            <ConnectedCarparkDetails
              carpark={selectedConnectedCarpark}
            />
          )}

          {/* Dispatch Carpark View - Selected Dispatch Carpark Details */}
          {bottomSheetView === 'dispatch-carpark' && selectedDispatchCarpark && (
            <DispatchCarparkDetails
              carpark={selectedDispatchCarpark}
            />
          )}
        </BottomSheet>
      </APIProvider>
    </div>
  );
}
