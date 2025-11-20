"use client";

import { useTheme } from "@/components/theme-provider";
import type { DispatchCarpark } from "@/types/dispatch-carpark";
import { MapPin, Navigation } from "lucide-react";
import AvailableDispatchCars from "@/components/available-dispatch-cars";

interface DispatchCarparkDetailsProps {
  carpark: DispatchCarpark;
}

export default function DispatchCarparkDetails({ carpark }: DispatchCarparkDetailsProps) {
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
          backgroundColor: isDarkMode ? '#065f4640' : '#d1fae5',
          color: isDarkMode ? '#6ee7b7' : '#065f46'
        }}>
          Dispatch
        </span>
      </div>

      {/* Address */}
      {carpark.address && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          padding: '12px',
          backgroundColor: isDarkMode ? '#1f2937' : '#f9fafb',
          borderRadius: '8px',
          marginBottom: '12px',
          border: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb'
        }}>
          <MapPin size={16} style={{
            flexShrink: 0,
            marginTop: '2px',
            color: isDarkMode ? '#9ca3af' : '#6b7280'
          }} />
          <div style={{
            fontSize: '14px',
            color: isDarkMode ? '#d1d5db' : '#4b5563',
            lineHeight: 1.5
          }}>
            {carpark.address}
          </div>
        </div>
      )}

      {/* Available Dispatch Cars */}
      <div style={{ marginBottom: '16px' }}>
        <AvailableDispatchCars />
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginTop: '16px'
      }}>
        <button
          onClick={() => {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${carpark.latitude},${carpark.longitude}`;
            window.open(url, '_blank');
          }}
          style={{
            flex: 1,
            padding: '12px 16px',
            backgroundColor: isDarkMode ? '#047857' : '#065f46',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = isDarkMode ? '#065f46' : '#047857';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isDarkMode ? '#047857' : '#065f46';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <Navigation size={16} />
          Get Directions
        </button>
      </div>

      {/* Info Note */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        backgroundColor: isDarkMode ? '#1f2937' : '#f9fafb',
        borderRadius: '8px',
        borderLeft: `3px solid ${isDarkMode ? '#047857' : '#065f46'}`,
        fontSize: '12px',
        color: isDarkMode ? '#9ca3af' : '#6b7280',
        lineHeight: 1.5
      }}>
        <strong style={{ color: isDarkMode ? '#d1d5db' : '#4b5563' }}>Note:</strong> This is a Noah dispatch location. Contact Noah for vehicle dispatch services and availability.
      </div>
    </div>
  );
}
