import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

/**
 * POST /api/auth/sync-profile
 * Syncs Firebase user to Supabase profiles table
 * Called after successful Firebase auth
 */
export async function POST(request: NextRequest) {
  try {
    // Get Firebase ID token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing authorization token" },
        { status: 401 }
      );
    }

    const idToken = authHeader.slice(7);

    // Verify Firebase token (basic validation - in production use firebase-admin)
    // For now, we trust the token since it came from our frontend
    // TODO: Add proper Firebase Admin SDK verification

    const body = await request.json();
    const { uid, phone, email, displayName } = body;

    if (!uid) {
      return NextResponse.json(
        { error: "Missing uid" },
        { status: 400 }
      );
    }

    // Use service role to bypass RLS
    const supabase = getServerSupabaseClient("service");

    // Upsert profile - create if not exists, update if exists
    const { data: profile, error } = await supabase
      .from("firebase_profiles")
      .upsert(
        {
          firebase_uid: uid,
          phone: phone || null,
          email: email || null,
          display_name: displayName || null,
          last_sign_in_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "firebase_uid",
        }
      )
      .select()
      .single();

    if (error) {
      console.error("[sync-profile] Upsert error:", error);
      return NextResponse.json(
        { error: "Failed to sync profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[sync-profile] Exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
