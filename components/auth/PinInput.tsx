"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/theme-provider";

interface PinInputProps {
  length: number;
  loading: boolean;
  onChange: (code: string) => void;
  autoFocus?: boolean;
}

/**
 * PinInput Component for OTP Entry
 *
 * Features:
 * - Manual digit input with proper navigation
 * - Paste functionality for quick input
 * - Keyboard navigation between inputs
 * - Auto-fill support
 */
export default function PinInput({ length, loading, onChange, autoFocus = true }: PinInputProps) {
  const { isDarkMode } = useTheme();
  const [values, setValues] = useState<string[]>(Array(length).fill(""));
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Initialize refs array
  useEffect(() => {
    inputRefs.current = Array(length).fill(null);
  }, [length]);

  // Reset values when loading state changes
  useEffect(() => {
    if (!loading) {
      setValues(Array(length).fill(""));
    }
  }, [loading, length]);

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    if (!/^\d*$/.test(value)) return;

    // Handle auto-fill or paste (when value length > 1)
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').substring(0, length);
      const newValues = [...Array(length).fill("")];

      [...digits].forEach((char, i) => {
        if (i < length) newValues[i] = char;
      });

      setValues(newValues);
      onChange(newValues.join(""));

      // Focus on the last input or the next empty one
      const focusIndex = Math.min(digits.length, length - 1);
      if (inputRefs.current[focusIndex]) {
        inputRefs.current[focusIndex]?.focus();
        setActiveIndex(focusIndex);
      }
      return;
    }

    // Update single value
    const newValues = [...values];
    newValues[index] = value;
    setValues(newValues);
    onChange(newValues.join(""));

    // Move to next input if current one is filled
    if (value && index < length - 1) {
      const nextInput = inputRefs.current[index + 1];
      if (nextInput) {
        nextInput.focus();
        setActiveIndex(index + 1);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Move to previous input on backspace if current is empty
    if (e.key === "Backspace" && !values[index] && index > 0) {
      const prevInput = inputRefs.current[index - 1];
      if (prevInput) {
        prevInput.focus();
        setActiveIndex(index - 1);
      }
    }

    // Move to next input on right arrow
    if (e.key === "ArrowRight" && index < length - 1) {
      const nextInput = inputRefs.current[index + 1];
      if (nextInput) {
        nextInput.focus();
        setActiveIndex(index + 1);
      }
    }

    // Move to previous input on left arrow
    if (e.key === "ArrowLeft" && index > 0) {
      const prevInput = inputRefs.current[index - 1];
      if (prevInput) {
        prevInput.focus();
        setActiveIndex(index - 1);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text/plain").trim();

    // Only accept digits
    if (!/^\d*$/.test(pastedData)) return;

    const pastedValue = pastedData.substring(0, length);
    const newValues = [...Array(length).fill("")];

    [...pastedValue].forEach((char, i) => {
      if (i < length) newValues[i] = char;
    });

    setValues(newValues);
    onChange(newValues.join(""));

    // Focus on the last input or the next empty one
    const focusIndex = Math.min(pastedValue.length, length - 1);
    const inputToFocus = inputRefs.current[focusIndex];
    if (inputToFocus) {
      inputToFocus.focus();
      setActiveIndex(focusIndex);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 8px" }}>
      <div style={{ display: "flex", gap: "12px", maxWidth: "100%", overflow: "hidden" }}>
        {Array.from({ length }).map((_, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.2 }}
            style={{ position: "relative", flexShrink: 0 }}
          >
            <input
              ref={(el) => {
                if (inputRefs.current) {
                  inputRefs.current[index] = el;
                }
              }}
              type="text"
              inputMode="numeric"
              pattern="\d*"
              maxLength={index === 0 ? length : 1}
              disabled={loading}
              autoFocus={index === 0 && autoFocus && !loading}
              autoComplete="off"
              value={values[index] || ""}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onFocus={() => setActiveIndex(index)}
              onPaste={handlePaste}
              style={{
                height: "56px",
                width: "48px",
                borderRadius: "8px",
                border: "2px solid",
                borderColor: activeIndex === index ? "#276EF1" : (isDarkMode ? "rgb(39, 39, 42)" : "rgb(209, 213, 219)"),
                textAlign: "center",
                fontSize: "20px",
                fontWeight: 500,
                caretColor: "#276EF1",
                outline: "none",
                transition: "all 0.2s",
                backgroundColor: isDarkMode ? "#27272a" : "#f9fafb",
                color: isDarkMode ? "#ffffff" : "#111827",
                opacity: loading ? 0.5 : 1,
              }}
            />
            {activeIndex === index && (
              <motion.div
                layoutId="active-indicator"
                style={{
                  position: "absolute",
                  bottom: "-4px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  height: "2px",
                  width: "32px",
                  borderRadius: "9999px",
                  backgroundColor: "#276EF1",
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
