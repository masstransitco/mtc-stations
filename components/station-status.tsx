"use client";

import { useTheme } from "@/components/theme-provider";
import VacancyTrendChart from "@/components/vacancy-trend-chart";

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
}

interface StationStatusProps {
  carpark: CarparkData;
  getMarkerColor: (vacancy: number) => string;
}

export default function StationStatus({ carpark, getMarkerColor }: StationStatusProps) {
  const { isDarkMode } = useTheme();

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
          backgroundColor: carpark.opening_status === "OPEN"
            ? (isDarkMode ? '#065f46' : '#d1fae5')
            : (isDarkMode ? '#7f1d1d' : '#fee2e2'),
          color: carpark.opening_status === "OPEN"
            ? (isDarkMode ? '#d1fae5' : '#065f46')
            : (isDarkMode ? '#fee2e2' : '#7f1d1d')
        }}>
          {carpark.opening_status || 'Unknown'}
        </span>
      </div>

      {/* Address */}
      <div style={{
        fontSize: '13px',
        color: isDarkMode ? '#9ca3af' : '#6b7280',
        marginBottom: '16px',
        lineHeight: 1.5
      }}>
        {carpark.display_address}
      </div>

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
        gridTemplateColumns: carpark.vacancy_ev !== null && carpark.vacancy_ev > 0 ? '1fr 1fr' : '1fr',
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
            color: getMarkerColor(carpark.vacancy)
          }}>
            {carpark.vacancy}
          </div>
          <div style={{
            fontSize: '11px',
            color: isDarkMode ? '#9ca3af' : '#6b7280',
            marginTop: '4px',
            textTransform: 'capitalize'
          }}>
            {carpark.vehicle_type.replace('privateCar', 'Private Car')}
          </div>
        </div>

        {carpark.vacancy_ev !== null && carpark.vacancy_ev > 0 && (
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
              EV Charging
            </div>
            <div style={{
              fontSize: '40px',
              fontWeight: 700,
              lineHeight: 1,
              color: '#10b981'
            }}>
              {carpark.vacancy_ev}
            </div>
            <div style={{
              fontSize: '11px',
              color: isDarkMode ? '#9ca3af' : '#6b7280',
              marginTop: '4px'
            }}>
              Spaces
            </div>
          </div>
        )}
      </div>

      {/* Disabled Parking */}
      {carpark.vacancy_dis !== null && carpark.vacancy_dis > 0 && (
        <div style={{
          padding: '10px 14px',
          backgroundColor: isDarkMode ? '#1e3a8a' : '#dbeafe',
          borderRadius: '8px',
          fontSize: '12px',
          color: isDarkMode ? '#bfdbfe' : '#1e3a8a',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          border: isDarkMode ? 'none' : '1px solid #93c5fd'
        }}>
          <span style={{ fontWeight: 500 }}>♿ Accessible Parking</span>
          <span style={{ fontWeight: 700, fontSize: '15px' }}>{carpark.vacancy_dis}</span>
        </div>
      )}

      {/* Vacancy Trend Chart */}
      <div style={{ marginBottom: '16px' }}>
        <VacancyTrendChart
          parkId={carpark.park_id}
          vehicleType={carpark.vehicle_type}
          hours={6}
        />
      </div>

      {/* Last Updated */}
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
          {new Date(carpark.lastupdate).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Hong_Kong'
          })}
        </span>
      </div>
    </div>
  );
}
