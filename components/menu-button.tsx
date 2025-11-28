"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useAppSelector } from "@/store/store";
import { selectIsSignedIn, selectProfile } from "@/store/userSlice";

interface MenuButtonProps {
  onToggleMenu: () => void;
  isDarkMode: boolean;
}

export function MenuButton({ onToggleMenu, isDarkMode }: MenuButtonProps) {
  const isSignedIn = useAppSelector(selectIsSignedIn);
  const profile = useAppSelector(selectProfile);

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.05 }}
      onClick={onToggleMenu}
      style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        zIndex: 10,
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
        overflow: 'hidden',
        padding: 0,
      }}
      title="Open menu"
    >
      {isSignedIn && profile?.avatar_url ? (
        <Image
          src={profile.avatar_url}
          alt="Profile"
          width={48}
          height={48}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          priority
        />
      ) : (
        <Image
          src="/logos/bolt.svg"
          alt="Menu"
          width={28}
          height={28}
          style={{
            filter: isDarkMode ? 'brightness(0) invert(1)' : 'none'
          }}
        />
      )}
    </motion.button>
  );
}

export default MenuButton;
