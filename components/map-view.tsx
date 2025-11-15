"use client";

import React, { useState, useEffect } from "react";
import { APIProvider, Map, AdvancedMarker, InfoWindow } from "@vis.gl/react-google-maps";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

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

interface ParkingMarkerProps {
  carpark: CarparkWithVacancy;
  onClick: () => void;
  isDarkMode: boolean;
}

function ParkingMarker({ carpark, onClick, isDarkMode }: ParkingMarkerProps) {
  const markerColor = carpark.vacancy > 20 ? "#22c55e" : carpark.vacancy > 10 ? "#eab308" : carpark.vacancy > 0 ? "#f97316" : "#ef4444";

  return (
    <AdvancedMarker
      position={{ lat: carpark.latitude, lng: carpark.longitude }}
      onClick={onClick}
    >
      <div className="cursor-pointer transform transition-transform hover:scale-110">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill={markerColor} stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2"/>
          <path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>
        </svg>
      </div>
    </AdvancedMarker>
  );
}

export default function MapView() {
  const [carparks, setCarparks] = useState<CarparkWithVacancy[]>([]);
  const [selectedCarpark, setSelectedCarpark] = useState<CarparkWithVacancy | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const { isDarkMode } = useTheme();

  useEffect(() => {
    setMounted(true);

    // Listen for Google Maps API errors
    const handleError = (event: ErrorEvent) => {
      if (event.message?.includes('Google Maps') || event.message?.includes('maps')) {
        console.error('Google Maps Error:', event);
        setMapError(event.message);
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  useEffect(() => {
    fetchCarparks();
  }, []);

  useEffect(() => {
    if (selectedCarpark && isDarkMode !== undefined) {
      injectDarkModeStyles();
    }
  }, [selectedCarpark, isDarkMode]);

  const fetchCarparks = async () => {
    try {
      console.log("Fetching carparks from /api/carparks...");
      const response = await fetch("/api/carparks");
      console.log("API response status:", response.status, response.ok);
      if (response.ok) {
        const data = await response.json();
        console.log("Carparks fetched successfully:", data.length, "car parks");
        setCarparks(data);
      } else {
        console.error("API response not OK:", response.status, response.statusText);
      }
    } catch (error) {
      console.error("Error fetching carparks:", error);
    } finally {
      setLoading(false);
    }
  };

  const injectDarkModeStyles = () => {
    const existingStyle = document.getElementById("google-maps-dark-mode");
    if (existingStyle) {
      existingStyle.remove();
    }

    const style = document.createElement("style");
    style.id = "google-maps-dark-mode";
    style.innerHTML = `
      .gm-style-iw-c {
        background-color: ${isDarkMode ? "#111827" : "#ffffff"} !important;
        padding: 0 !important;
        border-radius: 8px !important;
        box-shadow: 0 2px 7px 1px rgba(0,0,0,0.3) !important;
      }
      .gm-style-iw-d {
        overflow: auto !important;
        max-height: none !important;
      }
      .gm-style-iw-tc {
        filter: ${isDarkMode ? "invert(1) hue-rotate(180deg)" : "none"};
      }
      .gm-style .gm-style-iw-t::after {
        background: ${isDarkMode ? "#111827" : "#ffffff"} !important;
        box-shadow: -2px 2px 2px 0 rgba(0,0,0,0.2) !important;
      }
      .gm-ui-hover-effect {
        background-color: ${isDarkMode ? "#374151 !important" : "#f3f4f6 !important"};
      }
      .gm-ui-hover-effect:hover {
        background-color: ${isDarkMode ? "#4b5563 !important" : "#e5e7eb !important"};
      }
      .gm-ui-hover-effect > span {
        background-color: ${isDarkMode ? "#9ca3af !important" : "#6b7280 !important"};
      }
    `;
    document.head.appendChild(style);
  };

  const calculateMapCenter = () => {
    if (carparks.length === 0) {
      return { lat: 22.3193, lng: 114.1694 }; // Hong Kong center
    }
    const avgLat = carparks.reduce((sum, cp) => sum + cp.latitude, 0) / carparks.length;
    const avgLng = carparks.reduce((sum, cp) => sum + cp.longitude, 0) / carparks.length;
    return { lat: avgLat, lng: avgLng };
  };

  const calculateZoom = () => {
    if (carparks.length === 0) return 11;

    const lats = carparks.map(cp => cp.latitude);
    const lngs = carparks.map(cp => cp.longitude);
    const latSpread = Math.max(...lats) - Math.min(...lats);
    const lngSpread = Math.max(...lngs) - Math.min(...lngs);
    const maxSpread = Math.max(latSpread, lngSpread);

    if (maxSpread > 0.5) return 10;
    if (maxSpread > 0.2) return 11;
    if (maxSpread > 0.1) return 12;
    return 13;
  };

  const apiKey = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();
  const mapId = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "").trim();

  console.log("Map config:", {
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey.length,
    hasMapId: !!mapId,
    mapId: mapId,
    carparkCount: carparks.length,
    center: calculateMapCenter(),
    zoom: calculateZoom(),
    mounted
  });

  if (!mounted) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading map...</div>
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <div className="text-destructive">Missing Google Maps API Key</div>
      </div>
    );
  }

  if (mapError) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <div className="text-destructive font-semibold mb-2">Google Maps Error</div>
          <div className="text-sm text-muted-foreground">{mapError}</div>
        </div>
      </div>
    );
  }

  const mapCenter = calculateMapCenter();
  const mapZoom = calculateZoom();

  console.log("Rendering map with:", {
    mapCenter,
    mapZoom,
    carparkCount: carparks.length,
    loading,
    mounted,
    hasApiKey: !!apiKey,
    hasMapId: !!mapId
  });

  return (
    <div className="w-full h-full" style={{ width: '100%', height: '100%', minHeight: '500px', position: 'relative' }}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading car parks...</p>
          </div>
        </div>
      )}

      <APIProvider
        apiKey={apiKey}
        onLoad={() => console.log('Google Maps API loaded successfully')}
      >
        <Map
          mapId={mapId || undefined}
          defaultCenter={mapCenter}
          defaultZoom={mapZoom}
          colorScheme={isDarkMode ? 'DARK' : 'LIGHT'}
          gestureHandling="greedy"
          disableDefaultUI={false}
          style={{ width: "100%", height: "100%", minHeight: "400px" }}
          clickableIcons={false}
          mapTypeControl={true}
          rotateControl={true}
          tiltInteractionEnabled={true}
          headingInteractionEnabled={true}
          reuseMaps={true}
          onCameraChanged={(ev) => console.log('Camera changed:', ev.detail)}
          onDrag={() => console.log('Map dragged')}
        >
          {carparks.map((carpark) => (
            <ParkingMarker
              key={`${carpark.park_id}-${carpark.vehicle_type}`}
              carpark={carpark}
              onClick={() => setSelectedCarpark(carpark)}
              isDarkMode={isDarkMode}
            />
          ))}

          {selectedCarpark && (
            <InfoWindow
              position={{
                lat: selectedCarpark.latitude,
                lng: selectedCarpark.longitude
              }}
              onCloseClick={() => setSelectedCarpark(null)}
            >
              <Card className={`min-w-[280px] border-0 shadow-none ${isDarkMode ? "dark" : ""}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-start justify-between">
                    <span className="flex-1">{selectedCarpark.name}</span>
                    {selectedCarpark.opening_status === "OPEN" ? (
                      <Badge variant="success" className="ml-2">Open</Badge>
                    ) : (
                      <Badge variant="destructive" className="ml-2">Closed</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    <MapPin className="inline h-3 w-3 mr-1" />
                    {selectedCarpark.display_address}
                  </div>

                  {selectedCarpark.district && (
                    <div className="text-sm">
                      <span className="font-medium">District:</span> {selectedCarpark.district}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                    <div>
                      <div className="text-xs text-muted-foreground">Available Spaces</div>
                      <div className="text-2xl font-bold">{selectedCarpark.vacancy}</div>
                      <div className="text-xs text-muted-foreground capitalize">{selectedCarpark.vehicle_type}</div>
                    </div>

                    {selectedCarpark.vacancy_ev !== null && selectedCarpark.vacancy_ev > 0 && (
                      <div>
                        <div className="text-xs text-muted-foreground">EV Charging</div>
                        <div className="text-2xl font-bold text-success">{selectedCarpark.vacancy_ev}</div>
                        <div className="text-xs text-muted-foreground">Spaces</div>
                      </div>
                    )}

                    {selectedCarpark.vacancy_dis !== null && selectedCarpark.vacancy_dis > 0 && (
                      <div>
                        <div className="text-xs text-muted-foreground">Disabled</div>
                        <div className="text-2xl font-bold">{selectedCarpark.vacancy_dis}</div>
                        <div className="text-xs text-muted-foreground">Spaces</div>
                      </div>
                    )}
                  </div>

                  {selectedCarpark.is_stale && (
                    <Badge variant="outline" className="w-full justify-center">
                      Data may be outdated
                    </Badge>
                  )}

                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    Last updated: {new Date(selectedCarpark.lastupdate).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </InfoWindow>
          )}
        </Map>
      </APIProvider>
    </div>
  );
}
