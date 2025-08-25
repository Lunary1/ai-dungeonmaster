import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class OpenAIService {
  constructor() {
    // Use GPT-4o-mini for better cost/performance balance
    this.model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS) || 800;

    this.systemPrompt = `You are an expert Dungeons & Dragons 5th Edition Dungeon Master with years of experience running engaging campaigns. You excel at creating immersive narratives, memorable NPCs, and balanced challenges.

CORE PRINCIPLES:
- Create vivid, atmospheric descriptions using all five senses
- Ask for dice rolls when appropriate using proper D&D 5e mechanics
- Build on previous events and character development
- Maintain consistency with established campaign lore
- Encourage player creativity and meaningful choices
- Balance challenge with fun and narrative progression

STORYTELLING STYLE:
- Use rich, evocative language that paints clear mental pictures
- Create distinct personalities for NPCs with unique speech patterns
- Build tension through pacing and meaningful consequences
- Incorporate player backstories and motivations into the narrative
- Reference past events and relationships to create continuity

GAME MECHANICS:
- Follow D&D 5e rules accurately but prioritize fun over strict adherence
- Suggest appropriate skill checks and saving throws
- Provide clear descriptions of combat scenarios
- Explain the outcomes of actions clearly
- Offer multiple approaches to challenges

RESPONSE FORMAT:
- Keep responses engaging but concise (aim for 2-4 paragraphs)
- Use bold text for emphasis on important information
- Include environmental details that suggest possible actions
- End with questions or choices to drive player engagement
- Reference character details and past events when relevant

Remember: You're facilitating collaborative storytelling. The players' choices and creativity should drive the narrative forward.`;
  }

  async generateResponse({
    userMessage,
    campaignMemory,
    messageHistory,
    characterInfo,
  }) {
    try {
      // Build comprehensive context from all available data
      const context = this.buildEnhancedContext(
        campaignMemory,
        messageHistory,
        characterInfo
      );

      // Prepare messages for the AI
      const messages = [
        { role: "system", content: this.systemPrompt },
        { role: "system", content: `Campaign Context:\n${context}` },
        ...this.buildRecentMessageHistory(messageHistory),
        { role: "user", content: userMessage },
      ];

      // Generate response with GPT-4o-mini
      const completion = await openai.chat.completions.create({
        model: this.model,
        messages: messages,
        max_tokens: this.maxTokens,
        temperature: 0.8,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      });

      const response = completion.choices[0].message.content;

      // Extract any important information from this interaction
      const extractedInfo = await this.extractCampaignInfo(
        userMessage,
        response
      );

      return {
        response,
        extractedInfo,
      };
    } catch (error) {
      console.error("OpenAI API error:", error);

      if (error.code === "insufficient_quota") {
        return {
          response:
            "I'm sorry, but the AI service is currently unavailable due to quota limits. Please check your OpenAI API credits.",
          extractedInfo: null,
        };
      } else if (error.code === "invalid_api_key") {
        return {
          response:
            "I'm sorry, but there's an issue with the AI service configuration. Please check the API key.",
          extractedInfo: null,
        };
      } else {
        return {
          response:
            "I'm sorry, but I'm having trouble processing your request right now. Please try again in a moment.",
          extractedInfo: null,
        };
      }
    }
  }

  buildEnhancedContext(campaignMemory, messageHistory, characterInfo) {
    let context = "";

    // Character Information
    if (characterInfo) {
      context += "CHARACTER INFORMATION:\n";
      context += `Name: ${characterInfo.name || "Unknown Adventurer"}\n`;
      if (characterInfo.class) context += `Class: ${characterInfo.class}\n`;
      if (characterInfo.level) context += `Level: ${characterInfo.level}\n`;
      if (characterInfo.background)
        context += `Background: ${characterInfo.background}\n`;
      if (characterInfo.personality)
        context += `Personality: ${characterInfo.personality}\n`;
      context += "\n";
    }

    // Current Campaign State
    if (campaignMemory) {
      // Current Location
      if (campaignMemory.currentLocation) {
        context += `CURRENT LOCATION: ${campaignMemory.currentLocation.name}\n`;
        if (campaignMemory.currentLocation.description) {
          context += `${campaignMemory.currentLocation.description}\n`;
        }
        context += "\n";
      }

      // Active Quests
      if (campaignMemory.quests && campaignMemory.quests.length > 0) {
        context += "ACTIVE QUESTS:\n";
        campaignMemory.quests.slice(0, 3).forEach((quest) => {
          context += `- ${quest.title}: ${
            quest.description || "No description"
          }\n`;
        });
        context += "\n";
      }

      // Important NPCs
      if (campaignMemory.npcs && campaignMemory.npcs.length > 0) {
        context += "KNOWN NPCs:\n";
        campaignMemory.npcs.slice(0, 5).forEach((npc) => {
          context += `- ${npc.name}`;
          if (npc.personality) context += ` (${npc.personality})`;
          if (npc.description) context += `: ${npc.description}`;
          context += "\n";
        });
        context += "\n";
      }

      // Recent Important Events
      if (
        campaignMemory.importantEvents &&
        campaignMemory.importantEvents.length > 0
      ) {
        context += "RECENT EVENTS:\n";
        campaignMemory.importantEvents.slice(0, 3).forEach((event) => {
          context += `- ${event.description}\n`;
        });
        context += "\n";
      }

      // Locations Visited
      if (campaignMemory.locations && campaignMemory.locations.length > 0) {
        context += "LOCATIONS VISITED:\n";
        campaignMemory.locations.slice(-3).forEach((location) => {
          context += `- ${location.name}`;
          if (location.description) context += `: ${location.description}`;
          context += "\n";
        });
        context += "\n";
      }
    }

    // Recent Conversation for Immediate Context
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

  buildRecentMessageHistory(messageHistory) {
    if (!messageHistory || messageHistory.length === 0) return [];

    const messages = [];
    const recentMessages = messageHistory.slice(-6); // Last 6 messages

    recentMessages.forEach((msg) => {
      if (msg.type === "player") {
        messages.push({ role: "user", content: msg.content });
      } else if (msg.type === "dm") {
        messages.push({ role: "assistant", content: msg.content });
      }
    });

    return messages;
  }

  async extractCampaignInfo(userMessage, aiResponse) {
    try {
      // Use AI to extract structured information from the conversation
      const extractionPrompt = `Analyze the following D&D conversation and extract any important campaign information in JSON format.

Player said: "${userMessage}"
DM responded: "${aiResponse}"

Extract and return ONLY a JSON object with any of these fields that are mentioned or implied:
{
  "npcs": [{"name": "string", "description": "string", "personality": "string"}],
  "locations": [{"name": "string", "description": "string"}],
  "quests": [{"title": "string", "description": "string", "status": "active/completed"}],
  "events": [{"description": "string", "importance": 1-5}],
  "items": [{"name": "string", "description": "string"}],
  "character_updates": {"level": number, "class": "string", "name": "string"}
}

Return empty object {} if no important information is found.`;

      const extraction = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: extractionPrompt }],
        max_tokens: 300,
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      return JSON.parse(extraction.choices[0].message.content);
    } catch (error) {
      console.error("Error extracting campaign info:", error);
      return {};
    }
  }
}

export const openaiService = new OpenAIService();
