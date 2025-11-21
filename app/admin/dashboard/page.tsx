'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useTheme } from '@/components/theme-provider';

interface MetricsData {
  activity: Array<{
    hour: string;
    snapshot_count: number;
    unique_carparks: number;
    valid_count: number;
    invalid_count: number;
    offline_percentage: number;
  }>;
  quality: {
    total_carparks: number;
    active_carparks: number;
    total_snapshots: number;
    valid_snapshots: number;
    validity_rate: number;
  };
  utilization: Array<{
    hour: string;
    carpark_count: number;
    avg_vacancy: number;
    avg_utilization_rate: number;
  }>;
  districtUtilization: Array<{
    district: string;
    carpark_count: number;
    avg_vacancy: number;
    total_vacancy: number;
    avg_utilization_rate: number;
  }>;
  sizeUtilization: Array<{
    size_category: string;
    carpark_count: number;
    avg_vacancy: number;
    avg_capacity: number;
    avg_utilization_rate: number;
  }>;
}

export default function DashboardPage() {
  const { isDarkMode } = useTheme();
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [timeRange, setTimeRange] = useState<number>(7);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        days: timeRange.toString(),
        ...(selectedDistrict && { district: selectedDistrict }),
        ...(selectedSize && { sizeCategory: selectedSize }),
      });

      const response = await fetch(`/api/admin/metrics?${params}`);
      if (!response.ok) throw new Error('Failed to fetch metrics');

      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [timeRange, selectedDistrict, selectedSize]);

  // Theme-aware colors
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

  const chartColors = [colors.primary, colors.success, colors.warning, colors.purple, colors.teal, colors.danger];

  if (loading && !metrics) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        fontSize: '14px',
        color: colors.muted,
      }}>
        Loading dashboard...
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: '12px',
      }}>
        <div style={{ fontSize: '16px', color: colors.danger }}>Error loading dashboard</div>
        <div style={{ fontSize: '14px', color: colors.muted }}>{error}</div>
        <button
          onClick={fetchMetrics}
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

  // Format data for charts
  const activityData = metrics?.activity.slice(0, 72).reverse().map(item => ({
    time: new Date(item.hour).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      timeZone: 'Asia/Hong_Kong',
    }),
    snapshots: item.snapshot_count,
    carparks: item.unique_carparks,
    offline: Number(item.offline_percentage),
  })) || [];

  const utilizationData = metrics?.utilization.slice(0, 72).reverse().map(item => ({
    time: new Date(item.hour).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      timeZone: 'Asia/Hong_Kong',
    }),
    vacancy: Number(item.avg_vacancy),
    utilization: Number(item.avg_utilization_rate),
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
          Admin Dashboard
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
            {metrics?.districtUtilization.map(d => (
              <option key={d.district} value={d.district}>{d.district}</option>
            ))}
          </select>

          <select
            value={selectedSize}
            onChange={(e) => setSelectedSize(e.target.value)}
            style={{
              padding: '8px 12px',
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              background: colors.background,
              color: colors.text,
              fontSize: '14px',
            }}
          >
            <option value="">All Sizes</option>
            <option value="Small">Small (0-49)</option>
            <option value="Medium">Medium (50-99)</option>
            <option value="Large">Large (100-199)</option>
            <option value="Very Large">Very Large (200+)</option>
          </select>

          <button
            onClick={fetchMetrics}
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
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
              Total Carparks
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: colors.text }}>
              {metrics?.quality.total_carparks || 0}
            </div>
            <div style={{ fontSize: '12px', color: colors.success, marginTop: '4px' }}>
              {metrics?.quality.active_carparks || 0} active
            </div>
          </div>

          <div style={{
            background: colors.background,
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            padding: '20px',
          }}>
            <div style={{ fontSize: '12px', color: colors.muted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Data Quality
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: colors.text }}>
              {metrics?.quality.validity_rate || 0}%
            </div>
            <div style={{ fontSize: '12px', color: colors.muted, marginTop: '4px' }}>
              {metrics?.quality.valid_snapshots || 0} / {metrics?.quality.total_snapshots || 0} valid
            </div>
          </div>

          <div style={{
            background: colors.background,
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            padding: '20px',
          }}>
            <div style={{ fontSize: '12px', color: colors.muted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Avg Utilization
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: colors.text }}>
              {utilizationData.length > 0
                ? Math.round(utilizationData.reduce((sum, d) => sum + (d.utilization || 0), 0) / utilizationData.length)
                : 0}%
            </div>
            <div style={{ fontSize: '12px', color: colors.muted, marginTop: '4px' }}>
              Last {timeRange} days
            </div>
          </div>

          <div style={{
            background: colors.background,
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            padding: '20px',
          }}>
            <div style={{ fontSize: '12px', color: colors.muted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Avg Vacancy
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: colors.text }}>
              {utilizationData.length > 0
                ? Math.round(utilizationData.reduce((sum, d) => sum + (d.vacancy || 0), 0) / utilizationData.length)
                : 0}
            </div>
            <div style={{ fontSize: '12px', color: colors.muted, marginTop: '4px' }}>
              spaces available
            </div>
          </div>
        </div>

        {/* Activity Charts */}
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
            Data Ingestion Activity
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
              <XAxis
                dataKey="time"
                stroke={colors.muted}
                style={{ fontSize: '12px' }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis stroke={colors.muted} style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  background: colors.background,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="snapshots"
                stackId="1"
                stroke={colors.primary}
                fill={colors.primary}
                fillOpacity={0.6}
                name="Snapshots"
              />
              <Area
                type="monotone"
                dataKey="carparks"
                stackId="2"
                stroke={colors.success}
                fill={colors.success}
                fillOpacity={0.6}
                name="Carparks"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Utilization Charts */}
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
            Utilization Over Time
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={utilizationData}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
              <XAxis
                dataKey="time"
                stroke={colors.muted}
                style={{ fontSize: '12px' }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                yAxisId="left"
                stroke={colors.muted}
                style={{ fontSize: '12px' }}
                label={{ value: 'Utilization %', angle: -90, position: 'insideLeft' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke={colors.muted}
                style={{ fontSize: '12px' }}
                label={{ value: 'Vacancy', angle: 90, position: 'insideRight' }}
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
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="utilization"
                stroke={colors.danger}
                strokeWidth={2}
                dot={false}
                name="Utilization %"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="vacancy"
                stroke={colors.success}
                strokeWidth={2}
                dot={false}
                name="Avg Vacancy"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* District and Size Charts */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '24px',
        }}>
          {/* District Utilization */}
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
              Utilization by District
            </h2>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={metrics?.districtUtilization.slice(0, 10)}
                layout="vertical"
                margin={{ left: 100 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                <XAxis type="number" stroke={colors.muted} style={{ fontSize: '12px' }} />
                <YAxis
                  type="category"
                  dataKey="district"
                  stroke={colors.muted}
                  style={{ fontSize: '11px' }}
                  width={95}
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
                <Bar dataKey="avg_utilization_rate" fill={colors.purple} name="Utilization %" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Size Utilization */}
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
              Utilization by Carpark Size
            </h2>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={metrics?.sizeUtilization}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                <XAxis dataKey="size_category" stroke={colors.muted} style={{ fontSize: '12px' }} />
                <YAxis stroke={colors.muted} style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    background: colors.background,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
                <Legend />
                <Bar dataKey="avg_utilization_rate" fill={colors.teal} name="Utilization %" />
                <Bar dataKey="carpark_count" fill={colors.primary} name="Carparks" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
