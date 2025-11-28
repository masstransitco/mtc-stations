'use client';

import { useState } from 'react';
import { ChevronUp } from 'lucide-react';
import type { IndoorFloor } from '@/types/connected-carpark';

interface IndoorLevelPickerProps {
  visible: boolean;
  isDarkMode: boolean;
  selectedOrdinal: number | null;
  onLevelChange: (ordinal: number | null) => void;
  floors: IndoorFloor[];
}

/**
 * IndoorLevelPicker
 *
 * A vertical level selector for indoor map overlays.
 * Positioned on the left side under the compass button.
 * Allows users to filter the indoor overlay by floor level.
 */
export function IndoorLevelPicker({
  visible,
  isDarkMode,
  selectedOrdinal,
  onLevelChange,
  floors,
}: IndoorLevelPickerProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Sort floors in descending order (top floors first)
  const sortedFloors = [...floors].sort((a, b) => b.ordinal - a.ordinal);

  // Get the current floor display name
  const getCurrentFloorName = (): string => {
    if (selectedOrdinal === null) return 'All';
    const floor = floors.find(f => f.ordinal === selectedOrdinal);
    return floor?.short_name || 'All';
  };

  // Hide when not visible or no floors
  if (!visible || floors.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '80px', // Below compass: 20px + 48px + 12px gap
        left: '20px',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      {/* Toggle button when collapsed */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
            border: isDarkMode ? '2px solid #374151' : '2px solid #e5e7eb',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            color: isDarkMode ? '#d1d5db' : '#4b5563',
            fontSize: '12px',
            fontWeight: 600,
          }}
          title="Expand floor picker"
        >
          {getCurrentFloorName()}
        </button>
      )}

      {/* Expanded floor list */}
      {isExpanded && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
            borderRadius: '12px',
            padding: '6px',
            border: isDarkMode ? '2px solid #374151' : '2px solid #e5e7eb',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            maxHeight: 'calc(100vh - 250px)',
            overflowY: 'auto',
          }}
        >
          {/* Collapse button */}
          <button
            onClick={() => setIsExpanded(false)}
            style={{
              width: '36px',
              height: '24px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
              color: isDarkMode ? '#9ca3af' : '#6b7280',
              fontSize: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '4px',
            }}
            title="Collapse"
          >
            <ChevronUp size={14} />
          </button>

          {/* "All" button */}
          <button
            onClick={() => onLevelChange(null)}
            style={{
              width: '36px',
              height: '28px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: selectedOrdinal === null
                ? (isDarkMode ? '#8b5cf6' : '#7c3aed')
                : 'transparent',
              color: selectedOrdinal === null
                ? '#ffffff'
                : (isDarkMode ? '#d1d5db' : '#4b5563'),
              fontSize: '11px',
              fontWeight: selectedOrdinal === null ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '2px',
            }}
            title="Show all floors"
          >
            All
          </button>

          {/* Divider */}
          <div style={{
            height: '1px',
            backgroundColor: isDarkMode ? '#374151' : '#e5e7eb',
            margin: '2px 0',
          }} />

          {/* Floor buttons */}
          {sortedFloors.map((floor) => {
            const isSelected = floor.ordinal === selectedOrdinal;
            return (
              <button
                key={floor.ordinal}
                onClick={() => onLevelChange(floor.ordinal)}
                title={floor.name}
                style={{
                  width: '36px',
                  height: '28px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: isSelected
                    ? (isDarkMode ? '#8b5cf6' : '#7c3aed')
                    : 'transparent',
                  color: isSelected
                    ? '#ffffff'
                    : (isDarkMode ? '#d1d5db' : '#4b5563'),
                  fontSize: '10px',
                  fontWeight: isSelected ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {floor.short_name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
