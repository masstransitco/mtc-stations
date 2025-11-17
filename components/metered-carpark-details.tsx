"use client";

import { useTheme } from "@/components/theme-provider";
import type { MeteredCarpark } from "@/types/metered-carpark";
import MeteredVacancyTrendChart from "@/components/metered-vacancy-trend-chart";

interface MeteredCarparkDetailsProps {
  carpark: MeteredCarpark;
  getMarkerColor: (vacancy: number) => string;
}

export default function MeteredCarparkDetails({ carpark, getMarkerColor }: MeteredCarparkDetailsProps) {
  const { isDarkMode } = useTheme();

  // Calculate occupancy percentage
  const occupancyRate = carpark.tracked_spaces > 0
    ? Math.round((carpark.occupied_spaces / carpark.tracked_spaces) * 100)
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
        <span style={{
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          flexShrink: 0,
          backgroundColor: isDarkMode ? '#065f46' : '#d1fae5',
          color: isDarkMode ? '#d1fae5' : '#065f46'
        }}>
          Metered
        </span>
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
            color: getMarkerColor(carpark.vacant_spaces)
          }}>
            {carpark.vacant_spaces}
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
            {carpark.occupied_spaces}
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
