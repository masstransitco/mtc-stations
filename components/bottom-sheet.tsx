"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { useTheme } from "@/components/theme-provider";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export default function BottomSheet({ isOpen, onClose, children, title }: BottomSheetProps) {
  const [position, setPosition] = useState(2); // 0 = expanded, 1 = collapsed, 2 = minimized - start minimized
  const [dragStartY, setDragStartY] = useState(0);
  const [dragCurrentY, setDragCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const { isDarkMode } = useTheme();

  // Height states: 0 = 70vh (expanded), 1 = 40vh (collapsed), 2 = 100px (minimized)
  const heights = ["70vh", "40vh", "100px"];

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
          }}
        >
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
          style={{
            flex: 1,
            overflow: "auto",
            padding: "0 20px 20px 20px",
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
