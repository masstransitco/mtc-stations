"use client";

import { useState, useRef, useEffect } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { Search, X } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

interface AddressSearchProps {
  onPlaceSelected: (place: google.maps.places.PlaceResult) => void;
  onClear?: () => void;
}

export default function AddressSearch({ onPlaceSelected, onClear }: AddressSearchProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const places = useMapsLibrary("places");
  const { isDarkMode } = useTheme();
  const scrollPositionRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!places || !inputRef.current) return;

    // Initialize autocomplete with Hong Kong bounds
    const autocomplete = new places.Autocomplete(inputRef.current, {
      fields: ["formatted_address", "geometry", "name", "place_id"],
      componentRestrictions: { country: "hk" }, // Restrict to Hong Kong
      types: ["geocode", "establishment"], // Allow addresses and places
    });

    autocompleteRef.current = autocomplete;

    // Listen for place selection
    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (place.geometry?.location) {
        onPlaceSelected(place);
        setInputValue(place.formatted_address || place.name || "");
      }
    });

    return () => {
      if (listener) {
        google.maps.event.removeListener(listener);
      }
    };
  }, [places, onPlaceSelected]);

  // Inject custom styles for autocomplete dropdown
  useEffect(() => {
    const styleId = "autocomplete-dropdown-styles";

    // Remove existing style if present
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) {
      existingStyle.remove();
    }

    // Create new style element
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .pac-container {
        background-color: ${isDarkMode ? "#1f2937" : "#ffffff"} !important;
        border: 2px solid ${isDarkMode ? "#374151" : "#e5e7eb"} !important;
        border-radius: 12px !important;
        box-shadow: 0 8px 24px rgba(0, 0, 0, ${isDarkMode ? "0.4" : "0.15"}) !important;
        margin-top: 8px !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        padding: 4px 0 !important;
      }

      .pac-container::after {
        display: none !important;
      }

      .pac-item {
        padding: 12px 16px !important;
        cursor: pointer !important;
        border-top: none !important;
        color: ${isDarkMode ? "#f3f4f6" : "#111827"} !important;
        line-height: 1.4 !important;
        transition: background-color 0.15s ease !important;
      }

      .pac-item:hover {
        background-color: ${isDarkMode ? "#374151" : "#f3f4f6"} !important;
      }

      .pac-item-selected,
      .pac-item-selected:hover {
        background-color: ${isDarkMode ? "#4b5563" : "#e5e7eb"} !important;
      }

      .pac-icon {
        display: none !important;
      }

      .pac-item-query {
        color: ${isDarkMode ? "#f3f4f6" : "#111827"} !important;
        font-size: 14px !important;
        font-weight: 500 !important;
      }

      .pac-matched {
        color: ${isDarkMode ? "#60a5fa" : "#3b82f6"} !important;
        font-weight: 600 !important;
      }

      .pac-item span:last-child {
        color: ${isDarkMode ? "#9ca3af" : "#6b7280"} !important;
        font-size: 13px !important;
      }
    `;

    document.head.appendChild(style);

    return () => {
      const styleToRemove = document.getElementById(styleId);
      if (styleToRemove) {
        styleToRemove.remove();
      }
    };
  }, [isDarkMode]);

  const handleClear = () => {
    setInputValue("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    onClear?.();
  };

  const handleFocus = () => {
    // Store current scroll position
    scrollPositionRef.current = {
      x: window.scrollX,
      y: window.scrollY,
    };
  };

  const handleBlur = () => {
    // Restore scroll position after a short delay to ensure browser has finished its actions
    setTimeout(() => {
      window.scrollTo(scrollPositionRef.current.x, scrollPositionRef.current.y);
    }, 100);
  };

  // Handle keyboard dismissal and window resize (which happens when keyboard closes)
  useEffect(() => {
    const handleResize = () => {
      // Check if input is not focused (keyboard was dismissed)
      if (inputRef.current && document.activeElement !== inputRef.current) {
        window.scrollTo(scrollPositionRef.current.x, scrollPositionRef.current.y);
      }
    };

    const handleVisibilityChange = () => {
      // When page becomes visible again after keyboard dismissal
      if (!document.hidden && inputRef.current && document.activeElement !== inputRef.current) {
        window.scrollTo(scrollPositionRef.current.x, scrollPositionRef.current.y);
      }
    };

    const handleVisualViewportResize = () => {
      // Visual viewport resize happens when keyboard shows/hides on iOS
      // Add a small delay to ensure the keyboard animation is complete
      setTimeout(() => {
        if (inputRef.current && document.activeElement !== inputRef.current) {
          window.scrollTo(scrollPositionRef.current.x, scrollPositionRef.current.y);
        }
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Use visualViewport API for better iOS support
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportResize);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportResize);
      }
    };
  }, []);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          backgroundColor: isDarkMode ? "#1f2937" : "#ffffff",
          border: isDarkMode ? "2px solid #374151" : "2px solid #e5e7eb",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "0 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Search
            size={20}
            color={isDarkMode ? "#9ca3af" : "#6b7280"}
          />
        </div>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search for an address..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="address-search-input"
          style={{
            flex: 1,
            padding: "14px 8px",
            border: "none",
            outline: "none",
            fontSize: "16px",
            backgroundColor: "transparent",
            color: isDarkMode ? "#f3f4f6" : "#111827",
          }}
        />
        <style jsx>{`
          .address-search-input::placeholder {
            color: ${isDarkMode ? "#9ca3af" : "#6b7280"};
            opacity: 1;
          }
        `}</style>
        {inputValue && (
          <button
            onClick={handleClear}
            style={{
              padding: "0 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              border: "none",
              backgroundColor: "transparent",
            }}
          >
            <X
              size={20}
              color={isDarkMode ? "#9ca3af" : "#6b7280"}
            />
          </button>
        )}
      </div>
    </div>
  );
}
