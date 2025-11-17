"use client";

import { useTheme } from "@/components/theme-provider";

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

export default function LoadingSpinner({ size = 'md', message }: LoadingSpinnerProps) {
  const { isDarkMode } = useTheme();

  const sizeMap = {
    sm: { spinner: 32, dot: 8 },
    md: { spinner: 48, dot: 12 },
    lg: { spinner: 64, dot: 16 }
  };

  const dimensions = sizeMap[size];
  const dotSize = dimensions.dot;
  const spinnerSize = dimensions.spinner;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px'
    }}>
      <style>{`
        @keyframes spinnerRotate {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes dotPulse {
          0%, 100% {
            transform: scale(0.8);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.2);
            opacity: 1;
          }
        }

        .spinner-container-${size} {
          position: relative;
          width: ${spinnerSize}px;
          height: ${spinnerSize}px;
          animation: spinnerRotate 3s linear infinite;
        }

        .spinner-dot-${size} {
          position: absolute;
          width: ${dotSize}px;
          height: ${dotSize}px;
          border-radius: 50%;
          background: ${isDarkMode ? '#3b82f6' : '#2563eb'};
          box-shadow: 0 0 ${dotSize * 2}px ${isDarkMode ? 'rgba(59, 130, 246, 0.5)' : 'rgba(37, 99, 235, 0.5)'};
        }

        .spinner-dot-${size}:nth-child(1) {
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          animation: dotPulse 1.5s ease-in-out infinite;
          animation-delay: 0s;
        }

        .spinner-dot-${size}:nth-child(2) {
          top: 50%;
          right: 0;
          transform: translateY(-50%);
          animation: dotPulse 1.5s ease-in-out infinite;
          animation-delay: 0.375s;
        }

        .spinner-dot-${size}:nth-child(3) {
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          animation: dotPulse 1.5s ease-in-out infinite;
          animation-delay: 0.75s;
        }

        .spinner-dot-${size}:nth-child(4) {
          top: 50%;
          left: 0;
          transform: translateY(-50%);
          animation: dotPulse 1.5s ease-in-out infinite;
          animation-delay: 1.125s;
        }

        .spinner-center-${size} {
          position: absolute;
          width: ${dotSize}px;
          height: ${dotSize}px;
          border-radius: 50%;
          background: ${isDarkMode ? '#60a5fa' : '#3b82f6'};
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: dotPulse 1.5s ease-in-out infinite reverse;
        }

        .loading-message-${size} {
          font-size: ${size === 'sm' ? '13px' : size === 'md' ? '15px' : '17px'};
          font-weight: 500;
          color: ${isDarkMode ? '#9ca3af' : '#6b7280'};
          animation: dotPulse 2s ease-in-out infinite;
        }
      `}</style>

      <div className={`spinner-container-${size}`}>
        <div className={`spinner-dot-${size}`} />
        <div className={`spinner-dot-${size}`} />
        <div className={`spinner-dot-${size}`} />
        <div className={`spinner-dot-${size}`} />
        <div className={`spinner-center-${size}`} />
      </div>

      {message && (
        <div className={`loading-message-${size}`}>
          {message}
        </div>
      )}
    </div>
  );
}
