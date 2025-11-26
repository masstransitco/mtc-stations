"use client";

import { useEffect, useState, useMemo } from "react";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { useTheme } from "@/components/theme-provider";

// Multi-line history point with separate values per vehicle type
interface VehicleTypeHistoryPoint {
  timestamp: number;
  time: string;
  A?: number;
  G?: number;
  C?: number;
}

interface VehicleTypeHistoryResponse {
  carpark_id: string;
  hours: number;
  by_type: boolean;
  data_points: number;
  history: VehicleTypeHistoryPoint[];
}

interface MeteredVacancyTrendChartProps {
  carparkId: string;
  hours?: number;
  vehicleTypes?: string[];
}

// Vehicle type color scheme (matching badge colors)
const VEHICLE_TYPE_COLORS: Record<string, { primary: string; light: string; dark: string }> = {
  'A': { primary: '#3b82f6', light: '#dbeafe', dark: '#1e3a5f' },  // Blue - Private Car
  'G': { primary: '#f59e0b', light: '#fef3c7', dark: '#78350f' },  // Amber - Goods Vehicle
  'C': { primary: '#8b5cf6', light: '#ede9fe', dark: '#4c1d95' },  // Purple - Coach/Bus
};

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  'A': 'Private Car',
  'G': 'Goods Vehicle',
  'C': 'Coach/Bus',
};

export default function MeteredVacancyTrendChart({
  carparkId,
  hours = 6,
  vehicleTypes = ['A', 'C', 'G']
}: MeteredVacancyTrendChartProps) {
  const [data, setData] = useState<VehicleTypeHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { isDarkMode } = useTheme();

  // Determine which vehicle types are present in the data
  const presentVehicleTypes = useMemo(() => {
    const types = new Set<string>();
    data.forEach(point => {
      if (point.A !== undefined) types.add('A');
      if (point.G !== undefined) types.add('G');
      if (point.C !== undefined) types.add('C');
    });
    return Array.from(types).filter(t => vehicleTypes.includes(t));
  }, [data, vehicleTypes]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        setError(false);

        // Always fetch by_type data for multi-line chart
        const response = await fetch(
          `/api/metered-carparks/${encodeURIComponent(carparkId)}/history?hours=${hours}&by_type=true`,
          {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache'
            }
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch history');
        }

        const result: VehicleTypeHistoryResponse = await response.json();
        setData(result.history);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching metered vacancy history:', err);
        setError(true);
        setLoading(false);
      }
    };

    fetchHistory();
  }, [carparkId, hours]);

  // Custom tooltip showing breakdown by vehicle type
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      const date = new Date(dataPoint.timestamp);

      // Filter to only show selected vehicle types that have data
      const activePayloads = payload.filter((p: any) =>
        vehicleTypes.includes(p.dataKey) && p.value !== undefined
      );

      // Calculate total for selected types
      const total = activePayloads.reduce((sum: number, p: any) => sum + (p.value || 0), 0);

      return (
        <div style={{
          backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
          border: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb',
          padding: '8px 12px',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          fontSize: '11px',
          minWidth: '120px'
        }}>
          <div style={{
            color: isDarkMode ? '#9ca3af' : '#6b7280',
            fontSize: '10px',
            marginBottom: '6px',
            borderBottom: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb',
            paddingBottom: '4px'
          }}>
            {date.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
              timeZone: 'Asia/Hong_Kong'
            })}
          </div>
          {activePayloads.map((p: any) => (
            <div key={p.dataKey} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '3px'
            }}>
              <span style={{
                color: VEHICLE_TYPE_COLORS[p.dataKey]?.primary || '#6b7280',
                fontSize: '10px'
              }}>
                {VEHICLE_TYPE_LABELS[p.dataKey] || p.dataKey}
              </span>
              <span style={{
                fontWeight: 600,
                color: isDarkMode ? '#f3f4f6' : '#111827',
                marginLeft: '8px'
              }}>
                {p.value}
              </span>
            </div>
          ))}
          {activePayloads.length > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '4px',
              paddingTop: '4px',
              borderTop: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb'
            }}>
              <span style={{
                color: isDarkMode ? '#9ca3af' : '#6b7280',
                fontSize: '10px'
              }}>
                Total
              </span>
              <span style={{
                fontWeight: 700,
                color: isDarkMode ? '#f3f4f6' : '#111827',
                marginLeft: '8px'
              }}>
                {total}
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Format x-axis time labels - show hour only
  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      hour12: true,
      timeZone: 'Asia/Hong_Kong'
    }).toLowerCase();
  };

  // Generate hourly tick values for x-axis
  const hourlyTicks = useMemo(() => {
    if (data.length === 0) return [];

    const minTime = Math.min(...data.map(d => d.timestamp));
    const maxTime = Math.max(...data.map(d => d.timestamp));

    // Round to nearest hour boundaries
    const startHour = Math.ceil(minTime / 3600000) * 3600000;
    const ticks: number[] = [];

    for (let t = startHour; t <= maxTime; t += 3600000) {
      ticks.push(t);
    }

    return ticks;
  }, [data]);

  // Calculate stats for selected vehicle types (must be before early returns)
  const stats = useMemo(() => {
    if (data.length === 0) return { min: 0, avg: 0, max: 0 };

    const totals = data.map(d => {
      let sum = 0;
      if (vehicleTypes.includes('A') && d.A !== undefined) sum += d.A;
      if (vehicleTypes.includes('G') && d.G !== undefined) sum += d.G;
      if (vehicleTypes.includes('C') && d.C !== undefined) sum += d.C;
      return sum;
    });

    return {
      min: Math.min(...totals),
      avg: Math.round(totals.reduce((sum, v) => sum + v, 0) / totals.length),
      max: Math.max(...totals)
    };
  }, [data, vehicleTypes]);

  if (loading) {
    return (
      <div style={{
        height: '100px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isDarkMode ? '#9ca3af' : '#6b7280',
        fontSize: '11px'
      }}>
        Loading trend data...
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div style={{
        height: '100px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isDarkMode ? '#9ca3af' : '#6b7280',
        fontSize: '11px'
      }}>
        {error ? 'Unable to load trend data' : 'No recent data available'}
      </div>
    );
  }

  const gridColor = isDarkMode ? '#374151' : '#e5e7eb';
  const textColor = isDarkMode ? '#9ca3af' : '#6b7280';

  return (
    <div style={{
      marginTop: '12px',
      marginBottom: '12px'
    }}>
      {/* Chart Header */}
      <div style={{
        fontSize: '10px',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: textColor,
        marginBottom: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>Vacancy Trend</span>
        <span style={{
          fontSize: '9px',
          fontWeight: 400,
          textTransform: 'none'
        }}>
          Past {hours}h ({data.length} pts)
        </span>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={100}>
        <AreaChart
          data={data}
          margin={{ top: 5, right: 5, left: -25, bottom: 5 }}
        >
          <defs>
            {/* Gradient for Private Car (A) - Blue */}
            <linearGradient id="gradientA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={VEHICLE_TYPE_COLORS['A'].primary} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={VEHICLE_TYPE_COLORS['A'].primary} stopOpacity={0}/>
            </linearGradient>
            {/* Gradient for Goods Vehicle (G) - Amber */}
            <linearGradient id="gradientG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={VEHICLE_TYPE_COLORS['G'].primary} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={VEHICLE_TYPE_COLORS['G'].primary} stopOpacity={0}/>
            </linearGradient>
            {/* Gradient for Coach/Bus (C) - Purple */}
            <linearGradient id="gradientC" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={VEHICLE_TYPE_COLORS['C'].primary} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={VEHICLE_TYPE_COLORS['C'].primary} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatXAxis}
            stroke={textColor}
            style={{ fontSize: '9px' }}
            tickLine={false}
            axisLine={{ stroke: gridColor }}
            ticks={hourlyTicks}
            domain={['dataMin', 'dataMax']}
          />
          <YAxis
            stroke={textColor}
            style={{ fontSize: '9px' }}
            tickLine={false}
            axisLine={{ stroke: gridColor }}
            domain={[0, 'auto']}
            width={30}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* Render areas for each vehicle type that is selected and present in data */}
          {vehicleTypes.includes('A') && presentVehicleTypes.includes('A') && (
            <Area
              type="monotone"
              dataKey="A"
              stroke={VEHICLE_TYPE_COLORS['A'].primary}
              strokeWidth={2}
              fill="url(#gradientA)"
              animationDuration={500}
            />
          )}
          {vehicleTypes.includes('G') && presentVehicleTypes.includes('G') && (
            <Area
              type="monotone"
              dataKey="G"
              stroke={VEHICLE_TYPE_COLORS['G'].primary}
              strokeWidth={2}
              fill="url(#gradientG)"
              animationDuration={500}
            />
          )}
          {vehicleTypes.includes('C') && presentVehicleTypes.includes('C') && (
            <Area
              type="monotone"
              dataKey="C"
              stroke={VEHICLE_TYPE_COLORS['C'].primary}
              strokeWidth={2}
              fill="url(#gradientC)"
              animationDuration={500}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>

      {/* Chart Footer - min/max/avg stats (aggregate of selected types) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        marginTop: '6px',
        paddingTop: '6px',
        borderTop: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb',
        fontSize: '9px',
        color: textColor
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: '11px', color: isDarkMode ? '#f3f4f6' : '#111827' }}>
            {stats.min}
          </div>
          <div>Min</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: '11px', color: isDarkMode ? '#f3f4f6' : '#111827' }}>
            {stats.avg}
          </div>
          <div>Avg</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: '11px', color: isDarkMode ? '#f3f4f6' : '#111827' }}>
            {stats.max}
          </div>
          <div>Max</div>
        </div>
      </div>
    </div>
  );
}
