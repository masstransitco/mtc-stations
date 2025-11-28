"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { sendOtp, verifyOtpAndSync, clearOtpState } from "@/lib/firebase-auth";
import PhoneInput from "./PhoneInput";
import PinInput from "./PinInput";
import StepIndicator from "./StepIndicator";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

type AuthStep = "welcome" | "phone" | "verify";

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Sign In Modal Component
 *
 * Implements phone-based OTP authentication using Supabase Auth.
 * 3-step flow: Welcome -> Phone Entry -> OTP Verification
 * Uses React Portal to render outside of parent DOM hierarchy.
 */
export default function SignInModal({ isOpen, onClose, onSuccess }: SignInModalProps) {
  const { isDarkMode } = useTheme();
  const [step, setStep] = useState<AuthStep>("welcome");
  const [mounted, setMounted] = useState(false);

  // Ensure we're mounted before using portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const isSubmittingRef = useRef(false);

  // Reset modal state
  const handleClose = useCallback(() => {
    setStep("welcome");
    setPhoneNumber("");
    setVerificationCode("");
    setError(null);
    setLoading(false);
    setResendTimer(30);
    setCanResend(false);
    isSubmittingRef.current = false;
    clearOtpState();
    onClose();
  }, [onClose]);

  // Handle back button
  const handleBackToWelcome = useCallback(() => {
    setPhoneNumber("");
    setError(null);
    isSubmittingRef.current = false;
    setStep("welcome");
  }, []);

  // Countdown timer for resend
  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;
    if (!canResend && step === "verify") {
      timerId = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [canResend, step]);

  // Listen for auth state changes
  useEffect(() => {
    const supabase = getBrowserSupabaseClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: string, session: unknown) => {
        if (event === 'SIGNED_IN' && session) {
          onSuccess?.();
          handleClose();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [handleClose, onSuccess]);

  // Verify OTP code using Firebase, then sync Supabase session
  const verifyOtpCode = async (code: string) => {
    if (code.length !== 6 || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // Verify OTP with Firebase and sync to Supabase in one call
      const result = await verifyOtpAndSync(code);

      if (!result.success) {
        setError(result.error || "Failed to verify code. Please try again.");
        setVerificationCode("");
        return;
      }

      // Success - Firebase auth completed, Supabase synced
      if (result.firebaseUser) {
        onSuccess?.();
        handleClose();
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (verificationCode.length === 6 && step === "verify" && !loading && !isSubmittingRef.current) {
      verifyOtpCode(verificationCode);
    }
  }, [verificationCode, step, loading]);

  // Send OTP to phone using Firebase
  const handlePhoneSignIn = async () => {
    try {
      setLoading(true);
      setError(null);

      // Send OTP via Firebase Phone Auth
      const result = await sendOtp(phoneNumber, "recaptcha-container");

      if (!result.success) {
        let errorMessage = result.error || "We could not send the verification code. Please try again.";
        if (errorMessage.includes('invalid') || errorMessage.includes('Invalid')) {
          errorMessage = "Invalid phone number. Please enter a valid number.";
        } else if (errorMessage.includes('too-many-requests')) {
          errorMessage = "Too many attempts. Please try again later.";
        }
        setError(errorMessage);
        return;
      }

      setStep("verify");
      setResendTimer(30);
      setCanResend(false);
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle resend code
  const handleResendCode = () => {
    setVerificationCode("");
    setError(null);
    isSubmittingRef.current = false;
    setStep("phone");
  };

  // Step number for indicator
  const getStepNumber = () => {
    switch (step) {
      case "welcome": return 1;
      case "phone": return 2;
      case "verify": return 3;
      default: return 1;
    }
  };

  // Don't render anything if not mounted (SSR safety)
  if (!mounted) return null;

  // Render portal with AnimatePresence for proper enter/exit animations
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: "40px",
            pointerEvents: "auto",
            touchAction: "auto",
            zIndex: 99999,
            isolation: "isolate",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              backgroundColor: isDarkMode ? "rgba(0, 0, 0, 0.6)" : "rgba(0, 0, 0, 0.4)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Modal Container */}
          <motion.div
            style={{
              position: "relative",
              width: "91.666667%",
              maxWidth: "28rem",
              marginLeft: "auto",
              marginRight: "auto",
              borderRadius: "1rem",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              backgroundColor: isDarkMode ? "#18181b" : "#ffffff",
            }}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <AnimatePresence mode="wait" initial={false}>
          {/* WELCOME STEP */}
          {step === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Image with no padding - full width */}
              <div className="relative">
                <img
                  src="/auth/sign-in-1.png"
                  alt="Sign in illustration"
                  className="w-full h-auto"
                />

                {/* Close button - overlaid on image */}
                <motion.button
                  onClick={handleClose}
                  className={cn(
                    "absolute right-4 top-4 p-1 rounded-full z-[100] transition-colors",
                    "bg-black/20 backdrop-blur-sm",
                    "text-white hover:bg-black/40"
                  )}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="w-5 h-5" />
                </motion.button>

                {/* Step indicator - overlaid on image */}
                <div className="absolute top-6 left-0 right-0 px-6">
                  <StepIndicator currentStep={getStepNumber()} totalSteps={3} />
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="text-center space-y-2">
                  <h2 className={cn(
                    "text-2xl font-medium tracking-tight",
                    isDarkMode ? "text-white" : "text-gray-900"
                  )}>Sign In</h2>
                  <p className={cn(
                    "text-sm",
                    isDarkMode ? "text-zinc-400" : "text-gray-600"
                  )}>Access your account</p>
                </div>

                <div className={cn(
                  "mt-4 space-y-4 text-sm",
                  isDarkMode ? "text-zinc-400" : "text-gray-600"
                )}>
                  <p className="leading-relaxed">
                    Sign in to save your favorite car parks, track availability history, and get personalized recommendations.
                  </p>
                </div>

                <motion.button
                  onClick={() => setStep("phone")}
                  className="w-full py-3 mt-4 rounded-lg bg-[#276EF1] text-white font-medium transition-colors hover:bg-[#1E54B7]"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Continue
                </motion.button>

                <div className="mt-4 text-center">
                  <p className={cn(
                    "text-xs",
                    isDarkMode ? "text-zinc-500" : "text-gray-500"
                  )}>
                    By continuing, you agree to our{" "}
                    <span className="text-[#276EF1] hover:underline cursor-pointer">
                      Terms of Service
                    </span>{" "}
                    and{" "}
                    <span className="text-[#276EF1] hover:underline cursor-pointer">
                      Privacy Policy
                    </span>
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* PHONE STEP */}
          {step === "phone" && (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="p-6 space-y-4"
            >
              <div className="text-center space-y-2">
                <h2 className={cn(
                  "text-2xl font-medium tracking-tight",
                  isDarkMode ? "text-white" : "text-gray-900"
                )}>Enter your phone</h2>
                <p className={cn(
                  "text-sm",
                  isDarkMode ? "text-zinc-400" : "text-gray-600"
                )}>We'll send you a verification code</p>
              </div>

              <div className="mt-4 space-y-4">
                <PhoneInput value={phoneNumber} onChange={setPhoneNumber} disabled={loading} />

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "p-3 text-sm rounded-lg",
                      isDarkMode
                        ? "text-red-400 bg-red-900/30"
                        : "text-red-700 bg-red-100"
                    )}
                  >
                    {error}
                  </motion.div>
                )}
              </div>

              <div className="pt-4 space-y-3">
                <motion.button
                  onClick={handlePhoneSignIn}
                  disabled={loading || !phoneNumber || phoneNumber.length < 8}
                  className="w-full p-3 rounded-lg bg-[#276EF1] text-white font-medium transition-colors hover:bg-[#1E54B7] disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={(!loading && phoneNumber && phoneNumber.length >= 8) ? { scale: 1.02 } : {}}
                  whileTap={(!loading && phoneNumber && phoneNumber.length >= 8) ? { scale: 0.98 } : {}}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    "Send Code"
                  )}
                </motion.button>

                <motion.button
                  onClick={handleBackToWelcome}
                  disabled={loading}
                  className={cn(
                    "w-full p-3 text-sm disabled:opacity-50",
                    isDarkMode
                      ? "text-zinc-400 hover:text-white"
                      : "text-gray-600 hover:text-gray-900"
                  )}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  Back
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* VERIFY STEP */}
          {step === "verify" && (
            <motion.div
              key="verify"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="p-6 space-y-4"
            >
              <div className="text-center space-y-2">
                <h2 className={cn(
                  "text-2xl font-medium tracking-tight",
                  isDarkMode ? "text-white" : "text-gray-900"
                )}>Verification</h2>
                <p className={cn(
                  "text-sm",
                  isDarkMode ? "text-zinc-400" : "text-gray-600"
                )}>Enter the code sent to {phoneNumber}</p>
              </div>

              <div className="mt-6 space-y-6">
                <PinInput length={6} loading={loading} onChange={setVerificationCode} autoFocus={true} />

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "p-3 text-sm rounded-lg",
                      isDarkMode
                        ? "text-red-400 bg-red-900/30"
                        : "text-red-700 bg-red-100"
                    )}
                  >
                    {error}
                  </motion.div>
                )}

                <div className="text-center">
                  {!canResend && (
                    <p className={cn(
                      "text-sm",
                      isDarkMode ? "text-zinc-500" : "text-gray-500"
                    )}>
                      Resend code in <span className="text-[#276EF1]">{resendTimer}s</span>
                    </p>
                  )}
                  {canResend && (
                    <motion.button
                      onClick={handleResendCode}
                      className="text-sm font-medium text-[#276EF1] transition-colors hover:text-[#1E54B7]"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Resend Code
                    </motion.button>
                  )}
                </div>
              </div>

              <div className="pt-2 space-y-3">
                <motion.button
                  onClick={() => verifyOtpCode(verificationCode)}
                  disabled={loading || verificationCode.length !== 6}
                  className="w-full p-3 rounded-lg bg-[#276EF1] text-white font-medium transition-colors hover:bg-[#1E54B7] disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={(!loading && verificationCode.length === 6) ? { scale: 1.02 } : {}}
                  whileTap={(!loading && verificationCode.length === 6) ? { scale: 0.98 } : {}}
                >
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Verifying...</span>
                    </div>
                  ) : (
                    "Verify"
                  )}
                </motion.button>

                <motion.button
                  onClick={() => setStep("phone")}
                  disabled={loading}
                  className={cn(
                    "w-full p-3 text-sm disabled:opacity-50",
                    isDarkMode
                      ? "text-zinc-400 hover:text-white"
                      : "text-gray-600 hover:text-gray-900"
                  )}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  Change phone number
                </motion.button>
              </div>
            </motion.div>
          )}
            </AnimatePresence>
            {/* Hidden reCAPTCHA container for Firebase Phone Auth */}
            <div id="recaptcha-container" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
