"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTheme } from "@/components/theme-provider";
import { Navigation2, MapPin, Loader2, Building2 } from "lucide-react";
import type { MeteredCarpark } from "@/types/metered-carpark";
import type { ConnectedCarpark } from "@/types/connected-carpark";

// Parking meter icon matching the map marker
const ParkingMeterIcon = ({ size = 14, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: "block" }}
  >
    <path d="M11 15h2"/>
    <path d="M12 12v3"/>
    <path d="M12 19v3"/>
    <path d="M15.282 19a1 1 0 0 0 .948-.68l2.37-6.988a7 7 0 1 0-13.2 0l2.37 6.988a1 1 0 0 0 .948.68z"/>
    <path d="M9 9a3 3 0 1 1 6 0"/>
  </svg>
);

interface LocationData {
  latitude: number;
  longitude: number;
}

type NearbyCarpark =
  | { type: 'connected'; data: ConnectedCarpark; distance: number }
  | { type: 'metered'; data: MeteredCarpark; distance: number };

interface NearbyMeListProps {
  userLocation: LocationData | null;
  onConnectedCarparkClick: (carpark: ConnectedCarpark) => void;
  onMeteredCarparkClick: (carpark: MeteredCarpark) => void;
  getMeteredMarkerColor: (vacancy: number) => string;
}

// Haversine formula to calculate distance between two points (returns km)
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Thresholds to prevent excessive refetching
const DISTANCE_THRESHOLD_METERS = 50;
const MIN_FETCH_INTERVAL_MS = 30000; // 30 seconds

export default function NearbyMeList({
  userLocation,
  onConnectedCarparkClick,
  onMeteredCarparkClick,
  getMeteredMarkerColor,
}: NearbyMeListProps) {
  const { isDarkMode } = useTheme();
  const [nearbyCarparks, setNearbyCarparks] = useState<NearbyCarpark[]>([]);
  const [loading, setLoading] = useState(true);

  // Refs to track last fetch state for throttling
  const lastFetchedLocationRef = useRef<LocationData | null>(null);
  const lastFetchTimeRef = useRef<number>(0);

  // Check if we should refetch based on distance and time thresholds
  const shouldRefetch = useCallback((newLocation: LocationData): boolean => {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;

    // Always fetch on first load
    if (!lastFetchedLocationRef.current) return true;

    // Enforce minimum interval (30 seconds)
    if (timeSinceLastFetch < MIN_FETCH_INTERVAL_MS) return false;

    // Check distance threshold (50 meters)
    const distanceKm = calculateDistance(
      lastFetchedLocationRef.current.latitude,
      lastFetchedLocationRef.current.longitude,
      newLocation.latitude,
      newLocation.longitude
    );
    const distanceMeters = distanceKm * 1000;

    return distanceMeters >= DISTANCE_THRESHOLD_METERS;
  }, []);

  // Vacancy color function (adopted from legacy NearbyCarparksList)
  const getVacancyColor = (vacancy: number): string => {
    if (vacancy > 50) return "#0ea5e9";
    if (vacancy > 20) return "#3b82f6";
    if (vacancy > 10) return "#6366f1";
    if (vacancy > 5) return "#8b5cf6";
    if (vacancy > 0) return "#a855f7";
    return "#e11d48";
  };

  const fetchNearbyCarparks = useCallback(async () => {
    if (!userLocation) return;

    // Check if we should refetch based on distance/time thresholds
    if (!shouldRefetch(userLocation)) return;

    setLoading(true);
    try {
      // Fetch both connected and metered carparks in parallel
      const [connectedResponse, meteredResponse] = await Promise.all([
        fetch("/api/connected-carparks"),
        fetch("/api/metered-carparks"),
      ]);

      const allCarparks: NearbyCarpark[] = [];

      if (connectedResponse.ok) {
        const connectedData: ConnectedCarpark[] = await connectedResponse.json();
        connectedData.forEach((carpark) => {
          allCarparks.push({
            type: 'connected',
            data: carpark,
            distance: calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              carpark.latitude,
              carpark.longitude
            ),
          });
        });
      }

      if (meteredResponse.ok) {
        const meteredData: MeteredCarpark[] = await meteredResponse.json();
        meteredData.forEach((carpark) => {
          allCarparks.push({
            type: 'metered',
            data: carpark,
            distance: calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              carpark.latitude,
              carpark.longitude
            ),
          });
        });
      }

      // Sort by distance and take top 10
      const sorted = allCarparks
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10);

      setNearbyCarparks(sorted);

      // Update refs after successful fetch
      lastFetchedLocationRef.current = userLocation;
      lastFetchTimeRef.current = Date.now();
    } catch (error) {
      console.error("Error fetching nearby carparks:", error);
    } finally {
      setLoading(false);
    }
  }, [userLocation, shouldRefetch]);

  useEffect(() => {
    fetchNearbyCarparks();
  }, [fetchNearbyCarparks]);

  if (!userLocation) {
    return (
      <div
        style={{
          padding: "40px 20px",
          textAlign: "center",
          color: isDarkMode ? "#9ca3af" : "#6b7280",
          fontSize: "14px",
        }}
      >
        <MapPin
          size={32}
          style={{ marginBottom: "12px", opacity: 0.5 }}
          color={isDarkMode ? "#6b7280" : "#9ca3af"}
        />
        <div>Enable location to see nearby carparks</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          padding: "40px 20px",
          textAlign: "center",
          color: isDarkMode ? "#9ca3af" : "#6b7280",
        }}
      >
        <Loader2
          size={24}
          style={{ animation: "spin 1s linear infinite", marginBottom: "12px" }}
          color={isDarkMode ? "#60a5fa" : "#3b82f6"}
        />
        <div style={{ fontSize: "14px" }}>Finding nearby carparks...</div>
        <style jsx>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  const handleClick = (item: NearbyCarpark) => {
    if (item.type === 'connected') {
      onConnectedCarparkClick(item.data);
    } else {
      onMeteredCarparkClick(item.data);
    }
  };

  // Format distance for display
  const formatDistance = (distanceKm: number): string => {
    if (distanceKm < 1) {
      return `${(distanceKm * 1000).toFixed(0)}m`;
    }
    return `${distanceKm.toFixed(2)} km`;
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {nearbyCarparks.map((item) => {
        const isMetered = item.type === 'metered';
        const meteredData = isMetered ? (item.data as MeteredCarpark) : null;
        const connectedData = !isMetered ? (item.data as ConnectedCarpark) : null;

        const name = isMetered ? meteredData!.name : connectedData!.name;
        const key = isMetered ? meteredData!.carpark_id : connectedData!.park_id;
        const address = isMetered ? meteredData!.district : connectedData!.address;
        const vacancy = isMetered ? meteredData!.vacant_spaces : null; // ConnectedCarpark doesn't have real-time vacancy

        return (
          <div
            key={key}
            onClick={() => handleClick(item)}
            style={{
              padding: "16px",
              backgroundColor: isDarkMode ? "#111827" : "#f9fafb",
              border: isDarkMode ? "1px solid #374151" : "1px solid #e5e7eb",
              borderRadius: "12px",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = isDarkMode
                ? "0 4px 12px rgba(0, 0, 0, 0.3)"
                : "0 4px 12px rgba(0, 0, 0, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "8px",
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "4px",
                  }}
                >
                  {/* Type Icon */}
                  {isMetered ? (
                    <ParkingMeterIcon size={16} color={isDarkMode ? "#9ca3af" : "#6b7280"} />
                  ) : (
                    <Building2 size={16} color={isDarkMode ? "#9ca3af" : "#6b7280"} />
                  )}
                  <h4
                    style={{
                      margin: 0,
                      fontSize: "16px",
                      fontWeight: 600,
                      color: isDarkMode ? "#f3f4f6" : "#111827",
                    }}
                  >
                    {name}
                  </h4>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "12px",
                    color: isDarkMode ? "#9ca3af" : "#6b7280",
                  }}
                >
                  <Navigation2 size={14} />
                  <span>{formatDistance(item.distance)} away</span>
                </div>
              </div>
              {/* Vacancy display - only for metered carparks */}
              {isMetered && vacancy !== null && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: "4px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: 700,
                      color: getVacancyColor(vacancy),
                    }}
                  >
                    {vacancy}
                  </div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: isDarkMode ? "#9ca3af" : "#6b7280",
                      textTransform: "uppercase",
                    }}
                  >
                    / {meteredData!.tracked_spaces}
                  </div>
                </div>
              )}
            </div>

            {/* Address */}
            {address && (
              <div
                style={{
                  fontSize: "13px",
                  color: isDarkMode ? "#9ca3af" : "#6b7280",
                  marginBottom: "8px",
                  lineHeight: 1.4,
                }}
              >
                {address}
              </div>
            )}

            {/* Tags */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              {/* Type Badge */}
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  backgroundColor: isMetered
                    ? isDarkMode ? "#1e3a8a" : "#dbeafe"
                    : isDarkMode ? "#064e3b" : "#d1fae5",
                  color: isMetered
                    ? isDarkMode ? "#bfdbfe" : "#1e3a8a"
                    : isDarkMode ? "#6ee7b7" : "#047857",
                }}
              >
                {isMetered ? "Metered" : "Indoor"}
              </span>

            </div>
          </div>
        );
      })}

      {nearbyCarparks.length === 0 && !loading && (
        <div
          style={{
            padding: "20px",
            textAlign: "center",
            color: isDarkMode ? "#9ca3af" : "#6b7280",
            fontSize: "13px",
          }}
        >
          No carparks found nearby
        </div>
      )}
    </div>
  );
}
