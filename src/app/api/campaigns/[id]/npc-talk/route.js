// API route for NPC Talk sessions - controlled player to NPC communication
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { NpcTalkSessionSchema } from "@/lib/hybridLinearTypes";
import { buildDmSystemPrompt } from "@/lib/ai/dmSystemPrompt";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Store active NPC talk sessions in memory (could be moved to database for persistence)
const activeNpcSessions = new Map();

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
        throw new Error("Invalid token");
      }

      return { user, client };
    }

    throw new Error("No authorization header");
  } catch (error) {
    console.error("Authentication error:", error);
    return null;
  }
}

// POST - Send message to NPC (players) or manage NPC session (DM)
export async function POST(request, { params }) {
  try {
    const resolvedParams = await params;
    const campaignId = resolvedParams.id;
    console.log("NPC talk request for campaign:", campaignId);

    const auth = await getAuthenticatedUser(request);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, client } = auth;
    const body = await request.json();
    const { action, npcId, npcName, playerMessage } = body;

    // Get campaign and verify access
    const { data: campaign, error: campaignError } = await client
      .from("campaigns")
      .select(
        `
        *,
        campaign_players!inner (user_id)
      `
      )
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const isDM = campaign.dm_id === user.id;
    const isPlayer = campaign.campaign_players.some(
      (cp) => cp.user_id === user.id
    );

    if (!isDM && !isPlayer) {
      return NextResponse.json(
        { error: "Access denied to this campaign" },
        { status: 403 }
      );
    }

    const sessionKey = `${campaignId}-${npcId}`;

    // Handle DM actions (open/close NPC talk)
    if (isDM && (action === "open" || action === "close")) {
      if (action === "open") {
        if (!npcId || !npcName) {
          return NextResponse.json(
            { error: "NPC ID and name are required" },
            { status: 400 }
          );
        }

        // Check if campaign allows NPC chat
        if (!campaign.allow_player_npc_chat) {
          return NextResponse.json(
            { error: "NPC chat is disabled for this campaign" },
            { status: 403 }
          );
        }

        const session = {
          npcId,
          npcName,
          isOpen: true,
          playersCanChat: true,
          openedBy: user.id,
          openedAt: new Date().toISOString(),
        };

        activeNpcSessions.set(sessionKey, session);

        // Log the session opening
        await client.from("campaign_logs").insert({
          campaign_id: campaignId,
          user_input: `NPC_TALK_OPENED:${npcName}`,
          ai_output: `DM opened NPC talk with ${npcName}. Players can now chat with this NPC.`,
          input_type: "npc_talk",
          metadata: {
            action: "session_open",
            npc_id: npcId,
            npc_name: npcName,
            opened_by: user.id,
          },
        });

        return NextResponse.json({
          success: true,
          session: NpcTalkSessionSchema.parse(session),
        });
      } else if (action === "close") {
        const session = activeNpcSessions.get(sessionKey);
        if (!session) {
          return NextResponse.json(
            { error: "No active session found" },
            { status: 404 }
          );
        }

        activeNpcSessions.delete(sessionKey);

        // Log the session closing
        await client.from("campaign_logs").insert({
          campaign_id: campaignId,
          user_input: `NPC_TALK_CLOSED:${session.npcName}`,
          ai_output: `DM closed NPC talk with ${session.npcName}. Players can no longer chat with this NPC.`,
          input_type: "npc_talk",
          metadata: {
            action: "session_close",
            npc_id: npcId,
            npc_name: session.npcName,
            closed_by: user.id,
          },
        });

        return NextResponse.json({
          success: true,
          message: "NPC talk session closed",
        });
      }
    }

    // Handle player messages to NPC
    if (isPlayer && playerMessage) {
      const session = activeNpcSessions.get(sessionKey);

      if (!session || !session.isOpen || !session.playersCanChat) {
        return NextResponse.json(
          { error: "NPC talk session is not open" },
          { status: 403 }
        );
      }

      if (!playerMessage.trim()) {
        return NextResponse.json(
          { error: "Message cannot be empty" },
          { status: 400 }
        );
      }

      // Get NPC information
      const { data: npc } = await client
        .from("npcs")
        .select("*")
        .eq("id", npcId)
        .eq("campaign_id", campaignId)
        .single();

      if (!npc) {
        return NextResponse.json({ error: "NPC not found" }, { status: 404 });
      }

      // Generate NPC response using AI
      const npcResponse = await generateNpcResponse(
        npc,
        playerMessage,
        campaignId,
        client
      );

      // Log the player message and NPC response
      await client.from("campaign_logs").insert({
        campaign_id: campaignId,
        user_input: playerMessage,
        ai_output: npcResponse,
        input_type: "npc_talk",
        metadata: {
          action: "player_message",
          npc_id: npcId,
          npc_name: npc.name,
          player_id: user.id,
          is_npc_response: true,
        },
      });

      return NextResponse.json({
        success: true,
        npcResponse,
        npcName: npc.name,
      });
    }

    return NextResponse.json(
      { error: "Invalid action or missing parameters" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error in NPC talk route:", error);
    return NextResponse.json(
      { error: "Failed to process NPC talk request" },
      { status: 500 }
    );
  }
}

// GET - Get active NPC talk sessions
export async function GET(request, { params }) {
  try {
    const { campaignId } = params;
    const auth = await getAuthenticatedUser(request);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, client } = auth;

    // Verify campaign access
    const { data: campaign } = await client
      .from("campaigns")
      .select(
        `
        dm_id,
        campaign_players!inner (user_id)
      `
      )
      .eq("id", campaignId)
      .single();

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const isDM = campaign.dm_id === user.id;
    const isPlayer = campaign.campaign_players.some(
      (cp) => cp.user_id === user.id
    );

    if (!isDM && !isPlayer) {
      return NextResponse.json(
        { error: "Access denied to this campaign" },
        { status: 403 }
      );
    }

    // Get active sessions for this campaign
    const activeSessions = [];
    for (const [key, session] of activeNpcSessions.entries()) {
      if (key.startsWith(`${campaignId}-`)) {
        activeSessions.push(session);
      }
    }

    return NextResponse.json({
      success: true,
      activeSessions,
    });
  } catch (error) {
    console.error("Error getting NPC talk sessions:", error);
    return NextResponse.json(
      { error: "Failed to get NPC talk sessions" },
      { status: 500 }
    );
  }
}

async function generateNpcResponse(npc, playerMessage, campaignId, client) {
  try {
    // Build NPC-specific system prompt
    const npcSystemPrompt = `You are ${npc.name}, an NPC in a D&D campaign. 

Character Details:
- Name: ${npc.name}
- Race: ${npc.race || "Unknown"}
- Class: ${npc.class_type || "Unknown"}
- Location: ${npc.location || "Unknown"}
- Occupation: ${npc.occupation || "Unknown"}
- Relationship to party: ${npc.relationship_to_party || "Neutral"}

Personality: ${JSON.stringify(npc.personality || {})}
Dialogue Style: ${npc.dialogue_style || "Speak naturally for your character"}

Notes: ${npc.notes || "No additional notes"}

Roleplay this character authentically. Respond to the player's message in character.
Keep responses concise (1-3 sentences) and appropriate for the situation.
Stay true to your character's personality, occupation, and relationship with the party.`;

    // Get recent conversation context
    const { data: recentMessages } = await client
      .from("campaign_logs")
      .select("user_input, ai_output, metadata")
      .eq("campaign_id", campaignId)
      .eq("input_type", "npc_talk")
      .eq("metadata->npc_id", npc.id)
      .order("timestamp", { ascending: false })
      .limit(5);

    const conversationHistory =
      recentMessages?.reverse().map((msg) => ({
        role: msg.metadata?.is_npc_response ? "assistant" : "user",
        content: msg.metadata?.is_npc_response ? msg.ai_output : msg.user_input,
      })) || [];

    const messages = [
      { role: "system", content: npcSystemPrompt },
      ...conversationHistory,
      { role: "user", content: playerMessage },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 200,
      temperature: 0.8, // Higher creativity for character roleplay
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error("Error generating NPC response:", error);
    return `${npc.name} seems distracted and doesn't respond clearly.`;
  }
}
