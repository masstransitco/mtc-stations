"use client";

import { useState, useEffect, useCallback } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { getBrowserSupabaseClient, UserProfile } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  error: Error | null;
}

interface UseAuthReturn extends AuthState {
  isSignedIn: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

/**
 * Custom hook for Supabase authentication
 * Provides user, session, and profile state with real-time updates
 */
export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
    error: null,
  });

  // Fetch user profile from database
  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const supabase = getBrowserSupabaseClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('[useAuth] Error fetching profile:', error);
        return null;
      }

      return data as UserProfile;
    } catch (err) {
      console.error('[useAuth] Exception fetching profile:', err);
      return null;
    }
  }, []);

  // Refresh profile data
  const refreshProfile = useCallback(async () => {
    if (!state.user) return;

    const profile = await fetchProfile(state.user.id);
    setState(prev => ({ ...prev, profile }));
  }, [state.user, fetchProfile]);

  // Sign out handler
  const signOut = useCallback(async () => {
    try {
      const supabase = getBrowserSupabaseClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      setState({
        user: null,
        session: null,
        profile: null,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error('[useAuth] Sign out error:', err);
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err : new Error('Sign out failed'),
      }));
    }
  }, []);

  // Initialize auth state and subscribe to changes
  useEffect(() => {
    const supabase = getBrowserSupabaseClient();

    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('[useAuth] Error getting session:', error);
          setState({
            user: null,
            session: null,
            profile: null,
            loading: false,
            error,
          });
          return;
        }

        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          setState({
            user: session.user,
            session,
            profile,
            loading: false,
            error: null,
          });
        } else {
          setState({
            user: null,
            session: null,
            profile: null,
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        console.error('[useAuth] Exception during initialization:', err);
        setState({
          user: null,
          session: null,
          profile: null,
          loading: false,
          error: err instanceof Error ? err : new Error('Auth initialization failed'),
        });
      }
    };

    initializeAuth();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        console.log('[useAuth] Auth state changed:', event);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            const profile = await fetchProfile(session.user.id);
            setState({
              user: session.user,
              session,
              profile,
              loading: false,
              error: null,
            });
          }
        } else if (event === 'SIGNED_OUT') {
          setState({
            user: null,
            session: null,
            profile: null,
            loading: false,
            error: null,
          });
        } else if (event === 'USER_UPDATED') {
          if (session?.user) {
            const profile = await fetchProfile(session.user.id);
            setState(prev => ({
              ...prev,
              user: session.user,
              session,
              profile,
            }));
          }
        }
      }
    );

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  return {
    ...state,
    isSignedIn: !!state.user,
    isAdmin: state.profile?.is_admin ?? false,
    signOut,
    refreshProfile,
  };
}

/**
 * Hook for checking if user is authenticated
 * Lightweight version that only checks session existence
 */
export function useIsAuthenticated(): { isAuthenticated: boolean; loading: boolean } {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, session: unknown) => {
        setIsAuthenticated(!!session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { isAuthenticated, loading };
}

export default useAuth;
