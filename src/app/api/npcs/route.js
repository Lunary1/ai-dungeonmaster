// NPC Management API - Create, read, update NPCs with D&D 5e SRD compliance
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enhancedAIService } from "@/lib/enhancedAIService";

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

    const {
      user,
      error: authError,
      client,
    } = await getAuthenticatedUser(request);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify campaign access
    const { data: campaign } = await client
      .from("campaigns")
      .select("*, campaign_players(*)")
      .eq("id", campaignId)
      .single();

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const isOwner = campaign.owner_id === user.id;
    const isPlayer = campaign.campaign_players.some(
      (cp) => cp.user_id === user.id
    );

    if (!isOwner && !isPlayer) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get NPCs for the campaign
    const { data: npcs, error: npcsError } = await client
      .from("npcs")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("is_active", true)
      .order("name");

    if (npcsError) {
      return NextResponse.json(
        { error: "Failed to fetch NPCs" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      npcs: npcs || [],
      campaign: {
        id: campaign.id,
        name: campaign.name,
      },
    });
  } catch (error) {
    console.error("NPCs fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { campaignId, generatePrompt, npcData } = await request.json();

    if (!campaignId) {
      return NextResponse.json(
        { error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    const {
      user,
      error: authError,
      client,
    } = await getAuthenticatedUser(request);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is DM of the campaign
    const { data: campaign } = await client
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("owner_id", user.id)
      .single();

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found or you're not the owner" },
        { status: 404 }
      );
    }

    let finalNPCData;

    if (generatePrompt) {
      // AI-generate NPC based on prompt
      const { data: existingNPCs } = await client
        .from("npcs")
        .select("name, race, class_type")
        .eq("campaign_id", campaignId);

      finalNPCData = await enhancedAIService.generateNPC(
        campaignId,
        generatePrompt,
        existingNPCs || []
      );
    } else if (npcData) {
      // Use provided NPC data
      finalNPCData = npcData;
    } else {
      return NextResponse.json(
        { error: "Either generatePrompt or npcData is required" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!finalNPCData.name || !finalNPCData.race) {
      return NextResponse.json(
        { error: "NPC name and race are required" },
        { status: 400 }
      );
    }

    // Insert NPC into database
    const { data: newNPC, error: insertError } = await client
      .from("npcs")
      .insert({
        campaign_id: campaignId,
        name: finalNPCData.name,
        race: finalNPCData.race,
        class_type: finalNPCData.class_type || "Commoner",
        alignment: finalNPCData.alignment,
        armor_class: finalNPCData.armor_class || 10,
        hit_points: finalNPCData.hit_points || 1,
        hit_dice: finalNPCData.hit_dice || "1d8",
        speed: finalNPCData.speed || 30,
        strength: finalNPCData.strength || 10,
        dexterity: finalNPCData.dexterity || 10,
        constitution: finalNPCData.constitution || 10,
        intelligence: finalNPCData.intelligence || 10,
        wisdom: finalNPCData.wisdom || 10,
        charisma: finalNPCData.charisma || 10,
        stat_block: finalNPCData.stat_block || {},
        personality: finalNPCData.personality || {},
        dialogue_style: finalNPCData.dialogue_style,
        location: finalNPCData.location,
        occupation: finalNPCData.occupation,
        relationship_to_party: finalNPCData.relationship_to_party || "neutral",
        quest_hooks: finalNPCData.quest_hooks || [],
        notes: finalNPCData.notes || "",
      })
      .select()
      .single();

    if (insertError) {
      console.error("NPC insertion error:", insertError);
      return NextResponse.json(
        { error: "Failed to create NPC" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      npc: newNPC,
      generated: !!generatePrompt,
    });
  } catch (error) {
    console.error("NPC creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
