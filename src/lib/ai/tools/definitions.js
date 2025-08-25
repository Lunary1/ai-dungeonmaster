/**
 * OpenAI Function Call Tool Definitions for Two-Tier AI System
 *
 * This module defines all the tools/functions that the DIRECTOR and DM AI agents
 * can call to interact with the game state, dice system, rules, and encounters.
 */

// ============================================================================
// DICE & RULES TOOLS - Core D&D 5e mechanics
// ============================================================================

export const rollDiceFunction = {
  name: "roll_dice",
  description:
    "Roll dice using standard D&D notation (e.g., '1d20+5', '2d6', '1d20adv'). Handles advantage/disadvantage and modifiers.",
  parameters: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description:
          "Dice expression like '1d20+5', '2d6', '3d8+2', '1d20adv' (advantage), '1d20dis' (disadvantage)",
        pattern: "^\\d*d\\d+(adv|dis)?([+-]\\d+)?$",
      },
      reason: {
        type: "string",
        description:
          "Why this roll is being made (e.g., 'Perception check', 'Sword damage', 'Initiative')",
      },
      dc: {
        type: "number",
        description: "Difficulty Class for checks (5-30)",
        minimum: 5,
        maximum: 30,
      },
      ability: {
        type: "string",
        enum: ["STR", "DEX", "CON", "INT", "WIS", "CHA"],
        description: "Ability score being tested (for ability checks/saves)",
      },
    },
    required: ["expression", "reason"],
  },
};

export const lookupRuleFunction = {
  name: "lookup_rule",
  description: "Look up D&D 5e SRD rules, spells, conditions, or mechanics",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Rule, spell, condition, or mechanic to look up (e.g., 'grappling', 'fireball', 'poisoned condition')",
      },
      category: {
        type: "string",
        enum: [
          "combat",
          "spells",
          "conditions",
          "abilities",
          "equipment",
          "general",
        ],
        description: "Category of rule to search",
      },
    },
    required: ["query"],
  },
};

// ============================================================================
// STATE MANAGEMENT TOOLS - Campaign and party state
// ============================================================================

export const updateCampaignStateFunction = {
  name: "update_campaign_state",
  description:
    "Update campaign state including location, story progress, flags, and party status",
  parameters: {
    type: "object",
    properties: {
      campaignId: {
        type: "string",
        format: "uuid",
        description: "Campaign ID",
      },
      updates: {
        type: "object",
        properties: {
          currentLocation: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              type: {
                type: "string",
                enum: ["town", "dungeon", "wilderness", "building", "plane"],
              },
            },
          },
          storyProgress: {
            type: "object",
            properties: {
              currentRound: { type: "integer", minimum: 1, maximum: 200 },
              currentChapter: { type: "integer", minimum: 1, maximum: 10 },
              milestones: { type: "array", items: { type: "string" } },
            },
          },
          flags: {
            type: "object",
            additionalProperties: true,
            description: "Campaign flags and variables",
          },
          partyStatus: {
            type: "object",
            properties: {
              health: {
                type: "string",
                enum: ["healthy", "injured", "critical", "resting"],
              },
              resources: {
                type: "string",
                enum: ["full", "moderate", "low", "depleted"],
              },
              morale: {
                type: "string",
                enum: ["high", "good", "neutral", "low", "broken"],
              },
            },
          },
        },
      },
    },
    required: ["campaignId", "updates"],
  },
};

export const saveMemoryFunction = {
  name: "save_memory",
  description: "Save important events, NPCs, or discoveries to campaign memory",
  parameters: {
    type: "object",
    properties: {
      campaignId: {
        type: "string",
        format: "uuid",
        description: "Campaign ID",
      },
      memoryType: {
        type: "string",
        enum: ["event", "npc", "location", "quest", "item", "secret"],
        description: "Type of memory being saved",
      },
      data: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          importance: { type: "integer", minimum: 1, maximum: 5 },
          tags: { type: "array", items: { type: "string" } },
          relationships: { type: "array", items: { type: "string" } },
        },
        required: ["name", "description"],
      },
    },
    required: ["campaignId", "memoryType", "data"],
  },
};

export const loadMemoryFunction = {
  name: "load_memory",
  description: "Load relevant campaign memories, NPCs, or story elements",
  parameters: {
    type: "object",
    properties: {
      campaignId: {
        type: "string",
        format: "uuid",
        description: "Campaign ID",
      },
      query: {
        type: "string",
        description:
          "What to search for in memory (e.g., 'tavern keeper', 'goblin cave', 'stolen artifact')",
      },
      memoryTypes: {
        type: "array",
        items: {
          type: "string",
          enum: ["event", "npc", "location", "quest", "item", "secret"],
        },
        description: "Types of memories to search",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 10,
        default: 5,
        description: "Maximum number of memories to return",
      },
    },
    required: ["campaignId", "query"],
  },
};

// ============================================================================
// ENCOUNTER & NPC TOOLS - Dynamic content generation
// ============================================================================

export const generateEncounterFunction = {
  name: "generate_encounter",
  description:
    "Generate a balanced encounter appropriate for the party level and situation",
  parameters: {
    type: "object",
    properties: {
      partyLevel: {
        type: "integer",
        minimum: 1,
        maximum: 20,
        description: "Average party level",
      },
      partySize: {
        type: "integer",
        minimum: 1,
        maximum: 8,
        description: "Number of party members",
      },
      encounterType: {
        type: "string",
        enum: ["combat", "social", "exploration", "puzzle", "trap"],
        description: "Type of encounter to generate",
      },
      difficulty: {
        type: "string",
        enum: ["trivial", "easy", "medium", "hard", "deadly"],
        description: "Encounter difficulty",
      },
      environment: {
        type: "string",
        description:
          "Location/environment for the encounter (e.g., 'forest clearing', 'tavern', 'dungeon corridor')",
      },
      theme: {
        type: "string",
        description:
          "Thematic elements or constraints (e.g., 'undead', 'political intrigue', 'nature spirits')",
      },
    },
    required: [
      "partyLevel",
      "partySize",
      "encounterType",
      "difficulty",
      "environment",
    ],
  },
};

export const generateNpcFunction = {
  name: "generate_npc",
  description: "Generate an NPC with personality, goals, and story hooks",
  parameters: {
    type: "object",
    properties: {
      role: {
        type: "string",
        enum: [
          "shopkeeper",
          "guard",
          "noble",
          "commoner",
          "villain",
          "ally",
          "neutral",
          "quest_giver",
        ],
        description: "NPC's role in the story",
      },
      importance: {
        type: "string",
        enum: ["minor", "moderate", "major", "critical"],
        description: "How important this NPC is to the campaign",
      },
      location: {
        type: "string",
        description: "Where this NPC is found or based",
      },
      personality: {
        type: "string",
        description:
          "Personality traits or archetype (e.g., 'gruff but kind', 'ambitious schemer', 'nervous scholar')",
      },
      connectionToParty: {
        type: "string",
        description: "How this NPC relates to the party or current situation",
      },
    },
    required: ["role", "importance"],
  },
};

// ============================================================================
// DIRECTOR TOOLS - High-level campaign management
// ============================================================================

export const analyzeCampaignProgressFunction = {
  name: "analyze_campaign_progress",
  description:
    "Analyze current campaign state and provide strategic direction for the DM",
  parameters: {
    type: "object",
    properties: {
      campaignId: {
        type: "string",
        format: "uuid",
        description: "Campaign ID",
      },
      analysisType: {
        type: "string",
        enum: [
          "pacing",
          "character_development",
          "story_beats",
          "difficulty",
          "engagement",
        ],
        description: "Type of analysis to perform",
      },
      roundRange: {
        type: "object",
        properties: {
          start: { type: "integer", minimum: 1 },
          end: { type: "integer", minimum: 1 },
        },
        description: "Range of rounds to analyze",
      },
    },
    required: ["campaignId", "analysisType"],
  },
};

export const planStoryBeatsFunction = {
  name: "plan_story_beats",
  description: "Plan upcoming story beats and plot points for the campaign",
  parameters: {
    type: "object",
    properties: {
      campaignId: {
        type: "string",
        format: "uuid",
        description: "Campaign ID",
      },
      lookAhead: {
        type: "integer",
        minimum: 1,
        maximum: 20,
        default: 5,
        description: "How many rounds ahead to plan",
      },
      focusAreas: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "character_development",
            "main_plot",
            "side_quests",
            "world_building",
            "combat",
            "roleplay",
          ],
        },
        description: "Areas to focus story beats on",
      },
      intensity: {
        type: "string",
        enum: ["low", "building", "climactic", "resolution"],
        description: "Desired intensity level for upcoming beats",
      },
    },
    required: ["campaignId"],
  },
};

// ============================================================================
// TOOL COLLECTIONS - Organized by AI tier
// ============================================================================

export const DM_TOOLS = [
  rollDiceFunction,
  lookupRuleFunction,
  updateCampaignStateFunction,
  saveMemoryFunction,
  loadMemoryFunction,
  generateEncounterFunction,
  generateNpcFunction,
];

export const DIRECTOR_TOOLS = [
  analyzeCampaignProgressFunction,
  planStoryBeatsFunction,
  loadMemoryFunction,
  updateCampaignStateFunction,
];

export const ALL_TOOLS = [...DM_TOOLS, ...DIRECTOR_TOOLS];

/**
 * Get tools by AI role
 * @param {string} role - 'DM' or 'DIRECTOR'
 * @returns {Array} Array of tool definitions
 */
export function getToolsByRole(role) {
  switch (role.toUpperCase()) {
    case "DM":
      return DM_TOOLS;
    case "DIRECTOR":
      return DIRECTOR_TOOLS;
    default:
      return [];
  }
}

/**
 * Get tool definition by name
 * @param {string} toolName - Name of the tool
 * @returns {Object|null} Tool definition or null if not found
 */
export function getToolByName(toolName) {
  return ALL_TOOLS.find((tool) => tool.name === toolName) || null;
}
