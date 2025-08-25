// Phase 1: Database Service Layer for Hybrid Linear Campaigns
// Provides type-safe database operations for the two-tier AI system

import { supabase } from "../supabase.js";
import {
  CampaignSchema,
  StoryBibleSchema,
  PlotBeatSchema,
  EntitySchema,
  PartyMemberSchema,
  RulesCacheSchema,
  LedgerEntrySchema,
  FlagSchema,
  MilestoneSchema,
} from "../types/coreSchemas.js";

/**
 * Database service for hybrid linear campaigns
 */
class HybridCampaignDB {
  // ========================================
  // CAMPAIGN OPERATIONS
  // ========================================

  /**
   * Get campaign with round/chapter tracking
   * @param {string} campaignId
   * @returns {Promise<Object>}
   */
  async getCampaign(campaignId) {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (error) throw error;
    return CampaignSchema.parse(data);
  }

  /**
   * Update campaign progress
   * @param {string} campaignId
   * @param {Object} updates - {current_round?, current_chapter?, current_act?}
   * @returns {Promise<Object>}
   */
  async updateCampaignProgress(campaignId, updates) {
    const { data, error } = await supabase
      .from("campaigns")
      .update(updates)
      .eq("id", campaignId)
      .select()
      .single();

    if (error) throw error;
    return CampaignSchema.parse(data);
  }

  // ========================================
  // STORY BIBLE OPERATIONS
  // ========================================

  /**
   * Get or create story bible for campaign
   * @param {string} campaignId
   * @returns {Promise<Object>}
   */
  async getStoryBible(campaignId) {
    let { data, error } = await supabase
      .from("story_bible")
      .select("*")
      .eq("campaign_id", campaignId)
      .single();

    if (error && error.code === "PGRST116") {
      // Create default story bible
      const defaultBible = {
        campaign_id: campaignId,
        world: {},
        factions: [],
        locations: [],
        themes: ["heroism"],
        banned_content: [],
        tone: "heroic",
      };

      const { data: created, error: createError } = await supabase
        .from("story_bible")
        .insert(defaultBible)
        .select()
        .single();

      if (createError) throw createError;
      data = created;
    } else if (error) {
      throw error;
    }

    return StoryBibleSchema.parse(data);
  }

  /**
   * Update story bible
   * @param {string} campaignId
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async updateStoryBible(campaignId, updates) {
    const { data, error } = await supabase
      .from("story_bible")
      .update(updates)
      .eq("campaign_id", campaignId)
      .select()
      .single();

    if (error) throw error;
    return StoryBibleSchema.parse(data);
  }

  // ========================================
  // PLOT BEATS OPERATIONS
  // ========================================

  /**
   * Get plot beats for act/chapter
   * @param {string} campaignId
   * @param {number} [act]
   * @param {number} [chapter]
   * @returns {Promise<Array>}
   */
  async getPlotBeats(campaignId, act = null, chapter = null) {
    let query = supabase
      .from("plot_beats")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("act", { ascending: true })
      .order("chapter", { ascending: true })
      .order("beat_no", { ascending: true });

    if (act !== null) query = query.eq("act", act);
    if (chapter !== null) query = query.eq("chapter", chapter);

    const { data, error } = await query;
    if (error) throw error;

    return data.map((beat) => PlotBeatSchema.parse(beat));
  }

  /**
   * Create plot beat
   * @param {Object} beatData
   * @returns {Promise<Object>}
   */
  async createPlotBeat(beatData) {
    const { data, error } = await supabase
      .from("plot_beats")
      .insert(beatData)
      .select()
      .single();

    if (error) throw error;
    return PlotBeatSchema.parse(data);
  }

  /**
   * Complete plot beat
   * @param {string} beatId
   * @returns {Promise<Object>}
   */
  async completePlotBeat(beatId) {
    const { data, error } = await supabase
      .from("plot_beats")
      .update({ is_completed: true })
      .eq("id", beatId)
      .select()
      .single();

    if (error) throw error;
    return PlotBeatSchema.parse(data);
  }

  // ========================================
  // ENTITIES OPERATIONS
  // ========================================

  /**
   * Get entities by type and activity
   * @param {string} campaignId
   * @param {string} [type] - "npc", "monster", "item", "location"
   * @param {boolean} [activeOnly=true]
   * @param {number} [limit=50]
   * @returns {Promise<Array>}
   */
  async getEntities(campaignId, type = null, activeOnly = true, limit = 50) {
    let query = supabase
      .from("entities")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("last_seen_round", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (type) query = query.eq("type", type);
    if (activeOnly) query = query.eq("is_active", true);

    const { data, error } = await query;
    if (error) throw error;

    return data.map((entity) => EntitySchema.parse(entity));
  }

  /**
   * Create entity
   * @param {Object} entityData
   * @returns {Promise<Object>}
   */
  async createEntity(entityData) {
    const { data, error } = await supabase
      .from("entities")
      .insert(entityData)
      .select()
      .single();

    if (error) throw error;
    return EntitySchema.parse(data);
  }

  /**
   * Update entity last seen round
   * @param {string} entityId
   * @param {number} round
   * @returns {Promise<Object>}
   */
  async updateEntityLastSeen(entityId, round) {
    const { data, error } = await supabase
      .from("entities")
      .update({ last_seen_round: round, updated_at: new Date().toISOString() })
      .eq("entity_id", entityId)
      .select()
      .single();

    if (error) throw error;
    return EntitySchema.parse(data);
  }

  // ========================================
  // PARTY OPERATIONS
  // ========================================

  /**
   * Get party members for campaign
   * @param {string} campaignId
   * @returns {Promise<Array>}
   */
  async getPartyMembers(campaignId) {
    const { data, error } = await supabase
      .from("party")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data.map((member) => PartyMemberSchema.parse(member));
  }

  /**
   * Update party member
   * @param {string} campaignId
   * @param {string} playerId
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async updatePartyMember(campaignId, playerId, updates) {
    const { data, error } = await supabase
      .from("party")
      .upsert({
        campaign_id: campaignId,
        player_id: playerId,
        updated_at: new Date().toISOString(),
        ...updates,
      })
      .select()
      .single();

    if (error) throw error;
    return PartyMemberSchema.parse(data);
  }

  // ========================================
  // RULES CACHE OPERATIONS
  // ========================================

  /**
   * Lookup rule by topic
   * @param {string} topic
   * @returns {Promise<Object|null>}
   */
  async lookupRule(topic) {
    const { data, error } = await supabase
      .from("rules_cache")
      .select("*")
      .eq("topic", topic.toLowerCase())
      .single();

    if (error && error.code === "PGRST116") return null;
    if (error) throw error;

    return RulesCacheSchema.parse(data);
  }

  /**
   * Cache rule
   * @param {string} topic
   * @param {string} ruling
   * @param {string} [ref]
   * @returns {Promise<Object>}
   */
  async cacheRule(topic, ruling, ref = null) {
    const { data, error } = await supabase
      .from("rules_cache")
      .upsert({
        topic: topic.toLowerCase(),
        ruling,
        ref,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return RulesCacheSchema.parse(data);
  }

  // ========================================
  // LEDGER OPERATIONS
  // ========================================

  /**
   * Add ledger entry for round
   * @param {Object} entryData
   * @returns {Promise<Object>}
   */
  async addLedgerEntry(entryData) {
    const { data, error } = await supabase
      .from("campaign_logs")
      .insert({
        created_at: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        ...entryData,
      })
      .select()
      .single();

    if (error) throw error;
    return LedgerEntrySchema.parse(data);
  }

  /**
   * Get recent ledger entries
   * @param {string} campaignId
   * @param {number} [limit=10]
   * @returns {Promise<Array>}
   */
  async getRecentLedgerEntries(campaignId, limit = 10) {
    const { data, error } = await supabase
      .from("campaign_logs")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("round_no", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data.map((entry) => LedgerEntrySchema.parse(entry));
  }

  /**
   * Get ledger entries for specific round
   * @param {string} campaignId
   * @param {number} roundNo
   * @returns {Promise<Array>}
   */
  async getLedgerEntriesForRound(campaignId, roundNo) {
    const { data, error } = await supabase
      .from("campaign_logs")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("round_no", roundNo)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data.map((entry) => LedgerEntrySchema.parse(entry));
  }

  // ========================================
  // FLAGS OPERATIONS
  // ========================================

  /**
   * Get campaign flags
   * @param {string} campaignId
   * @returns {Promise<Array>}
   */
  async getFlags(campaignId) {
    const { data, error } = await supabase
      .from("flags")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("key", { ascending: true });

    if (error) throw error;
    return data.map((flag) => FlagSchema.parse(flag));
  }

  /**
   * Set campaign flag
   * @param {string} campaignId
   * @param {string} key
   * @param {any} value
   * @returns {Promise<Object>}
   */
  async setFlag(campaignId, key, value) {
    const { data, error } = await supabase
      .from("flags")
      .upsert({
        campaign_id: campaignId,
        key,
        value,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return FlagSchema.parse(data);
  }

  /**
   * Get flag value
   * @param {string} campaignId
   * @param {string} key
   * @returns {Promise<any|null>}
   */
  async getFlag(campaignId, key) {
    const { data, error } = await supabase
      .from("flags")
      .select("value")
      .eq("campaign_id", campaignId)
      .eq("key", key)
      .single();

    if (error && error.code === "PGRST116") return null;
    if (error) throw error;

    return data.value;
  }

  // ========================================
  // MILESTONES OPERATIONS
  // ========================================

  /**
   * Get milestones for campaign
   * @param {string} campaignId
   * @param {number} [limit=8]
   * @returns {Promise<Array>}
   */
  async getMilestones(campaignId, limit = 8) {
    const { data, error } = await supabase
      .from("milestones")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("round_to", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data.map((milestone) => MilestoneSchema.parse(milestone));
  }

  /**
   * Create milestone summary
   * @param {string} campaignId
   * @param {number} roundTo
   * @param {string} summary
   * @returns {Promise<Object>}
   */
  async createMilestone(campaignId, roundTo, summary) {
    const { data, error } = await supabase
      .from("milestones")
      .insert({
        campaign_id: campaignId,
        round_to: roundTo,
        summary,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return MilestoneSchema.parse(data);
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Check if campaign exists and user has access
   * @param {string} campaignId
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async hasAccess(campaignId, userId) {
    const { data, error } = await supabase
      .from("campaigns")
      .select("dm_id, owner_id")
      .eq("id", campaignId)
      .single();

    if (error) return false;

    if (data.dm_id === userId || data.owner_id === userId) return true;

    // Check if user is a campaign player
    const { data: playerData, error: playerError } = await supabase
      .from("campaign_players")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("user_id", userId)
      .single();

    return !playerError && !!playerData;
  }

  /**
   * Seed default rules cache
   * @returns {Promise<void>}
   */
  async seedRulesCache() {
    const defaultRules = [
      {
        topic: "stealth",
        ruling:
          "Dexterity (Stealth) check. DC set by DM based on environment and observers' passive Perception.",
        ref: "SRD 5.1 - Using Ability Scores",
      },
      {
        topic: "grappling",
        ruling:
          "Athletics check vs target's Athletics or Acrobatics. Success restrains target. Uses action, requires free hand.",
        ref: "SRD 5.1 - Combat",
      },
      {
        topic: "spell_attack_bonus",
        ruling:
          "Spell attack bonus = proficiency bonus + spellcasting ability modifier",
        ref: "SRD 5.1 - Spellcasting",
      },
      {
        topic: "advantage",
        ruling:
          "Roll twice, take higher result. Advantage and disadvantage cancel each other out.",
        ref: "SRD 5.1 - Using Ability Scores",
      },
      {
        topic: "critical_hit",
        ruling:
          "Natural 20 on attack roll. Roll all damage dice twice, add normal modifiers.",
        ref: "SRD 5.1 - Combat",
      },
    ];

    for (const rule of defaultRules) {
      try {
        await this.cacheRule(rule.topic, rule.ruling, rule.ref);
      } catch (error) {
        // Rule already exists, skip
        if (!error.message?.includes("duplicate key")) {
          console.error(`Failed to seed rule ${rule.topic}:`, error);
        }
      }
    }
  }
}

// Export singleton instance and class for testing
export const hybridCampaignDB = new HybridCampaignDB();
export { HybridCampaignDB };
