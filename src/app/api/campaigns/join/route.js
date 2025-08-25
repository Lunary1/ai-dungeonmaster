import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Authentication helper function
async function getAuthenticatedUser(request) {
  try {
    const authorization = request.headers.get("authorization");

    if (authorization?.startsWith("Bearer ")) {
      const token = authorization.substring(7);

      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      const {
        data: { user },
        error,
      } = await client.auth.getUser(token);

      if (error || !user) {
        return { user: null, error, client: null };
      }

      return { user, error: null, client };
    }

    return {
      user: null,
      error: new Error("No authorization header"),
      client: null,
    };
  } catch (error) {
    console.error("Auth helper error:", error);
    return { user: null, error, client: null };
  }
}

export async function POST(request) {
  try {
    const { inviteCode } = await request.json();
    const {
      user,
      error: authError,
      client,
    } = await getAuthenticatedUser(request);

    // Get the authenticated user
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate input
    if (!inviteCode || inviteCode.trim().length === 0) {
      return NextResponse.json(
        { error: "Invite code is required" },
        { status: 400 }
      );
    }

    // Find campaign by invite code
    const { data: campaign, error: campaignError } = await client
      .from("campaigns")
      .select("*")
      .eq("invite_code", inviteCode.trim())
      .single();

    if (campaignError || !campaign) {
      console.error("Campaign lookup error:", campaignError);
      return NextResponse.json(
        { error: "Invalid invite code or campaign not found" },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const { data: existingMember, error: memberCheckError } = await client
      .from("campaign_players")
      .select("*")
      .eq("campaign_id", campaign.id)
      .eq("user_id", user.id)
      .single();

    if (memberCheckError && memberCheckError.code !== "PGRST116") {
      console.error("Member check error:", memberCheckError);
      return NextResponse.json(
        { error: `Database error: ${memberCheckError.message}` },
        { status: 500 }
      );
    }

    if (existingMember) {
      return NextResponse.json(
        { error: "You are already a member of this campaign" },
        { status: 400 }
      );
    }

    // Ensure user has a profile record (campaign_players.user_id references user_profiles.id)
    const { data: userProfile, error: profileError } = await client
      .from("user_profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile) {
      // Create user profile if it doesn't exist
      const { data: newProfile, error: createProfileError } = await client
        .from("user_profiles")
        .insert({
          id: user.id,
          display_name: user.email?.split("@")[0] || "Player",
          email: user.email,
        })
        .select()
        .single();

      if (createProfileError) {
        console.error("Profile creation error:", createProfileError);
        return NextResponse.json(
          { error: "Failed to create user profile" },
          { status: 500 }
        );
      }
    }

    // Add user as player
    const { data: membership, error: joinError } = await client
      .from("campaign_players")
      .insert({
        campaign_id: campaign.id,
        user_id: user.id, // This should now reference user_profiles.id
      })
      .select()
      .single();

    if (joinError) {
      console.error("Join campaign error:", joinError);
      return NextResponse.json(
        { error: `Database error: ${joinError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      campaignId: campaign.id,
      campaign,
      membership,
      message: "Successfully joined campaign",
    });
  } catch (error) {
    console.error("Join campaign error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
