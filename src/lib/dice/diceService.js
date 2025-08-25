/**
 * Dice Service for D&D 5e dice rolling
 * Handles standard dice notation including advantage/disadvantage
 */

class DiceService {
  /**
   * Roll dice using D&D notation
   * @param {string} expression - Dice expression like "1d20+5", "2d6", "1d20adv"
   * @returns {Object} Roll result with total, individual rolls, and details
   */
  roll(expression) {
    try {
      const parsed = this.parseExpression(expression);
      const rolls = this.executeRolls(parsed);
      const total = this.calculateTotal(rolls, parsed);

      return {
        total,
        rolls: rolls.keptRolls || rolls.allRolls,
        allRolls: rolls.allRolls,
        droppedRolls: rolls.droppedRolls || [],
        expression: parsed.originalExpression,
        parsedExpression: parsed,
        success: true,
      };
    } catch (error) {
      throw new Error(
        `Invalid dice expression "${expression}": ${error.message}`
      );
    }
  }

  /**
   * Parse dice expression into components
   * @param {string} expression - Raw dice expression
   * @returns {Object} Parsed expression components
   */
  parseExpression(expression) {
    const originalExpression = expression;
    let cleanExpression = expression.trim().toLowerCase();

    // Check for advantage/disadvantage
    let advantage = false;
    let disadvantage = false;

    if (cleanExpression.includes("adv")) {
      advantage = true;
      cleanExpression = cleanExpression.replace(/adv/g, "");
    } else if (cleanExpression.includes("dis")) {
      disadvantage = true;
      cleanExpression = cleanExpression.replace(/dis/g, "");
    }

    // Parse the dice expression
    const diceRegex = /^(\d*)d(\d+)([+-]\d+)?$/;
    const match = cleanExpression.match(diceRegex);

    if (!match) {
      throw new Error(
        'Invalid dice format. Use format like "1d20", "2d6+3", "1d20adv"'
      );
    }

    const count = parseInt(match[1]) || 1;
    const sides = parseInt(match[2]);
    const modifier = match[3] ? parseInt(match[3]) : 0;

    // Validate dice parameters
    if (count < 1 || count > 100) {
      throw new Error("Dice count must be between 1 and 100");
    }
    if (![4, 6, 8, 10, 12, 20, 100].includes(sides)) {
      throw new Error(
        "Invalid die type. Use d4, d6, d8, d10, d12, d20, or d100"
      );
    }
    if (modifier < -100 || modifier > 100) {
      throw new Error("Modifier must be between -100 and +100");
    }

    // Handle advantage/disadvantage for d20
    let finalCount = count;
    let keepHighest = false;
    let keepLowest = false;

    if (sides === 20 && (advantage || disadvantage)) {
      if (count === 1) {
        finalCount = 2;
        keepHighest = advantage;
        keepLowest = disadvantage;
      } else {
        console.warn("Advantage/disadvantage only applies to single d20 rolls");
      }
    }

    return {
      originalExpression,
      count: finalCount,
      sides,
      modifier,
      advantage,
      disadvantage,
      keepHighest,
      keepLowest,
      originalCount: count,
    };
  }

  /**
   * Execute the actual dice rolls
   * @param {Object} parsed - Parsed expression
   * @returns {Object} Roll results
   */
  executeRolls(parsed) {
    const { count, sides, keepHighest, keepLowest } = parsed;
    const allRolls = [];

    // Roll the dice
    for (let i = 0; i < count; i++) {
      const roll = this.rollSingleDie(sides);
      allRolls.push(roll);
    }

    let keptRolls = [...allRolls];
    let droppedRolls = [];

    // Handle advantage/disadvantage
    if (keepHighest && allRolls.length > 1) {
      const highest = Math.max(...allRolls);
      keptRolls = [highest];
      droppedRolls = allRolls.filter((roll) => roll !== highest);
    } else if (keepLowest && allRolls.length > 1) {
      const lowest = Math.min(...allRolls);
      keptRolls = [lowest];
      droppedRolls = allRolls.filter((roll) => roll !== lowest);
    }

    return {
      allRolls,
      keptRolls,
      droppedRolls,
    };
  }

  /**
   * Calculate final total including modifier
   * @param {Object} rolls - Roll results
   * @param {Object} parsed - Parsed expression
   * @returns {number} Final total
   */
  calculateTotal(rolls, parsed) {
    const diceTotal = rolls.keptRolls.reduce((sum, roll) => sum + roll, 0);
    return diceTotal + parsed.modifier;
  }

  /**
   * Roll a single die
   * @param {number} sides - Number of sides on the die
   * @returns {number} Random roll result
   */
  rollSingleDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
  }

  /**
   * Validate if an expression is a valid dice expression
   * @param {string} expression - Expression to validate
   * @returns {boolean} True if valid
   */
  isValidExpression(expression) {
    try {
      this.parseExpression(expression);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get suggested expressions based on context
   * @param {string} context - Context like "attack", "damage", "skill"
   * @returns {Array} Array of suggested expressions
   */
  getSuggestions(context) {
    const suggestions = {
      attack: ["1d20+5", "1d20adv", "1d20dis"],
      damage: ["1d8+3", "2d6+1", "1d12+4"],
      skill: ["1d20+2", "1d20+5", "1d20adv"],
      save: ["1d20+3", "1d20+5", "1d20dis"],
      initiative: ["1d20+2", "1d20+1"],
      hit_die: ["1d8", "1d10", "1d12"],
      default: ["1d20", "1d6", "1d8", "1d10", "1d12"],
    };

    return suggestions[context] || suggestions.default;
  }
}

// Export singleton instance
export const diceService = new DiceService();

// Export class for testing
export { DiceService };
