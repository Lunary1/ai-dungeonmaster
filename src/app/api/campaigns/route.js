import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getAuthenticatedUser } from "@/lib/auth-helper";

export async function POST(request) {
  try {
    const { name, description } = await request.json();
    const {
      user,
      error: authError,
      client,
    } = await getAuthenticatedUser(request);

    if (authError || !user) {
      console.log(
        "Auth error in POST campaigns:",
        authError?.message || "No user"
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Authenticated user:", user.id);

    // Validate input
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Campaign name is required" },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: "Campaign name must be 100 characters or less" },
        { status: 400 }
      );
    }

    // Generate a unique join code
    const joinCode = nanoid(8); // 8 character join code

    // Create campaign - owner_id only (AI-only system)
    const { data: campaign, error: campaignError } = await client
      .from("campaigns")
      .insert({
        owner_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        invite_code: joinCode,
      })
      .select()
      .single();

    if (campaignError) {
      console.error("Campaign creation error:", campaignError);
      return NextResponse.json(
        { error: `Database error: ${campaignError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      campaign,
      message: "Campaign created successfully",
    });
  } catch (error) {
    console.error("Campaign creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const {
      user,
      error: authError,
      client,
    } = await getAuthenticatedUser(request);

    if (authError || !user) {
      console.log(
        "Auth error in GET campaigns:",
        authError?.message || "No user"
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Getting campaigns for user:", user.id);

    // Get campaigns where user is owner (AI-only system)
    const { data: ownedCampaigns, error: ownerError } = await client
      .from("campaigns")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    const { data: playerCampaigns, error: playerError } = await client
      .from("campaign_players")
      .select(
        `
        campaigns(*)
      `
      )
      .eq("user_id", user.id);

    if (ownerError || playerError) {
      console.error("Campaigns fetch error:", ownerError || playerError);
      return NextResponse.json(
        { error: `Database error: ${(ownerError || playerError).message}` },
        { status: 500 }
      );
    }

    // Combine and deduplicate campaigns
    const allCampaigns = [
      ...(ownedCampaigns || []),
      ...(playerCampaigns?.map((cp) => cp.campaigns).filter(Boolean) || []),
    ];

    // Remove duplicates by ID
    const uniqueCampaigns = allCampaigns.filter(
      (campaign, index, self) =>
        index === self.findIndex((c) => c.id === campaign.id)
    );

    return NextResponse.json({
      campaigns: uniqueCampaigns,
    });
  } catch (error) {
    console.error("Campaigns fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
