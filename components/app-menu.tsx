"use client";

import React from "react";
import { motion } from "framer-motion";
import { X, Sun, Moon, LogOut, ChevronRight, User } from "lucide-react";
import Image from "next/image";
import { useTheme } from "@/components/theme-provider";
import { useAppDispatch, useAppSelector } from "@/store/store";
import {
  selectIsSignedIn,
  selectProfile,
  selectUser,
  selectUserLoading,
  openSignInModal,
  signOutUser,
} from "@/store/userSlice";

interface AppMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AppMenu({ isOpen, onClose }: AppMenuProps) {
  const dispatch = useAppDispatch();
  const { theme, setTheme, isDarkMode } = useTheme();

  const isSignedIn = useAppSelector(selectIsSignedIn);
  const profile = useAppSelector(selectProfile);
  const user = useAppSelector(selectUser);
  const loading = useAppSelector(selectUserLoading);

  const handleSignIn = () => {
    dispatch(openSignInModal());
    onClose();
  };

  const handleSignOut = async () => {
    await dispatch(signOutUser());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Menu Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        style={{
          position: 'relative',
          width: '320px',
          maxWidth: '85vw',
          height: '100%',
          backgroundColor: isDarkMode ? '#18181b' : '#ffffff',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header with close button */}
        <div style={{
          padding: '20px',
          paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))',
          borderBottom: isDarkMode ? '1px solid #27272a' : '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{
            fontSize: '16px',
            fontWeight: 600,
            color: isDarkMode ? '#f4f4f5' : '#18181b',
          }}>
            Settings
          </span>

          <button
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: isDarkMode ? '#27272a' : '#f4f4f5',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s',
            }}
          >
            <X size={20} color={isDarkMode ? '#a1a1aa' : '#71717a'} />
          </button>
        </div>

        {/* Main Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
        }}>
          {/* User Profile / Sign In */}
          <div style={{ marginBottom: '24px' }}>
            {!loading && (
              <>
                {isSignedIn ? (
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      // TODO: Open profile view
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px',
                      backgroundColor: isDarkMode ? '#27272a' : '#f4f4f5',
                      borderRadius: '12px',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      backgroundColor: isDarkMode ? '#3f3f46' : '#e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {profile?.avatar_url ? (
                        <Image
                          src={profile.avatar_url}
                          alt="Profile"
                          width={48}
                          height={48}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <User size={24} color={isDarkMode ? '#a1a1aa' : '#71717a'} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '15px',
                        fontWeight: 500,
                        color: isDarkMode ? '#f4f4f5' : '#18181b',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {profile?.display_name || user?.phone || user?.email || 'User'}
                      </div>
                      {(user?.phone || user?.email) && profile?.display_name && (
                        <div style={{
                          fontSize: '13px',
                          color: isDarkMode ? '#71717a' : '#a1a1aa',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {user?.phone || user?.email}
                        </div>
                      )}
                    </div>
                    <ChevronRight size={20} color={isDarkMode ? '#71717a' : '#a1a1aa'} />
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSignIn}
                    style={{
                      width: '100%',
                      padding: '14px 20px',
                      backgroundColor: '#3b82f6',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '15px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    Sign In
                  </motion.button>
                )}
              </>
            )}
          </div>

          {/* Settings Section */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: isDarkMode ? '#71717a' : '#a1a1aa',
              marginBottom: '12px',
              paddingLeft: '4px',
            }}>
              Settings
            </div>

            {/* Theme Setting */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px',
              backgroundColor: isDarkMode ? '#27272a' : '#f4f4f5',
              borderRadius: '12px',
            }}>
              <span style={{
                fontSize: '14px',
                fontWeight: 500,
                color: isDarkMode ? '#f4f4f5' : '#18181b',
              }}>
                Theme
              </span>

              <div style={{
                display: 'flex',
                gap: '4px',
                padding: '4px',
                backgroundColor: isDarkMode ? '#18181b' : '#ffffff',
                borderRadius: '8px',
                border: isDarkMode ? '1px solid #3f3f46' : '1px solid #e5e7eb',
              }}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setTheme('light')}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme === 'light' ? '#f59e0b' : 'transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  <Sun size={16} color={theme === 'light' ? '#ffffff' : (isDarkMode ? '#71717a' : '#a1a1aa')} />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setTheme('dark')}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme === 'dark' ? '#6366f1' : 'transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  <Moon size={16} color={theme === 'dark' ? '#ffffff' : (isDarkMode ? '#71717a' : '#a1a1aa')} />
                </motion.button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
          borderTop: isDarkMode ? '1px solid #27272a' : '1px solid #e5e7eb',
        }}>
          {isSignedIn && (
            <motion.button
              whileHover={{ x: 2 }}
              onClick={handleSignOut}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 4px',
                marginBottom: '16px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: isDarkMode ? '#f87171' : '#dc2626',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              <LogOut size={18} />
              <span>Sign Out</span>
            </motion.button>
          )}

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{
              display: 'flex',
              gap: '16px',
            }}>
              <a
                href="/privacy"
                style={{
                  fontSize: '13px',
                  color: isDarkMode ? '#71717a' : '#a1a1aa',
                  textDecoration: 'none',
                }}
              >
                Privacy
              </a>
              <a
                href="/terms"
                style={{
                  fontSize: '13px',
                  color: isDarkMode ? '#71717a' : '#a1a1aa',
                  textDecoration: 'none',
                }}
              >
                Terms
              </a>
            </div>
            <span style={{
              fontSize: '13px',
              color: isDarkMode ? '#52525b' : '#d4d4d8',
            }}>
              v1.0.0
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default AppMenu;
