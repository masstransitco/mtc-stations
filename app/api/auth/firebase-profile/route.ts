import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

/**
 * GET /api/auth/firebase-profile?uid=xxx
 * Get Firebase user's profile from Supabase
 */
export async function GET(request: NextRequest) {
  try {
    // Get Firebase ID token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing authorization token" },
        { status: 401 }
      );
    }

    const uid = request.nextUrl.searchParams.get("uid");
    if (!uid) {
      return NextResponse.json(
        { error: "Missing uid parameter" },
        { status: 400 }
      );
    }

    // Use service role to bypass RLS
    const supabase = getServerSupabaseClient("service");

    const { data: profile, error } = await supabase
      .from("firebase_profiles")
      .select("*")
      .eq("firebase_uid", uid)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No profile found - not an error, just return null
        return NextResponse.json({ profile: null });
      }
      console.error("[firebase-profile] Query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[firebase-profile] Exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
