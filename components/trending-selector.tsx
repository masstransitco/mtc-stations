"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/components/theme-provider";
import { TrendingUp, ChevronDown, MapPin } from "lucide-react";
import TrendingCarparks from "@/components/trending-carparks";
import TrendingMeteredCarparks from "@/components/trending-metered-carparks";
import NearbyMeList from "@/components/nearby-me-list";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { selectTrendingTab, setTrendingTab, type TrendingTab } from "@/store/carparkSlice";
import type { MeteredCarpark } from "@/types/metered-carpark";
import type { ConnectedCarpark } from "@/types/connected-carpark";

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
            if (isNearbySelected) {
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
            color: isNearbySelected
              ? isDarkMode ? "#9ca3af" : "#6b7280"
              : isDarkMode ? "#f3f4f6" : "#111827",
            background: isNearbySelected
              ? "transparent"
              : isDarkMode ? "#1f2937" : "#f3f4f6",
            border: isNearbySelected
              ? isDarkMode ? "1px solid #374151" : "1px solid #e5e7eb"
              : isDarkMode ? "1px solid #374151" : "1px solid #d1d5db",
            borderRadius: "8px",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <TrendingUp size={16} color={isNearbySelected ? (isDarkMode ? "#6b7280" : "#9ca3af") : (isDarkMode ? "#60a5fa" : "#3b82f6")} />
          {!isNearbySelected && selectedOption?.label}
          {!isNearbySelected && (
            <ChevronDown
              size={14}
              color={isDarkMode ? "#9ca3af" : "#6b7280"}
              style={{
                transform: isDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}
            />
          )}
          {isNearbySelected && "Trending"}
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
          <MapPin size={16} color={isNearbySelected ? (isDarkMode ? "#60a5fa" : "#3b82f6") : (isDarkMode ? "#6b7280" : "#9ca3af")} />
          Nearby Me
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
          : "Nearest carparks to your location"}
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
    </div>
  );
}
