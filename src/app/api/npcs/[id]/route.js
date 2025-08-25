// Individual NPC API - Update and delete specific NPCs
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const {
      user,
      error: authError,
      client,
    } = await getAuthenticatedUser(request);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get NPC with campaign verification
    const { data: npc, error: npcError } = await client
      .from("npcs")
      .select(
        `
        *,
        campaigns!inner(owner_id, name)
      `
      )
      .eq("id", id)
      .single();

    if (npcError || !npc) {
      return NextResponse.json({ error: "NPC not found" }, { status: 404 });
    }

    // Verify access (DM or player in campaign)
    const { data: campaign } = await client
      .from("campaigns")
      .select("*, campaign_players(*)")
      .eq("id", npc.campaign_id)
      .single();

    const isOwner = campaign.owner_id === user.id;
    const isPlayer = campaign.campaign_players.some(
      (cp) => cp.user_id === user.id
    );

    if (!isOwner && !isPlayer) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({ npc });
  } catch (error) {
    console.error("NPC fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const updateData = await request.json();

    const {
      user,
      error: authError,
      client,
    } = await getAuthenticatedUser(request);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get NPC and verify campaign owner permission
    const { data: npc, error: npcError } = await client
      .from("npcs")
      .select(
        `
        *,
        campaigns!inner(owner_id)
      `
      )
      .eq("id", id)
      .single();

    if (npcError || !npc) {
      return NextResponse.json({ error: "NPC not found" }, { status: 404 });
    }

    // Only campaign owners can update NPCs
    if (npc.campaigns.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Only the campaign owner can update NPCs" },
        { status: 403 }
      );
    }

    // Update NPC
    const { data: updatedNPC, error: updateError } = await client
      .from("npcs")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("NPC update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update NPC" },
        { status: 500 }
      );
    }

    return NextResponse.json({ npc: updatedNPC });
  } catch (error) {
    console.error("NPC update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    const {
      user,
      error: authError,
      client,
    } = await getAuthenticatedUser(request);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get NPC and verify campaign owner permission
    const { data: npc, error: npcError } = await client
      .from("npcs")
      .select(
        `
        *,
        campaigns!inner(owner_id)
      `
      )
      .eq("id", id)
      .single();

    if (npcError || !npc) {
      return NextResponse.json({ error: "NPC not found" }, { status: 404 });
    }

    // Only campaign owners can delete NPCs
    if (npc.campaigns.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Only the campaign owner can delete NPCs" },
        { status: 403 }
      );
    }

    // Soft delete by marking as inactive
    const { error: deleteError } = await client
      .from("npcs")
      .update({ is_active: false })
      .eq("id", id);

    if (deleteError) {
      console.error("NPC deletion error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete NPC" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "NPC deleted successfully" });
  } catch (error) {
    console.error("NPC deletion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
