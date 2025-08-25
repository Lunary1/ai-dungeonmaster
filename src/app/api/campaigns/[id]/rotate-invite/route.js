import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getAuthenticatedUser } from "@/lib/auth-helper";

export async function POST(request, { params }) {
  try {
    const {
      user,
      error: authError,
      client,
    } = await getAuthenticatedUser(request);

    if (authError || !user) {
      console.log(
        "Auth error in rotate invite:",
        authError?.message || "No user"
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const campaignId = params.id;

    // Check if user is the owner/DM of this campaign
    const { data: campaign, error: campaignError } = await client
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError) {
      console.error("Campaign lookup error:", campaignError);
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Check if user has permission to rotate the invite code
    if (campaign.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Only the campaign owner can regenerate invite codes" },
        { status: 403 }
      );
    }

    // Generate new join code
    const newJoinCode = nanoid(8);

    // Update the campaign with new join code
    const { data: updatedCampaign, error: updateError } = await client
      .from("campaigns")
      .update({ invite_code: newJoinCode })
      .eq("id", campaignId)
      .select()
      .single();

    if (updateError) {
      console.error("Update campaign error:", updateError);
      return NextResponse.json(
        { error: "Failed to update join code" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      join_code: newJoinCode,
      message: "Join code regenerated successfully",
    });
  } catch (error) {
    console.error("Rotate invite error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
