'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTheme } from '@/components/theme-provider';

interface SnapshotMetadata {
  snapshot_id: string;
  snapshot_at: string;
  total_carparks: number;
  active_carparks: number;
  top_carpark_id: string;
  top_activity_score: number;
}

interface RankingData {
  carpark_id: string;
  rank: number;
  activity_score: number;
  state_changes: number;
  name: string;
  name_tc: string;
  district: string;
  district_tc: string;
  latitude: number;
  longitude: number;
  total_spaces: number;
  vacant_spaces?: number;
  occupied_spaces?: number;
  vacancy_rate?: number;
  last_updated?: string;
}

interface RankingHistoryData {
  snapshot_at: string;
  rank: number;
  activity_score: number;
}

export default function MeteredCarparksPage() {
  const { isDarkMode } = useTheme();

  // State
  const [snapshots, setSnapshots] = useState<SnapshotMetadata[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [currentSnapshot, setCurrentSnapshot] = useState<SnapshotMetadata | null>(null);
  const [rankings, setRankings] = useState<RankingData[]>([]);
  const [totalRankings, setTotalRankings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [district, setDistrict] = useState<string>('');
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState(0);

  // Modal state
  const [selectedCarpark, setSelectedCarpark] = useState<RankingData | null>(null);
  const [rankingHistory, setRankingHistory] = useState<RankingHistoryData[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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

  // Fetch available snapshots
  const fetchSnapshots = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/metered-carparks/snapshots?limit=200');
      if (!response.ok) throw new Error('Failed to fetch snapshots');
      const data = await response.json();
      setSnapshots(data.snapshots || []);
    } catch (err) {
      console.error('Error fetching snapshots:', err);
    }
  }, []);

  // Fetch rankings (latest or specific snapshot)
  const fetchRankings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let url: string;
      if (selectedSnapshotId) {
        // Fetch specific historical snapshot
        url = `/api/admin/metered-carparks/snapshots/${selectedSnapshotId}?limit=${pageSize}&offset=${currentPage * pageSize}`;
      } else {
        // Fetch latest with live vacancy
        const params = new URLSearchParams({
          limit: pageSize.toString(),
          offset: (currentPage * pageSize).toString(),
          ...(district && { district }),
        });
        url = `/api/admin/metered-carparks/rankings?${params}`;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch rankings');

      const data = await response.json();

      if (selectedSnapshotId) {
        setRankings(data.rankings || []);
        setCurrentSnapshot(data.snapshot);
        setTotalRankings(data.total || data.rankings?.length || 0);
      } else {
        setRankings(data.rankings || []);
        setCurrentSnapshot(data.snapshot);
        setTotalRankings(data.total || 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching rankings:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSnapshotId, district, pageSize, currentPage]);

  // Fetch carpark ranking history
  const fetchRankingHistory = async (carparkId: string) => {
    try {
      setLoadingHistory(true);
      const response = await fetch(`/api/admin/metered-carparks/${encodeURIComponent(carparkId)}/ranking-history?hours=24`);
      if (!response.ok) throw new Error('Failed to fetch ranking history');
      const data = await response.json();
      setRankingHistory(data.history || []);
    } catch (err) {
      console.error('Error fetching ranking history:', err);
      setRankingHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  // Fetch rankings when filters change
  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [district, pageSize, selectedSnapshotId]);

  // Get unique districts from rankings
  const districts = [...new Set(rankings.map(r => r.district).filter(Boolean))].sort();

  // Handle view history click
  const handleViewHistory = (carpark: RankingData) => {
    setSelectedCarpark(carpark);
    fetchRankingHistory(carpark.carpark_id);
  };

  const closeModal = () => {
    setSelectedCarpark(null);
    setRankingHistory([]);
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Hong_Kong',
    });
  };

  // Pagination
  const totalPages = Math.ceil(totalRankings / pageSize);

  if (loading && rankings.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        fontSize: '14px',
        color: colors.muted,
      }}>
        Loading ranking data...
      </div>
    );
  }

  if (error && rankings.length === 0) {
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
          onClick={fetchRankings}
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
          marginBottom: '8px',
          fontSize: '24px',
          fontWeight: 700,
          color: colors.text,
        }}>
          Metered Carpark Rankings
        </h1>
        <p style={{
          margin: 0,
          marginBottom: '16px',
          fontSize: '14px',
          color: colors.muted,
        }}>
          Historical activity rankings for on-street parking
        </p>

        {/* Filters */}
        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          {/* Snapshot Picker */}
          <select
            value={selectedSnapshotId || ''}
            onChange={(e) => setSelectedSnapshotId(e.target.value || null)}
            style={{
              padding: '8px 12px',
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              background: colors.background,
              color: colors.text,
              fontSize: '14px',
              minWidth: '220px',
            }}
          >
            <option value="">Latest (Live Vacancy)</option>
            {snapshots.map(s => (
              <option key={s.snapshot_id} value={s.snapshot_id}>
                {formatDate(s.snapshot_at)} ({s.active_carparks} active)
              </option>
            ))}
          </select>

          {/* District Filter */}
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
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

          {/* Page Size */}
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            style={{
              padding: '8px 12px',
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              background: colors.background,
              color: colors.text,
              fontSize: '14px',
            }}
          >
            <option value={50}>Show 50</option>
            <option value={100}>Show 100</option>
            <option value={200}>Show 200</option>
          </select>

          <button
            onClick={() => { fetchSnapshots(); fetchRankings(); }}
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
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '24px' }}>
        {/* Snapshot Info Bar */}
        {currentSnapshot && (
          <div style={{
            background: isDarkMode ? '#1e3a5f' : '#eff6ff',
            border: `1px solid ${isDarkMode ? '#3b82f6' : '#bfdbfe'}`,
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            flexWrap: 'wrap',
          }}>
            <div style={{ fontSize: '14px', color: colors.text }}>
              <strong>Snapshot:</strong> {formatDate(currentSnapshot.snapshot_at)} HKT
            </div>
            <div style={{ fontSize: '14px', color: colors.muted }}>
              {currentSnapshot.total_carparks} carparks
            </div>
            <div style={{ fontSize: '14px', color: colors.success }}>
              {currentSnapshot.active_carparks} active
            </div>
            {!selectedSnapshotId && (
              <div style={{
                fontSize: '12px',
                color: colors.success,
                background: isDarkMode ? '#064e3b' : '#d1fae5',
                padding: '4px 8px',
                borderRadius: '4px',
              }}>
                LIVE
              </div>
            )}
          </div>
        )}

        {/* Ranking Table */}
        <div style={{
          background: colors.background,
          border: `1px solid ${colors.border}`,
          borderRadius: '8px',
          overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
            }}>
              <thead>
                <tr style={{ background: isDarkMode ? '#111827' : '#f9fafb' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: colors.muted, fontWeight: 600, width: '60px' }}>Rank</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: colors.muted, fontWeight: 600 }}>Name</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: colors.muted, fontWeight: 600 }}>District</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: colors.muted, fontWeight: 600 }}>Activity</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: colors.muted, fontWeight: 600 }}>Spaces</th>
                  {!selectedSnapshotId && (
                    <th style={{ padding: '12px 16px', textAlign: 'right', color: colors.muted, fontWeight: 600 }}>Vacant</th>
                  )}
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: colors.muted, fontWeight: 600, width: '100px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((carpark, index) => (
                  <tr
                    key={carpark.carpark_id}
                    style={{
                      borderBottom: `1px solid ${colors.border}`,
                      background: index % 2 === 0 ? 'transparent' : (isDarkMode ? '#1a1f2e' : '#f9fafb'),
                    }}
                  >
                    <td style={{ padding: '12px 16px', color: colors.text, fontWeight: 700 }}>
                      #{carpark.rank}
                    </td>
                    <td style={{ padding: '12px 16px', color: colors.text, maxWidth: '300px' }}>
                      <div style={{ fontWeight: 500 }}>{carpark.name}</div>
                      {carpark.name_tc && (
                        <div style={{ fontSize: '11px', color: colors.muted, marginTop: '2px' }}>
                          {carpark.name_tc}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', color: colors.text, fontSize: '12px' }}>
                      {carpark.district}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <span style={{
                        color: carpark.activity_score > 500 ? colors.danger :
                               carpark.activity_score > 100 ? colors.warning : colors.text,
                        fontWeight: 700,
                        fontSize: '14px',
                      }}>
                        {Math.round(carpark.activity_score).toLocaleString()}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: colors.text, textAlign: 'right' }}>
                      {carpark.total_spaces}
                    </td>
                    {!selectedSnapshotId && (
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <span style={{
                          color: (carpark.vacancy_rate || 0) > 30 ? colors.success : colors.warning,
                          fontWeight: 600,
                        }}>
                          {carpark.vacant_spaces || 0}/{(carpark.vacant_spaces || 0) + (carpark.occupied_spaces || 0)}
                        </span>
                      </td>
                    )}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleViewHistory(carpark)}
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
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              padding: '12px 16px',
              borderTop: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
            }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                style={{
                  padding: '6px 12px',
                  background: currentPage === 0 ? colors.muted : colors.background,
                  color: currentPage === 0 ? '#fff' : colors.text,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '4px',
                  cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                }}
              >
                Prev
              </button>
              <span style={{ fontSize: '13px', color: colors.text }}>
                Page {currentPage + 1} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                style={{
                  padding: '6px 12px',
                  background: currentPage >= totalPages - 1 ? colors.muted : colors.background,
                  color: currentPage >= totalPages - 1 ? '#fff' : colors.text,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '4px',
                  cursor: currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Ranking History Modal */}
      {selectedCarpark && (
        <div
          onClick={closeModal}
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
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: colors.background,
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '900px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h2 style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 600,
                  color: colors.text,
                }}>
                  {selectedCarpark.name}
                </h2>
                {selectedCarpark.name_tc && (
                  <div style={{ fontSize: '14px', color: colors.muted, marginTop: '4px' }}>
                    {selectedCarpark.name_tc}
                  </div>
                )}
                <div style={{ fontSize: '13px', color: colors.muted, marginTop: '8px' }}>
                  {selectedCarpark.district} | Current Rank: #{selectedCarpark.rank} | Activity: {Math.round(selectedCarpark.activity_score).toLocaleString()}
                </div>
              </div>
              <button
                onClick={closeModal}
                style={{
                  padding: '6px 12px',
                  background: colors.muted,
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Close
              </button>
            </div>

            <h3 style={{
              margin: '20px 0 12px 0',
              fontSize: '15px',
              fontWeight: 600,
              color: colors.text
            }}>
              24-Hour Rank History
            </h3>

            {loadingHistory ? (
              <div style={{ padding: '40px', textAlign: 'center', color: colors.muted }}>
                Loading ranking history...
              </div>
            ) : rankingHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart
                  data={[...rankingHistory].reverse()}
                  margin={{ top: 20, right: 20, bottom: 60, left: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                  <XAxis
                    dataKey="snapshot_at"
                    stroke={colors.muted}
                    style={{ fontSize: '11px' }}
                    angle={-45}
                    textAnchor="end"
                    tickFormatter={(value) => new Date(value).toLocaleString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Asia/Hong_Kong',
                    })}
                  />
                  <YAxis
                    stroke={colors.muted}
                    style={{ fontSize: '12px' }}
                    reversed
                    domain={['dataMin - 10', 'dataMax + 10']}
                    label={{ value: 'Rank Position', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: colors.background,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                    labelFormatter={(value) => formatDate(value as string)}
                    formatter={(value: number, name: string) => {
                      if (name === 'rank') return [`#${value}`, 'Rank'];
                      if (name === 'activity_score') return [Math.round(value).toLocaleString(), 'Activity'];
                      return [value, name];
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rank"
                    stroke={colors.primary}
                    strokeWidth={2}
                    dot={{ fill: colors.primary, r: 3 }}
                    name="rank"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: colors.muted }}>
                No ranking history available. Snapshots are captured every ~5 minutes.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
