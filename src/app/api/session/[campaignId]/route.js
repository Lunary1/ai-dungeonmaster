// Campaign Session API - Two-Tier AI System for Hybrid Linear Campaigns
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { twoTierAI } from "@/lib/ai/twoTierAIService";
import { diceService } from "@/lib/diceService";
import {
  buildCampaignContext,
  maybeSummarizeCampaign,
} from "@/lib/ai/campaignContext";
import { buildDmSystemPrompt } from "@/lib/ai/dmSystemPrompt";
import { NarrationResultSchema, RollDirectiveSchema } from "@/lib/ai/types";
import { checkRateLimit } from "@/lib/ai/rateLimiter";
import { calculateChapter, isChapterBoundary } from "@/lib/hybridLinearTypes";

// Helper function to ensure realtime broadcasting works
async function insertCampaignLog(client, logData) {
  // Insert into campaign_logs table - Supabase Realtime will automatically
  // broadcast this to subscribers via database-level triggers
  const { data, error } = await client
    .from("campaign_logs")
    .insert(logData)
    .select()
    .single();

  if (error) {
    console.error("Error inserting campaign log:", error);
    throw new Error(`Failed to store message: ${error.message}`);
  }

  console.log(
    "Campaign log inserted successfully, realtime will broadcast:",
    data.id
  );
  return data;
}

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
    const resolvedParams = await params;
    const campaignId = resolvedParams.campaignId;
    console.log("Session API POST request for campaign:", campaignId);

    const { user_input, input_type = "message" } = await request.json();

    if (!user_input || !campaignId) {
      return NextResponse.json(
        { error: "User input and campaign ID are required" },
        { status: 400 }
      );
    }

    // Authenticate user
    const {
      user,
      error: authError,
      client,
    } = await getAuthenticatedUser(request);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has access to campaign
    const { data: campaign, error: campaignError } = await client
      .from("campaigns")
      .select("*, campaign_players(*)")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found or access denied" },
        { status: 404 }
      );
    }

    // Check if user is owner or player (AI-only system)
    const isOwner = campaign.owner_id === user.id;
    const isPlayer = campaign.campaign_players.some(
      (cp) => cp.user_id === user.id
    );

    if (!isOwner && !isPlayer) {
      return NextResponse.json(
        { error: "Access denied to this campaign" },
        { status: 403 }
      );
    }

    // Handle dice roll commands
    if (user_input.startsWith("/roll ")) {
      return await handleDiceRoll(user_input, campaignId, user, client);
    }

    // Handle skill check commands
    if (user_input.startsWith("/check ") || user_input.startsWith("/skill ")) {
      return await handleSkillCheck(user_input, campaignId, user, client);
    }

    // Handle AI DM narration requests
    if (input_type === "ai_narration") {
      return await handleAiNarration(user_input, campaignId, user, client);
    }

    // Handle round advancement (DM only)
    if (input_type === "round_advance") {
      return await handleRoundAdvance(campaignId, user, client);
    }

    // Handle state updates (DM only)
    if (input_type === "state_update") {
      return await handleStateUpdate(user_input, campaignId, user, client);
    }

    // Handle standard narrative input
    return await handleNarrativeInput(
      user_input,
      campaignId,
      user,
      client,
      input_type
    );
  } catch (error) {
    console.error("Session API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function handleAiNarration(user_input, campaignId, user, client) {
  try {
    console.log("🤖 Starting Two-Tier AI narration for:", {
      user_input,
      campaignId,
    });

    // Step 1: Store and return the user's request immediately (for realtime broadcast)
    const userRequestLog = await insertCampaignLog(client, {
      campaign_id: campaignId,
      user_input: user_input,
      ai_output: "", // No AI response yet
      input_type: "message",
      timestamp: new Date().toISOString(),
      metadata: {
        user_id: user.id,
        source: "dm_interface",
        ai_processing: true, // Flag to indicate AI is processing
      },
    });

    console.log(
      "✅ User request stored for immediate broadcast:",
      userRequestLog.id
    );

    // Rate limiting check
    const rateLimitKey = `${user.id}-${campaignId}`;
    const rateLimit = checkRateLimit(rateLimitKey, 12); // 12 requests per hour

    if (!rateLimit.allowed) {
      const resetTime = new Date(rateLimit.resetTime).toLocaleTimeString();
      return NextResponse.json(
        {
          error: `Rate limit exceeded. Try again after ${resetTime}`,
          resetTime: rateLimit.resetTime,
          log: userRequestLog, // Still return the user request for broadcast
        },
        { status: 429 }
      );
    }

    console.log("✅ Rate limit check passed");

    // Build enhanced campaign context for two-tier system
    console.log("🏗️ Building enhanced campaign context...");
    const campaignContext = await buildEnhancedCampaignContext(
      campaignId,
      client
    );
    console.log("✅ Enhanced campaign context built");

    // Get character information
    const characterInfo = await getCharacterInfo(campaignId, user.id, client);

    // Determine which AI tier to use based on input analysis
    const tier = analyzeInputForTier(user_input, campaignContext);
    console.log(`🎯 Using ${tier} tier for this request`);

    // Generate AI response using two-tier system
    console.log("🤖 Calling Two-Tier AI Service...");
    const aiResponse = await twoTierAI.generateResponse({
      userMessage: user_input,
      campaignId,
      campaignContext,
      messageHistory: campaignContext.recentMessages || [],
      characterInfo,
      tier,
    });

    if (!aiResponse.success) {
      throw new Error(aiResponse.error || "AI generation failed");
    }

    console.log("✅ AI response received:", {
      contentLength: aiResponse.response?.length,
      toolCallsCount: aiResponse.toolCalls?.length || 0,
      tier: aiResponse.tier,
    });

    // Format the response for database storage
    const formattedResponse = formatAIResponse(aiResponse, tier);

    // Step 2: Store the AI response as a separate message (for second broadcast)
    console.log("💾 Storing AI response in database...");
    const aiResponseData = {
      campaign_id: campaignId,
      user_input: "", // Empty user input for AI response
      ai_output: formattedResponse.message,
      input_type: "message",
      timestamp: new Date().toISOString(),
      metadata: {
        user_id: user.id,
        ai_tier: tier,
        tool_calls: aiResponse.toolCalls || [],
        tool_results: aiResponse.toolResults || [],
        directive: formattedResponse.directive,
        ai_usage: aiResponse.usage,
        model: "gpt-4o-mini",
        rate_limit_remaining: rateLimit.remaining,
        source: "ai_dm_two_tier",
        responding_to: userRequestLog.id,
      },
    };

    console.log("📝 AI response data prepared");

    const aiResponseLog = await insertCampaignLog(client, aiResponseData);

    console.log("✅ AI response stored successfully:", aiResponseLog.id);

    // Process any tool results that affect campaign state
    await processToolResults(aiResponse.toolResults, campaignId, client);

    // Check if we need to summarize the campaign
    await maybeSummarizeCampaign(campaignId, client);

    console.log("🎉 Two-Tier AI narration completed successfully");
    return NextResponse.json({
      message: formattedResponse.message,
      directive: formattedResponse.directive,
      success: true,
      tier: aiResponse.tier,
      toolResults: aiResponse.toolResults || [],
      usage: aiResponse.usage,
      rateLimitRemaining: rateLimit.remaining,
      log: aiResponseLog,
      userRequestLog: userRequestLog,
    });
  } catch (error) {
    console.error("❌ Two-Tier AI narration error:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      type: error.type,
      stack: error.stack,
    });

    if (error.code === "insufficient_quota") {
      return NextResponse.json(
        {
          error: "AI service temporarily unavailable. Please try again later.",
        },
        { status: 503 }
      );
    }

    if (error.code === "invalid_api_key") {
      return NextResponse.json(
        { error: "AI service configuration error." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate AI narration: " + error.message },
      { status: 500 }
    );
  }
}

async function handleDiceRoll(user_input, campaignId, user, client) {
  const diceNotation = user_input.substring(6).trim();
  const rollResult = diceService.rollDice(diceNotation);

  if (rollResult.error) {
    return NextResponse.json({
      ai_output: `❌ **Error**: ${rollResult.error}`,
      success: false,
    });
  }

  const resultMessage = diceService.formatRollResult(rollResult);

  // Store the dice roll in campaign logs with realtime broadcasting
  const insertedLog = await insertCampaignLog(client, {
    campaign_id: campaignId,
    user_input: user_input,
    ai_output: resultMessage,
    input_type: "dice_roll",
    timestamp: new Date().toISOString(),
    metadata: {
      roll_result: rollResult,
      user_id: user.id,
    },
  });

  return NextResponse.json({
    ai_output: resultMessage,
    success: true,
    roll_result: rollResult,
    log: insertedLog,
  });
}

async function handleSkillCheck(user_input, campaignId, user, client) {
  const parts = user_input.split(" ").slice(1);
  const skillName = parts[0];
  let modifier = parts[1] ? parseInt(parts[1]) : 0;

  // Get character data for automatic modifiers
  const { data: character } = await client
    .from("characters")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("user_id", user.id)
    .single();

  if (character) {
    // Calculate skill modifier based on D&D 5e rules
    const skillModifiers = calculateSkillModifiers(character);
    if (skillModifiers[skillName.toLowerCase()]) {
      modifier = skillModifiers[skillName.toLowerCase()];
    }
  }

  const rollResult = diceService.rollDice(`1d20+${modifier}`);
  const resultMessage = `🎲 **${skillName} Check**: ${rollResult.total} (rolled ${rollResult.rolls[0]} + ${modifier})`;

  // Store the skill check in campaign logs with realtime broadcasting
  const insertedLog = await insertCampaignLog(client, {
    campaign_id: campaignId,
    user_input: user_input,
    ai_output: resultMessage,
    input_type: "skill_check",
    timestamp: new Date().toISOString(),
    metadata: {
      skill_name: skillName,
      modifier: modifier,
      roll_result: rollResult,
      user_id: user.id,
    },
  });

  return NextResponse.json({
    ai_output: resultMessage,
    success: true,
    skill_check: {
      skill: skillName,
      total: rollResult.total,
      roll: rollResult.rolls[0],
      modifier: modifier,
    },
    log: insertedLog,
  });
}

async function handleNarrativeInput(
  user_input,
  campaignId,
  user,
  client,
  input_type
) {
  try {
    console.log("Handling narrative input:", {
      user_input,
      campaignId,
      input_type,
    });

    // For regular messages (DM messages, player messages), store with realtime broadcasting
    const data = await insertCampaignLog(client, {
      campaign_id: campaignId,
      user_input: user_input,
      ai_output: "", // No AI response for regular messages
      input_type: input_type,
      timestamp: new Date().toISOString(),
      metadata: {
        user_id: user.id,
        source: input_type === "message" ? "dm_interface" : "player_interface",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Message sent successfully",
      log_id: data.id,
      log: data,
    });
  } catch (error) {
    console.error("Narrative input error:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}

// New handler for round advancement via session API
async function handleRoundAdvance(campaignId, user, client) {
  try {
    // Only campaign owner can advance rounds (AI-only system)
    const { data: campaign } = await client
      .from("campaigns")
      .select("owner_id, current_round")
      .eq("id", campaignId)
      .single();

    if (campaign.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Only the campaign owner can advance rounds" },
        { status: 403 }
      );
    }

    // Call the dedicated advance-round API
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/campaigns/${campaignId}/advance-round`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to advance round");
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: `Advanced to Round ${result.round} (Chapter ${result.chapter})`,
      ...result,
    });
  } catch (error) {
    console.error("Error handling round advance:", error);
    return NextResponse.json(
      { error: "Failed to advance round" },
      { status: 500 }
    );
  }
}

// New handler for character/campaign state updates
async function handleStateUpdate(user_input, campaignId, user, client) {
  try {
    // Only DM can update state
    const { data: campaign } = await client
      .from("campaigns")
      .select("owner_id")
      .eq("id", campaignId)
      .single();

    if (campaign.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Only the campaign owner can update game state" },
        { status: 403 }
      );
    }

    // Parse state update command (format: "/state [character_name] hp=[new_hp] xp=[new_xp]")
    const parts = user_input.split(" ");
    if (parts.length < 3) {
      return NextResponse.json(
        {
          error:
            "Invalid state update format. Use: /state [character_name] hp=[value] xp=[value]",
        },
        { status: 400 }
      );
    }

    const characterName = parts[1];
    const updates = {};

    // Parse updates (hp=10, xp=100, etc.)
    for (let i = 2; i < parts.length; i++) {
      const [key, value] = parts[i].split("=");
      if (key && value) {
        if (key === "hp") updates.hit_points_current = parseInt(value);
        if (key === "xp") updates.experience_points = parseInt(value);
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid updates specified" },
        { status: 400 }
      );
    }

    // Find and update character
    const { data: character, error: findError } = await client
      .from("characters")
      .select("*")
      .eq("campaign_id", campaignId)
      .ilike("name", characterName)
      .single();

    if (findError || !character) {
      return NextResponse.json(
        { error: `Character '${characterName}' not found` },
        { status: 404 }
      );
    }

    const { error: updateError } = await client
      .from("characters")
      .update(updates)
      .eq("id", character.id);

    if (updateError) {
      throw new Error(`Failed to update character: ${updateError.message}`);
    }

    // Log the state update
    const logMessage = `DM updated ${character.name}: ${Object.entries(updates)
      .map(([key, value]) => `${key}=${value}`)
      .join(", ")}`;

    await insertCampaignLog(client, {
      campaign_id: campaignId,
      user_input: user_input,
      ai_output: logMessage,
      input_type: "state_update",
      metadata: {
        character_id: character.id,
        character_name: character.name,
        updates,
        updated_by: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: logMessage,
      character: {
        id: character.id,
        name: character.name,
        ...updates,
      },
    });
  } catch (error) {
    console.error("Error handling state update:", error);
    return NextResponse.json(
      { error: "Failed to update game state" },
      { status: 500 }
    );
  }
}

function calculateSkillModifiers(character) {
  // D&D 5e skill to ability mapping
  const skillAbilities = {
    acrobatics: "dexterity",
    "animal handling": "wisdom",
    arcana: "intelligence",
    athletics: "strength",
    deception: "charisma",
    history: "intelligence",
    insight: "wisdom",
    intimidation: "charisma",
    investigation: "intelligence",
    medicine: "wisdom",
    nature: "intelligence",
    perception: "wisdom",
    performance: "charisma",
    persuasion: "charisma",
    religion: "intelligence",
    "sleight of hand": "dexterity",
    stealth: "dexterity",
    survival: "wisdom",
  };

  const modifiers = {};
  const level = character.level || 1;
  const proficiencyBonus = Math.ceil(level / 4) + 1; // D&D 5e proficiency progression

  for (const [skill, ability] of Object.entries(skillAbilities)) {
    const abilityScore = character[ability] || 10;
    const abilityModifier = Math.floor((abilityScore - 10) / 2);

    // Check if proficient in skill (simplified - would need to parse skill_proficiencies)
    const isProficient =
      character.skill_proficiencies?.includes(skill) || false;
    const profBonus = isProficient ? proficiencyBonus : 0;

    modifiers[skill] = abilityModifier + profBonus;
  }

  return modifiers;
}

async function getCampaignContext(campaignId, client) {
  // Get basic campaign info
  const { data: campaign } = await client
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  // Get recent important events from logs
  const { data: recentLogs } = await client
    .from("campaign_logs")
    .select("ai_output, timestamp")
    .eq("campaign_id", campaignId)
    .in("input_type", ["message", "action"])
    .order("timestamp", { ascending: false })
    .limit(5);

  return {
    campaign: campaign,
    recent_events: recentLogs?.map((log) => log.ai_output).join("\n") || "",
    session_count: recentLogs?.length || 0,
  };
}

// GET endpoint to retrieve session history
export async function GET(request, { params }) {
  try {
    const resolvedParams = await params;
    const campaignId = resolvedParams.campaignId;
    console.log("Session API GET request for campaign:", campaignId);

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit")) || 50;

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

    // Get session history
    const { data: logs, error } = await client
      .from("campaign_logs")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch session history" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      logs: logs.reverse(), // Return in chronological order
      campaign: {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
      },
    });
  } catch (error) {
    console.error("Session history fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================================
// TWO-TIER AI SYSTEM HELPER FUNCTIONS
// ============================================================================

/**
 * Build enhanced campaign context for the two-tier AI system
 */
async function buildEnhancedCampaignContext(campaignId, client) {
  try {
    // Get basic campaign info
    const { data: campaign } = await client
      .from("campaigns")
      .select(
        `
        *,
        story_bible,
        current_round,
        current_chapter
      `
      )
      .eq("id", campaignId)
      .single();

    // Get party state
    const { data: partyState } = await client
      .from("party_state")
      .select("*")
      .eq("campaign_id", campaignId)
      .single();

    // Get recent plot beats
    const { data: plotBeats } = await client
      .from("plot_beats")
      .select("*")
      .eq("campaign_id", campaignId)
      .gte("round_number", (campaign?.current_round || 1) - 5)
      .order("round_number", { ascending: true });

    // Get recent entities (NPCs, locations, etc.)
    const { data: entities } = await client
      .from("campaign_entities")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("updated_at", { ascending: false })
      .limit(20);

    // Get recent campaign flags
    const { data: flags } = await client
      .from("campaign_flags")
      .select("*")
      .eq("campaign_id", campaignId);

    // Build the context from existing function and enhance it
    const baseContext = await buildCampaignContext(campaignId, client);

    return {
      ...baseContext,
      storyBible: campaign?.story_bible,
      currentRound: campaign?.current_round || 1,
      currentChapter: campaign?.current_chapter || 1,
      partyState: partyState || {},
      plotBeats: plotBeats || [],
      entities: entities || [],
      flags:
        flags?.reduce((acc, flag) => {
          try {
            acc[flag.flag_name] = JSON.parse(flag.flag_value);
          } catch {
            acc[flag.flag_name] = flag.flag_value;
          }
          return acc;
        }, {}) || {},
    };
  } catch (error) {
    console.error("Error building enhanced campaign context:", error);
    // Fallback to basic context
    return await buildCampaignContext(campaignId, client);
  }
}

/**
 * Get character information for the requesting user
 */
async function getCharacterInfo(campaignId, userId, client) {
  try {
    const { data: character } = await client
      .from("characters")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("user_id", userId)
      .single();

    if (!character) return {};

    return {
      name: character.name,
      class: character.class,
      level: character.level,
      background: character.background,
      personality: character.personality_traits,
      ...character.basic_info,
    };
  } catch (error) {
    console.error("Error getting character info:", error);
    return {};
  }
}

/**
 * Analyze user input to determine which AI tier to use
 */
function analyzeInputForTier(userInput, campaignContext) {
  const input = userInput.toLowerCase();

  // DIRECTOR tier indicators (strategic/high-level)
  const directorKeywords = [
    "campaign",
    "story",
    "plot",
    "chapter",
    "planning",
    "progress",
    "pacing",
    "development",
    "arc",
    "future",
    "strategy",
    "direction",
  ];

  // Check for DIRECTOR-specific requests
  if (directorKeywords.some((keyword) => input.includes(keyword))) {
    return "DIRECTOR";
  }

  // Check for round/chapter boundary (might need DIRECTOR input)
  if (campaignContext.currentRound && campaignContext.currentRound % 20 === 0) {
    return "DIRECTOR";
  }

  // Default to DM for immediate player interaction
  return "DM";
}

/**
 * Format AI response for database storage and UI display
 */
function formatAIResponse(aiResponse, tier) {
  let message = aiResponse.response || "";
  let directive = null;

  // Add tier indicator to message
  const tierPrefix = tier === "DIRECTOR" ? "🎯 **Campaign Director**: " : "🎭 ";

  // Add tool results to message if present
  if (aiResponse.toolResults && aiResponse.toolResults.length > 0) {
    const toolSummaries = aiResponse.toolResults
      .filter((result) => result.result.success && result.result.summary)
      .map((result) => result.result.summary)
      .join("\n");

    if (toolSummaries) {
      message += "\n\n" + toolSummaries;
    }

    // Check for dice roll directives in tool results
    const rollResults = aiResponse.toolResults.filter(
      (result) => result.toolName === "roll_dice" && result.result.success
    );

    if (rollResults.length > 0) {
      const lastRoll = rollResults[rollResults.length - 1].result.result;
      if (lastRoll.dc) {
        directive = {
          requiresRoll: true,
          rollType: "d20",
          ability: lastRoll.ability || null,
          dc: lastRoll.dc,
          reason: lastRoll.reason || "making a check",
        };
      }
    }
  }

  return {
    message: tierPrefix + message,
    directive,
  };
}

/**
 * Process tool results that might affect campaign state
 */
async function processToolResults(toolResults, campaignId, client) {
  if (!toolResults || toolResults.length === 0) return;

  try {
    // Process state updates
    const stateUpdates = toolResults.filter(
      (result) =>
        result.toolName === "update_campaign_state" && result.result.success
    );

    // Process memory saves
    const memorySaves = toolResults.filter(
      (result) => result.toolName === "save_memory" && result.result.success
    );

    // Log significant tool actions
    if (stateUpdates.length > 0 || memorySaves.length > 0) {
      await client.from("campaign_logs").insert({
        campaign_id: campaignId,
        log_type: "ai_tool_actions",
        log_data: {
          stateUpdates: stateUpdates.length,
          memorySaves: memorySaves.length,
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Error processing tool results:", error);
    // Non-fatal error, continue
  }
}
