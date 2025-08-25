class DiceService {
  constructor() {
    this.dicePattern = /^(\d+)?d(\d+)([+-]\d+)?$/i;
    this.advantagePattern =
      /^(.+?)\s+(advantage|adv|disadvantage|dis|disadv)$/i;
    this.dropPattern = /^(\d+d\d+)\s+drop\s+(lowest|highest|\d+)$/i;

    // D&D 5e skills and their associated abilities
    this.skills = {
      acrobatics: "dexterity",
      "animal handling": "wisdom",
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
      "sleight of hand": "dexterity",
      stealth: "dexterity",
      survival: "wisdom",
    };

    // D&D 5e saving throws
    this.savingThrows = {
      strength: "str",
      dexterity: "dex",
      constitution: "con",
      intelligence: "int",
      wisdom: "wis",
      charisma: "cha",
      str: "strength",
      dex: "dexterity",
      con: "constitution",
      int: "intelligence",
      wis: "wisdom",
      cha: "charisma",
    };
  }

  rollDice(notation) {
    try {
      const trimmed = notation.trim();

      // Check for advantage/disadvantage
      const advMatch = trimmed.match(this.advantagePattern);
      if (advMatch) {
        return this.rollWithAdvantage(advMatch[1], advMatch[2]);
      }

      // Check for drop lowest/highest
      const dropMatch = trimmed.match(this.dropPattern);
      if (dropMatch) {
        return this.rollWithDrop(dropMatch[1], dropMatch[2]);
      }

      // Standard dice roll
      const match = trimmed.match(this.dicePattern);
      if (!match) {
        return {
          error:
            "Invalid dice notation. Use format like '1d20', '3d6+2', 'd20 advantage', or '4d6 drop lowest'",
        };
      }

      const numDice = parseInt(match[1]) || 1;
      const diceSize = parseInt(match[2]);
      const modifier = match[3] ? parseInt(match[3]) : 0;

      // Validate inputs
      if (numDice < 1 || numDice > 100) {
        return {
          error: "Number of dice must be between 1 and 100",
        };
      }

      if (![4, 6, 8, 10, 12, 20, 100].includes(diceSize)) {
        return {
          error: "Invalid dice size. Use d4, d6, d8, d10, d12, d20, or d100",
        };
      }

      if (Math.abs(modifier) > 1000) {
        return {
          error: "Modifier must be between -1000 and +1000",
        };
      }

      // Roll the dice
      const rolls = [];
      for (let i = 0; i < numDice; i++) {
        rolls.push(Math.floor(Math.random() * diceSize) + 1);
      }

      const rollTotal = rolls.reduce((sum, roll) => sum + roll, 0);
      const finalTotal = rollTotal + modifier;

      return {
        notation: trimmed,
        numDice,
        diceSize,
        modifier,
        rolls,
        rollTotal,
        total: finalTotal,
        error: null,
      };
    } catch (error) {
      return {
        error: "Error processing dice roll: " + error.message,
      };
    }
  }

  // New enhanced rolling methods
  rollWithAdvantage(baseNotation, advantageType) {
    const isAdvantage =
      advantageType.toLowerCase().includes("adv") &&
      !advantageType.toLowerCase().includes("disadv");

    // Parse the base notation
    const match = baseNotation.trim().match(this.dicePattern);
    if (!match) {
      return { error: "Invalid dice notation for advantage/disadvantage roll" };
    }

    const modifier = match[3] ? parseInt(match[3]) : 0;

    // Roll two d20s (advantage/disadvantage only works with d20)
    if (parseInt(match[2]) !== 20) {
      return { error: "Advantage/disadvantage only works with d20 rolls" };
    }

    const roll1 = Math.floor(Math.random() * 20) + 1;
    const roll2 = Math.floor(Math.random() * 20) + 1;

    const chosenRoll = isAdvantage
      ? Math.max(roll1, roll2)
      : Math.min(roll1, roll2);
    const total = chosenRoll + modifier;

    return {
      notation: `${baseNotation} ${advantageType.toLowerCase()}`,
      rolls: [roll1, roll2],
      chosenRoll,
      discardedRoll: isAdvantage
        ? Math.min(roll1, roll2)
        : Math.max(roll1, roll2),
      modifier,
      total,
      isAdvantage,
      isDisadvantage: !isAdvantage,
      isCritical: chosenRoll === 20,
      isCriticalFail: chosenRoll === 1,
      error: null,
    };
  }

  rollWithDrop(diceNotation, dropRule) {
    const match = diceNotation.match(this.dicePattern);
    if (!match) {
      return { error: "Invalid dice notation for drop roll" };
    }

    const numDice = parseInt(match[1]) || 1;
    const diceSize = parseInt(match[2]);

    if (numDice < 2) {
      return { error: "Need at least 2 dice to drop any" };
    }

    // Roll all dice
    const rolls = [];
    for (let i = 0; i < numDice; i++) {
      rolls.push(Math.floor(Math.random() * diceSize) + 1);
    }

    let keptRolls, droppedRolls;

    if (dropRule === "lowest") {
      const sorted = [...rolls].sort((a, b) => b - a);
      keptRolls = sorted.slice(0, -1);
      droppedRolls = sorted.slice(-1);
    } else if (dropRule === "highest") {
      const sorted = [...rolls].sort((a, b) => a - b);
      keptRolls = sorted.slice(0, -1);
      droppedRolls = sorted.slice(-1);
    } else {
      const dropCount = parseInt(dropRule);
      if (dropCount >= numDice) {
        return { error: "Cannot drop all dice" };
      }
      const sorted = [...rolls].sort((a, b) => b - a);
      keptRolls = sorted.slice(0, numDice - dropCount);
      droppedRolls = sorted.slice(numDice - dropCount);
    }

    const total = keptRolls.reduce((sum, roll) => sum + roll, 0);

    return {
      notation: `${diceNotation} drop ${dropRule}`,
      allRolls: rolls,
      keptRolls,
      droppedRolls,
      total,
      error: null,
    };
  }

  // D&D 5e specific roll methods
  rollSkillCheck(skillName, modifier = 0) {
    const skill = skillName.toLowerCase();
    if (!this.skills[skill]) {
      return {
        error: `Unknown skill: ${skillName}. Use /help skills for a list.`,
      };
    }

    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + modifier;
    const ability = this.skills[skill];

    return {
      notation: `Skill Check: ${skillName}`,
      skill: skillName,
      ability,
      roll,
      modifier,
      total,
      isCritical: roll === 20,
      isCriticalFail: roll === 1,
      error: null,
    };
  }

  rollSavingThrow(abilityName, modifier = 0) {
    const ability = abilityName.toLowerCase();
    if (!this.savingThrows[ability]) {
      return {
        error: `Unknown ability: ${abilityName}. Use str, dex, con, int, wis, or cha.`,
      };
    }

    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + modifier;
    const fullAbilityName = this.savingThrows[ability];

    return {
      notation: `${fullAbilityName} saving throw`,
      ability: fullAbilityName,
      roll,
      modifier,
      total,
      isCritical: roll === 20,
      isCriticalFail: roll === 1,
      error: null,
    };
  }

  rollAttackWithAdvantage(
    attackBonus = 0,
    hasAdvantage = false,
    hasDisadvantage = false
  ) {
    if (hasAdvantage && hasDisadvantage) {
      // They cancel out, roll normally
      return this.rollAttack(attackBonus);
    }

    if (hasAdvantage || hasDisadvantage) {
      const result = this.rollWithAdvantage(
        "1d20",
        hasAdvantage ? "advantage" : "disadvantage"
      );
      if (result.error) return result;

      return {
        ...result,
        notation: `Attack roll ${
          hasAdvantage ? "with advantage" : "with disadvantage"
        }`,
        total: result.chosenRoll + attackBonus,
        modifier: attackBonus,
        isAttackRoll: true,
      };
    }

    return this.rollAttack(attackBonus);
  }

  rollMultiple(notations) {
    const results = [];
    for (const notation of notations) {
      results.push(this.rollDice(notation));
    }
    return results;
  }

  // Convenience methods for common D&D rolls
  rollAbilityScore() {
    // Roll 4d6, drop lowest
    const rolls = [];
    for (let i = 0; i < 4; i++) {
      rolls.push(Math.floor(Math.random() * 6) + 1);
    }
    rolls.sort((a, b) => b - a); // Sort descending
    const total = rolls.slice(0, 3).reduce((sum, roll) => sum + roll, 0); // Take top 3

    return {
      notation: "4d6 drop lowest",
      rolls: rolls,
      droppedRoll: rolls[3],
      total: total,
      error: null,
    };
  }

  rollInitiative(dexModifier = 0) {
    const roll = Math.floor(Math.random() * 20) + 1;
    return {
      notation: "1d20" + (dexModifier >= 0 ? "+" : "") + dexModifier,
      rolls: [roll],
      modifier: dexModifier,
      total: roll + dexModifier,
      error: null,
    };
  }

  rollAttack(attackBonus = 0) {
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + attackBonus;

    return {
      notation: "1d20" + (attackBonus >= 0 ? "+" : "") + attackBonus,
      rolls: [roll],
      modifier: attackBonus,
      total: total,
      isCritical: roll === 20,
      isCriticalFail: roll === 1,
      error: null,
    };
  }

  rollDamage(notation) {
    // Enhanced damage rolling with critical hit support
    const result = this.rollDice(notation);
    if (result.error) return result;

    return {
      ...result,
      criticalDamage: this.rollDice(notation), // Double dice for critical hits
    };
  }

  // Utility method to format roll results for display
  formatRollResult(result) {
    if (result.error) {
      return `❌ **Dice Roll Error**\n${result.error}`;
    }

    let formatted = `🎲 **${result.notation}**\n\n`;
    formatted += `**✨ Total: ${result.total}** ✨\n\n`;

    // Handle advantage/disadvantage rolls
    if (result.isAdvantage || result.isDisadvantage) {
      formatted += `**🎯 Rolls:** \`${result.rolls.join(", ")}\`\n`;
      formatted += `**${
        result.isAdvantage ? "⬆️ Advantage" : "⬇️ Disadvantage"
      }:** Used **${result.chosenRoll}**, ~~discarded ${
        result.discardedRoll
      }~~\n`;
    }
    // Handle drop rolls
    else if (result.keptRolls) {
      formatted += `**🎲 All Rolls:** \`${result.allRolls.join(", ")}\`\n`;
      formatted += `**✅ Kept:** \`${result.keptRolls.join(", ")}\`\n`;
      formatted += `**❌ Dropped:** ~~\`${result.droppedRolls.join(
        ", "
      )}\`~~\n`;
    }
    // Handle skill checks
    else if (result.skill) {
      formatted += `**🎯 Ability:** *${result.ability}*\n`;
      formatted += `**🎲 Roll:** \`${result.roll}\`\n`;
      if (result.modifier !== 0) {
        formatted += `**⚡ Modifier:** ${result.modifier >= 0 ? "+" : ""}${
          result.modifier
        }\n`;
      }
    }
    // Handle saving throws
    else if (result.ability && !result.skill) {
      formatted += `**🎲 Roll:** \`${result.roll}\`\n`;
      if (result.modifier !== 0) {
        formatted += `**⚡ Modifier:** ${result.modifier >= 0 ? "+" : ""}${
          result.modifier
        }\n`;
      }
    }
    // Handle standard rolls
    else if (result.rolls && result.rolls.length > 1) {
      formatted += `**🎲 Individual Rolls:** \`${result.rolls.join(", ")}\`\n`;
      if (result.modifier && result.modifier !== 0) {
        formatted += `**⚡ Modifier:** ${result.modifier >= 0 ? "+" : ""}${
          result.modifier
        }\n`;
      }
    } else if (result.modifier && result.modifier !== 0) {
      formatted += `**⚡ Modifier:** ${result.modifier >= 0 ? "+" : ""}${
        result.modifier
      }\n`;
    }

    // Add critical hit/miss indicators
    if (result.isCritical) {
      formatted += `\n🌟 **CRITICAL ${
        result.skill || result.ability ? "SUCCESS" : "HIT"
      }!** 🌟\n`;
    } else if (result.isCriticalFail) {
      formatted += `\n💥 **CRITICAL ${
        result.skill || result.ability ? "FAILURE" : "MISS"
      }!** 💥\n`;
    }

    return formatted;
  }

  // Method to validate dice notation without rolling
  validateNotation(notation) {
    const match = notation.trim().match(this.dicePattern);
    if (!match) {
      return { valid: false, error: "Invalid dice notation format" };
    }

    const numDice = parseInt(match[1]) || 1;
    const diceSize = parseInt(match[2]);

    if (numDice < 1 || numDice > 100) {
      return {
        valid: false,
        error: "Number of dice must be between 1 and 100",
      };
    }

    if (![4, 6, 8, 10, 12, 20, 100].includes(diceSize)) {
      return { valid: false, error: "Invalid dice size" };
    }

    return { valid: true };
  }

  // Generate random encounter-appropriate dice combinations
  getRandomEncounterDice() {
    const encounters = [
      "1d4",
      "1d6",
      "1d8",
      "1d10",
      "1d12",
      "1d20",
      "2d6",
      "3d6",
      "4d6",
      "2d8",
      "3d8",
      "2d10",
      "1d20+5",
      "2d6+3",
      "3d6+2",
      "1d12+4",
    ];
    return encounters[Math.floor(Math.random() * encounters.length)];
  }
}

export const diceService = new DiceService();
