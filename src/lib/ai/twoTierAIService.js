/**
 * Two-Tier AI Service for Hybrid Linear Campaigns
 *
 * This service implements the DIRECTOR/DM architecture where:
 * - DIRECTOR: High-level campaign management and strategic planning
 * - DM: Direct player interaction and scene management
 */

import OpenAI from "openai";
import {
  getToolsByRole,
  getToolByName,
  DM_TOOLS,
  DIRECTOR_TOOLS,
} from "./tools/definitions.js";
import * as toolHandlers from "./tools/handlers.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * AI Agent class for handling both DIRECTOR and DM roles
 */
class TwoTierAIService {
  constructor() {
    this.model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS) || 1200;

    // System prompts for each tier
    this.systemPrompts = {
      DIRECTOR: this.buildDirectorPrompt(),
      DM: this.buildDMPrompt(),
    };
  }

  /**
   * Generate response using the two-tier system
   * @param {Object} params - Parameters for generation
   * @param {string} params.userMessage - Player's message
   * @param {string} params.campaignId - Campaign ID
   * @param {Object} params.campaignContext - Current campaign state
   * @param {Array} params.messageHistory - Recent message history
   * @param {Object} params.characterInfo - Character information
   * @param {string} params.tier - 'DIRECTOR' or 'DM'
   * @returns {Object} AI response with tool calls
   */
  async generateResponse({
    userMessage,
    campaignId,
    campaignContext,
    messageHistory = [],
    characterInfo = {},
    tier = "DM",
  }) {
    try {
      // Build context and messages
      const context = this.buildContext(
        campaignContext,
        messageHistory,
        characterInfo
      );
      const tools = getToolsByRole(tier);

      const messages = [
        { role: "system", content: this.systemPrompts[tier] },
        { role: "system", content: `Campaign Context:\n${context}` },
        ...this.buildRecentMessageHistory(messageHistory),
        { role: "user", content: userMessage },
      ];

      // Call OpenAI with function calling
      const completion = await openai.chat.completions.create({
        model: this.model,
        messages: messages,
        max_tokens: this.maxTokens,
        temperature: tier === "DIRECTOR" ? 0.3 : 0.8, // Director more analytical, DM more creative
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
        tools: tools.map((tool) => ({ type: "function", function: tool })),
        tool_choice: "auto",
      });

      const response = completion.choices[0].message;

      // Handle tool calls if present
      let toolResults = [];
      if (response.tool_calls && response.tool_calls.length > 0) {
        toolResults = await this.handleToolCalls(
          response.tool_calls,
          campaignId
        );
      }

      return {
        success: true,
        response: response.content || "",
        toolCalls: response.tool_calls || [],
        toolResults,
        tier,
        usage: completion.usage,
      };
    } catch (error) {
      console.error(`Error in ${tier} AI generation:`, error);
      return this.handleError(error, tier);
    }
  }

  /**
   * Execute a Director analysis for campaign planning
   * @param {string} campaignId - Campaign ID
   * @param {Object} analysisParams - Analysis parameters
   * @returns {Object} Director analysis and recommendations
   */
  async executeDirectorAnalysis(campaignId, analysisParams = {}) {
    try {
      const prompt = this.buildDirectorAnalysisPrompt(analysisParams);

      const completion = await openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: this.systemPrompts.DIRECTOR },
          { role: "user", content: prompt },
        ],
        max_tokens: this.maxTokens,
        temperature: 0.3,
        tools: DIRECTOR_TOOLS.map((tool) => ({
          type: "function",
          function: tool,
        })),
        tool_choice: "auto",
      });

      const response = completion.choices[0].message;
      let toolResults = [];

      if (response.tool_calls && response.tool_calls.length > 0) {
        toolResults = await this.handleToolCalls(
          response.tool_calls,
          campaignId
        );
      }

      return {
        success: true,
        analysis: response.content,
        toolResults,
        recommendations: this.extractRecommendations(toolResults),
      };
    } catch (error) {
      console.error("Error in Director analysis:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle tool calls from AI responses
   * @param {Array} toolCalls - Tool calls from OpenAI
   * @param {string} campaignId - Campaign ID for context
   * @returns {Array} Results from tool executions
   */
  async handleToolCalls(toolCalls, campaignId) {
    const results = [];

    for (const toolCall of toolCalls) {
      try {
        const { name, arguments: args } = toolCall.function;
        const parsedArgs = JSON.parse(args);

        // Add campaignId to args if not present and needed
        if (!parsedArgs.campaignId && this.toolNeedsCampaignId(name)) {
          parsedArgs.campaignId = campaignId;
        }

        let result;

        // Route to appropriate handler
        switch (name) {
          case "roll_dice":
            result = await toolHandlers.handleRollDice(parsedArgs);
            break;
          case "lookup_rule":
            result = await toolHandlers.handleLookupRule(parsedArgs);
            break;
          case "update_campaign_state":
            result = await toolHandlers.handleUpdateCampaignState(parsedArgs);
            break;
          case "save_memory":
            result = await toolHandlers.handleSaveMemory(parsedArgs);
            break;
          case "load_memory":
            result = await toolHandlers.handleLoadMemory(parsedArgs);
            break;
          case "generate_encounter":
            result = await toolHandlers.handleGenerateEncounter(parsedArgs);
            break;
          case "generate_npc":
            result = await toolHandlers.handleGenerateNpc(parsedArgs);
            break;
          case "analyze_campaign_progress":
            result = await toolHandlers.handleAnalyzeCampaignProgress(
              parsedArgs
            );
            break;
          case "plan_story_beats":
            result = await toolHandlers.handlePlanStoryBeats(parsedArgs);
            break;
          default:
            result = {
              success: false,
              error: `Unknown tool: ${name}`,
            };
        }

        results.push({
          toolCall,
          result,
          toolName: name,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`Error executing tool ${toolCall.function.name}:`, error);
        results.push({
          toolCall,
          result: {
            success: false,
            error: error.message,
          },
          toolName: toolCall.function.name,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  /**
   * Build system prompt for DIRECTOR tier
   */
  buildDirectorPrompt() {
    return `You are the DIRECTOR, the strategic AI that oversees campaign planning and pacing for a D&D 5e hybrid linear campaign.

CORE RESPONSIBILITIES:
- Analyze campaign progress and pacing across 200 rounds
- Plan story beats and major plot developments
- Ensure character development opportunities
- Balance different types of content (combat, roleplay, exploration)
- Monitor campaign health and player engagement
- Provide strategic guidance to the DM AI

CAMPAIGN STRUCTURE:
- 200 rounds total, organized into 10 chapters (20 rounds each)
- Hybrid linear: structured backbone with player choice freedom
- Each round should advance the story meaningfully
- Balance between main plot and character development

ANALYSIS FOCUS:
- Story pacing and momentum
- Character development opportunities  
- Challenge difficulty progression
- Content variety and balance
- Player engagement indicators

TOOL USAGE:
- Use analyze_campaign_progress for strategic insights
- Use plan_story_beats for upcoming content planning  
- Use load_memory to understand campaign history
- Use update_campaign_state for high-level state changes

COMMUNICATION STYLE:
- Analytical and strategic
- Focus on big picture planning
- Provide actionable recommendations
- Consider long-term campaign arc
- Balance narrative structure with player agency

Remember: You guide the overall campaign strategy while the DM handles direct player interaction.`;
  }

  /**
   * Build system prompt for DM tier
   */
  buildDMPrompt() {
    return `You are the DM, the interactive AI that directly manages player interactions in a D&D 5e hybrid linear campaign.

CORE RESPONSIBILITIES:
- Respond directly to player actions and decisions
- Narrate scenes with vivid, immersive descriptions
- Manage encounters, NPCs, and immediate challenges
- Call for appropriate dice rolls and rule checks
- Maintain scene continuity and flow
- Save important developments to campaign memory

STORYTELLING PRINCIPLES:
- Create atmospheric, engaging narratives
- Use all five senses in descriptions
- Give NPCs distinct personalities and voices
- Build tension through pacing and consequences
- Reference past events and character details
- Encourage player creativity and meaningful choices

MECHANICAL FOCUS:
- Follow D&D 5e rules accurately but prioritize fun
- Use roll_dice for appropriate skill checks and saves
- Look up rules when needed with lookup_rule
- Generate encounters and NPCs as required
- Update campaign state based on player actions

TOOL USAGE:
- Use roll_dice whenever dice are needed
- Use lookup_rule for mechanics questions
- Use save_memory for important events/NPCs/discoveries
- Use load_memory to recall relevant information
- Use generate_encounter for combat/challenges
- Use generate_npc for new characters
- Use update_campaign_state for location/progress changes

RESPONSE FORMAT:
- Vivid, engaging descriptions (2-4 paragraphs)
- Bold text for emphasis and important information
- Clear action consequences and next steps
- End with questions or choices to drive engagement
- Include environmental details suggesting possible actions

Remember: You're facilitating collaborative storytelling focused on immediate player experience.`;
  }

  /**
   * Build analysis prompt for Director
   */
  buildDirectorAnalysisPrompt(params) {
    const {
      analysisType = "pacing",
      focusAreas = ["pacing", "character_development"],
      lookAhead = 5,
    } = params;

    return `Perform a ${analysisType} analysis of the current campaign state.

Focus Areas: ${focusAreas.join(", ")}
Look Ahead: ${lookAhead} rounds

Please analyze the campaign and provide strategic recommendations for upcoming content.
Use the appropriate analysis tools to gather data, then provide actionable insights.`;
  }

  /**
   * Build context from campaign data
   */
  buildContext(campaignContext, messageHistory, characterInfo) {
    let context = "";

    // Character Information
    if (characterInfo && characterInfo.name) {
      context += "CHARACTER INFORMATION:\n";
      context += `Name: ${characterInfo.name}\n`;
      if (characterInfo.class) context += `Class: ${characterInfo.class}\n`;
      if (characterInfo.level) context += `Level: ${characterInfo.level}\n`;
      if (characterInfo.background)
        context += `Background: ${characterInfo.background}\n`;
      context += "\n";
    }

    // Campaign State
    if (campaignContext) {
      if (campaignContext.currentLocation) {
        context += `CURRENT LOCATION: ${JSON.stringify(
          campaignContext.currentLocation
        )}\n\n`;
      }

      if (campaignContext.currentRound) {
        context += `CURRENT ROUND: ${campaignContext.currentRound} / 200\n`;
      }

      if (campaignContext.currentChapter) {
        context += `CURRENT CHAPTER: ${campaignContext.currentChapter} / 10\n\n`;
      }

      if (campaignContext.storyBible) {
        context += `STORY BIBLE: ${campaignContext.storyBible}\n\n`;
      }

      if (campaignContext.partyState) {
        context += `PARTY STATUS: ${JSON.stringify(
          campaignContext.partyState
        )}\n\n`;
      }
    }

    // Recent conversation context
    if (messageHistory && messageHistory.length > 0) {
      context += "RECENT CONVERSATION:\n";
      const recentMessages = messageHistory.slice(-4);
      recentMessages.forEach((msg) => {
        if (msg.type === "player") {
          context += `Player: ${msg.content}\n`;
        } else if (msg.type === "dm") {
          context += `DM: ${msg.content.substring(0, 150)}...\n`;
        }
      });
      context += "\n";
    }

    return context || "This is the beginning of a new adventure!";
  }

  /**
   * Build message history for OpenAI
   */
  buildRecentMessageHistory(messageHistory) {
    if (!messageHistory || messageHistory.length === 0) return [];

    const messages = [];
    const recentMessages = messageHistory.slice(-6);

    recentMessages.forEach((msg) => {
      if (msg.type === "player") {
        messages.push({ role: "user", content: msg.content });
      } else if (msg.type === "dm") {
        messages.push({ role: "assistant", content: msg.content });
      }
    });

    return messages;
  }

  /**
   * Check if a tool needs campaign ID
   */
  toolNeedsCampaignId(toolName) {
    const needsCampaignId = [
      "update_campaign_state",
      "save_memory",
      "load_memory",
      "analyze_campaign_progress",
      "plan_story_beats",
    ];
    return needsCampaignId.includes(toolName);
  }

  /**
   * Extract recommendations from tool results
   */
  extractRecommendations(toolResults) {
    const recommendations = [];

    toolResults.forEach(({ result, toolName }) => {
      if (result.success && result.analysis?.recommendations) {
        recommendations.push(...result.analysis.recommendations);
      }
    });

    return recommendations;
  }

  /**
   * Handle API errors
   */
  handleError(error, tier) {
    console.error(`${tier} AI error:`, error);

    if (error.code === "insufficient_quota") {
      return {
        success: false,
        error: "AI service unavailable due to quota limits",
        response:
          "I'm sorry, but the AI service is currently unavailable. Please check your OpenAI API credits.",
      };
    } else if (error.code === "invalid_api_key") {
      return {
        success: false,
        error: "Invalid API key configuration",
        response:
          "I'm sorry, but there's an issue with the AI service configuration.",
      };
    } else {
      return {
        success: false,
        error: error.message,
        response: `I'm having trouble processing your request right now. Please try again in a moment.`,
      };
    }
  }
}

// Export singleton instance
export const twoTierAI = new TwoTierAIService();

// Export class for testing
export { TwoTierAIService };
