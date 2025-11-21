'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from './theme-provider';

export function AdminNav() {
  const { isDarkMode } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  const colors = {
    background: isDarkMode ? '#1f2937' : '#ffffff',
    text: isDarkMode ? '#f3f4f6' : '#111827',
    border: isDarkMode ? '#374151' : '#e5e7eb',
    muted: isDarkMode ? '#6b7280' : '#9ca3af',
    primary: '#3b82f6',
    hover: isDarkMode ? '#374151' : '#f3f4f6',
  };

  const navItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/admin/carparks', label: 'Carparks', icon: '🅿️' },
  ];

  return (
    <nav
      style={{
        width: '100%',
        background: colors.background,
        borderBottom: `1px solid ${colors.border}`,
        padding: '0 24px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          height: '56px',
        }}
      >
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              style={{
                padding: '8px 16px',
                background: isActive ? colors.primary : 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: isActive ? '#ffffff' : colors.text,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: isActive ? 600 : 500,
                transition: 'all 0.2s',
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
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
