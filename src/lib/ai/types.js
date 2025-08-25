// Types for AI DM Storytelling feature
import { z } from "zod";

/**
 * Roll directive schema - when AI suggests a player should roll dice
 */
export const RollDirectiveSchema = z.object({
  requiresRoll: z.boolean(),
  rollType: z.enum(["d20", "damage", "custom"]).default("d20"),
  ability: z
    .enum(["STR", "DEX", "CON", "INT", "WIS", "CHA"])
    .nullable()
    .optional(),
  dc: z.number().min(1).max(30).nullable().optional(),
  reason: z.string().min(1).max(200).optional(), // Make reason optional since AI might not always provide it
});

/**
 * Narration result schema - AI response with optional roll directive
 */
export const NarrationResultSchema = z.object({
  message: z.string().min(1),
  directive: RollDirectiveSchema.nullable().optional(),
});

/**
 * AI narration request schema
 */
export const NarrationRequestSchema = z.object({
  campaignId: z.string().uuid(),
  userMessage: z.string().min(1).max(1000),
});

// TypeScript types (for JSDoc comments)
/**
 * @typedef {Object} RollDirective
 * @property {boolean} requiresRoll
 * @property {"d20"|"damage"|"custom"} rollType
 * @property {"STR"|"DEX"|"CON"|"INT"|"WIS"|"CHA"|null} [ability]
 * @property {number|null} [dc]
 * @property {string} reason
 */

/**
 * @typedef {Object} NarrationResult
 * @property {string} message
 * @property {RollDirective|null} [directive]
 */

/**
 * @typedef {Object} NarrationRequest
 * @property {string} campaignId
 * @property {string} userMessage
 */

export default {
  RollDirectiveSchema,
  NarrationResultSchema,
  NarrationRequestSchema,
};
