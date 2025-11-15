"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { useTheme } from "@/components/theme-provider";

interface VacancyHistoryPoint {
  timestamp: number;
  vacancy: number;
  time: string;
}

interface VacancyHistoryResponse {
  park_id: string;
  vehicle_type: string;
  hours: number;
  data_points: number;
  history: VacancyHistoryPoint[];
}

interface VacancyTrendChartProps {
  parkId: string;
  vehicleType: string;
  hours?: number;
}

export default function VacancyTrendChart({ parkId, vehicleType, hours = 6 }: VacancyTrendChartProps) {
  const [data, setData] = useState<VacancyHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { isDarkMode } = useTheme();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        setError(false);

        const response = await fetch(
          `/api/carparks/${encodeURIComponent(parkId)}/history?vehicle_type=${vehicleType}&hours=${hours}`,
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

        const result: VacancyHistoryResponse = await response.json();
        setData(result.history);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching vacancy history:', err);
        setError(true);
        setLoading(false);
      }
    };

    fetchHistory();
  }, [parkId, vehicleType, hours]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const date = new Date(data.timestamp);

      return (
        <div style={{
          backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
          border: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb',
          padding: '6px 10px',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          fontSize: '11px'
        }}>
          <div style={{
            fontWeight: 600,
            color: isDarkMode ? '#f3f4f6' : '#111827',
            marginBottom: '2px'
          }}>
            {data.vacancy} spaces
          </div>
          <div style={{
            color: isDarkMode ? '#9ca3af' : '#6b7280',
            fontSize: '10px'
          }}>
            {date.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  // Format x-axis time labels
  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      hour12: true
    });
  };

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

  const lineColor = isDarkMode ? '#60a5fa' : '#3b82f6';
  const areaColor = isDarkMode ? '#1e3a8a' : '#dbeafe';
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
            <linearGradient id="vacancyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={lineColor} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={lineColor} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatXAxis}
            stroke={textColor}
            style={{ fontSize: '9px' }}
            tickLine={false}
            axisLine={{ stroke: gridColor }}
            minTickGap={40}
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
          <Area
            type="monotone"
            dataKey="vacancy"
            stroke={lineColor}
            strokeWidth={2}
            fill="url(#vacancyGradient)"
            animationDuration={500}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Chart Footer - min/max/avg stats */}
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
            {Math.min(...data.map(d => d.vacancy))}
          </div>
          <div>Min</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: '11px', color: isDarkMode ? '#f3f4f6' : '#111827' }}>
            {Math.round(data.reduce((sum, d) => sum + d.vacancy, 0) / data.length)}
          </div>
          <div>Avg</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: '11px', color: isDarkMode ? '#f3f4f6' : '#111827' }}>
            {Math.max(...data.map(d => d.vacancy))}
          </div>
          <div>Max</div>
        </div>
      </div>
    </div>
  );
}
