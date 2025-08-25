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

export async function POST(request, { params }) {
  try {
    const {
      user,
      error: authError,
      client,
    } = await getAuthenticatedUser(request);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const campaignId = resolvedParams.id;

    // Get campaign and verify user is DM
    const { data: campaign, error: campaignError } = await client
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Check if user is campaign owner
    if (campaign.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Only the campaign owner can start the campaign" },
        { status: 403 }
      );
    }

    // Update campaign to mark as started - use updated_at as session start indicator
    const sessionStartTime = new Date().toISOString();
    const { data: updatedCampaign, error: updateError } = await client
      .from("campaigns")
      .update({
        is_active: true,
        updated_at: sessionStartTime,
      })
      .eq("id", campaignId)
      .select()
      .single();

    if (updateError) {
      console.error("Campaign update error:", updateError);
      return NextResponse.json(
        { error: "Failed to start campaign" },
        { status: 500 }
      );
    }

    // Log the campaign start in campaign_logs (if RLS allows, otherwise skip)
    try {
      const { error: logError } = await client.from("campaign_logs").insert({
        campaign_id: campaignId,
        user_input: "CAMPAIGN_START",
        ai_output: "Campaign session has been started by the campaign owner.",
        input_type: "action",
        metadata: {
          action_type: "campaign_start",
          owner_id: user.id,
          started_at: new Date().toISOString(),
        },
      });

      if (logError) {
        console.error("Failed to log campaign start:", logError);
        // Don't fail the request if logging fails due to RLS
      }
    } catch (logErr) {
      console.error("Campaign logging error:", logErr);
      // Continue without failing
    }

    return NextResponse.json({
      success: true,
      campaign: updatedCampaign,
      message: "Campaign started successfully",
      sessionUrl: `/campaign/${campaignId}/session`,
      sessionStartTime,
    });
  } catch (error) {
    console.error("Start campaign error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
