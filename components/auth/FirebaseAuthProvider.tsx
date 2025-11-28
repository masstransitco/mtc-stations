"use client";

/**
 * Firebase-first Auth Provider
 *
 * Based on mtc-app pattern - Firebase handles authentication.
 * Profile data is managed via API routes (service role).
 *
 * This provider:
 * 1. Listens to Firebase auth state changes
 * 2. Updates Redux state with Firebase user
 * 3. Fetches profile from Supabase via API
 */

import React, { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/store";
import {
  setAuthUser,
  setProfile,
  setLoading,
  selectShowSignInModal,
  closeSignInModal,
} from "@/store/userSlice";
import {
  onAuthStateChanged,
  AuthUser,
  getCurrentIdToken,
} from "@/lib/firebase-auth";
import SignInModal from "./SignInModal";

interface FirebaseAuthProviderProps {
  children: React.ReactNode;
}

/**
 * Fetch Firebase profile from API
 */
async function fetchFirebaseProfile(uid: string) {
  try {
    const idToken = await getCurrentIdToken();
    if (!idToken) return null;

    const response = await fetch(`/api/auth/firebase-profile?uid=${uid}`, {
      headers: { "Authorization": `Bearer ${idToken}` },
    });

    if (response.ok) {
      const data = await response.json();
      return data.profile;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * FirebaseAuthProvider Component
 *
 * Manages Firebase auth state and syncs it with Redux.
 * Should be placed inside ReduxProvider in the component tree.
 */
export function FirebaseAuthProvider({ children }: FirebaseAuthProviderProps) {
  const dispatch = useAppDispatch();
  const showSignInModal = useAppSelector(selectShowSignInModal);

  useEffect(() => {
    // Subscribe to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(async (firebaseUser: AuthUser | null, isLoading: boolean) => {
      console.log("[FirebaseAuthProvider] Auth state changed:", firebaseUser?.uid ?? "signed out");

      if (firebaseUser) {
        // Convert Firebase user to our auth user format
        dispatch(setAuthUser({
          id: firebaseUser.uid,
          phone: firebaseUser.phoneNumber ?? undefined,
          email: firebaseUser.email ?? undefined,
          created_at: firebaseUser.metadata.creationTime,
        } as any));

        // Fetch profile from Supabase via API
        const profile = await fetchFirebaseProfile(firebaseUser.uid);
        if (profile) {
          dispatch(setProfile(profile));
        }
      } else {
        // Signed out
        dispatch(setAuthUser(null));
        dispatch(setProfile(null));
      }

      dispatch(setLoading(false));
    });

    return () => unsubscribe();
  }, [dispatch]);

  // Handle sign in modal close
  const handleSignInModalClose = () => {
    dispatch(closeSignInModal());
  };

  return (
    <>
      {children}
      <SignInModal isOpen={showSignInModal} onClose={handleSignInModalClose} />
    </>
  );
}

export default FirebaseAuthProvider;
