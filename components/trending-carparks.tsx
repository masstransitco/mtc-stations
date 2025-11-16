"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { TrendingUp, Loader2 } from "lucide-react";

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

interface TrendingCarparksProps {
  onCarparkClick: (carpark: CarparkData) => void;
  getMarkerColor: (vacancy: number) => string;
}

export default function TrendingCarparks({ onCarparkClick, getMarkerColor }: TrendingCarparksProps) {
  const { isDarkMode } = useTheme();
  const [carparks, setCarparks] = useState<CarparkData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrendingCarparks = async () => {
      try {
        const response = await fetch('/api/carparks/trending');
        if (response.ok) {
          const data = await response.json();
          setCarparks(data);
        }
      } catch (error) {
        console.error('Error fetching trending carparks:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingCarparks();
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        gap: '12px'
      }}>
        <Loader2
          size={32}
          color={isDarkMode ? '#9ca3af' : '#6b7280'}
          style={{ animation: 'spin 1s linear infinite' }}
        />
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
        <span style={{
          fontSize: '14px',
          color: isDarkMode ? '#9ca3af' : '#6b7280'
        }}>
          Loading trending carparks...
        </span>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px'
      }}>
        <TrendingUp size={18} color={isDarkMode ? '#60a5fa' : '#3b82f6'} />
        <h4 style={{
          margin: 0,
          fontSize: '16px',
          fontWeight: 600,
          color: isDarkMode ? '#f3f4f6' : '#111827'
        }}>
          Trending Carparks
        </h4>
      </div>

      {/* Subtitle */}
      <p style={{
        margin: '0 0 16px 0',
        fontSize: '13px',
        color: isDarkMode ? '#9ca3af' : '#6b7280',
        lineHeight: 1.5
      }}>
        Most active carparks in the past 6 hours
      </p>

      {/* Carpark List - Minimal Compact Design */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {carparks.map((carpark, index) => (
          <div
            key={`${carpark.park_id}-${carpark.vehicle_type}`}
            onClick={() => onCarparkClick(carpark)}
            style={{
              padding: '10px 12px',
              backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
              border: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? '#374151' : '#f9fafb';
              e.currentTarget.style.borderColor = isDarkMode ? '#4b5563' : '#d1d5db';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? '#1f2937' : '#ffffff';
              e.currentTarget.style.borderColor = isDarkMode ? '#374151' : '#e5e7eb';
            }}
          >
            {/* Rank Number */}
            <div style={{
              fontSize: '13px',
              fontWeight: 600,
              color: isDarkMode ? '#6b7280' : '#9ca3af',
              minWidth: '20px',
              textAlign: 'center'
            }}>
              {index + 1}
            </div>

            {/* Main Content */}
            <div style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              {/* Name */}
              <div style={{
                fontSize: '13px',
                fontWeight: 600,
                color: isDarkMode ? '#f3f4f6' : '#111827',
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {carpark.name}
              </div>

              {/* District - Compact */}
              {carpark.district && (
                <div style={{
                  fontSize: '11px',
                  color: isDarkMode ? '#9ca3af' : '#6b7280'
                }}>
                  {carpark.district}
                </div>
              )}
            </div>

            {/* Vacancy Info - Compact */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexShrink: 0
            }}>
              {/* Regular Spaces */}
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '2px'
              }}>
                <span style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: getMarkerColor(carpark.vacancy),
                  lineHeight: 1
                }}>
                  {carpark.vacancy}
                </span>
              </div>

              {/* EV Spaces */}
              {carpark.vacancy_ev !== null && carpark.vacancy_ev > 0 && (
                <>
                  <div style={{
                    width: '1px',
                    height: '16px',
                    backgroundColor: isDarkMode ? '#374151' : '#d1d5db'
                  }} />
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}>
                    <span style={{
                      fontSize: '11px',
                      color: '#10b981',
                      fontWeight: 600
                    }}>
                      ⚡
                    </span>
                    <span style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#10b981',
                      lineHeight: 1
                    }}>
                      {carpark.vacancy_ev}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {carparks.length === 0 && !loading && (
        <div style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: isDarkMode ? '#9ca3af' : '#6b7280',
          fontSize: '14px'
        }}>
          No trending carparks available
        </div>
      )}
    </div>
  );
}
