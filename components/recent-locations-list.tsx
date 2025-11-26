"use client";

import { useTheme } from "@/components/theme-provider";
import { X, Clock } from "lucide-react";
import { useCarparkActions } from "@/hooks/use-carpark-actions";
import type { RecentSearch } from "@/store/carparkSlice";

interface RecentLocationsListProps {
  onLocationClick: (location: RecentSearch) => void;
}

export default function RecentLocationsList({
  onLocationClick,
}: RecentLocationsListProps) {
  const { isDarkMode } = useTheme();
  const { recentSearches, handleRemoveRecentSearch } = useCarparkActions();

  if (recentSearches.length === 0) {
    return (
      <div
        style={{
          padding: "40px 20px",
          textAlign: "center",
          color: isDarkMode ? "#9ca3af" : "#6b7280",
          fontSize: "14px",
        }}
      >
        <Clock
          size={32}
          style={{ marginBottom: "12px", opacity: 0.5 }}
          color={isDarkMode ? "#6b7280" : "#9ca3af"}
        />
        <div>No recent searches</div>
        <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>
          Your searched locations will appear here
        </div>
      </div>
    );
  }

  const handleRemove = (e: React.MouseEvent, placeId: string) => {
    e.stopPropagation();
    handleRemoveRecentSearch(placeId);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {recentSearches.map((item: RecentSearch) => (
        <div
          key={item.place_id}
          onClick={() => onLocationClick(item)}
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
          {/* Main Content - Name and Address */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
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
              {item.name}
            </div>
            {item.address !== item.name && (
              <div
                style={{
                  fontSize: "11px",
                  color: isDarkMode ? "#9ca3af" : "#6b7280",
                  lineHeight: 1.3,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.address}
              </div>
            )}
          </div>

          {/* Remove Button */}
          <button
            onClick={(e) => handleRemove(e, item.place_id)}
            style={{
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "transparent",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              color: isDarkMode ? "#6b7280" : "#9ca3af",
              transition: "all 0.15s ease",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? "#4b5563" : "#e5e7eb";
              e.currentTarget.style.color = isDarkMode ? "#f3f4f6" : "#374151";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = isDarkMode ? "#6b7280" : "#9ca3af";
            }}
            aria-label="Remove from recents"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
