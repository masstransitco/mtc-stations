"use client";

import { APIProvider, Map, AdvancedMarker, InfoWindow } from "@vis.gl/react-google-maps";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
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

export default function SimpleMap() {
  const [carparks, setCarparks] = useState<CarparkWithVacancy[]>([]);
  const [selectedCarpark, setSelectedCarpark] = useState<CarparkWithVacancy | null>(null);
  const [loading, setLoading] = useState(true);
  const { isDarkMode } = useTheme();

  const apiKey = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();
  const mapId = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "").trim();
  const center = { lat: 22.3193, lng: 114.1694 };

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

  return (
    <div style={{ width: '100%', height: '100%' }}>
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

      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={center}
          defaultZoom={11}
          mapId={mapId}
          colorScheme={isDarkMode ? 'DARK' : 'LIGHT'}
          style={{ width: "100%", height: "100%" }}
          gestureHandling="greedy"
        >
          {carparks.map((carpark) => (
            <AdvancedMarker
              key={`${carpark.park_id}-${carpark.vehicle_type}`}
              position={{ lat: carpark.latitude, lng: carpark.longitude }}
              onClick={() => setSelectedCarpark(carpark)}
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

          {selectedCarpark && (
            <InfoWindow
              position={{
                lat: selectedCarpark.latitude,
                lng: selectedCarpark.longitude
              }}
              onCloseClick={() => setSelectedCarpark(null)}
            >
              <div style={{
                minWidth: '320px',
                maxWidth: '380px',
                padding: '20px',
                backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                color: isDarkMode ? '#f3f4f6' : '#111827',
                borderRadius: '12px',
                animation: 'fadeIn 0.3s ease-out',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>
                <style>{`
                  @keyframes fadeIn {
                    from {
                      opacity: 0;
                      transform: translateY(8px);
                    }
                    to {
                      opacity: 1;
                      transform: translateY(0);
                    }
                  }
                `}</style>

                {/* Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px',
                  marginBottom: '16px'
                }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    margin: 0,
                    lineHeight: 1.3,
                    flex: 1
                  }}>
                    {selectedCarpark.name}
                  </h3>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    backgroundColor: selectedCarpark.opening_status === "OPEN"
                      ? (isDarkMode ? '#065f46' : '#d1fae5')
                      : (isDarkMode ? '#7f1d1d' : '#fee2e2'),
                    color: selectedCarpark.opening_status === "OPEN"
                      ? (isDarkMode ? '#d1fae5' : '#065f46')
                      : (isDarkMode ? '#fee2e2' : '#7f1d1d')
                  }}>
                    {selectedCarpark.opening_status || 'Unknown'}
                  </span>
                </div>

                {/* Address */}
                <div style={{
                  fontSize: '13px',
                  color: isDarkMode ? '#9ca3af' : '#6b7280',
                  marginBottom: '20px',
                  lineHeight: 1.5
                }}>
                  {selectedCarpark.display_address}
                </div>

                {/* Vacancy Info */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: selectedCarpark.vacancy_ev !== null && selectedCarpark.vacancy_ev > 0 ? '1fr 1fr' : '1fr',
                  gap: '16px',
                  padding: '16px',
                  backgroundColor: isDarkMode ? '#111827' : '#f9fafb',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}>
                  <div>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: isDarkMode ? '#9ca3af' : '#6b7280',
                      marginBottom: '6px'
                    }}>
                      Available
                    </div>
                    <div style={{
                      fontSize: '36px',
                      fontWeight: 700,
                      lineHeight: 1,
                      color: getMarkerColor(selectedCarpark.vacancy)
                    }}>
                      {selectedCarpark.vacancy}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: isDarkMode ? '#9ca3af' : '#6b7280',
                      marginTop: '4px',
                      textTransform: 'capitalize'
                    }}>
                      {selectedCarpark.vehicle_type.replace('privateCar', 'Private Car')}
                    </div>
                  </div>

                  {selectedCarpark.vacancy_ev !== null && selectedCarpark.vacancy_ev > 0 && (
                    <div style={{
                      borderLeft: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb',
                      paddingLeft: '16px'
                    }}>
                      <div style={{
                        fontSize: '11px',
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: isDarkMode ? '#9ca3af' : '#6b7280',
                        marginBottom: '6px'
                      }}>
                        EV Charging
                      </div>
                      <div style={{
                        fontSize: '36px',
                        fontWeight: 700,
                        lineHeight: 1,
                        color: '#22c55e'
                      }}>
                        {selectedCarpark.vacancy_ev}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: isDarkMode ? '#9ca3af' : '#6b7280',
                        marginTop: '4px'
                      }}>
                        Spaces
                      </div>
                    </div>
                  )}
                </div>

                {/* Disabled Parking */}
                {selectedCarpark.vacancy_dis !== null && selectedCarpark.vacancy_dis > 0 && (
                  <div style={{
                    padding: '10px 12px',
                    backgroundColor: isDarkMode ? '#1e3a8a' : '#dbeafe',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: isDarkMode ? '#bfdbfe' : '#1e3a8a',
                    marginBottom: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>Accessible Parking</span>
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>{selectedCarpark.vacancy_dis}</span>
                  </div>
                )}

                {/* Last Updated */}
                <div style={{
                  fontSize: '11px',
                  color: isDarkMode ? '#6b7280' : '#9ca3af',
                  paddingTop: '12px',
                  borderTop: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>Last updated</span>
                  <span>{new Date(selectedCarpark.lastupdate).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</span>
                </div>
              </div>
            </InfoWindow>
          )}
        </Map>
      </APIProvider>
    </div>
  );
}
