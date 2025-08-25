/**
 * Enhanced Dice Service for D&D 5e SRD compliance
 * Supports /roll XdY+Z syntax with advantage/disadvantage
 */
class DiceService {
  constructor() {
    // Basic dice notation: XdY+Z or XdY-Z
    this.basicDicePattern = /^(\d+)?d(\d+)([+-]\d+)?$/i;

    // Advanced patterns for advantage/disadvantage
    // /roll 2d20kh1+5 (keep highest 1 - advantage)
    // /roll 2d20kl1+5 (keep lowest 1 - disadvantage)
    this.keepPattern = /^(\d+)d(\d+)k([hl])(\d+)([+-]\d+)?$/i;

    // Multiple dice expressions: /roll 1d20+5, 1d6+2
    this.multiplePattern = /^(.+?(?:,\s*.+)+)$/;
  }

  /**
   * Parse and roll dice from /roll command
   * @param {string} command - The full command (e.g., "/roll 1d20+5")
   * @returns {Object} - Roll result with raw rolls and final total
   */
  parseRollCommand(command) {
    // Remove /roll prefix and trim
    const notation = command.replace(/^\/roll\s+/i, "").trim();

    if (!notation || notation === "/roll") {
      throw new Error("No dice notation provided");
    }

    // Handle multiple dice expressions
    if (this.multiplePattern.test(notation)) {
      return this.rollMultiple(notation);
    }

    // Handle single dice expression
    return this.rollSingle(notation);
  }

  /**
   * Roll multiple dice expressions separated by commas
   */
  rollMultiple(notation) {
    const expressions = notation.split(",").map((expr) => expr.trim());
    const results = [];
    let grandTotal = 0;

    for (const expr of expressions) {
      const result = this.rollSingle(expr);
      results.push(result);
      grandTotal += result.total;
    }

    return {
      type: "multiple",
      expressions: results,
      grandTotal,
      notation: notation,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Roll a single dice expression
   */
  rollSingle(notation) {
    // Check for keep highest/lowest (advantage/disadvantage)
    const keepMatch = notation.match(this.keepPattern);
    if (keepMatch) {
      return this.rollWithKeep(keepMatch);
    }

    // Check for basic dice notation
    const basicMatch = notation.match(this.basicDicePattern);
    if (basicMatch) {
      return this.rollBasic(basicMatch);
    }

    throw new Error(`Invalid dice notation: ${notation}`);
  }

  /**
   * Roll basic dice notation (XdY+Z)
   */
  rollBasic(match) {
    const [, numDiceStr, diceSizeStr, modifierStr] = match;

    const numDice = numDiceStr ? parseInt(numDiceStr) : 1;
    const diceSize = parseInt(diceSizeStr);
    const modifier = modifierStr ? parseInt(modifierStr) : 0;

    // Validate dice parameters
    this.validateDiceParameters(numDice, diceSize);

    const rolls = [];
    for (let i = 0; i < numDice; i++) {
      rolls.push(this.rollSingleDie(diceSize));
    }

    const rollTotal = rolls.reduce((sum, roll) => sum + roll, 0);
    const total = rollTotal + modifier;

    return {
      type: "basic",
      notation: `${numDice}d${diceSize}${modifier >= 0 ? "+" : ""}${
        modifier || ""
      }`,
      numDice,
      diceSize,
      modifier,
      rolls,
      rollTotal,
      total,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Roll with keep highest/lowest (advantage/disadvantage)
   */
  rollWithKeep(match) {
    const [, numDiceStr, diceSizeStr, keepType, keepCountStr, modifierStr] =
      match;

    const numDice = parseInt(numDiceStr);
    const diceSize = parseInt(diceSizeStr);
    const keepCount = parseInt(keepCountStr);
    const modifier = modifierStr ? parseInt(modifierStr) : 0;
    const isAdvantage = keepType.toLowerCase() === "h";

    // Validate parameters
    this.validateDiceParameters(numDice, diceSize);
    if (keepCount > numDice) {
      throw new Error(`Cannot keep ${keepCount} dice from ${numDice} dice`);
    }

    // Roll all dice
    const allRolls = [];
    for (let i = 0; i < numDice; i++) {
      allRolls.push({
        value: this.rollSingleDie(diceSize),
        kept: false,
      });
    }

    // Sort and mark kept dice
    const sortedRolls = [...allRolls].sort((a, b) =>
      isAdvantage ? b.value - a.value : a.value - b.value
    );

    // Mark the kept dice
    for (let i = 0; i < keepCount; i++) {
      const originalIndex = allRolls.indexOf(sortedRolls[i]);
      allRolls[originalIndex].kept = true;
    }

    const keptRolls = allRolls
      .filter((roll) => roll.kept)
      .map((roll) => roll.value);
    const droppedRolls = allRolls
      .filter((roll) => !roll.kept)
      .map((roll) => roll.value);
    const rollTotal = keptRolls.reduce((sum, roll) => sum + roll, 0);
    const total = rollTotal + modifier;

    return {
      type: "keep",
      notation: `${numDice}d${diceSize}k${keepType}${keepCount}${
        modifier >= 0 ? "+" : ""
      }${modifier || ""}`,
      numDice,
      diceSize,
      modifier,
      keepType: isAdvantage ? "highest" : "lowest",
      keepCount,
      allRolls: allRolls.map((roll) => roll.value),
      keptRolls,
      droppedRolls,
      rollTotal,
      total,
      isAdvantage,
      isDisadvantage: !isAdvantage,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Roll a single die
   */
  rollSingleDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
  }

  /**
   * Validate dice parameters
   */
  validateDiceParameters(numDice, diceSize) {
    if (isNaN(numDice) || numDice < 1 || numDice > 100) {
      throw new Error("Number of dice must be between 1 and 100");
    }

    if (![4, 6, 8, 10, 12, 20, 100].includes(diceSize)) {
      throw new Error(
        "Invalid die size. Supported: d4, d6, d8, d10, d12, d20, d100"
      );
    }
  }

  /**
   * Helper method to create advantage roll (2d20kh1)
   */
  rollAdvantage(modifier = 0) {
    return this.rollSingle(
      `2d20kh1${modifier >= 0 ? "+" : ""}${modifier || ""}`
    );
  }

  /**
   * Helper method to create disadvantage roll (2d20kl1)
   */
  rollDisadvantage(modifier = 0) {
    return this.rollSingle(
      `2d20kl1${modifier >= 0 ? "+" : ""}${modifier || ""}`
    );
  }

  /**
   * Helper method for ability checks
   */
  rollAbilityCheck(
    abilityModifier,
    proficiencyBonus = 0,
    advantage = false,
    disadvantage = false
  ) {
    const modifier = abilityModifier + proficiencyBonus;

    if (advantage && disadvantage) {
      // Advantage and disadvantage cancel out
      return this.rollSingle(`1d20${modifier >= 0 ? "+" : ""}${modifier}`);
    } else if (advantage) {
      return this.rollAdvantage(modifier);
    } else if (disadvantage) {
      return this.rollDisadvantage(modifier);
    } else {
      return this.rollSingle(`1d20${modifier >= 0 ? "+" : ""}${modifier}`);
    }
  }

  /**
   * Calculate ability modifier from ability score (D&D 5e formula)
   */
  calculateAbilityModifier(abilityScore) {
    return Math.floor((abilityScore - 10) / 2);
  }

  /**
   * Calculate proficiency bonus by character level (D&D 5e)
   */
  calculateProficiencyBonus(level) {
    return Math.ceil(level / 4) + 1;
  }

  /**
   * Format roll result for display
   */
  formatRollResult(result) {
    if (result.type === "multiple") {
      const formattedExpressions = result.expressions
        .map((expr) => this.formatRollResult(expr))
        .join(", ");
      return `${formattedExpressions} = **${result.grandTotal}**`;
    }

    if (result.type === "keep") {
      const keptStr = result.keptRolls.join(", ");
      const droppedStr =
        result.droppedRolls.length > 0
          ? ` ~~${result.droppedRolls.join(", ")}~~`
          : "";
      const modifierStr =
        result.modifier !== 0
          ? ` ${result.modifier >= 0 ? "+" : ""}${result.modifier}`
          : "";

      return `${result.notation}: [${keptStr}]${droppedStr}${modifierStr} = **${result.total}**`;
    }

    // Basic roll
    const rollsStr = result.rolls.join(", ");
    const modifierStr =
      result.modifier !== 0
        ? ` ${result.modifier >= 0 ? "+" : ""}${result.modifier}`
        : "";

    return `${result.notation}: [${rollsStr}]${modifierStr} = **${result.total}**`;
  }
}

// Export singleton instance
export const diceService = new DiceService();

// Export class for testing
export { DiceService };
