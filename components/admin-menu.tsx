'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from './theme-provider';

export function AdminMenu() {
  const { isDarkMode } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const colors = {
    background: isDarkMode ? '#1f2937' : '#ffffff',
    text: isDarkMode ? '#f3f4f6' : '#111827',
    border: isDarkMode ? '#374151' : '#e5e7eb',
    muted: isDarkMode ? '#6b7280' : '#9ca3af',
    primary: '#3b82f6',
    hover: isDarkMode ? '#374151' : '#f3f4f6',
  };

  const menuItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/admin/carparks', label: 'Carparks', icon: '🅿️' },
  ];

  return (
    <div style={{ position: 'relative' }}>
      {/* Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '8px 16px',
          background: colors.background,
          border: `1px solid ${colors.border}`,
          borderRadius: '6px',
          color: colors.text,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: 500,
        }}
      >
        <span style={{ fontSize: '18px' }}>☰</span>
        <span>Menu</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
            }}
          />

          {/* Menu Content */}
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              background: colors.background,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              boxShadow: isDarkMode
                ? '0 10px 25px rgba(0, 0, 0, 0.5)'
                : '0 10px 25px rgba(0, 0, 0, 0.1)',
              minWidth: '200px',
              zIndex: 1000,
              overflow: 'hidden',
            }}
          >
            {menuItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    router.push(item.path);
                    setIsOpen(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: isActive ? colors.primary : 'transparent',
                    border: 'none',
                    color: isActive ? '#ffffff' : colors.text,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 400,
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = colors.hover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <span style={{ fontSize: '18px' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
