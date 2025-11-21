'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ZAxis,
} from 'recharts';
import { useTheme } from '@/components/theme-provider';
import { CarparkModal } from '@/components/carpark-modal';

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
    snapshot_count: number;
  }>;
}

interface CarparksResponse {
  carparks: CarparkData[];
  total: number;
}

export default function CarparksPage() {
  const { isDarkMode } = useTheme();
  const [data, setData] = useState<CarparksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [timeRange, setTimeRange] = useState<number>(7);
  const [selectedCarpark, setSelectedCarpark] = useState<CarparkData | null>(null);
  const [limit, setLimit] = useState<number>(20);

  const colors = {
    background: isDarkMode ? '#1f2937' : '#ffffff',
    text: isDarkMode ? '#f3f4f6' : '#111827',
    border: isDarkMode ? '#374151' : '#e5e7eb',
    muted: isDarkMode ? '#6b7280' : '#9ca3af',
    primary: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    purple: '#8b5cf6',
    teal: '#14b8a6',
  };

  const chartColors = [
    colors.primary,
    colors.success,
    colors.warning,
    colors.purple,
    colors.teal,
    colors.danger,
    '#f472b6',
    '#fb923c',
    '#a78bfa',
    '#34d399',
  ];

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        days: timeRange.toString(),
        limit: limit.toString(),
        ...(selectedDistrict && { district: selectedDistrict }),
      });

      const response = await fetch(`/api/admin/carparks?${params}`);
      if (!response.ok) throw new Error('Failed to fetch carpark data');

      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching carpark data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeRange, selectedDistrict, limit]);

  // Get unique districts from data
  const districts = data?.carparks
    ? Array.from(new Set(data.carparks.map(c => c.district))).sort()
    : [];

  if (loading && !data) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        fontSize: '14px',
        color: colors.muted,
      }}>
        Loading carpark data...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: '12px',
      }}>
        <div style={{ fontSize: '16px', color: colors.danger }}>Error loading data</div>
        <div style={{ fontSize: '14px', color: colors.muted }}>{error}</div>
        <button
          onClick={fetchData}
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
          Retry
        </button>
      </div>
    );
  }

  // Prepare data for activity scatter plot
  const activityScatterData = data?.carparks.map(carpark => ({
    name: carpark.name,
    activity_score: carpark.activity_score,
    avg_rate_change: Math.abs(carpark.avg_rate_change),
    capacity: carpark.max_capacity,
    carpark,
  })) || [];

  return (
    <div style={{
      width: '100%',
      height: '100%',
      overflow: 'auto',
      background: isDarkMode ? '#111827' : '#f9fafb',
    }}>
      {/* Header */}
      <div style={{
        padding: '24px',
        background: colors.background,
        borderBottom: `1px solid ${colors.border}`,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <h1 style={{
          margin: 0,
          marginBottom: '16px',
          fontSize: '24px',
          fontWeight: 700,
          color: colors.text,
        }}>
          Carpark Activity Analysis
        </h1>

        {/* Filters */}
        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
        }}>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            style={{
              padding: '8px 12px',
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              background: colors.background,
              color: colors.text,
              fontSize: '14px',
            }}
          >
            <option value={1}>Last 24 hours</option>
            <option value={3}>Last 3 days</option>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>

          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            style={{
              padding: '8px 12px',
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              background: colors.background,
              color: colors.text,
              fontSize: '14px',
            }}
          >
            <option value="">All Districts</option>
            {districts.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{
              padding: '8px 12px',
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              background: colors.background,
              color: colors.text,
              fontSize: '14px',
            }}
          >
            <option value={10}>Top 10</option>
            <option value={20}>Top 20</option>
            <option value={50}>Top 50</option>
            <option value={100}>Top 100</option>
          </select>

          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              padding: '8px 16px',
              background: loading ? colors.muted : colors.primary,
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
            }}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '24px' }}>
        {/* Overview Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}>
          <div style={{
            background: colors.background,
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            padding: '20px',
          }}>
            <div style={{ fontSize: '12px', color: colors.muted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Carparks Analyzed
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: colors.text }}>
              {data?.total || 0}
            </div>
            <div style={{ fontSize: '12px', color: colors.muted, marginTop: '4px' }}>
              {selectedDistrict || 'All districts'}
            </div>
          </div>

          <div style={{
            background: colors.background,
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            padding: '20px',
          }}>
            <div style={{ fontSize: '12px', color: colors.muted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Avg Activity Score
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: colors.text }}>
              {data?.carparks.length
                ? (data.carparks.reduce((sum, c) => sum + c.activity_score, 0) / data.carparks.length).toFixed(1)
                : 0}
            </div>
            <div style={{ fontSize: '12px', color: colors.muted, marginTop: '4px' }}>
              Variance-based metric
            </div>
          </div>

          <div style={{
            background: colors.background,
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            padding: '20px',
          }}>
            <div style={{ fontSize: '12px', color: colors.muted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Capacity
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: colors.text }}>
              {data?.carparks.reduce((sum, c) => sum + c.max_capacity, 0).toLocaleString() || 0}
            </div>
            <div style={{ fontSize: '12px', color: colors.muted, marginTop: '4px' }}>
              parking spaces
            </div>
          </div>

          <div style={{
            background: colors.background,
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            padding: '20px',
          }}>
            <div style={{ fontSize: '12px', color: colors.muted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Avg Rate of Change
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: colors.text }}>
              {data?.carparks.length
                ? (data.carparks.reduce((sum, c) => sum + Math.abs(c.avg_rate_change), 0) / data.carparks.length).toFixed(1)
                : 0}
            </div>
            <div style={{ fontSize: '12px', color: colors.muted, marginTop: '4px' }}>
              spaces/hour
            </div>
          </div>
        </div>

        {/* Activity Scatter Plot */}
        <div style={{
          background: colors.background,
          border: `1px solid ${colors.border}`,
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '24px',
        }}>
          <h2 style={{
            margin: 0,
            marginBottom: '16px',
            fontSize: '18px',
            fontWeight: 600,
            color: colors.text,
          }}>
            Activity Score vs Rate of Change
          </h2>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
              <XAxis
                type="number"
                dataKey="activity_score"
                name="Activity Score"
                stroke={colors.muted}
                style={{ fontSize: '12px' }}
                label={{ value: 'Activity Score', position: 'insideBottom', offset: -10 }}
              />
              <YAxis
                type="number"
                dataKey="avg_rate_change"
                name="Avg Rate of Change"
                stroke={colors.muted}
                style={{ fontSize: '12px' }}
                label={{ value: 'Avg Rate of Change (spaces/hour)', angle: -90, position: 'insideLeft' }}
              />
              <ZAxis type="number" dataKey="capacity" range={[50, 400]} name="Capacity" />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{
                  background: colors.background,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
                content={({ payload }) => {
                  if (!payload || !payload[0]) return null;
                  const data = payload[0].payload;
                  return (
                    <div style={{
                      background: colors.background,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      padding: '12px',
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: '8px', color: colors.text }}>
                        {data.name}
                      </div>
                      <div style={{ fontSize: '12px', color: colors.muted }}>
                        Activity Score: <strong style={{ color: colors.text }}>{data.activity_score}</strong>
                      </div>
                      <div style={{ fontSize: '12px', color: colors.muted }}>
                        Rate of Change: <strong style={{ color: colors.text }}>{data.avg_rate_change}</strong> spaces/hr
                      </div>
                      <div style={{ fontSize: '12px', color: colors.muted }}>
                        Capacity: <strong style={{ color: colors.text }}>{data.capacity}</strong> spaces
                      </div>
                      <button
                        onClick={() => setSelectedCarpark(data.carpark)}
                        style={{
                          marginTop: '8px',
                          padding: '4px 8px',
                          background: colors.primary,
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          width: '100%',
                        }}
                      >
                        View Details
                      </button>
                    </div>
                  );
                }}
              />
              <Scatter
                data={activityScatterData}
                fill={colors.primary}
                onClick={(data) => setSelectedCarpark(data.carpark)}
                style={{ cursor: 'pointer' }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Individual Carpark Time Series */}
        <div style={{
          background: colors.background,
          border: `1px solid ${colors.border}`,
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '24px',
        }}>
          <h2 style={{
            margin: 0,
            marginBottom: '16px',
            fontSize: '18px',
            fontWeight: 600,
            color: colors.text,
          }}>
            Vacancy Trends (Top {Math.min(10, data?.carparks.length || 0)} Carparks)
          </h2>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={(() => {
                // Create unified time series data
                if (!data?.carparks.length) return [];

                const topCarparks = data.carparks.slice(0, 10);
                const allTimestamps = new Set<string>();

                // Collect all unique timestamps
                topCarparks.forEach(carpark => {
                  carpark.time_series.slice(-48).forEach(ts => {
                    allTimestamps.add(ts.hour);
                  });
                });

                // Sort timestamps
                const sortedTimes = Array.from(allTimestamps).sort();

                // Create unified data points
                return sortedTimes.map(hour => {
                  const dataPoint: any = {
                    time: new Date(hour).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      timeZone: 'Asia/Hong_Kong',
                    }),
                  };

                  topCarparks.forEach(carpark => {
                    const timeEntry = carpark.time_series.find(ts => ts.hour === hour);
                    dataPoint[carpark.park_id] = timeEntry ? Number(timeEntry.avg_vacancy) : null;
                  });

                  return dataPoint;
                });
              })()}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
              <XAxis
                dataKey="time"
                stroke={colors.muted}
                style={{ fontSize: '11px' }}
                angle={-45}
                textAnchor="end"
                height={80}
                interval="preserveStartEnd"
                minTickGap={30}
              />
              <YAxis
                stroke={colors.muted}
                style={{ fontSize: '12px' }}
                label={{ value: 'Vacancy', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  background: colors.background,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              />
              <Legend />
              {data?.carparks.slice(0, 10).map((carpark, index) => (
                <Line
                  key={carpark.park_id}
                  type="monotone"
                  dataKey={carpark.park_id}
                  stroke={chartColors[index % chartColors.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={true}
                  name={carpark.name.length > 25 ? carpark.name.substring(0, 25) + '...' : carpark.name}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Rate of Change Chart */}
        <div style={{
          background: colors.background,
          border: `1px solid ${colors.border}`,
          borderRadius: '8px',
          padding: '20px',
        }}>
          <h2 style={{
            margin: 0,
            marginBottom: '16px',
            fontSize: '18px',
            fontWeight: 600,
            color: colors.text,
          }}>
            Rate of Change Over Time (Top 5 Carparks)
          </h2>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={(() => {
                // Create unified time series data for rate of change
                if (!data?.carparks.length) return [];

                const topCarparks = data.carparks.slice(0, 5);
                const allTimestamps = new Set<string>();

                // Collect all unique timestamps
                topCarparks.forEach(carpark => {
                  carpark.time_series.slice(-48).forEach(ts => {
                    allTimestamps.add(ts.hour);
                  });
                });

                // Sort timestamps
                const sortedTimes = Array.from(allTimestamps).sort();

                // Create unified data points
                return sortedTimes.map(hour => {
                  const dataPoint: any = {
                    time: new Date(hour).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      timeZone: 'Asia/Hong_Kong',
                    }),
                  };

                  topCarparks.forEach(carpark => {
                    const timeEntry = carpark.time_series.find(ts => ts.hour === hour);
                    dataPoint[carpark.park_id] = timeEntry ? Number(timeEntry.rate_of_change) : null;
                  });

                  return dataPoint;
                });
              })()}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
              <XAxis
                dataKey="time"
                stroke={colors.muted}
                style={{ fontSize: '11px' }}
                angle={-45}
                textAnchor="end"
                height={80}
                interval="preserveStartEnd"
                minTickGap={30}
              />
              <YAxis
                stroke={colors.muted}
                style={{ fontSize: '12px' }}
                label={{ value: 'Rate of Change (spaces/hour)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  background: colors.background,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              />
              <Legend />
              {data?.carparks.slice(0, 5).map((carpark, index) => (
                <Line
                  key={carpark.park_id}
                  type="monotone"
                  dataKey={carpark.park_id}
                  stroke={chartColors[index % chartColors.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={true}
                  name={carpark.name.length > 25 ? carpark.name.substring(0, 25) + '...' : carpark.name}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Carpark List */}
        <div style={{
          marginTop: '24px',
          background: colors.background,
          border: `1px solid ${colors.border}`,
          borderRadius: '8px',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${colors.border}`,
          }}>
            <h2 style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 600,
              color: colors.text,
            }}>
              Carpark Details
            </h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
            }}>
              <thead>
                <tr style={{ background: isDarkMode ? '#111827' : '#f9fafb' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: colors.muted, fontWeight: 600 }}>Name</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: colors.muted, fontWeight: 600 }}>District</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: colors.muted, fontWeight: 600 }}>Capacity</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: colors.muted, fontWeight: 600 }}>Current Vacancy</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: colors.muted, fontWeight: 600 }}>Activity Score</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: colors.muted, fontWeight: 600 }}>Rate of Change</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: colors.muted, fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.carparks.map((carpark, index) => (
                  <tr
                    key={carpark.park_id}
                    style={{
                      borderBottom: `1px solid ${colors.border}`,
                      background: index % 2 === 0 ? 'transparent' : (isDarkMode ? '#1a1f2e' : '#f9fafb'),
                    }}
                  >
                    <td style={{ padding: '12px 16px', color: colors.text, maxWidth: '250px' }}>
                      <div style={{ fontWeight: 500 }}>{carpark.name}</div>
                      <div style={{ fontSize: '11px', color: colors.muted, marginTop: '2px' }}>
                        {carpark.size_category}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: colors.text }}>{carpark.district}</td>
                    <td style={{ padding: '12px 16px', color: colors.text, textAlign: 'right' }}>
                      {carpark.max_capacity}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <span style={{
                        color: carpark.current_vacancy > carpark.max_capacity * 0.3 ? colors.success : colors.warning,
                        fontWeight: 600,
                      }}>
                        {carpark.current_vacancy}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: colors.text, textAlign: 'right', fontWeight: 600 }}>
                      {carpark.activity_score}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <span style={{
                        color: Math.abs(carpark.avg_rate_change) > 5 ? colors.danger : colors.muted,
                      }}>
                        {carpark.avg_rate_change > 0 ? '+' : ''}{carpark.avg_rate_change}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => setSelectedCarpark(carpark)}
                        style={{
                          padding: '6px 12px',
                          background: colors.primary,
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {selectedCarpark && (
        <CarparkModal
          carpark={selectedCarpark}
          onClose={() => setSelectedCarpark(null)}
        />
      )}
    </div>
  );
}
