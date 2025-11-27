"use client";

import { useEffect, useState, useMemo } from "react";
import { useTheme } from "@/components/theme-provider";
import type { MeteredCarpark } from "@/types/metered-carpark";
import MeteredVacancyTrendChart from "@/components/metered-vacancy-trend-chart";

interface VehicleTypeBreakdown {
  vehicle_type: string;
  vehicle_type_label: string;
  total_spaces: number;
  tracked_spaces: number;
  vacant_spaces: number;
  occupied_spaces: number;
}

export interface MeteredSpaceDetail {
  parking_space_id: string;
  latitude: number;
  longitude: number;
  vehicle_type: string;
  is_vacant: boolean | null;
  has_real_time_tracking: boolean;
}

interface MeteredCarparkDetailsProps {
  carpark: MeteredCarpark;
  getMarkerColor: (vacancy: number) => string;
  onShowSpaces?: (spaces: MeteredSpaceDetail[]) => void;
  onHideSpaces?: () => void;
}

// Vehicle type color scheme
const VEHICLE_TYPE_COLORS: Record<string, { primary: string; light: string; dark: string }> = {
  'A': { primary: '#3b82f6', light: '#dbeafe', dark: '#1e3a5f' },  // Blue - Private Car
  'G': { primary: '#f59e0b', light: '#fef3c7', dark: '#78350f' },  // Amber - Goods Vehicle
  'C': { primary: '#8b5cf6', light: '#ede9fe', dark: '#4c1d95' },  // Purple - Coach/Bus
};

export default function MeteredCarparkDetails({
  carpark: initialCarpark,
  getMarkerColor,
  onShowSpaces,
  onHideSpaces
}: MeteredCarparkDetailsProps) {
  const { isDarkMode } = useTheme();
  const [carpark, setCarpark] = useState<MeteredCarpark>(initialCarpark);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleTypeBreakdown[]>([]);
  const [selectedVehicleTypes, setSelectedVehicleTypes] = useState<Set<string>>(
    new Set(['A', 'C', 'G'])
  );
  const [showSpaces, setShowSpaces] = useState(false);
  const [spacesLoading, setSpacesLoading] = useState(false);

  // Toggle vehicle type filter
  const toggleVehicleType = (type: string) => {
    setSelectedVehicleTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        // Don't allow deselecting all - keep at least one
        if (next.size > 1) {
          next.delete(type);
        }
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // Computed filtered vacancy based on selected vehicle types
  const filteredVacancy = useMemo(() => {
    return vehicleTypes
      .filter(vt => selectedVehicleTypes.has(vt.vehicle_type))
      .reduce((sum, vt) => sum + (vt.vacant_spaces || 0), 0);
  }, [vehicleTypes, selectedVehicleTypes]);

  const filteredOccupied = useMemo(() => {
    return vehicleTypes
      .filter(vt => selectedVehicleTypes.has(vt.vehicle_type))
      .reduce((sum, vt) => sum + (vt.occupied_spaces || 0), 0);
  }, [vehicleTypes, selectedVehicleTypes]);

  const filteredTotal = useMemo(() => {
    return vehicleTypes
      .filter(vt => selectedVehicleTypes.has(vt.vehicle_type))
      .reduce((sum, vt) => sum + vt.tracked_spaces, 0);
  }, [vehicleTypes, selectedVehicleTypes]);

  // Theme-aware color function for vacancy text (darker colors in light mode for readability)
  const getVacancyColor = (vacancy: number): string => {
    if (isDarkMode) {
      // Dark mode: lighter grays are readable
      if (vacancy >= 4) return "#d1d5db"; // gray-300
      if (vacancy === 3) return "#9ca3af"; // gray-400
      if (vacancy === 2) return "#6b7280"; // gray-500
      if (vacancy === 1) return "#4b5563"; // gray-600
      return "#374151"; // gray-700
    } else {
      // Light mode: darker grays needed for white background
      if (vacancy >= 4) return "#374151"; // gray-700
      if (vacancy === 3) return "#4b5563"; // gray-600
      if (vacancy === 2) return "#6b7280"; // gray-500
      if (vacancy === 1) return "#9ca3af"; // gray-400
      return "#d1d5db"; // gray-300
    }
  };

  // Fetch fresh vacancy data and vehicle type breakdown on mount
  useEffect(() => {
    const fetchFreshData = async () => {
      try {
        const response = await fetch(
          `/api/metered-carparks?carpark_id=${encodeURIComponent(initialCarpark.carpark_id)}`,
          { cache: 'no-store' }
        );
        if (response.ok) {
          const data = await response.json();
          const freshCarpark = data.find((c: MeteredCarpark) => c.carpark_id === initialCarpark.carpark_id);
          if (freshCarpark) {
            setCarpark(freshCarpark);
          }
        }
      } catch (error) {
        console.error('Error fetching fresh metered carpark data:', error);
      }
    };

    const fetchVehicleTypes = async () => {
      try {
        const response = await fetch(
          `/api/metered-carparks/${encodeURIComponent(initialCarpark.carpark_id)}/spaces`
        );
        if (response.ok) {
          const data = await response.json();
          setVehicleTypes(data);
        }
      } catch (error) {
        console.error('Error fetching vehicle type breakdown:', error);
      }
    };

    fetchFreshData();
    fetchVehicleTypes();
  }, [initialCarpark.carpark_id]);

  // Fetch and show individual space markers when toggled
  useEffect(() => {
    if (showSpaces && onShowSpaces) {
      const fetchSpaces = async () => {
        setSpacesLoading(true);
        try {
          const response = await fetch(
            `/api/metered-carparks/${encodeURIComponent(initialCarpark.carpark_id)}/spaces/details`
          );
          if (response.ok) {
            const data = await response.json();
            onShowSpaces(data.spaces);
          }
        } catch (error) {
          console.error('Error fetching space details:', error);
        } finally {
          setSpacesLoading(false);
        }
      };
      fetchSpaces();
    } else if (!showSpaces && onHideSpaces) {
      onHideSpaces();
    }
  }, [showSpaces, initialCarpark.carpark_id, onShowSpaces, onHideSpaces]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      onHideSpaces?.();
    };
  }, [onHideSpaces]);

  // Calculate occupancy percentage based on filtered values
  const occupancyRate = filteredTotal > 0
    ? Math.round((filteredOccupied / filteredTotal) * 100)
    : 0;

  return (
    <div style={{
      width: '100%',
      animation: 'fadeIn 0.3s ease-out',
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
        gap: '8px',
        marginBottom: '12px'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: 600,
          margin: 0,
          lineHeight: 1.3,
          flex: 1,
          color: isDarkMode ? '#f3f4f6' : '#111827'
        }}>
          {carpark.name}
        </h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          {/* Show Spaces Toggle Button - only show when callbacks provided */}
          {onShowSpaces && onHideSpaces && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSpaces(!showSpaces);
              }}
              disabled={spacesLoading}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                cursor: spacesLoading ? 'wait' : 'pointer',
                transition: 'all 0.15s ease',
                backgroundColor: showSpaces
                  ? (isDarkMode ? '#1e3a5f' : '#dbeafe')
                  : (isDarkMode ? '#374151' : '#f3f4f6'),
                color: showSpaces
                  ? '#3b82f6'
                  : (isDarkMode ? '#9ca3af' : '#6b7280'),
                border: showSpaces
                  ? '1px solid #3b82f6'
                  : (isDarkMode ? '1px solid #4b5563' : '1px solid #d1d5db'),
                opacity: spacesLoading ? 0.6 : 1
              }}
            >
              {spacesLoading ? 'Loading...' : (showSpaces ? 'Hide Spaces' : 'Show Spaces')}
            </button>
          )}
          {/* Metered Badge */}
          <span style={{
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            backgroundColor: isDarkMode ? '#065f46' : '#d1fae5',
            color: isDarkMode ? '#d1fae5' : '#065f46'
          }}>
            Metered
          </span>
        </div>
      </div>

      {/* Chinese Name */}
      {carpark.name_tc && (
        <div style={{
          fontSize: '14px',
          color: isDarkMode ? '#d1d5db' : '#4b5563',
          marginBottom: '12px',
          lineHeight: 1.4
        }}>
          {carpark.name_tc}
        </div>
      )}

      {/* District Badge */}
      {carpark.district && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 10px',
          backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 500,
          color: isDarkMode ? '#d1d5db' : '#4b5563',
          marginBottom: '16px'
        }}>
          📍 {carpark.district}
        </div>
      )}

      {/* Vehicle Type Breakdown - Toggleable Filters */}
      {vehicleTypes.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '16px'
        }}>
          {vehicleTypes.map((vt) => {
            const isSelected = selectedVehicleTypes.has(vt.vehicle_type);
            const colors = VEHICLE_TYPE_COLORS[vt.vehicle_type] || VEHICLE_TYPE_COLORS['A'];
            return (
              <button
                key={vt.vehicle_type}
                onClick={() => toggleVehicleType(vt.vehicle_type)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  backgroundColor: isSelected
                    ? (isDarkMode ? colors.dark : colors.light)
                    : (isDarkMode ? '#1f2937' : '#f3f4f6'),
                  borderRadius: '8px',
                  border: isSelected
                    ? `1px solid ${colors.primary}`
                    : (isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb'),
                  cursor: 'pointer',
                  opacity: isSelected ? 1 : 0.5,
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{
                  fontSize: '12px',
                  color: isSelected
                    ? colors.primary
                    : (isDarkMode ? '#9ca3af' : '#6b7280')
                }}>
                  {vt.vehicle_type_label}
                </span>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: isSelected
                    ? (isDarkMode ? '#f3f4f6' : '#111827')
                    : (isDarkMode ? '#6b7280' : '#9ca3af')
                }}>
                  {vt.vacant_spaces ?? 0}/{vt.total_spaces}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Vacancy Info */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        padding: '16px',
        backgroundColor: isDarkMode ? '#111827' : '#f9fafb',
        borderRadius: '12px',
        marginBottom: '16px',
        border: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb'
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
            fontSize: '40px',
            fontWeight: 700,
            lineHeight: 1,
            color: getVacancyColor(filteredVacancy)
          }}>
            {filteredVacancy}
          </div>
          <div style={{
            fontSize: '11px',
            color: isDarkMode ? '#9ca3af' : '#6b7280',
            marginTop: '4px'
          }}>
            Vacant Spaces
          </div>
        </div>

        <div style={{
          borderLeft: isDarkMode ? '1px solid #374151' : '1px solid #d1d5db',
          paddingLeft: '12px'
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: isDarkMode ? '#9ca3af' : '#6b7280',
            marginBottom: '6px'
          }}>
            Occupied
          </div>
          <div style={{
            fontSize: '40px',
            fontWeight: 700,
            lineHeight: 1,
            color: isDarkMode ? '#f87171' : '#dc2626'
          }}>
            {filteredOccupied}
          </div>
          <div style={{
            fontSize: '11px',
            color: isDarkMode ? '#9ca3af' : '#6b7280',
            marginTop: '4px'
          }}>
            {occupancyRate}% Full
          </div>
        </div>
      </div>

      {/* Vacancy Trend Chart */}
      <div style={{ marginBottom: '16px' }}>
        <MeteredVacancyTrendChart
          carparkId={carpark.carpark_id}
          hours={6}
          vehicleTypes={Array.from(selectedVehicleTypes)}
        />
      </div>

      {/* Last Updated */}
      {carpark.last_updated && (
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
          <span style={{ fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
            {new Date(carpark.last_updated).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Asia/Hong_Kong'
            })}
          </span>
        </div>
      )}
    </div>
  );
}
