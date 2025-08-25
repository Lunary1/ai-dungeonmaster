// Enhanced AI service for Sprint 2 - D&D 5e SRD compliant storytelling
import OpenAI from "openai";
import D5ePromptTemplates from "./d5ePromptTemplates";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class EnhancedAIService {
  constructor() {
    this.model = "gpt-4"; // Using GPT-4 for better D&D knowledge
  }

  // Core D&D 5e SRD prompt template
  generateSystemPrompt(campaignContext, characters, npcs, sessionHistory) {
    return D5ePromptTemplates.getSystemPrompt(
      campaignContext,
      characters,
      npcs,
      sessionHistory
    );
  }

  // Generate narrative response with strict SRD compliance
  async generateNarrative(
    input,
    campaignContext,
    characters,
    npcs,
    sessionHistory
  ) {
    try {
      const systemPrompt = this.generateSystemPrompt(
        campaignContext,
        characters,
        npcs
      );

      // Build conversation history with context
      const messages = [
        { role: "system", content: systemPrompt },
        ...this.formatSessionHistory(sessionHistory),
        { role: "user", content: input },
      ];

      const response = await openai.chat.completions.create({
        model: this.model,
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7, // Balanced creativity while maintaining consistency
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      });

      return {
        content: response.choices[0].message.content,
        usage: response.usage,
      };
    } catch (error) {
      console.error("AI service error:", error);
      throw new Error(`AI service failed: ${error.message}`);
    }
  }

  // Format session history for AI context
  formatSessionHistory(sessionHistory) {
    if (!sessionHistory || sessionHistory.length === 0) {
      return [];
    }

    // Take last 10 exchanges to avoid token limit
    const recentHistory = sessionHistory.slice(-10);

    return recentHistory.map((log) => ({
      role:
        log.metadata?.source === "ai_dm" || log.metadata?.is_ai_response
          ? "assistant"
          : "user",
      content:
        log.metadata?.source === "ai_dm" || log.metadata?.is_ai_response
          ? log.ai_output
          : log.user_input,
    }));
  }

  // Generate SRD-compliant NPC
  async generateNPC(campaignId, prompt, existingNPCs = []) {
    const systemPrompt = `You are an expert D&D 5e NPC generator. Create NPCs that strictly follow SRD rules and stat blocks.

EXISTING NPCs (avoid duplication):
${existingNPCs
  .map((npc) => `- ${npc.name}: ${npc.race} ${npc.class_type || "Commoner"}`)
  .join("\n")}

Generate a complete NPC with the following JSON structure. Use only SRD races, classes, and stat blocks:

{
  "name": "Full name",
  "race": "SRD race only",
  "class_type": "SRD class or 'Commoner' for non-adventurers",
  "alignment": "One of the 9 alignments",
  "armor_class": 10-18,
  "hit_points": 1-200,
  "hit_dice": "XdY format",
  "speed": 25-40,
  "strength": 3-18,
  "dexterity": 3-18,
  "constitution": 3-18,
  "intelligence": 3-18,
  "wisdom": 3-18,
  "charisma": 3-18,
  "stat_block": {
    "skills": ["SRD skills they're proficient in"],
    "saving_throws": ["abilities they're proficient in"],
    "damage_resistances": [],
    "damage_immunities": [],
    "condition_immunities": [],
    "senses": "passive Perception X",
    "languages": ["Common", "others"],
    "challenge_rating": "0-5 for most NPCs",
    "proficiency_bonus": 2-3,
    "features": ["special abilities from SRD"]
  },
  "personality": {
    "traits": ["2-3 personality traits"],
    "ideals": "What drives them",
    "bonds": "What they care about",
    "flaws": "Their weakness",
    "goals": ["short-term and long-term goals"],
    "fears": ["what they fear"],
    "quirks": ["memorable mannerisms"]
  },
  "dialogue_style": "How they speak (formal, casual, etc.)",
  "location": "Where they're usually found",
  "occupation": "Their job or role",
  "relationship_to_party": "ally/neutral/enemy/unknown",
  "quest_hooks": ["potential quest connections"],
  "notes": "Additional DM information"
}

IMPORTANT: Only use D&D 5e SRD content. No homebrew races, classes, or abilities.`;

    try {
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        max_tokens: 1500,
        temperature: 0.8,
      });

      const content = response.choices[0].message.content;

      // Extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error("Could not parse NPC JSON from AI response");
    } catch (error) {
      console.error("NPC generation error:", error);
      throw new Error(`NPC generation failed: ${error.message}`);
    }
  }

  // Validate D&D 5e mechanics in user input
  validateMechanics(input) {
    const validation = {
      valid: true,
      warnings: [],
    };

    // Check for common homebrew or invalid mechanics
    const homebrewPatterns = [
      /roll\s+d\d+\s*\+\s*\d*\s*\+\s*\d+\s*\+\s*\d+/i, // Too many bonuses
      /DC\s+([3-9]|3[1-9])/i, // Invalid DC ranges
      /advantage.*advantage/i, // Double advantage (not RAW)
      /\+\d{2,}/i, // Suspiciously high bonuses
    ];

    homebrewPatterns.forEach((pattern) => {
      if (pattern.test(input)) {
        validation.warnings.push("Potential non-SRD mechanics detected");
      }
    });

    return validation;
  }

  // Generate encounter suggestions based on SRD
  async suggestEncounter(partyLevel, environment, difficulty = "medium") {
    const systemPrompt = `Generate a D&D 5e encounter using only SRD monsters. 

Party Level: ${partyLevel}
Environment: ${environment}
Difficulty: ${difficulty}

Use the encounter building guidelines from the SRD. Return a JSON object with:
{
  "monsters": [{"name": "SRD monster name", "quantity": 1, "cr": "1/4"}],
  "environment_features": ["terrain features"],
  "tactical_notes": "How monsters might fight",
  "treasure": "Appropriate treasure for CR",
  "xp_total": 0
}

Only use monsters from the SRD Monster Manual.`;

    try {
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Generate ${difficulty} encounter for level ${partyLevel} party in ${environment}`,
          },
        ],
        max_tokens: 800,
        temperature: 0.7,
      });

      const content = response.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error("Could not parse encounter JSON");
    } catch (error) {
      console.error("Encounter generation error:", error);
      throw new Error(`Encounter generation failed: ${error.message}`);
    }
  }
}

export const enhancedAIService = new EnhancedAIService();
