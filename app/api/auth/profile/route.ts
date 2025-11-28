import { NextRequest, NextResponse } from "next/server";
import { getAuthSupabaseClient, getServerSupabaseClient } from "@/lib/supabase";

/**
 * GET /api/auth/profile
 * Get current user's profile
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getAuthSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      console.error("[GET /api/auth/profile] Error fetching profile:", profileError);
      return NextResponse.json(
        { error: "Failed to fetch profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[GET /api/auth/profile] Exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/auth/profile
 * Update current user's profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await getAuthSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Only allow certain fields to be updated by the user
    const allowedFields = ["display_name", "avatar_url", "preferences"];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data: profile, error: updateError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("[PATCH /api/auth/profile] Error updating profile:", updateError);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[PATCH /api/auth/profile] Exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/profile/admin
 * Admin endpoint to update any user's profile (requires admin role)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getAuthSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("user_id", user.id)
      .single();

    if (!adminProfile?.is_admin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { targetUserId, updates } = body;

    if (!targetUserId || !updates) {
      return NextResponse.json(
        { error: "Missing targetUserId or updates" },
        { status: 400 }
      );
    }

    // Use service role for admin operations
    const serviceSupabase = getServerSupabaseClient("service");
    const { data: profile, error: updateError } = await serviceSupabase
      .from("profiles")
      .update(updates)
      .eq("user_id", targetUserId)
      .select()
      .single();

    if (updateError) {
      console.error("[POST /api/auth/profile] Admin update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[POST /api/auth/profile] Exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
