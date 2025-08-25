// Hybrid Linear Campaign Types and Utilities
import { z } from "zod";

// Roll directive schema (reuse existing)
export const RollDirectiveSchema = z.object({
  requiresRoll: z.boolean(),
  rollType: z.string(),
  ability: z.enum(["STR", "DEX", "CON", "INT", "WIS", "CHA"]).optional(),
  skill: z.string().optional(),
  dc: z.number().optional(),
  reason: z.string(),
});

// Round advancement result
export const AdvanceRoundResultSchema = z.object({
  round: z.number(),
  chapter: z.number(),
  autosummary: z.string().optional(),
  chapterSummary: z.string().optional(),
  isComplete: z.boolean().default(false),
});

// NPC talk session state
export const NpcTalkSessionSchema = z.object({
  npcId: z.string(),
  npcName: z.string(),
  isOpen: z.boolean(),
  playersCanChat: z.boolean(),
  openedBy: z.string(), // DM user ID
  openedAt: z.string(),
});

// Campaign config schema
export const CampaignConfigSchema = z.object({
  mode: z.enum(["HYBRID_LINEAR", "FREEFORM"]).default("HYBRID_LINEAR"),
  target_rounds: z.number().min(1).max(1000).default(200),
  rounds_per_chapter: z.number().min(1).max(100).default(40),
  allow_player_npc_chat: z.boolean().default(true),
  config_data: z.record(z.any()).default({}),
});

// Character state snapshot
export const CharacterStateSchema = z.object({
  character_id: z.string(),
  round: z.number(),
  hp_current: z.number().optional(),
  xp: z.number().optional(),
  inventory_json: z.record(z.any()).default({}),
  notes: z.string().optional(),
});

// Encounter state
export const EncounterStateSchema = z.object({
  name: z.string(),
  state_json: z.record(z.any()).default({}),
  is_active: z.boolean().default(false),
});

// Helper functions for linear campaign logic

/**
 * Calculate chapter from round number
 */
export function calculateChapter(round, roundsPerChapter = 40) {
  return Math.ceil(round / roundsPerChapter);
}

/**
 * Check if round is a chapter boundary
 */
export function isChapterBoundary(round, roundsPerChapter = 40) {
  return round % roundsPerChapter === 0;
}

/**
 * Check if campaign is complete
 */
export function isCampaignComplete(round, targetRounds = 200) {
  return round >= targetRounds;
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(round, targetRounds = 200) {
  return Math.min(100, (round / targetRounds) * 100);
}

/**
 * Get ability modifier from ability score (D&D 5e)
 */
export function getAbilityModifier(abilityScore) {
  return Math.floor((abilityScore - 10) / 2);
}

/**
 * Calculate proficiency bonus by level (D&D 5e)
 */
export function getProficiencyBonus(level) {
  return Math.ceil(level / 4) + 1;
}

/**
 * Format round display (e.g., "Round 42 • Chapter 2")
 */
export function formatRoundDisplay(round, chapter) {
  return `Round ${round} • Chapter ${chapter}`;
}

/**
 * Get next chapter boundary
 */
export function getNextChapterBoundary(round, roundsPerChapter = 40) {
  const chapter = calculateChapter(round, roundsPerChapter);
  return chapter * roundsPerChapter;
}

/**
 * Check if summarization should trigger
 */
export function shouldTriggerSummary(messageCount, summaryInterval = 10) {
  return messageCount > 0 && messageCount % summaryInterval === 0;
}

// Type definitions for TypeScript-like intellisense
/**
 * @typedef {Object} RollDirective
 * @property {boolean} requiresRoll
 * @property {string} rollType
 * @property {string} [ability]
 * @property {string} [skill]
 * @property {number} [dc]
 * @property {string} reason
 */

/**
 * @typedef {Object} AdvanceRoundResult
 * @property {number} round
 * @property {number} chapter
 * @property {string} [autosummary]
 * @property {string} [chapterSummary]
 * @property {boolean} isComplete
 */

/**
 * @typedef {Object} NpcTalkSession
 * @property {string} npcId
 * @property {string} npcName
 * @property {boolean} isOpen
 * @property {boolean} playersCanChat
 * @property {string} openedBy
 * @property {string} openedAt
 */

/**
 * @typedef {Object} CampaignConfig
 * @property {string} mode
 * @property {number} target_rounds
 * @property {number} rounds_per_chapter
 * @property {boolean} allow_player_npc_chat
 * @property {Object} config_data
 */
