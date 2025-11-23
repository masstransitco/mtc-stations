import { ReactNode, CSSProperties } from 'react';

interface MapControlButtonProps {
  icon: ReactNode;
  onClick: () => void;
  isActive: boolean;
  title: string;
  isDarkMode: boolean;
  position: number; // Position in stack (0-based index)
  className?: string;
}

export function MapControlButton({
  icon,
  onClick,
  isActive,
  title,
  isDarkMode,
  position,
  className
}: MapControlButtonProps) {
  // Calculate top position: base (80px - below theme selector) + position * (button height 48px + gap 12px)
  const topPosition = 80 + position * 60;

  const buttonStyle: CSSProperties = {
    position: 'absolute',
    top: `${topPosition}px`,
    right: '20px',
    zIndex: 10,
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: isActive && title === 'My Location'
      ? '#3b82f6'
      : (isDarkMode ? '#1f2937' : '#ffffff'),
    border: isActive && title === 'My Location'
      ? '2px solid #3b82f6'
      : (isDarkMode ? '2px solid #374151' : '2px solid #e5e7eb'),
    boxShadow: isActive && title === 'My Location'
      ? '0 4px 12px rgba(59, 130, 246, 0.4)'
      : '0 4px 12px rgba(0, 0, 0, 0.15)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1.1)';
    e.currentTarget.style.boxShadow = isActive && title === 'My Location'
      ? '0 6px 16px rgba(59, 130, 246, 0.5)'
      : '0 6px 16px rgba(0, 0, 0, 0.2)';
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1)';
    e.currentTarget.style.boxShadow = isActive && title === 'My Location'
      ? '0 4px 12px rgba(59, 130, 246, 0.4)'
      : '0 4px 12px rgba(0, 0, 0, 0.15)';
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={buttonStyle}
      title={title}
      className={className}
    >
      {icon}
    </button>
  );
}
