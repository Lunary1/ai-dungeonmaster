import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helper";

// Update campaign
export async function PUT(request, { params }) {
  try {
    const { name, description } = await request.json();
    const {
      user,
      error: authError,
      client,
    } = await getAuthenticatedUser(request);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Check if user is the campaign owner
    const { data: campaign, error: campaignError } = await client
      .from("campaigns")
      .select("owner_id")
      .eq("id", params.id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const isOwner = campaign.owner_id === user.id;
    if (!isOwner) {
      return NextResponse.json(
        { error: "Only the campaign owner can update this campaign" },
        { status: 403 }
      );
    }

    // Update campaign
    const { data: updatedCampaign, error: updateError } = await client
      .from("campaigns")
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) {
      console.error("Campaign update error:", updateError);
      return NextResponse.json(
        { error: `Database error: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      campaign: updatedCampaign,
      message: "Campaign updated successfully",
    });
  } catch (error) {
    console.error("Campaign update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Delete campaign
export async function DELETE(request, { params }) {
  try {
    const {
      user,
      error: authError,
      client,
    } = await getAuthenticatedUser(request);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is the campaign owner
    const { data: campaign, error: campaignError } = await client
      .from("campaigns")
      .select("owner_id, name")
      .eq("id", params.id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const isOwner = campaign.owner_id === user.id;
    if (!isOwner) {
      return NextResponse.json(
        { error: "Only the campaign owner can delete this campaign" },
        { status: 403 }
      );
    }

    // Delete campaign (CASCADE should handle related records)
    const { error: deleteError } = await client
      .from("campaigns")
      .delete()
      .eq("id", params.id);

    if (deleteError) {
      console.error("Campaign delete error:", deleteError);
      return NextResponse.json(
        { error: `Database error: ${deleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Campaign "${campaign.name}" deleted successfully`,
    });
  } catch (error) {
    console.error("Campaign delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
