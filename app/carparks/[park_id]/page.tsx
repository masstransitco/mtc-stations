'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTheme } from '@/components/theme-provider';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface CarparkData {
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
}

export default function CarparkPage() {
  const params = useParams();
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const [carpark, setCarpark] = useState<CarparkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const fetchCarpark = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/carparks/${params.park_id}/analytics`);
        if (!response.ok) {
          throw new Error('Failed to fetch carpark data');
        }
        const result = await response.json();
        setCarpark(result.carpark);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Error fetching carpark:', err);
      } finally {
        setLoading(false);
      }
    };

    if (params.park_id) {
      fetchCarpark();
    }
  }, [params.park_id]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: isDarkMode ? '#111827' : '#f9fafb',
        color: colors.muted,
      }}>
        Loading carpark data...
      </div>
    );
  }

  if (error || !carpark) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: isDarkMode ? '#111827' : '#f9fafb',
        gap: '12px',
      }}>
        <div style={{ fontSize: '16px', color: colors.danger }}>
          {error || 'Carpark not found'}
        </div>
        <button
          onClick={() => router.back()}
          style={{
            padding: '8px 16px',
            background: colors.primary,
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  const utilizationRate = carpark.max_capacity > 0
    ? Math.round(((carpark.max_capacity - carpark.current_vacancy) / carpark.max_capacity) * 100)
    : 0;

  const getUtilizationColor = (rate: number) => {
    if (rate >= 90) return colors.danger;
    if (rate >= 70) return colors.warning;
    return colors.success;
  };

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      background: isDarkMode ? '#111827' : '#f9fafb',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'fixed',
      top: 0,
      left: 0,
    }}>
      <div style={{
        maxWidth: '1200px',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
      }}>
        {/* Main Container */}
        <div style={{
          background: colors.background,
          borderRadius: '12px',
          boxShadow: isDarkMode
            ? '0 25px 50px rgba(0, 0, 0, 0.8)'
            : '0 25px 50px rgba(0, 0, 0, 0.15)',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '24px',
            borderBottom: `1px solid ${colors.border}`,
          }}>
            <h1 style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: 700,
              color: colors.text,
              marginBottom: '8px',
            }}>
              {carpark.name}
            </h1>
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

          {/* Content */}
          <div style={{
            padding: '24px',
            flex: 1,
            overflow: 'auto',
            minHeight: 0,
          }}>
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

            {/* Vacancy Trend Chart */}
            <div style={{
              marginBottom: '24px',
              padding: '16px',
              background: isDarkMode ? '#111827' : '#f9fafb',
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
            }}>
              <div style={{
                fontSize: '11px',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: colors.muted,
                marginBottom: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span>Vacancy Trend</span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 400,
                  textTransform: 'none',
                }}>
                  Past 12h ({carpark.time_series.slice(-12).length} pts)
                </span>
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart
                  data={carpark.time_series.slice(-12).map(ts => ({
                    time: new Date(ts.hour).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      hour12: true,
                      timeZone: 'Asia/Hong_Kong',
                    }),
                    vacancy: Number(ts.avg_vacancy),
                    timestamp: new Date(ts.hour).getTime(),
                  }))}
                  margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="vacancyGradientModal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.primary} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={colors.primary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="time"
                    stroke={colors.muted}
                    style={{ fontSize: '10px' }}
                    tickLine={false}
                    axisLine={{ stroke: colors.border }}
                    minTickGap={40}
                  />
                  <YAxis
                    stroke={colors.muted}
                    style={{ fontSize: '10px' }}
                    tickLine={false}
                    axisLine={{ stroke: colors.border }}
                    domain={[0, 'auto']}
                    width={35}
                  />
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div style={{
                            background: colors.background,
                            border: `1px solid ${colors.border}`,
                            padding: '6px 10px',
                            borderRadius: '6px',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                            fontSize: '11px',
                          }}>
                            <div style={{
                              fontWeight: 600,
                              color: colors.text,
                              marginBottom: '2px',
                            }}>
                              {data.vacancy} spaces
                            </div>
                            <div style={{
                              color: colors.muted,
                              fontSize: '10px',
                            }}>
                              {new Date(data.timestamp).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true,
                                timeZone: 'Asia/Hong_Kong',
                              })}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="vacancy"
                    stroke={colors.primary}
                    strokeWidth={2}
                    fill="url(#vacancyGradientModal)"
                    animationDuration={500}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{
                display: 'flex',
                justifyContent: 'space-around',
                marginTop: '8px',
                paddingTop: '8px',
                borderTop: `1px solid ${colors.border}`,
                fontSize: '10px',
                color: colors.muted,
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: '12px', color: colors.text }}>
                    {Math.min(...carpark.time_series.slice(-12).map(d => Number(d.avg_vacancy)))}
                  </div>
                  <div>Min</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: '12px', color: colors.text }}>
                    {Math.round(carpark.time_series.slice(-12).reduce((sum, d) => sum + Number(d.avg_vacancy), 0) / carpark.time_series.slice(-12).length)}
                  </div>
                  <div>Avg</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: '12px', color: colors.text }}>
                    {Math.max(...carpark.time_series.slice(-12).map(d => Number(d.avg_vacancy)))}
                  </div>
                  <div>Max</div>
                </div>
              </div>
            </div>

            {/* Map */}
            <div style={{
              marginBottom: '24px',
              borderRadius: '8px',
              overflow: 'hidden',
              height: '400px',
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
    </div>
  );
}
