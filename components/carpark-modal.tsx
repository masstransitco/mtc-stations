'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from './theme-provider';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';

interface CarparkModalProps {
  carpark: {
    park_id: string;
    name: string;
    display_address: string;
    latitude: number;
    longitude: number;
    district: string;
    current_vacancy: number;
    max_capacity: number;
    size_category: string;
    activity_score: number;
    avg_variance: number;
    avg_rate_change: number;
    lastupdate: string;
    time_series: Array<{
      hour: string;
      avg_vacancy: number;
      min_vacancy: number;
      max_vacancy: number;
      vacancy_stddev: number;
      rate_of_change: number;
    }>;
  };
  onClose: () => void;
}

export function CarparkModal({ carpark, onClose }: CarparkModalProps) {
  const { isDarkMode } = useTheme();
  const modalRef = useRef<HTMLDivElement>(null);

  const colors = {
    background: isDarkMode ? '#1f2937' : '#ffffff',
    text: isDarkMode ? '#f3f4f6' : '#111827',
    border: isDarkMode ? '#374151' : '#e5e7eb',
    muted: isDarkMode ? '#6b7280' : '#9ca3af',
    primary: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
  };

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const utilizationRate = carpark.max_capacity > 0
    ? Math.round(((carpark.max_capacity - carpark.current_vacancy) / carpark.max_capacity) * 100)
    : 0;

  const getUtilizationColor = (rate: number) => {
    if (rate >= 90) return colors.danger;
    if (rate >= 70) return colors.warning;
    return colors.success;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.background,
          borderRadius: '12px',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: isDarkMode
            ? '0 25px 50px rgba(0, 0, 0, 0.8)'
            : '0 25px 50px rgba(0, 0, 0, 0.15)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px',
            borderBottom: `1px solid ${colors.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ flex: 1 }}>
            <h2 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 700,
              color: colors.text,
              marginBottom: '8px',
            }}>
              {carpark.name}
            </h2>
            <div style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              marginBottom: '8px',
            }}>
              <span style={{
                fontSize: '11px',
                padding: '4px 8px',
                background: colors.primary + '20',
                color: colors.primary,
                borderRadius: '4px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                {carpark.size_category}
              </span>
              <span style={{
                fontSize: '11px',
                padding: '4px 8px',
                background: colors.muted + '20',
                color: colors.muted,
                borderRadius: '4px',
              }}>
                {carpark.district}
              </span>
            </div>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: colors.muted,
            }}>
              {carpark.display_address}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: colors.muted,
              padding: '0 8px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Stats Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}>
            <div style={{
              padding: '16px',
              background: isDarkMode ? '#111827' : '#f9fafb',
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
            }}>
              <div style={{
                fontSize: '11px',
                color: colors.muted,
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Current Vacancy
              </div>
              <div style={{
                fontSize: '28px',
                fontWeight: 700,
                color: colors.text,
              }}>
                {carpark.current_vacancy}
              </div>
              <div style={{
                fontSize: '12px',
                color: colors.muted,
                marginTop: '4px',
              }}>
                of {carpark.max_capacity} spaces
              </div>
            </div>

            <div style={{
              padding: '16px',
              background: isDarkMode ? '#111827' : '#f9fafb',
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
            }}>
              <div style={{
                fontSize: '11px',
                color: colors.muted,
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Utilization
              </div>
              <div style={{
                fontSize: '28px',
                fontWeight: 700,
                color: getUtilizationColor(utilizationRate),
              }}>
                {utilizationRate}%
              </div>
              <div style={{
                fontSize: '12px',
                color: colors.muted,
                marginTop: '4px',
              }}>
                {carpark.max_capacity - carpark.current_vacancy} occupied
              </div>
            </div>

            <div style={{
              padding: '16px',
              background: isDarkMode ? '#111827' : '#f9fafb',
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
            }}>
              <div style={{
                fontSize: '11px',
                color: colors.muted,
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Activity Score
              </div>
              <div style={{
                fontSize: '28px',
                fontWeight: 700,
                color: colors.primary,
              }}>
                {carpark.activity_score}
              </div>
              <div style={{
                fontSize: '12px',
                color: colors.muted,
                marginTop: '4px',
              }}>
                Avg variance: {carpark.avg_variance}
              </div>
            </div>

            <div style={{
              padding: '16px',
              background: isDarkMode ? '#111827' : '#f9fafb',
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
            }}>
              <div style={{
                fontSize: '11px',
                color: colors.muted,
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Avg Rate of Change
              </div>
              <div style={{
                fontSize: '28px',
                fontWeight: 700,
                color: colors.warning,
              }}>
                {carpark.avg_rate_change}
              </div>
              <div style={{
                fontSize: '12px',
                color: colors.muted,
                marginTop: '4px',
              }}>
                spaces/hour
              </div>
            </div>
          </div>

          {/* Map */}
          <div style={{
            marginBottom: '24px',
            borderRadius: '8px',
            overflow: 'hidden',
            height: '300px',
            border: `1px solid ${colors.border}`,
          }}>
            <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
              <Map
                mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim()}
                defaultCenter={{ lat: Number(carpark.latitude), lng: Number(carpark.longitude) }}
                defaultZoom={17}
                gestureHandling="greedy"
                disableDefaultUI={false}
                colorScheme={isDarkMode ? 'DARK' : 'LIGHT'}
              >
                <AdvancedMarker
                  position={{ lat: Number(carpark.latitude), lng: Number(carpark.longitude) }}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: colors.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: '20px',
                    fontWeight: 700,
                    border: '3px solid white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}>
                    P
                  </div>
                </AdvancedMarker>
              </Map>
            </APIProvider>
          </div>

          {/* Additional Details */}
          <div style={{
            padding: '16px',
            background: isDarkMode ? '#111827' : '#f9fafb',
            borderRadius: '8px',
            border: `1px solid ${colors.border}`,
          }}>
            <h3 style={{
              margin: 0,
              marginBottom: '12px',
              fontSize: '14px',
              fontWeight: 600,
              color: colors.text,
            }}>
              Details
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '140px 1fr',
              gap: '8px',
              fontSize: '13px',
            }}>
              <div style={{ color: colors.muted }}>Carpark ID:</div>
              <div style={{ color: colors.text, fontFamily: 'monospace' }}>{carpark.park_id}</div>

              <div style={{ color: colors.muted }}>Coordinates:</div>
              <div style={{ color: colors.text, fontFamily: 'monospace' }}>
                {Number(carpark.latitude).toFixed(6)}, {Number(carpark.longitude).toFixed(6)}
              </div>

              <div style={{ color: colors.muted }}>Last Updated:</div>
              <div style={{ color: colors.text }}>
                {new Date(carpark.lastupdate).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Asia/Hong_Kong',
                })}
              </div>

              <div style={{ color: colors.muted }}>Data Points:</div>
              <div style={{ color: colors.text }}>
                {carpark.time_series.length} hourly snapshots
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
