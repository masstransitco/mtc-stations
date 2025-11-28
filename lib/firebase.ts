/**
 * Firebase Client SDK Configuration
 * Used for phone authentication via Firebase + Supabase Third Party Auth
 */

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (singleton pattern)
let app: FirebaseApp;
let auth: Auth;

function initializeFirebase() {
  // Fail fast if config is incomplete to avoid "invalid-app-credential" later.
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

  // Optional: allow local dev without reCAPTCHA when explicitly enabled.
  if (process.env.NEXT_PUBLIC_FIREBASE_DISABLE_APP_VERIFICATION === "true") {
    auth.settings.appVerificationDisabledForTesting = true;
  }

  return { app, auth };
}

// Get Firebase Auth instance
export function getFirebaseAuth(): Auth {
  if (!auth) {
    initializeFirebase();
  }
  return auth;
}

// Store the confirmation result for OTP verification
let confirmationResult: ConfirmationResult | null = null;
let recaptchaVerifier: RecaptchaVerifier | null = null;

/**
 * Send OTP to phone number using Firebase Phone Auth
 * @param phoneNumber - Phone number in E.164 format (e.g., +85298765432)
 * @param recaptchaContainerId - ID of the element to render reCAPTCHA (invisible)
 */
export async function sendFirebaseOtp(
  phoneNumber: string,
  recaptchaContainerId: string = "recaptcha-container"
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = getFirebaseAuth();

    // Clear existing verifier if present
    if (recaptchaVerifier) {
      recaptchaVerifier.clear();
      recaptchaVerifier = null;
    }

    // Create invisible reCAPTCHA verifier
    recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
      size: "invisible",
      // No site key passed here: Firebase will use the managed reCAPTCHA (non-Enterprise).
    });

    // Send OTP
    confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);

    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to send OTP";
    console.error("[Firebase] Error sending OTP:", errorMessage);
    // Clear verifier on error
    if (recaptchaVerifier) {
      recaptchaVerifier.clear();
      recaptchaVerifier = null;
    }
    return { success: false, error: errorMessage };
  }
}

/**
 * Verify OTP code and get Firebase ID token
 * @param code - 6-digit OTP code
 * @returns Firebase ID token on success
 */
export async function verifyFirebaseOtp(
  code: string
): Promise<{ success: boolean; idToken?: string; error?: string }> {
  try {
    if (!confirmationResult) {
      return { success: false, error: "No OTP request found. Please request a new code." };
    }

    // Verify the code
    const userCredential = await confirmationResult.confirm(code);

    // Get the Firebase ID token
    const idToken = await userCredential.user.getIdToken();

    return { success: true, idToken };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to verify OTP";
    console.error("[Firebase] Error verifying OTP:", errorMessage);

    // Handle specific error codes
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
 * Clear the stored confirmation result and reCAPTCHA verifier (for cleanup)
 */
export function clearFirebaseOtpState() {
  confirmationResult = null;
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
}

/**
 * Get current Firebase user's ID token (for existing sessions)
 */
export async function getCurrentFirebaseIdToken(): Promise<string | null> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

/**
 * Sign out from Firebase
 */
export async function signOutFirebase(): Promise<void> {
  const auth = getFirebaseAuth();
  await auth.signOut();
  clearFirebaseOtpState();
}
