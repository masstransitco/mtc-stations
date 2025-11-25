"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/components/theme-provider";
import { TrendingUp, ChevronDown } from "lucide-react";
import TrendingCarparks from "@/components/trending-carparks";
import TrendingMeteredCarparks from "@/components/trending-metered-carparks";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { selectTrendingTab, setTrendingTab, type TrendingTab } from "@/store/carparkSlice";
import type { MeteredCarpark } from "@/types/metered-carpark";

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

interface TrendingSelectorProps {
  onIndoorCarparkClick: (carpark: CarparkData) => void;
  onMeteredCarparkClick: (carpark: MeteredCarpark) => void;
  getMarkerColor: (vacancy: number) => string;
  getMeteredMarkerColor: (vacancy: number) => string;
}

const TRENDING_OPTIONS: { value: TrendingTab; label: string }[] = [
  { value: "indoor", label: "Trending Carparks" },
  { value: "metered", label: "Trending Metered Carparks" },
];

export default function TrendingSelector({
  onIndoorCarparkClick,
  onMeteredCarparkClick,
  getMarkerColor,
  getMeteredMarkerColor,
}: TrendingSelectorProps) {
  const { isDarkMode } = useTheme();
  const dispatch = useAppDispatch();
  const selectedType = useAppSelector(selectTrendingTab);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = TRENDING_OPTIONS.find((o) => o.value === selectedType);

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

  return (
    <div>
      {/* Header with Dropdown */}
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
        <TrendingUp size={18} color={isDarkMode ? "#60a5fa" : "#3b82f6"} />

        {/* Dropdown Trigger */}
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            margin: 0,
            padding: 0,
            fontSize: "16px",
            fontWeight: 600,
            color: isDarkMode ? "#f3f4f6" : "#111827",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          {selectedOption?.label}
          <ChevronDown
            size={16}
            color={isDarkMode ? "#9ca3af" : "#6b7280"}
            style={{
              transform: isDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          />
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
          : "Most active on-street parking in the past 6 hours"}
      </p>

      {/* Content - Render selected trending list without its own header */}
      {selectedType === "indoor" ? (
        <TrendingCarparks
          onCarparkClick={onIndoorCarparkClick}
          getMarkerColor={getMarkerColor}
          showHeader={false}
        />
      ) : (
        <TrendingMeteredCarparks
          onCarparkClick={onMeteredCarparkClick}
          getMarkerColor={getMeteredMarkerColor}
          showHeader={false}
        />
      )}
    </div>
  );
}
