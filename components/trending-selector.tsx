"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/components/theme-provider";
import { TrendingUp, ChevronDown } from "lucide-react";
import TrendingCarparks from "@/components/trending-carparks";
import TrendingMeteredCarparks from "@/components/trending-metered-carparks";
import NearbyMeList from "@/components/nearby-me-list";
import RecentLocationsList from "@/components/recent-locations-list";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { selectTrendingTab, setTrendingTab, type TrendingTab, type RecentSearch } from "@/store/carparkSlice";
import type { MeteredCarpark } from "@/types/metered-carpark";
import type { ConnectedCarpark } from "@/types/connected-carpark";

// Nearby Me icon (crosshair style)
const NearbyMeIcon = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    height={size}
    viewBox="0 -960 960 960"
    width={size}
    fill={color}
    style={{ display: "block" }}
  >
    <path d="M480-400q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm-40-240v-200h80v200h-80Zm0 520v-200h80v200h-80Zm200-320v-80h200v80H640Zm-520 0v-80h200v80H120Z"/>
  </svg>
);

// Recents icon (location marker with inner dot)
const RecentsIcon = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    height={size}
    viewBox="0 -960 960 960"
    width={size}
    fill={color}
    style={{ display: "block" }}
  >
    <path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-180q45-45 80-93 30-41 55-90t25-97q0-66-47-113t-113-47q-66 0-113 47t-47 113q0 48 25 97t55 90q35 48 80 93Zm0-220q-25 0-42.5-17.5T420-540q0-25 17.5-42.5T480-600q25 0 42.5 17.5T540-540q0 25-17.5 42.5T480-480Z"/>
  </svg>
);

interface CarparkData {
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
  activity_score?: number;
}

interface LocationData {
  latitude: number;
  longitude: number;
}

interface TrendingSelectorProps {
  onIndoorCarparkClick: (carpark: CarparkData) => void;
  onMeteredCarparkClick: (carpark: MeteredCarpark) => void;
  onConnectedCarparkClick: (carpark: ConnectedCarpark) => void;
  getMarkerColor: (vacancy: number) => string;
  getMeteredMarkerColor: (vacancy: number) => string;
  onNearbyMeClick: () => void;
  onRecentLocationClick: (location: RecentSearch) => void;
  userLocation: LocationData | null;
  isTracking: boolean;
}

const TRENDING_OPTIONS: { value: TrendingTab; label: string }[] = [
  { value: "indoor", label: "Trending Carparks" },
  { value: "metered", label: "Trending Metered Carparks" },
];

export default function TrendingSelector({
  onIndoorCarparkClick,
  onMeteredCarparkClick,
  onConnectedCarparkClick,
  getMarkerColor,
  getMeteredMarkerColor,
  onNearbyMeClick,
  onRecentLocationClick,
  userLocation,
  isTracking,
}: TrendingSelectorProps) {
  const { isDarkMode } = useTheme();
  const dispatch = useAppDispatch();
  const selectedType = useAppSelector(selectTrendingTab);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = TRENDING_OPTIONS.find((o) => o.value === selectedType);
  const isNearbySelected = selectedType === "nearby";
  const isRecentsSelected = selectedType === "recents";
  const isTrendingSelected = selectedType === "indoor" || selectedType === "metered";

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNearbyMeClick = () => {
    dispatch(setTrendingTab("nearby"));
    if (!isTracking) {
      onNearbyMeClick();
    }
  };

  return (
    <div>
      {/* Header with Tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "16px",
          position: "relative",
        }}
        ref={dropdownRef}
      >
        {/* Trending Tab */}
        <button
          onClick={() => {
            if (!isTrendingSelected) {
              dispatch(setTrendingTab("indoor"));
            } else {
              setIsDropdownOpen(!isDropdownOpen);
            }
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            margin: 0,
            padding: "6px 10px",
            fontSize: "14px",
            fontWeight: 600,
            color: isTrendingSelected
              ? isDarkMode ? "#f3f4f6" : "#111827"
              : isDarkMode ? "#9ca3af" : "#6b7280",
            background: isTrendingSelected
              ? isDarkMode ? "#1f2937" : "#f3f4f6"
              : "transparent",
            border: isTrendingSelected
              ? isDarkMode ? "1px solid #374151" : "1px solid #d1d5db"
              : isDarkMode ? "1px solid #374151" : "1px solid #e5e7eb",
            borderRadius: "8px",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <TrendingUp size={16} color={isTrendingSelected ? (isDarkMode ? "#60a5fa" : "#3b82f6") : (isDarkMode ? "#6b7280" : "#9ca3af")} />
          {isTrendingSelected && selectedOption?.label}
          {isTrendingSelected && (
            <ChevronDown
              size={14}
              color={isDarkMode ? "#9ca3af" : "#6b7280"}
              style={{
                transform: isDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}
            />
          )}
          {!isTrendingSelected && "Trending"}
        </button>

        {/* Nearby Me Tab */}
        <button
          onClick={handleNearbyMeClick}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            margin: 0,
            padding: "6px 10px",
            fontSize: "14px",
            fontWeight: 600,
            color: isNearbySelected
              ? isDarkMode ? "#f3f4f6" : "#111827"
              : isDarkMode ? "#9ca3af" : "#6b7280",
            background: isNearbySelected
              ? isDarkMode ? "#1f2937" : "#f3f4f6"
              : "transparent",
            border: isNearbySelected
              ? isDarkMode ? "1px solid #374151" : "1px solid #d1d5db"
              : isDarkMode ? "1px solid #374151" : "1px solid #e5e7eb",
            borderRadius: "8px",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <NearbyMeIcon size={16} color={isNearbySelected ? (isDarkMode ? "#60a5fa" : "#3b82f6") : (isDarkMode ? "#6b7280" : "#9ca3af")} />
          Nearby Me
        </button>

        {/* Recents Tab */}
        <button
          onClick={() => dispatch(setTrendingTab("recents"))}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            margin: 0,
            padding: "6px 10px",
            fontSize: "14px",
            fontWeight: 600,
            color: isRecentsSelected
              ? isDarkMode ? "#f3f4f6" : "#111827"
              : isDarkMode ? "#9ca3af" : "#6b7280",
            background: isRecentsSelected
              ? isDarkMode ? "#1f2937" : "#f3f4f6"
              : "transparent",
            border: isRecentsSelected
              ? isDarkMode ? "1px solid #374151" : "1px solid #d1d5db"
              : isDarkMode ? "1px solid #374151" : "1px solid #e5e7eb",
            borderRadius: "8px",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <RecentsIcon size={16} color={isRecentsSelected ? (isDarkMode ? "#60a5fa" : "#3b82f6") : (isDarkMode ? "#6b7280" : "#9ca3af")} />
          Recents
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: "26px",
              marginTop: "4px",
              backgroundColor: isDarkMode ? "#1f2937" : "#ffffff",
              border: isDarkMode ? "1px solid #374151" : "1px solid #e5e7eb",
              borderRadius: "8px",
              boxShadow: isDarkMode
                ? "0 4px 12px rgba(0, 0, 0, 0.4)"
                : "0 4px 12px rgba(0, 0, 0, 0.1)",
              zIndex: 10,
              overflow: "hidden",
              minWidth: "200px",
            }}
          >
            {TRENDING_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  dispatch(setTrendingTab(option.value));
                  setIsDropdownOpen(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px 14px",
                  fontSize: "14px",
                  fontWeight: selectedType === option.value ? 600 : 400,
                  color:
                    selectedType === option.value
                      ? isDarkMode
                        ? "#60a5fa"
                        : "#3b82f6"
                      : isDarkMode
                      ? "#f3f4f6"
                      : "#111827",
                  backgroundColor:
                    selectedType === option.value
                      ? isDarkMode
                        ? "#374151"
                        : "#f3f4f6"
                      : "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background-color 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (selectedType !== option.value) {
                    e.currentTarget.style.backgroundColor = isDarkMode
                      ? "#374151"
                      : "#f9fafb";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedType !== option.value) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
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
        {selectedType === "indoor"
          ? "Most active carparks in the past 6 hours"
          : selectedType === "metered"
          ? "Most active on-street parking in the past 6 hours"
          : selectedType === "nearby"
          ? "Nearest carparks to your location"
          : "Your recently searched locations"}
      </p>

      {/* Content - Render selected list */}
      {selectedType === "indoor" && (
        <TrendingCarparks
          onCarparkClick={onIndoorCarparkClick}
          getMarkerColor={getMarkerColor}
          showHeader={false}
        />
      )}
      {selectedType === "metered" && (
        <TrendingMeteredCarparks
          onCarparkClick={onMeteredCarparkClick}
          getMarkerColor={getMeteredMarkerColor}
          showHeader={false}
        />
      )}
      {selectedType === "nearby" && (
        <NearbyMeList
          userLocation={userLocation}
          onConnectedCarparkClick={onConnectedCarparkClick}
          onMeteredCarparkClick={onMeteredCarparkClick}
          getMeteredMarkerColor={getMeteredMarkerColor}
        />
      )}
      {selectedType === "recents" && (
        <RecentLocationsList
          onLocationClick={onRecentLocationClick}
        />
      )}
    </div>
  );
}
