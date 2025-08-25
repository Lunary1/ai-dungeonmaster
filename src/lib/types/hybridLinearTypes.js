// Phase 1: Hybrid Linear Campaign Types
// TypeScript-style interfaces and Zod schemas for the two-tier AI system

import { z } from "zod";

// ========================================
// CORE CAMPAIGN TYPES
// ========================================

/**
 * Extended Campaign with round/chapter tracking
 */
const CampaignSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  dm_id: z.string().uuid(),
  owner_id: z.string().uuid(),
  current_round: z.number().min(1).default(1),
  current_chapter: z.number().min(1).default(1),
  current_act: z.number().min(1).max(3).default(1),
  target_rounds: z.number().min(1).max(1000).default(200),
  invite_code: z.string(),
  is_active: z.boolean().default(true),
  created_at: z.string(),
  updated_at: z.string(),
});

/**
 * Story Bible for world building and AI context
 */
const StoryBibleSchema = z.object({
  campaign_id: z.string().uuid(),
  world: z
    .object({
      setting: z.string().optional(),
      history: z.string().optional(),
      major_locations: z.array(z.string()).default([]),
    })
    .default({}),
  factions: z
    .array(
      z.object({
        name: z.string(),
        goals: z.string(),
        power_level: z.enum(["weak", "moderate", "strong", "dominant"]),
        relations: z.record(z.string()).default({}), // faction_name -> relationship
      })
    )
    .default([]),
  locations: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        connections: z.array(z.string()).default([]),
        secrets: z.array(z.string()).default([]),
      })
    )
    .default([]),
  themes: z.array(z.string()).default([]), // ["heroism", "political_intrigue"]
  banned_content: z.array(z.string()).default([]), // safety restrictions
  tone: z.enum(["heroic", "gritty", "dark", "comedic"]).default("heroic"),
  created_at: z.string(),
  updated_at: z.string(),
});

/**
 * Plot Beat for act/chapter structure
 */
const PlotBeatSchema = z.object({
  id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  act: z.number().min(1).max(3),
  chapter: z.number().min(1),
  beat_no: z.number().min(1),
  description: z.string().min(1),
  success_branch: z.string().optional(),
  fail_branch: z.string().optional(),
  stakes: z.string().optional(),
  reveal_flags: z.array(z.string()).default([]),
  is_completed: z.boolean().default(false),
  created_at: z.string(),
});

/**
 * Entity (NPC, Monster, Item, Location)
 */
const EntitySchema = z.object({
  entity_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  type: z.enum(["npc", "monster", "item", "location"]),
  name: z.string().min(1),
  sheet_json: z.record(z.any()).default({}), // stats, abilities, description
  ai_persona_prompt: z.string().optional(), // for NPCs
  last_seen_round: z.number().optional(),
  is_active: z.boolean().default(true),
  created_at: z.string(),
  updated_at: z.string(),
});

/**
 * Party member state
 */
const PartyMemberSchema = z.object({
  id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  player_id: z.string().uuid(),
  character_sheet: z.record(z.any()).default({}),
  bonds: z.array(z.string()).default([]),
  goals: z.array(z.string()).default([]),
  inventory: z.record(z.any()).default({}),
  created_at: z.string(),
  updated_at: z.string(),
});

/**
 * Rules cache entry
 */
export const RulesCacheSchema = z.object({
  id: z.string().uuid(),
  topic: z.string().min(1),
  ruling: z.string().min(1),
  ref: z.string().optional(),
  updated_at: z.string(),
});

/**
 * Round ledger entry (enhanced campaign_logs)
 */
export const LedgerEntrySchema = z.object({
  id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  round_no: z.number().min(1),
  user_input: z.string(),
  ai_output: z.string(),
  input_type: z
    .enum([
      "message",
      "dice_roll",
      "skill_check",
      "action",
      "ai_narration",
      "player_request",
      "npc_talk",
      "round_advance",
      "state_update",
    ])
    .default("message"),
  metadata: z.record(z.any()).default({}),
  recap: z.string().optional(), // 3-5 sentence summary
  dm_output: z.record(z.any()).default({}), // structured DM response
  dice_rolls: z.array(z.record(z.any())).default([]),
  rulings: z.array(z.record(z.any())).default([]),
  diffs: z.record(z.any()).default({}), // state changes
  timestamp: z.string(),
  created_at: z.string(),
});

/**
 * Campaign flag
 */
export const FlagSchema = z.object({
  id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  key: z.string().min(1),
  value: z.any().default(true), // boolean, number, string, or object
  created_at: z.string(),
  updated_at: z.string(),
});

/**
 * Milestone summary (every 25 rounds)
 */
export const MilestoneSchema = z.object({
  id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  round_to: z.number().min(1), // 25, 50, 75, etc.
  summary: z.string().min(1), // 250-400 words for Director
  created_at: z.string(),
});

// ========================================
// AI SYSTEM TYPES
// ========================================

/**
 * Director Planning Output (every ~8 rounds)
 */
export const DirectorOutputSchema = z.object({
  chapter_title: z.string(),
  goal: z.string(),
  stakes: z.string(),
  obstacles: z.array(
    z.object({
      name: z.string(),
      approaches: z.array(z.string()),
      fail_forward: z.string(), // what happens if players fail this obstacle
    })
  ),
  twists: z.array(z.string()),
  npc_agendas: z.array(
    z.object({
      npc_id: z.string(),
      moves: z.array(z.string()),
    })
  ),
  side_thread: z.string().optional(),
  beat_budget: z.number().min(1), // rounds allocated for this chapter
  signals_replan: z.array(z.string()).default([]), // conditions that trigger replanning
});

/**
 * DM Round Output (every round)
 */
export const DmOutputSchema = z.object({
  narration: z.string().max(220), // concise narration
  skill_calls: z
    .array(
      z.object({
        pc: z.string(),
        check: z.string(),
        dc: z.number(),
        reason: z.string(),
      })
    )
    .default([]),
  combat: z
    .object({
      initiative_order: z.array(z.string()),
      round_summary: z.string(),
    })
    .optional(),
  loot_or_costs: z
    .array(
      z.object({
        type: z.enum(["gain", "loss"]),
        item: z.string(),
        quantity: z.number().default(1),
      })
    )
    .default([]),
  flags_updates: z
    .array(
      z.object({
        key: z.string(),
        value: z.any(),
      })
    )
    .default([]),
  signals: z.object({
    replan: z.boolean().default(false),
    end_chapter: z.boolean().default(false),
  }),
  prompt_to_players: z.string(),
});

/**
 * Tool Call Types (for OpenAI function calls)
 */
export const ToolCallSchema = z.object({
  name: z.enum([
    "rollDice",
    "lookupRule",
    "spawnEncounter",
    "updateState",
    "knowledge",
  ]),
  parameters: z.record(z.any()),
});

/**
 * Roll Dice Tool Parameters
 */
export const RollDiceParamsSchema = z.object({
  formula: z.string(), // "2d20kh1+5", "1d8+2"
  purpose: z.string(), // "stealth check", "damage roll"
});

/**
 * Lookup Rule Tool Parameters
 */
export const LookupRuleParamsSchema = z.object({
  topic: z.string(), // "stealth", "grappling", "spell_attack_bonus"
});

/**
 * Spawn Encounter Tool Parameters
 */
export const SpawnEncounterParamsSchema = z.object({
  table: z.string(), // "forest", "dungeon", "city"
  level: z.number().min(1).max(20),
  context: z.record(z.any()).optional(),
});

/**
 * Update State Tool Parameters
 */
export const UpdateStateParamsSchema = z.object({
  campaignId: z.string().uuid(),
  diffs: z.record(z.any()), // changes to apply
});

/**
 * Knowledge Tool Parameters
 */
export const KnowledgeParamsSchema = z.object({
  campaignId: z.string().uuid(),
  query: z.string(),
  scope: z.array(z.string()), // ["story_bible", "entities", "flags", "recent_events"]
});

// ========================================
// UTILITY TYPES
// ========================================

/**
 * Round Context (minimal context for DM)
 */
export const RoundContextSchema = z.object({
  campaign: CampaignSchema,
  recent_recaps: z.array(z.string()).max(4), // last 4 round summaries
  current_chapter_plan: DirectorOutputSchema.optional(),
  local_entities: z.array(EntitySchema).max(10), // nearby NPCs/monsters/items
  party_snapshot: z.array(PartyMemberSchema),
  relevant_rules: z.array(RulesCacheSchema).max(20),
  active_flags: z.array(FlagSchema),
  safety_tone: z.object({
    tone: z.string(),
    banned_content: z.array(z.string()),
  }),
});

/**
 * Director Context (for macro planning)
 */
export const DirectorContextSchema = z.object({
  campaign: CampaignSchema,
  story_bible: StoryBibleSchema,
  milestones: z.array(MilestoneSchema).max(8), // last 8 milestone summaries
  recent_round_summaries: z.array(z.string()).max(8), // last 8 round recaps
  completed_plot_beats: z.array(PlotBeatSchema),
  current_flags: z.array(FlagSchema),
  party_progression: z.array(PartyMemberSchema),
});

// ========================================
// JSDoc TYPE DEFINITIONS
// ========================================

/**
 * @typedef {Object} Campaign
 * @property {string} id
 * @property {string} name
 * @property {string} [description]
 * @property {string} dm_id
 * @property {string} owner_id
 * @property {number} current_round
 * @property {number} current_chapter
 * @property {number} current_act
 * @property {number} target_rounds
 * @property {string} invite_code
 * @property {boolean} is_active
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} StoryBible
 * @property {string} campaign_id
 * @property {Object} world
 * @property {Array} factions
 * @property {Array} locations
 * @property {string[]} themes
 * @property {string[]} banned_content
 * @property {string} tone
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} PlotBeat
 * @property {string} id
 * @property {string} campaign_id
 * @property {number} act
 * @property {number} chapter
 * @property {number} beat_no
 * @property {string} description
 * @property {string} [success_branch]
 * @property {string} [fail_branch]
 * @property {string} [stakes]
 * @property {string[]} reveal_flags
 * @property {boolean} is_completed
 * @property {string} created_at
 */

/**
 * @typedef {Object} Entity
 * @property {string} entity_id
 * @property {string} campaign_id
 * @property {"npc"|"monster"|"item"|"location"} type
 * @property {string} name
 * @property {Object} sheet_json
 * @property {string} [ai_persona_prompt]
 * @property {number} [last_seen_round]
 * @property {boolean} is_active
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} DirectorOutput
 * @property {string} chapter_title
 * @property {string} goal
 * @property {string} stakes
 * @property {Array} obstacles
 * @property {string[]} twists
 * @property {Array} npc_agendas
 * @property {string} [side_thread]
 * @property {number} beat_budget
 * @property {string[]} signals_replan
 */

/**
 * @typedef {Object} DmOutput
 * @property {string} narration
 * @property {Array} skill_calls
 * @property {Object} [combat]
 * @property {Array} loot_or_costs
 * @property {Array} flags_updates
 * @property {Object} signals
 * @property {string} prompt_to_players
 */

// ========================================
// EXPORTS
// ========================================

export {
  // Core schemas
  CampaignSchema,
  StoryBibleSchema,
  PlotBeatSchema,
  EntitySchema,
  PartyMemberSchema,
  RulesCacheSchema,
  LedgerEntrySchema,
  FlagSchema,
  MilestoneSchema,

  // AI schemas
  DirectorOutputSchema,
  DmOutputSchema,
  ToolCallSchema,

  // Tool parameter schemas
  RollDiceParamsSchema,
  LookupRuleParamsSchema,
  SpawnEncounterParamsSchema,
  UpdateStateParamsSchema,
  KnowledgeParamsSchema,

  // Context schemas
  RoundContextSchema,
  DirectorContextSchema,
};

// Re-export existing types for compatibility
export {
  RollDirectiveSchema,
  NarrationResultSchema,
  NarrationRequestSchema,
} from "./ai/types.js";

export {
  calculateChapter,
  isChapterBoundary,
  isCampaignComplete,
  calculateProgress,
  getAbilityModifier,
  getProficiencyBonus,
  formatRoundDisplay,
  getNextChapterBoundary,
  shouldTriggerSummary,
} from "./hybridLinearTypes.js";
