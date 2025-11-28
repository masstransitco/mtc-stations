"use client";

/**
 * Firebase-first Authentication Hook
 *
 * Based on mtc-app's useAuth pattern - Firebase handles auth,
 * profile data fetched from Supabase via API.
 */

import { useState, useEffect, useCallback } from "react";
import {
  AuthUser,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  getCurrentIdToken,
} from "@/lib/firebase-auth";

// Firebase profile type (stored in Supabase)
export interface FirebaseProfile {
  id: string;
  firebase_uid: string;
  phone: string | null;
  display_name: string | null;
  email: string | null;
  roles: string[];
  is_admin: boolean;
  is_active: boolean;
  avatar_url: string | null;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
}

interface UseFirebaseAuthReturn {
  // Firebase user
  user: AuthUser | null;
  loading: boolean;

  // Role info from Firebase claims
  isAdmin: boolean;
  role: string | null;

  // Profile (fetched from Supabase via API)
  profile: FirebaseProfile | null;
  profileLoading: boolean;

  // Computed
  isSignedIn: boolean;

  // Actions
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

/**
 * Firebase-first auth hook
 *
 * Usage:
 * ```tsx
 * const { user, isSignedIn, profile, signOut } = useFirebaseAuth();
 * ```
 */
export function useFirebaseAuth(): UseFirebaseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<FirebaseProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Fetch profile via API (uses Firebase token for auth)
  const fetchProfile = useCallback(async (firebaseUid: string) => {
    setProfileLoading(true);
    try {
      const idToken = await getCurrentIdToken();
      if (!idToken) {
        setProfile(null);
        return;
      }

      const response = await fetch(`/api/auth/firebase-profile?uid=${firebaseUid}`, {
        headers: {
          "Authorization": `Bearer ${idToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
      } else {
        console.error("[useFirebaseAuth] Profile fetch failed:", response.status);
        setProfile(null);
      }
    } catch (err) {
      console.error("[useFirebaseAuth] Profile fetch exception:", err);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // Subscribe to Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async (authUser, isLoading) => {
      setUser(authUser);
      setLoading(isLoading);

      if (authUser) {
        await fetchProfile(authUser.uid);
      } else {
        setProfile(null);
      }
    });

    return () => unsubscribe();
  }, [fetchProfile]);

  // Sign out from Firebase
  const signOut = useCallback(async () => {
    await firebaseSignOut();
    setUser(null);
    setProfile(null);
  }, []);

  // Manually refresh profile
  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.uid);
    }
  }, [user, fetchProfile]);

  return {
    user,
    loading,
    isAdmin: user?.isAdmin ?? profile?.is_admin ?? false,
    role: user?.role ?? null,
    profile,
    profileLoading,
    isSignedIn: !!user,
    signOut,
    refreshProfile,
  };
}

export default useFirebaseAuth;
