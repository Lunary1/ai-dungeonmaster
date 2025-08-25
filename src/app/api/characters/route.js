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

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const campaignId = url.searchParams.get("campaignId");

    if (!campaignId) {
      return NextResponse.json(
        { error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    // Get the authenticated user
    const {
      user,
      error: authError,
      client,
    } = await getAuthenticatedUser(request);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = client;

    // First check if user has access to this campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, owner_id")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Check if user is owner or a member (AI-only system)
    let hasAccess = campaign.owner_id === user.id;

    if (!hasAccess) {
      const { data: membership } = await supabase
        .from("campaign_players")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      hasAccess = !!membership;
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get user's character(s) for this campaign
    const { data: characters, error: charactersError } = await supabase
      .from("characters")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("user_id", user.id);

    if (charactersError) {
      console.error("Characters fetch error:", charactersError);
      return NextResponse.json(
        { error: "Failed to fetch characters" },
        { status: 500 }
      );
    }

    return NextResponse.json({ characters: characters || [] });
  } catch (error) {
    console.error("Characters API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
