/**
 * Tool Handler Implementations for Two-Tier AI System
 *
 * This module implements the actual functionality for each tool that can be
 * called by the DIRECTOR and DM AI agents.
 */

import { diceService } from "../../diceService.js";
import { srdLookup } from "../../srd/lookup.js";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ============================================================================
// DICE & RULES HANDLERS
// ============================================================================

/**
 * Handle dice rolling with D&D 5e notation
 */
export async function handleRollDice({ expression, reason, dc, ability }) {
  try {
    // Use the existing dice service
    const rollResult = diceService.rollDice(expression);

    if (rollResult.error) {
      return {
        success: false,
        error: rollResult.error,
        summary: `❌ Error rolling ${expression}: ${rollResult.error}`,
      };
    }

    // Determine success for checks with DC
    let success = null;
    if (dc && rollResult.total) {
      success = rollResult.total >= dc;
    }

    // Format the result
    const result = {
      total: rollResult.total,
      rolls: rollResult.rolls,
      expression: rollResult.notation,
      reason,
      success,
      dc,
      ability,
      timestamp: new Date().toISOString(),
    };

    // Create a human-readable summary
    let summary = `🎲 ${reason}: Rolled ${expression} = **${rollResult.total}**`;

    if (rollResult.rolls && rollResult.rolls.length > 1) {
      summary += ` (${rollResult.rolls.join(", ")})`;
    }

    if (dc) {
      summary += ` vs DC ${dc} - ${success ? "**SUCCESS**" : "**FAILURE**"}`;
    }

    return {
      success: true,
      result,
      summary,
      displayRoll: true,
    };
  } catch (error) {
    console.error("Error rolling dice:", error);
    return {
      success: false,
      error: `Failed to roll dice: ${error.message}`,
      summary: `❌ Error rolling ${expression}: ${error.message}`,
    };
  }
}

/**
 * Handle SRD rule lookups
 */
export async function handleLookupRule({ query, category }) {
  try {
    const results = await srdLookup.search(query, category);

    if (!results || results.length === 0) {
      return {
        success: false,
        error: "No rules found for that query",
        summary: `❓ No SRD rules found for "${query}"`,
      };
    }

    // Format the results
    const formattedResults = results.slice(0, 3).map((rule) => ({
      title: rule.title,
      description: rule.description,
      source: rule.source || "SRD 5.1",
    }));

    return {
      success: true,
      results: formattedResults,
      summary: `📚 Found ${results.length} rule(s) for "${query}"`,
      query,
      category,
    };
  } catch (error) {
    console.error("Error looking up rule:", error);
    return {
      success: false,
      error: `Failed to lookup rule: ${error.message}`,
      summary: `❌ Error looking up "${query}": ${error.message}`,
    };
  }
}

// ============================================================================
// STATE MANAGEMENT HANDLERS
// ============================================================================

/**
 * Handle campaign state updates
 */
export async function handleUpdateCampaignState({ campaignId, updates }) {
  try {
    const updateQueries = [];
    const logEntries = [];

    // Update campaign basic info
    if (updates.currentLocation || updates.storyProgress) {
      const campaignUpdate = { id: campaignId };

      if (updates.currentLocation) {
        campaignUpdate.current_location = JSON.stringify(
          updates.currentLocation
        );
        logEntries.push({
          type: "location_change",
          data: { location: updates.currentLocation },
          round_number: updates.storyProgress?.currentRound || null,
        });
      }

      if (updates.storyProgress) {
        if (updates.storyProgress.currentRound) {
          campaignUpdate.current_round = updates.storyProgress.currentRound;
        }
        if (updates.storyProgress.currentChapter) {
          campaignUpdate.current_chapter = updates.storyProgress.currentChapter;
        }
      }

      updateQueries.push(
        supabase.from("campaigns").update(campaignUpdate).eq("id", campaignId)
      );
    }

    // Update flags
    if (updates.flags) {
      updateQueries.push(
        supabase.from("campaign_flags").upsert(
          Object.entries(updates.flags).map(([key, value]) => ({
            campaign_id: campaignId,
            flag_name: key,
            flag_value: JSON.stringify(value),
            updated_at: new Date().toISOString(),
          }))
        )
      );

      logEntries.push({
        type: "flags_updated",
        data: { flags: updates.flags },
      });
    }

    // Update party status
    if (updates.partyStatus) {
      updateQueries.push(
        supabase.from("party_state").upsert({
          campaign_id: campaignId,
          ...updates.partyStatus,
          updated_at: new Date().toISOString(),
        })
      );

      logEntries.push({
        type: "party_status",
        data: { status: updates.partyStatus },
      });
    }

    // Execute all updates
    await Promise.all(updateQueries);

    // Log the changes
    if (logEntries.length > 0) {
      await supabase.from("campaign_logs").insert(
        logEntries.map((entry) => ({
          campaign_id: campaignId,
          log_type: entry.type,
          log_data: entry.data,
          round_number: entry.round_number || null,
          created_at: new Date().toISOString(),
        }))
      );
    }

    return {
      success: true,
      summary: `✅ Campaign state updated successfully`,
      updatedFields: Object.keys(updates),
    };
  } catch (error) {
    console.error("Error updating campaign state:", error);
    return {
      success: false,
      error: `Failed to update campaign state: ${error.message}`,
      summary: `❌ Error updating campaign state: ${error.message}`,
    };
  }
}

/**
 * Handle saving memories to campaign
 */
export async function handleSaveMemory({ campaignId, memoryType, data }) {
  try {
    // Determine the appropriate table based on memory type
    let tableName;
    let insertData = {
      campaign_id: campaignId,
      name: data.name,
      description: data.description,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    switch (memoryType) {
      case "npc":
        tableName = "campaign_entities";
        insertData.entity_type = "npc";
        insertData.attributes = {
          personality: data.personality,
          importance: data.importance,
          tags: data.tags || [],
          relationships: data.relationships || [],
        };
        break;

      case "location":
        tableName = "campaign_entities";
        insertData.entity_type = "location";
        insertData.attributes = {
          type: data.type,
          importance: data.importance,
          tags: data.tags || [],
        };
        break;

      case "quest":
        tableName = "campaign_entities";
        insertData.entity_type = "quest";
        insertData.attributes = {
          status: data.status || "active",
          importance: data.importance,
          tags: data.tags || [],
        };
        break;

      case "item":
        tableName = "campaign_entities";
        insertData.entity_type = "item";
        insertData.attributes = {
          type: data.type,
          rarity: data.rarity,
          importance: data.importance,
          tags: data.tags || [],
        };
        break;

      case "event":
        tableName = "campaign_logs";
        insertData = {
          campaign_id: campaignId,
          log_type: "important_event",
          log_data: {
            name: data.name,
            description: data.description,
            importance: data.importance,
            tags: data.tags || [],
          },
          created_at: new Date().toISOString(),
        };
        break;

      case "secret":
        tableName = "campaign_entities";
        insertData.entity_type = "secret";
        insertData.attributes = {
          revealed: false,
          importance: data.importance,
          tags: data.tags || [],
        };
        break;

      default:
        throw new Error(`Unknown memory type: ${memoryType}`);
    }

    const { data: result, error } = await supabase
      .from(tableName)
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      result,
      summary: `💾 Saved ${memoryType}: "${data.name}"`,
      memoryType,
      name: data.name,
    };
  } catch (error) {
    console.error("Error saving memory:", error);
    return {
      success: false,
      error: `Failed to save memory: ${error.message}`,
      summary: `❌ Error saving ${memoryType}: ${error.message}`,
    };
  }
}

/**
 * Handle loading memories from campaign
 */
export async function handleLoadMemory({
  campaignId,
  query,
  memoryTypes,
  limit = 5,
}) {
  try {
    const results = [];

    // Search in campaign entities
    if (
      !memoryTypes ||
      memoryTypes.some((type) =>
        ["npc", "location", "quest", "item", "secret"].includes(type)
      )
    ) {
      const entityQuery = supabase
        .from("campaign_entities")
        .select("*")
        .eq("campaign_id", campaignId)
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (memoryTypes) {
        const entityTypes = memoryTypes.filter((type) =>
          ["npc", "location", "quest", "item", "secret"].includes(type)
        );
        if (entityTypes.length > 0) {
          entityQuery.in("entity_type", entityTypes);
        }
      }

      const { data: entities } = await entityQuery;
      if (entities) {
        results.push(
          ...entities.map((entity) => ({
            type: entity.entity_type,
            name: entity.name,
            description: entity.description,
            attributes: entity.attributes,
            relevance: calculateRelevance(entity, query),
          }))
        );
      }
    }

    // Search in campaign logs for events
    if (!memoryTypes || memoryTypes.includes("event")) {
      const { data: logs } = await supabase
        .from("campaign_logs")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("log_type", "important_event")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (logs) {
        results.push(
          ...logs
            .filter(
              (log) =>
                log.log_data?.name
                  ?.toLowerCase()
                  .includes(query.toLowerCase()) ||
                log.log_data?.description
                  ?.toLowerCase()
                  .includes(query.toLowerCase())
            )
            .map((log) => ({
              type: "event",
              name: log.log_data?.name || "Event",
              description: log.log_data?.description || "",
              timestamp: log.created_at,
              relevance: calculateRelevance(log.log_data, query),
            }))
        );
      }
    }

    // Sort by relevance and limit results
    const sortedResults = results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);

    return {
      success: true,
      results: sortedResults,
      summary: `🔍 Found ${sortedResults.length} memories matching "${query}"`,
      query,
      totalFound: sortedResults.length,
    };
  } catch (error) {
    console.error("Error loading memory:", error);
    return {
      success: false,
      error: `Failed to load memory: ${error.message}`,
      summary: `❌ Error searching for "${query}": ${error.message}`,
    };
  }
}

// ============================================================================
// ENCOUNTER & NPC HANDLERS
// ============================================================================

/**
 * Handle encounter generation
 */
export async function handleGenerateEncounter({
  partyLevel,
  partySize,
  encounterType,
  difficulty,
  environment,
  theme,
}) {
  try {
    // This would typically call an encounter generation service
    // For now, we'll create a structured response that the AI can use

    const encounter = {
      type: encounterType,
      difficulty,
      environment,
      theme,
      partyLevel,
      partySize,
      description: `A ${difficulty} ${encounterType} encounter in ${environment}`,
      elements: [],
      rewards: [],
      challenges: [],
    };

    // Add type-specific elements
    switch (encounterType) {
      case "combat":
        encounter.elements = await generateCombatElements(
          partyLevel,
          partySize,
          difficulty,
          theme
        );
        break;
      case "social":
        encounter.elements = await generateSocialElements(difficulty, theme);
        break;
      case "exploration":
        encounter.elements = await generateExplorationElements(
          difficulty,
          environment
        );
        break;
      case "puzzle":
        encounter.elements = await generatePuzzleElements(difficulty, theme);
        break;
      case "trap":
        encounter.elements = await generateTrapElements(partyLevel, difficulty);
        break;
    }

    return {
      success: true,
      encounter,
      summary: `⚔️ Generated ${difficulty} ${encounterType} encounter for level ${partyLevel} party`,
      encounterType,
      difficulty,
    };
  } catch (error) {
    console.error("Error generating encounter:", error);
    return {
      success: false,
      error: `Failed to generate encounter: ${error.message}`,
      summary: `❌ Error generating ${encounterType} encounter: ${error.message}`,
    };
  }
}

/**
 * Handle NPC generation
 */
export async function handleGenerateNpc({
  role,
  importance,
  location,
  personality,
  connectionToParty,
}) {
  try {
    // Generate NPC data structure
    const npc = {
      role,
      importance,
      location,
      personality: personality || generateRandomPersonality(),
      connectionToParty,
      name: generateRandomName(),
      appearance: generateRandomAppearance(),
      motivation: generateRandomMotivation(role),
      secrets: importance === "critical" ? generateSecrets() : [],
      stats: generateBasicStats(role, importance),
    };

    return {
      success: true,
      npc,
      summary: `👤 Generated ${importance} ${role}: ${npc.name}`,
      role,
      name: npc.name,
    };
  } catch (error) {
    console.error("Error generating NPC:", error);
    return {
      success: false,
      error: `Failed to generate NPC: ${error.message}`,
      summary: `❌ Error generating ${role} NPC: ${error.message}`,
    };
  }
}

// ============================================================================
// DIRECTOR HANDLERS
// ============================================================================

/**
 * Handle campaign progress analysis
 */
export async function handleAnalyzeCampaignProgress({
  campaignId,
  analysisType,
  roundRange,
}) {
  try {
    // Fetch relevant campaign data
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    let analysis = {};

    switch (analysisType) {
      case "pacing":
        analysis = await analyzePacing(campaignId, roundRange);
        break;
      case "character_development":
        analysis = await analyzeCharacterDevelopment(campaignId, roundRange);
        break;
      case "story_beats":
        analysis = await analyzeStoryBeats(campaignId, roundRange);
        break;
      case "difficulty":
        analysis = await analyzeDifficulty(campaignId, roundRange);
        break;
      case "engagement":
        analysis = await analyzeEngagement(campaignId, roundRange);
        break;
    }

    return {
      success: true,
      analysis,
      summary: `📊 Completed ${analysisType} analysis for campaign`,
      analysisType,
      campaignId,
    };
  } catch (error) {
    console.error("Error analyzing campaign progress:", error);
    return {
      success: false,
      error: `Failed to analyze campaign: ${error.message}`,
      summary: `❌ Error analyzing ${analysisType}: ${error.message}`,
    };
  }
}

/**
 * Handle story beat planning
 */
export async function handlePlanStoryBeats({
  campaignId,
  lookAhead = 5,
  focusAreas,
  intensity,
}) {
  try {
    // Fetch current campaign state
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    const currentRound = campaign.current_round || 1;
    const storyBeats = [];

    // Generate story beats for the next rounds
    for (let i = 1; i <= lookAhead; i++) {
      const roundNumber = currentRound + i;
      const beat = await generateStoryBeat(
        campaignId,
        roundNumber,
        focusAreas,
        intensity,
        i === 1 // isNext
      );
      storyBeats.push(beat);
    }

    // Save the planned beats
    await supabase.from("plot_beats").upsert(
      storyBeats.map((beat) => ({
        campaign_id: campaignId,
        round_number: beat.roundNumber,
        beat_type: beat.type,
        description: beat.description,
        priority: beat.priority,
        prerequisites: beat.prerequisites || [],
        planned_at: new Date().toISOString(),
      }))
    );

    return {
      success: true,
      storyBeats,
      summary: `📖 Planned ${storyBeats.length} story beats for rounds ${
        currentRound + 1
      }-${currentRound + lookAhead}`,
      lookAhead,
      startRound: currentRound + 1,
    };
  } catch (error) {
    console.error("Error planning story beats:", error);
    return {
      success: false,
      error: `Failed to plan story beats: ${error.message}`,
      summary: `❌ Error planning story beats: ${error.message}`,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateRelevance(item, query) {
  const queryLower = query.toLowerCase();
  let score = 0;

  if (item.name?.toLowerCase().includes(queryLower)) score += 10;
  if (item.description?.toLowerCase().includes(queryLower)) score += 5;
  if (
    item.attributes?.tags?.some((tag) => tag.toLowerCase().includes(queryLower))
  )
    score += 3;

  return score;
}

// Placeholder functions for encounter generation
async function generateCombatElements(
  partyLevel,
  partySize,
  difficulty,
  theme
) {
  return [
    {
      type: "monsters",
      description: `Combat encounter appropriate for level ${partyLevel} party of ${partySize}`,
      challenge: `${difficulty} difficulty with ${theme} theme`,
    },
  ];
}

async function generateSocialElements(difficulty, theme) {
  return [
    {
      type: "social_challenge",
      description: `Social encounter with ${difficulty} complexity`,
      theme,
    },
  ];
}

async function generateExplorationElements(difficulty, environment) {
  return [
    {
      type: "exploration_challenge",
      description: `Exploration challenge in ${environment}`,
      difficulty,
    },
  ];
}

async function generatePuzzleElements(difficulty, theme) {
  return [
    {
      type: "puzzle",
      description: `${difficulty} puzzle with ${theme} theme`,
    },
  ];
}

async function generateTrapElements(partyLevel, difficulty) {
  return [
    {
      type: "trap",
      description: `${difficulty} trap for level ${partyLevel} party`,
    },
  ];
}

// Placeholder functions for NPC generation
function generateRandomPersonality() {
  const personalities = [
    "cheerful and optimistic",
    "gruff but kind-hearted",
    "nervous and twitchy",
    "wise and patient",
    "ambitious and cunning",
    "mysterious and aloof",
  ];
  return personalities[Math.floor(Math.random() * personalities.length)];
}

function generateRandomName() {
  const names = [
    "Aelindra",
    "Bram",
    "Celia",
    "Dorian",
    "Evelyn",
    "Finn",
    "Gwen",
    "Hector",
    "Iris",
    "Jace",
    "Kira",
    "Liam",
  ];
  return names[Math.floor(Math.random() * names.length)];
}

function generateRandomAppearance() {
  return "A person of average height with distinctive features";
}

function generateRandomMotivation(role) {
  const motivations = {
    shopkeeper: "Making a profit and serving customers well",
    guard: "Protecting the community from threats",
    noble: "Maintaining power and influence",
    commoner: "Living a peaceful life with family",
    villain: "Achieving their dark goals",
    ally: "Helping the party succeed",
    neutral: "Pursuing personal interests",
    quest_giver: "Solving a pressing problem",
  };
  return motivations[role] || "Following their own agenda";
}

function generateSecrets() {
  return ["Has a hidden connection to the main plot"];
}

function generateBasicStats(role, importance) {
  const baseStats = {
    minor: { ac: 10, hp: 5, cr: 0 },
    moderate: { ac: 12, hp: 15, cr: 0.25 },
    major: { ac: 14, hp: 30, cr: 0.5 },
    critical: { ac: 16, hp: 50, cr: 1 },
  };
  return baseStats[importance] || baseStats.minor;
}

// Placeholder analysis functions
async function analyzePacing(campaignId, roundRange) {
  return {
    type: "pacing",
    assessment: "moderate",
    recommendations: [
      "Consider adding more action sequences",
      "Balance roleplay with exploration",
    ],
  };
}

async function analyzeCharacterDevelopment(campaignId, roundRange) {
  return {
    type: "character_development",
    assessment: "good",
    recommendations: [
      "Focus on character backstories",
      "Create personal stakes",
    ],
  };
}

async function analyzeStoryBeats(campaignId, roundRange) {
  return {
    type: "story_beats",
    assessment: "on_track",
    recommendations: [
      "Continue current narrative arc",
      "Prepare climax elements",
    ],
  };
}

async function analyzeDifficulty(campaignId, roundRange) {
  return {
    type: "difficulty",
    assessment: "appropriate",
    recommendations: [
      "Maintain current challenge level",
      "Add optional harder encounters",
    ],
  };
}

async function analyzeEngagement(campaignId, roundRange) {
  return {
    type: "engagement",
    assessment: "high",
    recommendations: [
      "Continue current approach",
      "Introduce surprise elements",
    ],
  };
}

async function generateStoryBeat(
  campaignId,
  roundNumber,
  focusAreas,
  intensity,
  isNext
) {
  return {
    roundNumber,
    type: focusAreas?.[0] || "main_plot",
    description: `Story beat for round ${roundNumber}`,
    priority: isNext ? "high" : "medium",
    intensity: intensity || "building",
    prerequisites: [],
  };
}
