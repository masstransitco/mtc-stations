/**
 * Firebase Auth with Supabase Data Access
 *
 * This module implements Firebase-first authentication where:
 * 1. Firebase handles phone OTP authentication (primary auth)
 * 2. Firebase ID token is passed to Supabase client for database access
 * 3. Profile data stored in Supabase (managed via API routes with service role)
 *
 * Note: This does NOT use Supabase Auth sessions. Instead, we use
 * the Firebase ID token directly with Supabase's accessToken option.
 */

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getAuth,
  Auth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  onIdTokenChanged,
  User as FirebaseUser,
} from "firebase/auth";

// =============================================================================
// Firebase Configuration
// =============================================================================

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Singleton instances
let app: FirebaseApp;
let auth: Auth;

function initializeFirebase() {
  // Validate config
  const missingKeys = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length) {
    throw new Error(`Missing Firebase env vars: ${missingKeys.join(", ")}`);
  }

  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }

  auth = getAuth(app);

  // Allow local dev without reCAPTCHA when explicitly enabled
  if (process.env.NEXT_PUBLIC_FIREBASE_DISABLE_APP_VERIFICATION === "true") {
    auth.settings.appVerificationDisabledForTesting = true;
  }

  return { app, auth };
}

/**
 * Get Firebase Auth instance (singleton)
 */
export function getFirebaseAuth(): Auth {
  if (!auth) {
    initializeFirebase();
  }
  return auth;
}

// =============================================================================
// Phone OTP Authentication
// =============================================================================

let confirmationResult: ConfirmationResult | null = null;
let recaptchaVerifier: RecaptchaVerifier | null = null;

/**
 * Send OTP to phone number using Firebase Phone Auth
 * @param phoneNumber - Phone number in E.164 format (e.g., +85298765432)
 * @param recaptchaContainerId - ID of the element to render reCAPTCHA
 */
export async function sendOtp(
  phoneNumber: string,
  recaptchaContainerId: string = "recaptcha-container"
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = getFirebaseAuth();

    // Clear existing verifier
    if (recaptchaVerifier) {
      recaptchaVerifier.clear();
      recaptchaVerifier = null;
    }

    // Create invisible reCAPTCHA verifier
    recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
      size: "invisible",
    });

    // Send OTP
    confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);

    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to send OTP";
    console.error("[Firebase] Error sending OTP:", errorMessage);

    if (recaptchaVerifier) {
      recaptchaVerifier.clear();
      recaptchaVerifier = null;
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Verify OTP and complete Firebase sign-in
 * @param code - 6-digit OTP code
 * @returns Firebase user on success
 */
export async function verifyOtpAndSync(
  code: string
): Promise<{
  success: boolean;
  firebaseUser?: FirebaseUser;
  error?: string;
}> {
  try {
    if (!confirmationResult) {
      return { success: false, error: "No OTP request found. Please request a new code." };
    }

    // Verify OTP with Firebase
    const userCredential = await confirmationResult.confirm(code);
    const firebaseUser = userCredential.user;

    // Sync profile to Supabase via API (uses service role, doesn't need Supabase auth)
    try {
      await syncUserProfile(firebaseUser);
    } catch (profileError) {
      console.warn("[Auth] Profile sync failed (non-blocking):", profileError);
    }

    return {
      success: true,
      firebaseUser,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to verify OTP";
    console.error("[Auth] OTP verification error:", errorMessage);

    if (errorMessage.includes("invalid-verification-code")) {
      return { success: false, error: "Invalid code. Please check and try again." };
    }
    if (errorMessage.includes("code-expired")) {
      return { success: false, error: "Code expired. Please request a new one." };
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Sync Firebase user to Supabase profile via API route
 * This uses service role on the server side
 */
async function syncUserProfile(firebaseUser: FirebaseUser): Promise<void> {
  const idToken = await firebaseUser.getIdToken();

  const response = await fetch("/api/auth/sync-profile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      uid: firebaseUser.uid,
      phone: firebaseUser.phoneNumber,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
    }),
  });

  if (!response.ok) {
    throw new Error(`Profile sync failed: ${response.status}`);
  }
}

/**
 * Clear OTP state (for cleanup/reset)
 */
export function clearOtpState() {
  confirmationResult = null;
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
}

// =============================================================================
// Sign Out
// =============================================================================

/**
 * Sign out from Firebase
 */
export async function signOut(): Promise<void> {
  const auth = getFirebaseAuth();
  await auth.signOut();
  clearOtpState();
}

/**
 * Get current Firebase user's ID token (for API calls)
 */
export async function getCurrentIdToken(): Promise<string | null> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

// =============================================================================
// Auth State Observer
// =============================================================================

export interface AuthUser extends FirebaseUser {
  isAdmin?: boolean;
  role?: string;
}

/**
 * Subscribe to Firebase auth state changes
 */
export function onAuthStateChanged(
  callback: (user: AuthUser | null, loading: boolean) => void
): () => void {
  const auth = getFirebaseAuth();

  return onIdTokenChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      // Get token with claims
      const token = await firebaseUser.getIdTokenResult();
      const authUser: AuthUser = Object.assign(firebaseUser, {
        role: (token.claims.role as string) || "user",
        isAdmin: token.claims.role === "admin",
      });

      callback(authUser, false);
    } else {
      callback(null, false);
    }
  });
}

// =============================================================================
// Re-exports from old firebase.ts for backwards compatibility
// =============================================================================

export {
  sendOtp as sendFirebaseOtp,
  verifyOtpAndSync as verifyFirebaseOtp,
  clearOtpState as clearFirebaseOtpState,
  getCurrentIdToken as getCurrentFirebaseIdToken,
  signOut as signOutFirebase,
};
