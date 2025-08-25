import { NextResponse } from "next/server";
import { openaiService } from "@/lib/openaiService";
import { memoryService } from "@/lib/memoryService";
import { diceService } from "@/lib/diceService";

export async function POST(request) {
  try {
    const { message, campaignId, messageHistory } = await request.json();

    if (!message || !campaignId) {
      return NextResponse.json(
        { error: "Message and campaignId are required" },
        { status: 400 }
      );
    }

    // Check if it's a dice roll command
    if (message.startsWith("/roll ")) {
      const diceNotation = message.substring(6).trim();
      const rollResult = diceService.rollDice(diceNotation);

      if (rollResult.error) {
        return NextResponse.json({
          message: `❌ **Error**: ${rollResult.error}`,
        });
      }

      const resultMessage = diceService.formatRollResult(rollResult);

      // Store the roll in memory
      await memoryService.addMessage(campaignId, {
        type: "system",
        content: `Player rolled ${rollResult.notation}: ${rollResult.total}`,
        timestamp: new Date(),
      });

      return NextResponse.json({ message: resultMessage });
    }

    // Check for skill check commands
    if (message.startsWith("/check ") || message.startsWith("/skill ")) {
      const parts = message.split(" ").slice(1);
      const skillName = parts[0];
      let modifier = parts[1] ? parseInt(parts[1]) : 0;

      // Try to get character data for automatic modifiers
      const character = await memoryService.getCharacter(campaignId);
      if (character && character.abilities) {
        const skills = {
          acrobatics: "dexterity",
          "animal-handling": "wisdom",
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
          "sleight-of-hand": "dexterity",
          stealth: "dexterity",
          survival: "wisdom",
        };

        const ability = skills[skillName.toLowerCase().replace(" ", "-")];
        if (ability && character.abilities[ability]) {
          const abilityModifier = Math.floor(
            (character.abilities[ability] - 10) / 2
          );
          const proficiencyBonus = character.skillProficiencies?.includes(
            skillName
          )
            ? Math.ceil(character.level / 4) + 1
            : 0;
          modifier = abilityModifier + proficiencyBonus;
        }
      }

      const rollResult = diceService.rollSkillCheck(skillName, modifier);

      if (rollResult.error) {
        return NextResponse.json({
          message: `❌ **Error**: ${rollResult.error}`,
        });
      }

      const resultMessage = diceService.formatRollResult(rollResult);

      await memoryService.addMessage(campaignId, {
        type: "system",
        content: `Player made ${skillName} check: ${rollResult.total}`,
        timestamp: new Date(),
      });

      return NextResponse.json({ message: resultMessage });
    }

    // Check for saving throw commands
    if (message.startsWith("/save ") || message.startsWith("/saving ")) {
      const parts = message.split(" ").slice(1);
      const abilityName = parts[0];
      let modifier = parts[1] ? parseInt(parts[1]) : 0;

      // Try to get character data for automatic modifiers
      const character = await memoryService.getCharacter(campaignId);
      if (character && character.abilities) {
        const abilities = [
          "strength",
          "dexterity",
          "constitution",
          "intelligence",
          "wisdom",
          "charisma",
        ];
        const ability = abilities.find((a) =>
          a.startsWith(abilityName.toLowerCase())
        );

        if (ability && character.abilities[ability]) {
          const abilityModifier = Math.floor(
            (character.abilities[ability] - 10) / 2
          );
          const proficiencyBonus = character.savingThrowProficiencies?.includes(
            ability
          )
            ? Math.ceil(character.level / 4) + 1
            : 0;
          modifier = abilityModifier + proficiencyBonus;
        }
      }

      const rollResult = diceService.rollSavingThrow(abilityName, modifier);

      if (rollResult.error) {
        return NextResponse.json({
          message: `❌ **Error**: ${rollResult.error}`,
        });
      }

      const resultMessage = diceService.formatRollResult(rollResult);

      await memoryService.addMessage(campaignId, {
        type: "system",
        content: `Player made ${rollResult.ability} saving throw: ${rollResult.total}`,
        timestamp: new Date(),
      });

      return NextResponse.json({ message: resultMessage });
    }

    // Check for ability check commands
    if (message.startsWith("/ability ") || message.startsWith("/stat ")) {
      const parts = message.split(" ").slice(1);
      const abilityName = parts[0];
      let modifier = parts[1] ? parseInt(parts[1]) : 0;

      // Try to get character data for automatic modifiers
      const character = await memoryService.getCharacter(campaignId);
      if (character && character.abilities) {
        const abilities = [
          "strength",
          "dexterity",
          "constitution",
          "intelligence",
          "wisdom",
          "charisma",
        ];
        const ability = abilities.find((a) =>
          a.startsWith(abilityName.toLowerCase())
        );

        if (ability && character.abilities[ability]) {
          modifier = Math.floor((character.abilities[ability] - 10) / 2);
        }
      }

      const rollResult = diceService.rollSkillCheck(
        abilityName + " Check",
        modifier
      );

      if (rollResult.error) {
        return NextResponse.json({
          message: `❌ **Error**: ${rollResult.error}`,
        });
      }

      const resultMessage = diceService.formatRollResult(rollResult);

      await memoryService.addMessage(campaignId, {
        type: "system",
        content: `Player made ${abilityName} ability check: ${rollResult.total}`,
        timestamp: new Date(),
      });

      return NextResponse.json({ message: resultMessage });
    }

    // Check for initiative commands
    if (message.startsWith("/initiative") || message.startsWith("/init")) {
      let modifier = 0;

      // Try to get character data for automatic modifiers
      const character = await memoryService.getCharacter(campaignId);
      if (character && character.abilities && character.abilities.dexterity) {
        modifier = Math.floor((character.abilities.dexterity - 10) / 2);
      }

      const rollResult = diceService.rollSkillCheck("Initiative", modifier);

      const resultMessage = diceService.formatRollResult(rollResult);

      await memoryService.addMessage(campaignId, {
        type: "system",
        content: `Player rolled initiative: ${rollResult.total}`,
        timestamp: new Date(),
      });

      return NextResponse.json({ message: resultMessage });
    }

    // Check for attack roll commands
    if (message.startsWith("/attack ")) {
      const parts = message.split(" ").slice(1);
      const attackBonus = parts[0] ? parseInt(parts[0]) : 0;
      const hasAdvantage = parts.includes("advantage") || parts.includes("adv");
      const hasDisadvantage =
        parts.includes("disadvantage") || parts.includes("dis");

      const rollResult = diceService.rollAttackWithAdvantage(
        attackBonus,
        hasAdvantage,
        hasDisadvantage
      );

      if (rollResult.error) {
        return NextResponse.json({
          message: `❌ **Error**: ${rollResult.error}`,
        });
      }

      const resultMessage = diceService.formatRollResult(rollResult);

      await memoryService.addMessage(campaignId, {
        type: "system",
        content: `Player made attack roll: ${rollResult.total}`,
        timestamp: new Date(),
      });

      return NextResponse.json({ message: resultMessage });
    }

    // Check for character management commands
    if (message.startsWith("/character ") || message.startsWith("/char ")) {
      const args = message.split(" ").slice(1);
      const action = args[0]?.toLowerCase();

      if (action === "create" || action === "new") {
        // Basic character creation
        const name = args.slice(1).join(" ") || "Unnamed Adventurer";
        const characterData = {
          name,
          class: "Fighter", // Default class
          level: 1,
          background: "",
          personality: "",
          backstory: "",
        };

        await memoryService.addOrUpdateCharacter(campaignId, characterData);

        return NextResponse.json({
          message: `**Character Created!**\n\n**Name:** ${name}\n**Class:** Fighter\n**Level:** 1\n\nYou can update your character details by telling me about your class, background, and personality in regular chat, and I'll remember them!`,
        });
      }

      if (action === "show" || action === "view") {
        const campaignMemory = await memoryService.getCampaignMemory(
          campaignId
        );
        if (campaignMemory.characters && campaignMemory.characters.length > 0) {
          const char = campaignMemory.characters[0];
          let charInfo = `**📋 Character Sheet**\n\n`;
          charInfo += `**Name:** ${char.name}\n`;
          charInfo += `**Class:** ${char.class || "Unknown"}\n`;
          charInfo += `**Level:** ${char.level || 1}\n`;
          if (char.background)
            charInfo += `**Background:** ${char.background}\n`;
          if (char.personality)
            charInfo += `**Personality:** ${char.personality}\n`;
          if (char.backstory) charInfo += `**Backstory:** ${char.backstory}\n`;

          return NextResponse.json({ message: charInfo });
        } else {
          return NextResponse.json({
            message:
              "No character found. Use `/character create [name]` to create one!",
          });
        }
      }

      return NextResponse.json({
        message:
          "**Character Commands:**\n• `/character create [name]` - Create new character\n• `/character show` - View character sheet",
      });
    }

    // Check for inventory commands
    if (message.startsWith("/inventory") || message.startsWith("/inv")) {
      const campaignMemory = await memoryService.getCampaignMemory(campaignId);
      if (campaignMemory.inventory && campaignMemory.inventory.length > 0) {
        let inventoryList = "**🎒 Inventory:**\n\n";
        campaignMemory.inventory.forEach((item) => {
          inventoryList += `• **${item.item_name}**`;
          if (item.quantity > 1) inventoryList += ` (x${item.quantity})`;
          if (item.description) inventoryList += ` - ${item.description}`;
          inventoryList += "\n";
        });
        return NextResponse.json({ message: inventoryList });
      } else {
        return NextResponse.json({
          message:
            "Your inventory is empty. Find some treasure during your adventures!",
        });
      }
    }

    // Check for other commands
    if (message.startsWith("/")) {
      return handleCommand(message, campaignId);
    }

    // Get campaign memory for context
    const campaignMemory = await memoryService.getCampaignMemory(campaignId);

    // Get character information (assume first character for now, could be enhanced for multiple characters)
    const characterInfo =
      campaignMemory.characters && campaignMemory.characters.length > 0
        ? campaignMemory.characters[0]
        : null;

    // Generate AI response with enhanced context
    const aiResult = await openaiService.generateResponse({
      userMessage: message,
      campaignMemory,
      messageHistory: messageHistory || [],
      characterInfo,
    });

    const aiResponse = aiResult.response;
    const extractedInfo = aiResult.extractedInfo;

    // Store both user message and AI response in memory
    await memoryService.addMessage(campaignId, {
      type: "player",
      content: message,
      timestamp: new Date(),
    });

    await memoryService.addMessage(campaignId, {
      type: "dm",
      content: aiResponse,
      timestamp: new Date(),
    });

    // Process any extracted campaign information
    if (extractedInfo) {
      await memoryService.processCampaignInfo(campaignId, extractedInfo);
    }

    return NextResponse.json({ message: aiResponse });
  } catch (error) {
    console.error("Error in AI API route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function handleCommand(message, campaignId) {
  const command = message.toLowerCase().split(" ")[0];
  const args = message.substring(command.length).trim();

  switch (command) {
    case "/help":
      const helpMessage = `**🎲 Available Commands:**

**Dice Rolling:**
• **/roll [dice]** - Roll dice (e.g., /roll 1d20+5, /roll 3d6)
• **/roll [dice] advantage** - Roll with advantage (/roll 1d20+3 advantage)
• **/roll [dice] disadvantage** - Roll with disadvantage (/roll 1d20 dis)
• **/roll 4d6 drop lowest** - Roll 4d6, drop the lowest die

**D&D 5e Checks & Combat:**
• **/check [skill]** - Skill check using character sheet modifiers
• **/save [ability]** - Saving throw using character modifiers  
• **/ability [ability]** - Raw ability check using character stats
• **/initiative** - Roll initiative using character Dex modifier
• **/attack [bonus]** - Attack roll (/attack +5)
• **/attack [bonus] advantage** - Attack with advantage

**Skills:** acrobatics, animal handling, arcana, athletics, deception, history, insight, intimidation, investigation, medicine, nature, perception, performance, persuasion, religion, sleight of hand, stealth, survival

**Abilities:** str/strength, dex/dexterity, con/constitution, int/intelligence, wis/wisdom, cha/charisma

**Character Management:**
• **📋 Character Sheet Button** - Click the button to open your full character sheet
• **/character create [name]** - Create a new character
• **/character show** - View your character summary
• **/inventory** or **/inv** - View your inventory

**Other Commands:**
👥 **/npc [name]** - Generate or interact with an NPC
📜 **/quest** - Get quest information
🗺️ **/location** - Describe locations
⚔️ **/encounter** - Generate encounters
💰 **/loot** - Generate loot

**Examples:**
• /check perception (uses your character's Wisdom + proficiency)
• /save dexterity (uses your character's Dex modifier)
• /ability strength (raw Strength ability check)
• /initiative (uses your character's Dex modifier)
• /roll 1d20+5 advantage
• /attack +7 disadvantage

You can also just describe what you want to do, and I'll respond as your Dungeonmaster!`;
      return NextResponse.json({ message: helpMessage });

    case "/npc":
      if (!args) {
        return NextResponse.json({
          message: "Please specify an NPC name. Example: /npc Gandalf",
        });
      }
      // For now, return a simple response - this could be enhanced with AI generation
      return NextResponse.json({
        message: `**NPC: ${args}**\n\nThis NPC feature is coming soon! For now, you can describe interactions with NPCs in regular chat and I'll roleplay them for you.`,
      });

    case "/quest":
      return NextResponse.json({
        message:
          "**Quest Management**\n\nQuest tracking is coming soon! For now, you can ask me about current quests or request new ones in regular chat.",
      });

    case "/location":
      return NextResponse.json({
        message:
          "**Location Information**\n\nLocation details coming soon! You can ask me to describe your surroundings or travel to new places in regular chat.",
      });

    case "/encounter":
      return NextResponse.json({
        message:
          "**Random Encounter**\n\nEncounter generation is coming soon! You can ask me to create encounters for you in regular chat.",
      });

    case "/loot":
      return NextResponse.json({
        message:
          "**Loot Generation**\n\nLoot generation is coming soon! You can ask me about treasure and loot in regular chat.",
      });

    default:
      return NextResponse.json({
        message: `Unknown command: ${command}. Type /help for available commands.`,
      });
  }
}
