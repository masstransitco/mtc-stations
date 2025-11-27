"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { useTheme } from "@/components/theme-provider";
import { ChevronLeft } from "lucide-react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  onExpand?: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
  onHeightChange?: (height: number) => void;
}

export default function BottomSheet({ isOpen, onClose, children, title, onExpand, showBackButton = false, onBack, onHeightChange }: BottomSheetProps) {
  const [position, setPosition] = useState(2); // 0 = expanded, 1 = collapsed, 2 = minimized - start minimized
  const [dragStartY, setDragStartY] = useState(0);
  const [dragCurrentY, setDragCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const { isDarkMode } = useTheme();

  // Height states: 0 = 70vh (expanded), 1 = 40vh (collapsed), 2 = 100px (minimized)
  const heights = ["70vh", "40vh", "100px"];

  // Function to expand the sheet
  const expandSheet = () => {
    if (position !== 0) {
      setPosition(0); // Expand to full
      onExpand?.(); // Call optional callback
    }
  };

  // Expand when isOpen becomes true
  useEffect(() => {
    if (isOpen) {
      setPosition(1); // Expand to collapsed state when content is available
    }
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setDragStartY(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setDragCurrentY(e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;

    const dragDistance = dragCurrentY - dragStartY;
    const threshold = 50;

    if (Math.abs(dragDistance) > threshold) {
      if (dragDistance > 0) {
        // Dragging down
        if (position < 2) {
          setPosition(position + 1);
        }
        // Stay at minimized position, don't close
      } else {
        // Dragging up
        if (position > 0) {
          setPosition(position - 1);
        }
      }
    }

    setIsDragging(false);
    setDragStartY(0);
    setDragCurrentY(0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragStartY(e.clientY);
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    setDragCurrentY(e.clientY);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;

    const dragDistance = dragCurrentY - dragStartY;
    const threshold = 50;

    if (Math.abs(dragDistance) > threshold) {
      if (dragDistance > 0) {
        // Dragging down
        if (position < 2) {
          setPosition(position + 1);
        }
        // Stay at minimized position, don't close
      } else {
        // Dragging up
        if (position > 0) {
          setPosition(position - 1);
        }
      }
    }

    setIsDragging(false);
    setDragStartY(0);
    setDragCurrentY(0);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStartY, dragCurrentY, position]);

  // Measure and report actual DOM height during drag
  // Only runs RAF loop while actively dragging to avoid continuous reads
  useEffect(() => {
    if (!sheetRef.current || !onHeightChange || !isDragging) return;

    const element = sheetRef.current;
    let animationFrameId: number | null = null;

    const measureHeight = () => {
      const rect = element.getBoundingClientRect();
      const visibleHeight = Math.max(0, window.innerHeight - rect.top);
      onHeightChange(visibleHeight);

      // Continue measuring only while dragging
      if (isDragging) {
        animationFrameId = requestAnimationFrame(measureHeight);
      }
    };

    // Start measuring
    measureHeight();

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isDragging, onHeightChange]);

  // Also report height changes when position state changes
  useEffect(() => {
    if (!onHeightChange) return;

    // Convert vh to pixels for position-based heights
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
    let pixelHeight = 100; // Default minimized height

    if (position === 0) {
      pixelHeight = viewportHeight * 0.7; // 70vh
    } else if (position === 1) {
      pixelHeight = viewportHeight * 0.4; // 40vh
    } else if (position === 2) {
      pixelHeight = 100; // 100px
    }

    onHeightChange(pixelHeight);
  }, [position, onHeightChange]);

  const translateY = isDragging && dragCurrentY !== 0 ? dragCurrentY - dragStartY : 0;

  return (
    <>

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: heights[position],
          backgroundColor: isDarkMode ? "#1f2937" : "#ffffff",
          borderTopLeftRadius: "20px",
          borderTopRightRadius: "20px",
          boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.25)",
          zIndex: 50,
          transform: `translateY(${translateY}px)`,
          transition: isDragging ? "none" : "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          touchAction: "none",
        }}
      >
        {/* Drag Handle */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          style={{
            padding: "16px",
            cursor: "grab",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
            flexShrink: 0,
            userSelect: "none",
            WebkitUserSelect: "none",
            position: "relative",
          }}
        >
          {/* Back Button */}
          {showBackButton && onBack && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onBack();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
              }}
              style={{
                position: "absolute",
                left: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                backgroundColor: isDarkMode ? "#374151" : "#f3f4f6",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDarkMode ? "#4b5563" : "#e5e7eb";
                e.currentTarget.style.transform = "translateY(-50%) scale(1.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isDarkMode ? "#374151" : "#f3f4f6";
                e.currentTarget.style.transform = "translateY(-50%) scale(1)";
              }}
            >
              <ChevronLeft size={20} color={isDarkMode ? "#f3f4f6" : "#111827"} />
            </button>
          )}

          <div
            style={{
              width: "40px",
              height: "4px",
              backgroundColor: isDarkMode ? "#4b5563" : "#d1d5db",
              borderRadius: "2px",
            }}
          />
          {title && (
            <h3
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 600,
                color: isDarkMode ? "#f3f4f6" : "#111827",
              }}
            >
              {title}
            </h3>
          )}
        </div>

        {/* Content */}
        <div
          onClick={expandSheet}
          style={{
            flex: 1,
            overflow: "auto",
            padding: "0 20px 20px 20px",
            cursor: position !== 0 ? 'pointer' : 'default',
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
