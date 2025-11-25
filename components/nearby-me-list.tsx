"use client";

import { useEffect, useState, useCallback } from "react";
import { useTheme } from "@/components/theme-provider";
import { Navigation2, MapPin, Loader2, Building2 } from "lucide-react";

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
import type { MeteredCarpark } from "@/types/metered-carpark";
import type { ConnectedCarpark } from "@/types/connected-carpark";

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

// Haversine formula to calculate distance between two points
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

export default function NearbyMeList({
  userLocation,
  onConnectedCarparkClick,
  onMeteredCarparkClick,
  getMeteredMarkerColor,
}: NearbyMeListProps) {
  const { isDarkMode } = useTheme();
  const [nearbyCarparks, setNearbyCarparks] = useState<NearbyCarpark[]>([]);
  const [loading, setLoading] = useState(true);

  // Theme-aware color function for metered list text
  const getListVacancyColor = (vacancy: number): string => {
    if (isDarkMode) {
      if (vacancy >= 4) return "#d1d5db";
      if (vacancy === 3) return "#9ca3af";
      if (vacancy === 2) return "#6b7280";
      if (vacancy === 1) return "#4b5563";
      return "#374151";
    } else {
      if (vacancy >= 4) return "#374151";
      if (vacancy === 3) return "#4b5563";
      if (vacancy === 2) return "#6b7280";
      if (vacancy === 1) return "#9ca3af";
      return "#d1d5db";
    }
  };

  const fetchNearbyCarparks = useCallback(async () => {
    if (!userLocation) return;

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
    } catch (error) {
      console.error("Error fetching nearby carparks:", error);
    } finally {
      setLoading(false);
    }
  }, [userLocation]);

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {nearbyCarparks.map((item, index) => {
        const isMetered = item.type === 'metered';
        const name = isMetered ? (item.data as MeteredCarpark).name : (item.data as ConnectedCarpark).name;
        const key = isMetered ? (item.data as MeteredCarpark).carpark_id : (item.data as ConnectedCarpark).park_id;

        return (
          <div
            key={key}
            onClick={() => handleClick(item)}
            style={{
              padding: "10px 12px",
              minHeight: "52px",
              boxSizing: "border-box",
              backgroundColor: isDarkMode ? "#1f2937" : "#ffffff",
              border: isDarkMode ? "1px solid #374151" : "1px solid #e5e7eb",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.15s ease",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? "#374151" : "#f9fafb";
              e.currentTarget.style.borderColor = isDarkMode ? "#4b5563" : "#d1d5db";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? "#1f2937" : "#ffffff";
              e.currentTarget.style.borderColor = isDarkMode ? "#374151" : "#e5e7eb";
            }}
          >
            {/* Rank Number */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "2px",
                minWidth: "32px",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: isDarkMode ? "#6b7280" : "#9ca3af",
                  minWidth: "16px",
                  textAlign: "center",
                }}
              >
                {index + 1}
              </span>
              {/* Type Icon */}
              {isMetered ? (
                <ParkingMeterIcon size={14} color={isDarkMode ? "#9ca3af" : "#6b7280"} />
              ) : (
                <Building2 size={14} color={isDarkMode ? "#9ca3af" : "#6b7280"} />
              )}
            </div>

            {/* Main Content - Name only */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: "13px",
                fontWeight: 600,
                color: isDarkMode ? "#f3f4f6" : "#111827",
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {name}
            </div>

            {/* Distance */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "12px",
                color: isDarkMode ? "#9ca3af" : "#6b7280",
                flexShrink: 0,
              }}
            >
              <Navigation2 size={12} />
              <span>
                {item.distance < 1
                  ? `${(item.distance * 1000).toFixed(0)}m`
                  : `${item.distance.toFixed(1)}km`}
              </span>
            </div>

            {/* Vacancy Info (for metered only) */}
            {isMetered && (
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "2px",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: getListVacancyColor((item.data as MeteredCarpark).vacant_spaces),
                    lineHeight: 1,
                  }}
                >
                  {(item.data as MeteredCarpark).vacant_spaces}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: isDarkMode ? "#6b7280" : "#9ca3af",
                  }}
                >
                  /{(item.data as MeteredCarpark).tracked_spaces}
                </span>
              </div>
            )}
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
