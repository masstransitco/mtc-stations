"use client";

import { APIProvider, Map, AdvancedMarker, InfoWindow, CollisionBehavior, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Menu, Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useLocationTracking } from "@/hooks/use-location-tracking";
import VacancyTrendChart from "@/components/vacancy-trend-chart";
import { BuildingOverlay } from "@/components/building-overlay";
import AddressSearch from "@/components/address-search";
import BottomSheet from "@/components/bottom-sheet";
import NearbyCarparksList from "@/components/nearby-carparks-list";
import StationStatus from "@/components/station-status";
import TrendingCarparks from "@/components/trending-carparks";
import Image from "next/image";
import Box3DIcon from "@/components/icons/box-3d-icon";

interface CarparkWithVacancy {
  park_id: string;
  name: string;
  latitude: number;
  longitude: number;
  district: string | null;
  opening_status: string | null;
  display_address: string;
  vehicle_type: string;
  vacancy: number;
  vacancy_dis: number | null;
  vacancy_ev: number | null;
  lastupdate: string;
  is_stale: boolean;
}

interface CarparkWithDistance extends CarparkWithVacancy {
  distance: number;
}

interface SearchLocation {
  lat: number;
  lng: number;
  address: string;
}

// Component to handle map reference
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
  bottomSheetHeight
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
  bottomSheetHeight: number;
}) {
  const map = useMap();
  const prevHeightRef = useRef(100);

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
      {carparks.map((carpark) => (
        <AdvancedMarker
          key={`${carpark.park_id}-${carpark.vehicle_type}`}
          position={{ lat: carpark.latitude, lng: carpark.longitude }}
          onClick={() => {
            setSelectedCarpark(carpark);
            onCarparkMarkerClick(carpark);
          }}
          collisionBehavior={CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY}
          zIndex={carpark.vacancy}
        >
          <div style={{
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            position: 'relative'
          }}>
            {/* Glassmorphic outer ring */}
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: `${getMarkerColor(carpark.vacancy)}20`,
              backdropFilter: 'blur(8px)',
              border: `2px solid ${getMarkerColor(carpark.vacancy)}`,
              boxShadow: `0 4px 12px ${getMarkerColor(carpark.vacancy)}40, 0 0 0 1px ${getMarkerColor(carpark.vacancy)}20`,
            }} />

            {/* Inner circle with parking icon */}
            <div style={{
              position: 'relative',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: getMarkerColor(carpark.vacancy),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 2px 8px ${getMarkerColor(carpark.vacancy)}60`,
            }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
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
      ))}

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
type BottomSheetView = 'home' | 'nearby' | 'station';

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
        setCarparks(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading car parks:", err);
        setLoading(false);
      });
  }, []);

  const getMarkerColor = (vacancy: number) => {
    if (vacancy > 50) return "#0ea5e9";  // Sky blue - high availability
    if (vacancy > 20) return "#3b82f6";  // Blue - good availability
    if (vacancy > 10) return "#6366f1";  // Indigo - moderate availability
    if (vacancy > 5) return "#8b5cf6";   // Purple - low availability
    if (vacancy > 0) return "#a855f7";   // Purple/Magenta - very low
    return "#e11d48";                     // Rose red - full/closed
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
    } else if (bottomSheetView === 'nearby') {
      setBottomSheetView('home');
      setSearchLocation(null);
      setNearbyCarparks([]);
    }
  };

  // Get bottom sheet title based on current view
  const getBottomSheetTitle = () => {
    if (bottomSheetView === 'station') return 'Station Status';
    if (bottomSheetView === 'nearby') return 'Nearby Carparks';
    return 'Search Carparks';
  };

  // Handle marker click on map
  const handleCarparkMarkerClick = (carpark: CarparkWithVacancy) => {
    setBottomSheetView('station');
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
          zIndex: 10,
          padding: '20px',
          background: 'white',
          borderRadius: '8px'
        }}>
          Loading {carparks.length} car parks...
        </div>
      )}

      {/* Top Left - Menu Button */}
      <button
        onClick={() => {/* TODO: Open menu */}}
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
        title="Menu"
      >
        <Image
          src="/logos/bolt.svg"
          alt="Menu"
          width={28}
          height={28}
          style={{
            filter: isDarkMode ? 'brightness(0) invert(1)' : 'none'
          }}
        />
      </button>

      {/* Top Right - Theme Toggle */}
      <button
        onClick={toggleTheme}
        style={{
          position: 'absolute',
          top: '20px',
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
        title="Toggle Theme"
      >
        {isDarkMode ? (
          <Sun size={24} color="#f3f4f6" />
        ) : (
          <Moon size={24} color="#111827" />
        )}
      </button>

      {/* Top Right Stack - 3D Buildings Button */}
      <button
        onClick={() => setShow3DBuildings(!show3DBuildings)}
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
            bottomSheetHeight={bottomSheetHeight}
          />
        </Map>

        {/* Bottom Sheet - Always Mounted */}
        <BottomSheet
          isOpen={isBottomSheetOpen}
          onClose={() => {
            setIsBottomSheetOpen(false);
            setBottomSheetView('home');
            setSelectedCarpark(null);
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
            <StationStatus
              carpark={selectedCarpark}
              getMarkerColor={getMarkerColor}
            />
          )}
        </BottomSheet>
      </APIProvider>
    </div>
  );
}
