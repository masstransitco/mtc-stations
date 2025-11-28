"use client";

import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { User, Session } from "@supabase/supabase-js";
import { UserProfile, getBrowserSupabaseClient } from "@/lib/supabase";
import type { RootState } from "./store";

// =============================================================================
// Types
// =============================================================================

interface AuthUser {
  id: string;
  phone?: string;
  email?: string;
  created_at?: string;
}

interface UserState {
  // Auth state
  user: AuthUser | null;
  profile: UserProfile | null;
  session: Session | null;
  isSignedIn: boolean;
  isAdmin: boolean;

  // Loading states
  loading: boolean;
  profileLoading: boolean;

  // Error state
  error: string | null;

  // UI state
  showSignInModal: boolean;
}

const initialState: UserState = {
  user: null,
  profile: null,
  session: null,
  isSignedIn: false,
  isAdmin: false,
  loading: true,
  profileLoading: false,
  error: null,
  showSignInModal: false,
};

// =============================================================================
// Async Thunks
// =============================================================================

/**
 * Fetch user profile from Supabase
 */
export const fetchUserProfile = createAsyncThunk<
  UserProfile | null,
  string,
  { rejectValue: string }
>(
  "user/fetchUserProfile",
  async (userId, { rejectWithValue }) => {
    try {
      const supabase = getBrowserSupabaseClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.error("[userSlice] Error fetching profile:", error);
        return rejectWithValue(error.message);
      }

      return data as UserProfile;
    } catch (err) {
      console.error("[userSlice] Exception fetching profile:", err);
      return rejectWithValue("Failed to fetch profile");
    }
  }
);

/**
 * Update user profile
 */
export const updateUserProfile = createAsyncThunk<
  UserProfile,
  Partial<UserProfile>,
  { state: RootState; rejectValue: string }
>(
  "user/updateUserProfile",
  async (updates, { getState, rejectWithValue }) => {
    const state = getState();
    const userId = state.user.user?.id;

    if (!userId) {
      return rejectWithValue("Not authenticated");
    }

    try {
      const supabase = getBrowserSupabaseClient();
      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) {
        console.error("[userSlice] Error updating profile:", error);
        return rejectWithValue(error.message);
      }

      return data as UserProfile;
    } catch (err) {
      console.error("[userSlice] Exception updating profile:", err);
      return rejectWithValue("Failed to update profile");
    }
  }
);

/**
 * Sign out user (Firebase)
 */
export const signOutUser = createAsyncThunk<
  void,
  void,
  { rejectValue: string }
>(
  "user/signOut",
  async (_, { rejectWithValue }) => {
    try {
      // Dynamic import to avoid circular dependencies
      const { signOut } = await import("@/lib/firebase-auth");
      await signOut();
    } catch (err) {
      console.error("[userSlice] Exception signing out:", err);
      return rejectWithValue("Failed to sign out");
    }
  }
);

// =============================================================================
// Slice
// =============================================================================

export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    // Set auth user from Supabase auth state change
    setAuthUser: (state, action: PayloadAction<User | null>) => {
      if (action.payload) {
        state.user = {
          id: action.payload.id,
          phone: action.payload.phone ?? undefined,
          email: action.payload.email ?? undefined,
          created_at: action.payload.created_at,
        };
        state.isSignedIn = true;
      } else {
        state.user = null;
        state.profile = null;
        state.isSignedIn = false;
        state.isAdmin = false;
      }
      state.loading = false;
    },

    // Set session
    setSession: (state, action: PayloadAction<Session | null>) => {
      state.session = action.payload;
    },

    // Set profile directly
    setProfile: (state, action: PayloadAction<UserProfile | null>) => {
      state.profile = action.payload;
      state.isAdmin = action.payload?.is_admin ?? false;
    },

    // Set loading state
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    // Set error
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    // Clear error
    clearError: (state) => {
      state.error = null;
    },

    // Toggle sign in modal
    openSignInModal: (state) => {
      state.showSignInModal = true;
    },

    closeSignInModal: (state) => {
      state.showSignInModal = false;
    },

    toggleSignInModal: (state) => {
      state.showSignInModal = !state.showSignInModal;
    },

    // Reset user state (for sign out)
    resetUserState: (state) => {
      state.user = null;
      state.profile = null;
      state.session = null;
      state.isSignedIn = false;
      state.isAdmin = false;
      state.loading = false;
      state.profileLoading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch profile
    builder
      .addCase(fetchUserProfile.pending, (state) => {
        state.profileLoading = true;
        state.error = null;
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.profile = action.payload;
        state.isAdmin = action.payload?.is_admin ?? false;
        state.profileLoading = false;
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.profileLoading = false;
        state.error = action.payload ?? "Failed to fetch profile";
      });

    // Update profile
    builder
      .addCase(updateUserProfile.pending, (state) => {
        state.profileLoading = true;
        state.error = null;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.profile = action.payload;
        state.isAdmin = action.payload.is_admin;
        state.profileLoading = false;
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.profileLoading = false;
        state.error = action.payload ?? "Failed to update profile";
      });

    // Sign out
    builder
      .addCase(signOutUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(signOutUser.fulfilled, (state) => {
        state.user = null;
        state.profile = null;
        state.session = null;
        state.isSignedIn = false;
        state.isAdmin = false;
        state.loading = false;
        state.error = null;
      })
      .addCase(signOutUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to sign out";
      });
  },
});

// =============================================================================
// Actions
// =============================================================================

export const {
  setAuthUser,
  setSession,
  setProfile,
  setLoading,
  setError,
  clearError,
  openSignInModal,
  closeSignInModal,
  toggleSignInModal,
  resetUserState,
} = userSlice.actions;

// =============================================================================
// Selectors
// =============================================================================

export const selectUser = (state: RootState) => state.user.user;
export const selectProfile = (state: RootState) => state.user.profile;
export const selectSession = (state: RootState) => state.user.session;
export const selectIsSignedIn = (state: RootState) => state.user.isSignedIn;
export const selectIsAdmin = (state: RootState) => state.user.isAdmin;
export const selectUserLoading = (state: RootState) => state.user.loading;
export const selectProfileLoading = (state: RootState) => state.user.profileLoading;
export const selectUserError = (state: RootState) => state.user.error;
export const selectShowSignInModal = (state: RootState) => state.user.showSignInModal;

// Convenience selectors
export const selectUserId = (state: RootState) => state.user.user?.id;
export const selectUserPhone = (state: RootState) => state.user.user?.phone ?? state.user.profile?.phone;
export const selectUserEmail = (state: RootState) => state.user.user?.email ?? state.user.profile?.email;
export const selectDisplayName = (state: RootState) => state.user.profile?.display_name;
export const selectUserRoles = (state: RootState) => state.user.profile?.roles ?? [];

export default userSlice.reducer;
