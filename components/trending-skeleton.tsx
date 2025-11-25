"use client";

import { useTheme } from "@/components/theme-provider";

interface TrendingSkeletonProps {
  rows?: number;
  showHeader?: boolean;
  type?: "indoor" | "metered";
}

export default function TrendingSkeleton({
  rows = 5,
  showHeader = true,
  type = "indoor",
}: TrendingSkeletonProps) {
  const { isDarkMode } = useTheme();

  const shimmerBg = isDarkMode
    ? "linear-gradient(90deg, #374151 0%, #4b5563 50%, #374151 100%)"
    : "linear-gradient(90deg, #e5e7eb 0%, #f3f4f6 50%, #e5e7eb 100%)";

  return (
    <div>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .skeleton-shimmer {
          background: ${shimmerBg};
          background-size: 200% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
        }
      `}</style>

      {showHeader && (
        <>
          {/* Header Skeleton */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "16px",
            }}
          >
            {/* Icon placeholder */}
            <div
              className="skeleton-shimmer"
              style={{
                width: "18px",
                height: "18px",
                borderRadius: "4px",
              }}
            />
            {/* Title placeholder */}
            <div
              className="skeleton-shimmer"
              style={{
                width: type === "metered" ? "180px" : "140px",
                height: "18px",
                borderRadius: "4px",
              }}
            />
          </div>

          {/* Subtitle Skeleton */}
          <div
            className="skeleton-shimmer"
            style={{
              width: "220px",
              height: "14px",
              borderRadius: "4px",
              marginBottom: "16px",
            }}
          />
        </>
      )}

      {/* List Skeleton */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            style={{
              padding: "10px 12px",
              backgroundColor: isDarkMode ? "#1f2937" : "#ffffff",
              border: isDarkMode ? "1px solid #374151" : "1px solid #e5e7eb",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            {/* Rank Skeleton */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "2px",
                minWidth: "32px",
              }}
            >
              <div
                className="skeleton-shimmer"
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "4px",
                }}
              />
            </div>

            {/* Main Content Skeleton */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              {/* Name placeholder - varying widths for natural look */}
              <div
                className="skeleton-shimmer"
                style={{
                  width: `${65 + (index % 3) * 10}%`,
                  height: "14px",
                  borderRadius: "4px",
                }}
              />
              {/* District placeholder */}
              <div
                className="skeleton-shimmer"
                style={{
                  width: `${35 + (index % 2) * 15}%`,
                  height: "11px",
                  borderRadius: "3px",
                }}
              />
            </div>

            {/* Vacancy Skeleton */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "2px",
                flexShrink: 0,
              }}
            >
              {/* Main vacancy number */}
              <div
                className="skeleton-shimmer"
                style={{
                  width: "28px",
                  height: "20px",
                  borderRadius: "4px",
                }}
              />
              {/* For metered: show /total skeleton */}
              {type === "metered" && (
                <div
                  className="skeleton-shimmer"
                  style={{
                    width: "24px",
                    height: "12px",
                    borderRadius: "3px",
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
