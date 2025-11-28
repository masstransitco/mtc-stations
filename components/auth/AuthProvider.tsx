"use client";

import React, { useEffect } from "react";
import { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { useAppDispatch, useAppSelector } from "@/store/store";
import {
  setAuthUser,
  setSession,
  setProfile,
  setLoading,
  fetchUserProfile,
  selectShowSignInModal,
  closeSignInModal,
} from "@/store/userSlice";
import SignInModal from "./SignInModal";

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * AuthProvider Component
 *
 * Manages Supabase auth state and syncs it with Redux.
 * Should be placed inside ReduxProvider in the component tree.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const dispatch = useAppDispatch();
  const showSignInModal = useAppSelector(selectShowSignInModal);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();

    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("[AuthProvider] Error getting session:", error);
          dispatch(setLoading(false));
          return;
        }

        if (session?.user) {
          dispatch(setAuthUser(session.user));
          dispatch(setSession(session));
          // Fetch full profile
          dispatch(fetchUserProfile(session.user.id));
        } else {
          dispatch(setLoading(false));
        }
      } catch (err) {
        console.error("[AuthProvider] Exception during initialization:", err);
        dispatch(setLoading(false));
      }
    };

    initializeAuth();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        console.log("[AuthProvider] Auth state changed:", event);

        switch (event) {
          case "SIGNED_IN":
          case "TOKEN_REFRESHED":
            if (session?.user) {
              dispatch(setAuthUser(session.user));
              dispatch(setSession(session));
              dispatch(fetchUserProfile(session.user.id));
            }
            break;

          case "SIGNED_OUT":
            dispatch(setAuthUser(null));
            dispatch(setSession(null));
            dispatch(setProfile(null));
            break;

          case "USER_UPDATED":
            if (session?.user) {
              dispatch(setAuthUser(session.user));
              dispatch(fetchUserProfile(session.user.id));
            }
            break;

          default:
            break;
        }
      }
    );

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [dispatch]);

  // Handle sign in modal close
  const handleSignInModalClose = () => {
    dispatch(closeSignInModal());
  };

  return (
    <>
      {children}
      <SignInModal
        isOpen={showSignInModal}
        onClose={handleSignInModalClose}
      />
    </>
  );
}

export default AuthProvider;
