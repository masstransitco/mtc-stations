"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { TrendingUp, Loader2 } from "lucide-react";
import type { MeteredCarpark } from "@/types/metered-carpark";

interface TrendingMeteredCarpark extends MeteredCarpark {
  activity_score: number;
  rank_change?: number | null;
}

// Position change indicator icons
const RankUpIcon = ({ color = "#22c55e" }: { color?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" height="14px" viewBox="0 -960 960 960" width="14px" fill={color}>
    <path d="m296-345-56-56 240-240 240 240-56 56-184-183-184 183Z"/>
  </svg>
);

const RankDownIcon = ({ color = "#ef4444" }: { color?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" height="14px" viewBox="0 -960 960 960" width="14px" fill={color}>
    <path d="M480-345 240-585l56-56 184 183 184-183 56 56-240 240Z"/>
  </svg>
);

interface TrendingMeteredCarparksProps {
  onCarparkClick: (carpark: MeteredCarpark) => void;
  getMarkerColor: (vacancy: number) => string;
  showHeader?: boolean;
}

export default function TrendingMeteredCarparks({
  onCarparkClick,
  getMarkerColor,
  showHeader = true,
}: TrendingMeteredCarparksProps) {
  const { isDarkMode } = useTheme();
  const [carparks, setCarparks] = useState<TrendingMeteredCarpark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrendingCarparks = async () => {
      try {
        const response = await fetch("/api/metered-carparks/trending");
        if (response.ok) {
          const data = await response.json();
          setCarparks(data);
        }
      } catch (error) {
        console.error("Error fetching trending metered carparks:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingCarparks();
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
          gap: "12px",
        }}
      >
        <Loader2
          size={32}
          color={isDarkMode ? "#9ca3af" : "#6b7280"}
          style={{ animation: "spin 1s linear infinite" }}
        />
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
        <span
          style={{
            fontSize: "14px",
            color: isDarkMode ? "#9ca3af" : "#6b7280",
          }}
        >
          Loading trending metered carparks...
        </span>
      </div>
    );
  }

  return (
    <div>
      {showHeader && (
        <>
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "16px",
            }}
          >
            <TrendingUp size={18} color={isDarkMode ? "#60a5fa" : "#3b82f6"} />
            <h4
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: 600,
                color: isDarkMode ? "#f3f4f6" : "#111827",
              }}
            >
              Trending Metered Carparks
            </h4>
          </div>

          {/* Subtitle */}
          <p
            style={{
              margin: "0 0 16px 0",
              fontSize: "13px",
              color: isDarkMode ? "#9ca3af" : "#6b7280",
              lineHeight: 1.5,
            }}
          >
            Most active on-street parking in the past 6 hours
          </p>
        </>
      )}

      {/* Carpark List */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {carparks.map((carpark, index) => (
          <div
            key={carpark.carpark_id}
            onClick={() => onCarparkClick(carpark)}
            style={{
              padding: "10px 12px",
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
              e.currentTarget.style.backgroundColor = isDarkMode
                ? "#374151"
                : "#f9fafb";
              e.currentTarget.style.borderColor = isDarkMode
                ? "#4b5563"
                : "#d1d5db";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode
                ? "#1f2937"
                : "#ffffff";
              e.currentTarget.style.borderColor = isDarkMode
                ? "#374151"
                : "#e5e7eb";
            }}
          >
            {/* Rank Number with Position Change Indicator */}
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
              {carpark.rank_change !== null && carpark.rank_change !== undefined && carpark.rank_change > 0 && (
                <RankUpIcon color={isDarkMode ? "#4ade80" : "#22c55e"} />
              )}
              {carpark.rank_change !== null && carpark.rank_change !== undefined && carpark.rank_change < 0 && (
                <RankDownIcon color={isDarkMode ? "#f87171" : "#ef4444"} />
              )}
            </div>

            {/* Main Content */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              {/* Name */}
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: isDarkMode ? "#f3f4f6" : "#111827",
                  lineHeight: 1.3,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {carpark.name}
              </div>

              {/* District */}
              {carpark.district && (
                <div
                  style={{
                    fontSize: "11px",
                    color: isDarkMode ? "#9ca3af" : "#6b7280",
                  }}
                >
                  {carpark.district}
                </div>
              )}
            </div>

            {/* Vacancy Info */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexShrink: 0,
              }}
            >
              {/* Vacant / Total */}
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "2px",
                }}
              >
                <span
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: getMarkerColor(carpark.vacant_spaces),
                    lineHeight: 1,
                  }}
                >
                  {carpark.vacant_spaces}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: isDarkMode ? "#6b7280" : "#9ca3af",
                  }}
                >
                  /{carpark.tracked_spaces}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {carparks.length === 0 && !loading && (
        <div
          style={{
            padding: "40px 20px",
            textAlign: "center",
            color: isDarkMode ? "#9ca3af" : "#6b7280",
            fontSize: "14px",
          }}
        >
          No trending metered carparks available
        </div>
      )}
    </div>
  );
}
