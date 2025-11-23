import { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import Image from 'next/image';

interface ThemeSelectorProps {
  isDarkMode: boolean;
  onThemeChange: (theme: 'light' | 'dark') => void;
}

export function ThemeSelector({ isDarkMode, onThemeChange }: ThemeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const buttonStyle = {
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
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1.1)';
    e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1)';
    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  };

  return (
    <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10 }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={buttonStyle}
        title="Theme Selector"
      >
        <Image
          src="/logos/bolt.svg"
          alt="Theme Selector"
          width={28}
          height={28}
          style={{
            filter: isDarkMode ? 'brightness(0) invert(1)' : 'none'
          }}
        />
      </button>

      {/* Expandable Theme Options */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '0',
          right: '60px',
          display: 'flex',
          gap: '8px',
          transition: 'all 0.3s ease',
        }}>
          {/* Light Mode Button */}
          <button
            onClick={() => {
              onThemeChange('light');
              setIsOpen(false);
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
              ...buttonStyle,
              backgroundColor: !isDarkMode ? '#3b82f6' : (isDarkMode ? '#1f2937' : '#ffffff'),
            }}
            title="Light Mode"
          >
            <Sun size={24} color="#ffffff" />
          </button>

          {/* Dark Mode Button */}
          <button
            onClick={() => {
              onThemeChange('dark');
              setIsOpen(false);
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
              ...buttonStyle,
              backgroundColor: isDarkMode ? '#3b82f6' : (isDarkMode ? '#1f2937' : '#ffffff'),
            }}
            title="Dark Mode"
          >
            <Moon size={24} color={isDarkMode ? '#ffffff' : '#111827'} />
          </button>
        </div>
      )}
    </div>
  );
}
