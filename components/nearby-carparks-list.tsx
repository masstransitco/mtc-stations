"use client";

import { useTheme } from "@/components/theme-provider";
import { MapPin, Navigation2 } from "lucide-react";

interface CarparkWithDistance {
  park_id: string;
  name: string;
  display_address: string;
  latitude: number;
  longitude: number;
  district: string | null;
  opening_status: string | null;
  vehicle_type: string;
  vacancy: number;
  vacancy_dis: number | null;
  vacancy_ev: number | null;
  lastupdate: string;
  is_stale: boolean;
  distance: number;
}

interface NearbyCarparksListProps {
  carparks: CarparkWithDistance[];
  onCarparkClick: (carpark: CarparkWithDistance) => void;
  loading?: boolean;
}

export default function NearbyCarparksList({
  carparks,
  onCarparkClick,
  loading = false,
}: NearbyCarparksListProps) {
  const { isDarkMode } = useTheme();

  const getVacancyColor = (vacancy: number) => {
    if (vacancy > 50) return "#0ea5e9";
    if (vacancy > 20) return "#3b82f6";
    if (vacancy > 10) return "#6366f1";
    if (vacancy > 5) return "#8b5cf6";
    if (vacancy > 0) return "#a855f7";
    return "#e11d48";
  };

  if (loading) {
    return (
      <div
        style={{
          padding: "20px",
          textAlign: "center",
          color: isDarkMode ? "#9ca3af" : "#6b7280",
        }}
      >
        Loading nearby carparks...
      </div>
    );
  }

  if (carparks.length === 0) {
    return (
      <div
        style={{
          padding: "20px",
          textAlign: "center",
          color: isDarkMode ? "#9ca3af" : "#6b7280",
        }}
      >
        No carparks found nearby. Try searching for a different location.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {carparks.map((carpark) => (
        <div
          key={carpark.park_id}
          onClick={() => onCarparkClick(carpark)}
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
              <h4
                style={{
                  margin: 0,
                  fontSize: "16px",
                  fontWeight: 600,
                  color: isDarkMode ? "#f3f4f6" : "#111827",
                  marginBottom: "4px",
                }}
              >
                {carpark.name}
              </h4>
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
                <span>{carpark.distance.toFixed(2)} km away</span>
              </div>
            </div>
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
                  color: getVacancyColor(carpark.vacancy),
                }}
              >
                {carpark.vacancy}
              </div>
              <div
                style={{
                  fontSize: "10px",
                  color: isDarkMode ? "#9ca3af" : "#6b7280",
                  textTransform: "uppercase",
                }}
              >
                Available
              </div>
            </div>
          </div>

          {/* Address */}
          <div
            style={{
              fontSize: "13px",
              color: isDarkMode ? "#9ca3af" : "#6b7280",
              marginBottom: "8px",
              lineHeight: 1.4,
            }}
          >
            {carpark.display_address}
          </div>

          {/* Additional Info */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            {carpark.opening_status && (
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  backgroundColor:
                    carpark.opening_status === "OPEN"
                      ? isDarkMode
                        ? "#065f46"
                        : "#d1fae5"
                      : isDarkMode
                      ? "#7f1d1d"
                      : "#fee2e2",
                  color:
                    carpark.opening_status === "OPEN"
                      ? isDarkMode
                        ? "#d1fae5"
                        : "#065f46"
                      : isDarkMode
                      ? "#fee2e2"
                      : "#7f1d1d",
                }}
              >
                {carpark.opening_status}
              </span>
            )}
            {carpark.vacancy_ev !== null && carpark.vacancy_ev > 0 && (
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  fontWeight: 600,
                  backgroundColor: isDarkMode ? "#064e3b" : "#d1fae5",
                  color: isDarkMode ? "#6ee7b7" : "#047857",
                }}
              >
                {carpark.vacancy_ev} EV
              </span>
            )}
            {carpark.vacancy_dis !== null && carpark.vacancy_dis > 0 && (
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  fontWeight: 600,
                  backgroundColor: isDarkMode ? "#1e3a8a" : "#dbeafe",
                  color: isDarkMode ? "#bfdbfe" : "#1e3a8a",
                }}
              >
                {carpark.vacancy_dis} Accessible
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
