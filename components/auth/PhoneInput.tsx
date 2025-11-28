"use client";

import React, { useState, useMemo } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

const SUPPORTED_COUNTRIES = [
  { code: 'HK', dialCode: '852', flag: '\ud83c\udded\ud83c\uddf0', name: 'Hong Kong' },
  { code: 'CN', dialCode: '86', flag: '\ud83c\udde8\ud83c\uddf3', name: 'China' },
  { code: 'GB', dialCode: '44', flag: '\ud83c\uddec\ud83c\udde7', name: 'United Kingdom' },
  { code: 'US', dialCode: '1', flag: '\ud83c\uddfa\ud83c\uddf8', name: 'United States' },
  { code: 'JP', dialCode: '81', flag: '\ud83c\uddef\ud83c\uddf5', name: 'Japan' },
  { code: 'SG', dialCode: '65', flag: '\ud83c\uddf8\ud83c\uddec', name: 'Singapore' },
  { code: 'DE', dialCode: '49', flag: '\ud83c\udde9\ud83c\uddea', name: 'Germany' },
  { code: 'IN', dialCode: '91', flag: '\ud83c\uddee\ud83c\uddf3', name: 'India' },
  { code: 'AE', dialCode: '971', flag: '\ud83c\udde6\ud83c\uddea', name: 'United Arab Emirates' },
  { code: 'KR', dialCode: '82', flag: '\ud83c\uddf0\ud83c\uddf7', name: 'South Korea' },
  { code: 'MY', dialCode: '60', flag: '\ud83c\uddf2\ud83c\uddfe', name: 'Malaysia' },
  { code: 'TH', dialCode: '66', flag: '\ud83c\uddf9\ud83c\udded', name: 'Thailand' },
  { code: 'AU', dialCode: '61', flag: '\ud83c\udde6\ud83c\uddfa', name: 'Australia' },
  { code: 'NL', dialCode: '31', flag: '\ud83c\uddf3\ud83c\uddf1', name: 'Netherlands' },
  { code: 'IT', dialCode: '39', flag: '\ud83c\uddee\ud83c\uddf9', name: 'Italy' },
  { code: 'FR', dialCode: '33', flag: '\ud83c\uddeb\ud83c\uddf7', name: 'France' },
  { code: 'CA', dialCode: '1', flag: '\ud83c\udde8\ud83c\udde6', name: 'Canada' },
  { code: 'TW', dialCode: '886', flag: '\ud83c\uddf9\ud83c\uddfc', name: 'Taiwan' },
];

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function PhoneInput({ value, onChange, disabled }: PhoneInputProps) {
  const { isDarkMode } = useTheme();
  const [open, setOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(SUPPORTED_COUNTRIES[0]);
  const [isFocused, setIsFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Split the phone number into parts
  const phoneNumberWithoutCode = useMemo(() => {
    if (value.startsWith('+')) {
      const country = SUPPORTED_COUNTRIES.find(c => value.startsWith(`+${c.dialCode}`));
      if (country) {
        return value.slice(country.dialCode.length + 1);
      }
    }
    return value;
  }, [value]);

  // Filter countries based on search
  const filteredCountries = useMemo(() => {
    if (!searchQuery) return SUPPORTED_COUNTRIES;
    const query = searchQuery.toLowerCase();
    return SUPPORTED_COUNTRIES.filter(
      c => c.name.toLowerCase().includes(query) || c.dialCode.includes(query)
    );
  }, [searchQuery]);

  // Handle country selection
  const handleCountrySelect = (country: typeof SUPPORTED_COUNTRIES[0]) => {
    setSelectedCountry(country);
    setOpen(false);
    setSearchQuery('');
    onChange(`+${country.dialCode}${phoneNumberWithoutCode}`);
  };

  // Handle phone number input
  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.replace(/\D/g, '');
    onChange(`+${selectedCountry.dialCode}${input}`);
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      setOpen(false);
    };
  }, []);

  return (
    <div className="flex gap-2">
      {/* Country Code Selector */}
      <div className="relative">
        <motion.button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(!open)}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg border hover:border-[#276EF1] disabled:opacity-50 transition-colors min-w-[120px]",
            isDarkMode
              ? "border-zinc-700 bg-zinc-800/50 text-white"
              : "border-gray-300 bg-gray-50 text-gray-900"
          )}
        >
          <span className="text-xl">{selectedCountry.flag}</span>
          <span className="text-sm">+{selectedCountry.dialCode}</span>
          <ChevronDown className={cn(
            "w-4 h-4 ml-auto transition-transform",
            open && "rotate-180",
            isDarkMode ? "text-zinc-400" : "text-gray-500"
          )} />
        </motion.button>

        {/* Dropdown */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "absolute top-full left-0 mt-1 w-[280px] rounded-lg border shadow-lg z-50 overflow-hidden",
                isDarkMode
                  ? "bg-zinc-900 border-zinc-700"
                  : "bg-white border-gray-200"
              )}
            >
              {/* Search Input */}
              <div className={cn(
                "p-2 border-b",
                isDarkMode ? "border-zinc-700" : "border-gray-200"
              )}>
                <input
                  type="text"
                  placeholder="Search country..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 text-sm rounded-md outline-none",
                    isDarkMode
                      ? "bg-zinc-800 text-white placeholder-zinc-500"
                      : "bg-gray-100 text-gray-900 placeholder-gray-400"
                  )}
                  autoFocus
                />
              </div>

              {/* Country List */}
              <div className="max-h-[300px] overflow-y-auto">
                {filteredCountries.length === 0 ? (
                  <div className={cn(
                    "py-4 text-center text-sm",
                    isDarkMode ? "text-zinc-400" : "text-gray-500"
                  )}>
                    No country found
                  </div>
                ) : (
                  filteredCountries.map((country) => (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() => handleCountrySelect(country)}
                      className={cn(
                        "flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors",
                        isDarkMode
                          ? "hover:bg-zinc-800 text-white"
                          : "hover:bg-gray-100 text-gray-900",
                        country.code === selectedCountry.code && (
                          isDarkMode ? "bg-zinc-800" : "bg-gray-100"
                        )
                      )}
                    >
                      <span className="text-xl">{country.flag}</span>
                      <span className="flex-1 text-sm">{country.name}</span>
                      <span className={cn(
                        "text-sm",
                        isDarkMode ? "text-zinc-400" : "text-gray-500"
                      )}>
                        +{country.dialCode}
                      </span>
                      {country.code === selectedCountry.code && (
                        <Check className="w-4 h-4 text-[#276EF1]" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Click outside to close */}
        {open && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setOpen(false);
              setSearchQuery('');
            }}
          />
        )}
      </div>

      {/* Phone Number Input */}
      <div className="relative flex-1">
        <motion.input
          type="tel"
          placeholder="Phone number"
          value={phoneNumberWithoutCode}
          onChange={handlePhoneInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          className={cn(
            "w-full px-4 py-2 text-base rounded-lg border-2 outline-none transition-all focus:border-[#276EF1] disabled:opacity-50",
            isDarkMode
              ? "bg-zinc-800/50 text-white placeholder-zinc-500"
              : "bg-gray-50 text-gray-900 placeholder-gray-400"
          )}
          style={{
            borderColor: isFocused ? "#276EF1" : (isDarkMode ? "rgb(63, 63, 70)" : "rgb(209, 213, 219)"),
          }}
        />
        {isFocused && (
          <motion.div
            layoutId="phone-input-indicator"
            className="absolute -bottom-1 left-0 right-0 mx-auto h-0.5 w-2/3 rounded-full bg-[#276EF1]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </div>
    </div>
  );
}
