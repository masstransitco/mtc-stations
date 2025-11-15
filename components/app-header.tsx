"use client";

import Image from "next/image";
import ThemeToggle from "./theme-toggle";
import { useTheme } from "./theme-provider";

export default function AppHeader() {
  const { isDarkMode } = useTheme();
  return (
    <header style={{
      backgroundColor: 'var(--card, #ffffff)',
      borderBottom: '1px solid var(--border, #e5e7eb)'
    }}>
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: '1536px',
        margin: '0 auto'
      }}>
        {/* Logo and Title Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            position: 'relative',
            width: '80px',
            height: '40px',
            filter: isDarkMode ? 'brightness(0) invert(1)' : 'none'
          }}>
            <Image
              src="/logos/mtc-logo-2025.svg"
              alt="MTC Logo"
              fill
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 style={{
              fontSize: '18px',
              fontWeight: 600,
              lineHeight: 1.2,
              color: 'var(--foreground, #000000)',
              margin: 0
            }}>
              MTC Parking Stations
            </h1>
            <p style={{
              fontSize: '12px',
              color: 'var(--muted-foreground, #6b7280)',
              margin: 0
            }}>
              Hong Kong Real-time Parking Availability
            </p>
          </div>
        </div>

        {/* Theme Toggle Section */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
