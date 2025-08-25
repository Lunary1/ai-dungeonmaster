/**
 * SRD (System Reference Document) Lookup Service
 * Provides D&D 5e rule lookups using SRD content only
 */

class SRDLookupService {
  constructor() {
    // Basic SRD rules database - in a real implementation this would be more comprehensive
    this.rules = {
      combat: [
        {
          title: "Grappling",
          description:
            "When you want to grab a creature or wrestle with it, you can use the Attack action to make a special melee attack, a grapple. If you're able to make multiple attacks with the Attack action, this attack replaces one of them. The target of your grapple must be no more than one size larger than you and must be within your reach.",
          source: "SRD 5.1",
        },
        {
          title: "Shoving",
          description:
            "Using the Attack action, you can make a special melee attack to shove a creature, either to knock it prone or push it away from you. If you're able to make multiple attacks with the Attack action, this attack replaces one of them.",
          source: "SRD 5.1",
        },
        {
          title: "Opportunity Attacks",
          description:
            "In a fight, everyone is constantly watching for a chance to strike an enemy who is fleeing or passing by. Such a strike is called an opportunity attack. You can make an opportunity attack when a hostile creature that you can see moves out of your reach.",
          source: "SRD 5.1",
        },
        {
          title: "Two-Weapon Fighting",
          description:
            "When you fight with a light melee weapon in each hand, you can use a bonus action to attack with the weapon in your other hand. This attack uses the same ability modifier as the primary attack. The off-hand attack doesn't add your ability modifier to the damage unless that modifier is negative.",
          source: "SRD 5.1",
        },
      ],
      conditions: [
        {
          title: "Blinded",
          description:
            "• A blinded creature can't see and automatically fails any ability check that requires sight.\n• Attack rolls against the creature have advantage, and the creature's attack rolls have disadvantage.",
          source: "SRD 5.1",
        },
        {
          title: "Charmed",
          description:
            "• A charmed creature can't attack the charmer or target the charmer with harmful abilities or magical effects.\n• The charmer has advantage on any ability check to interact socially with the creature.",
          source: "SRD 5.1",
        },
        {
          title: "Frightened",
          description:
            "• A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight.\n• The creature can't willingly move closer to the source of its fear.",
          source: "SRD 5.1",
        },
        {
          title: "Grappled",
          description:
            "• A grappled creature's speed becomes 0, and it can't benefit from any bonus to its speed.\n• The condition ends if the grappler is incapacitated or if an effect removes the grappled creature from the reach of the grappler or grappling effect.",
          source: "SRD 5.1",
        },
        {
          title: "Incapacitated",
          description:
            "• An incapacitated creature can't take actions or reactions.",
          source: "SRD 5.1",
        },
        {
          title: "Poisoned",
          description:
            "• A poisoned creature has disadvantage on attack rolls and ability checks.",
          source: "SRD 5.1",
        },
        {
          title: "Prone",
          description:
            "• A prone creature's only movement option is to crawl, unless it stands up and thereby ends the condition.\n• The creature has disadvantage on attack rolls.\n• An attack roll against the creature has advantage if the attacker is within 5 feet of the creature. Otherwise, the attack roll has disadvantage.",
          source: "SRD 5.1",
        },
        {
          title: "Restrained",
          description:
            "• A restrained creature's speed becomes 0, and it can't benefit from any bonus to its speed.\n• Attack rolls against the creature have advantage, and the creature's attack rolls have disadvantage.\n• The creature has disadvantage on Dexterity saving throws.",
          source: "SRD 5.1",
        },
        {
          title: "Stunned",
          description:
            "• A stunned creature is incapacitated, can't move, and can speak only falteringly.\n• The creature automatically fails Strength and Dexterity saving throws.\n• Attack rolls against the creature have advantage.",
          source: "SRD 5.1",
        },
        {
          title: "Unconscious",
          description:
            "• An unconscious creature is incapacitated, can't move or speak, and is unaware of its surroundings.\n• The creature drops whatever it's holding and falls prone.\n• The creature automatically fails Strength and Dexterity saving throws.\n• Attack rolls against the creature have advantage.\n• Any attack that hits the creature is a critical hit if the attacker is within 5 feet of the creature.",
          source: "SRD 5.1",
        },
      ],
      spells: [
        {
          title: "Fireball",
          description:
            "3rd-level evocation\nCasting Time: 1 action\nRange: 150 feet\nComponents: V, S, M (a tiny ball of bat guano and sulfur)\nDuration: Instantaneous\n\nA bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame. Each creature in a 20-foot-radius sphere centered on that point must make a Dexterity saving throw. A target takes 8d6 fire damage on a failed save, or half as much damage on a successful one.",
          source: "SRD 5.1",
        },
        {
          title: "Magic Missile",
          description:
            "1st-level evocation\nCasting Time: 1 action\nRange: 120 feet\nComponents: V, S\nDuration: Instantaneous\n\nYou create three glowing darts of magical force. Each dart hits a creature of your choice that you can see within range. A dart deals 1d4 + 1 force damage to its target. The darts all strike simultaneously, and you can direct them to hit one creature or several.",
          source: "SRD 5.1",
        },
        {
          title: "Cure Wounds",
          description:
            "1st-level evocation\nCasting Time: 1 action\nRange: Touch\nComponents: V, S\nDuration: Instantaneous\n\nA creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier. This spell has no effect on undead or constructs.",
          source: "SRD 5.1",
        },
        {
          title: "Shield",
          description:
            "1st-level abjuration\nCasting Time: 1 reaction, which you take when you are hit by an attack or targeted by the magic missile spell\nRange: Self\nComponents: V, S\nDuration: 1 round\n\nAn invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack, and you take no damage from magic missile.",
          source: "SRD 5.1",
        },
      ],
      abilities: [
        {
          title: "Strength",
          description:
            "Strength measures bodily power, athletic training, and the extent to which you can exert raw physical force. A Strength check can model any attempt to lift, push, pull, or break something, to force your body through a space, or to otherwise apply brute force to a situation.",
          source: "SRD 5.1",
        },
        {
          title: "Dexterity",
          description:
            "Dexterity measures agility, reflexes, and balance. A Dexterity check can model any attempt to move nimbly, quickly, or quietly, or to keep from falling on tricky footing.",
          source: "SRD 5.1",
        },
        {
          title: "Constitution",
          description:
            "Constitution measures health, stamina, and vital force. Constitution checks are uncommon, and no skills apply to Constitution checks, because the endurance this ability represents is largely passive rather than involving a specific effort on the part of a character or monster.",
          source: "SRD 5.1",
        },
        {
          title: "Intelligence",
          description:
            "Intelligence measures reasoning ability, memory, and analytical thinking. An Intelligence check comes into play when you need to draw on logic, education, memory, or deductive reasoning.",
          source: "SRD 5.1",
        },
        {
          title: "Wisdom",
          description:
            "Wisdom reflects how attuned you are to the world around you and represents perceptiveness and intuition. A Wisdom check might reflect an effort to read body language, understand someone's feelings, notice things about the environment, or care for an injured person.",
          source: "SRD 5.1",
        },
        {
          title: "Charisma",
          description:
            "Charisma measures your ability to interact effectively with others. It includes such factors as confidence and eloquence, and it can represent a charming or commanding personality. A Charisma check might arise when you try to influence or entertain others.",
          source: "SRD 5.1",
        },
      ],
      general: [
        {
          title: "Advantage and Disadvantage",
          description:
            "Sometimes a special ability or spell tells you that you have advantage or disadvantage on an ability check, a saving throw, or an attack roll. When that happens, you roll a second d20 when you make the roll. Use the higher of the two rolls if you have advantage, and use the lower roll if you have disadvantage.",
          source: "SRD 5.1",
        },
        {
          title: "Proficiency Bonus",
          description:
            "Characters have a proficiency bonus determined by level. Monsters also have this bonus, which is incorporated in their stat blocks. The bonus is used in the rules on ability checks, saving throws, and attack rolls. Your proficiency bonus can't be added to a single die roll or other number more than once.",
          source: "SRD 5.1",
        },
        {
          title: "Difficulty Class",
          description:
            "The Difficulty Class (DC) of a task represents how hard it is to accomplish. Typical DCs: Very easy (5), Easy (10), Medium (15), Hard (20), Very hard (25), Nearly impossible (30).",
          source: "SRD 5.1",
        },
        {
          title: "Critical Hits",
          description:
            "When you score a critical hit, you get to roll extra dice for the attack's damage against the target. Roll all of the attack's damage dice twice and add them together. Then add any relevant modifiers as normal.",
          source: "SRD 5.1",
        },
      ],
    };
  }

  /**
   * Search for rules matching a query
   * @param {string} query - Search term
   * @param {string} category - Optional category filter
   * @returns {Array} Array of matching rules
   */
  async search(query, category = null) {
    const searchTerm = query.toLowerCase();
    let searchCategories = category ? [category] : Object.keys(this.rules);

    const results = [];

    for (const cat of searchCategories) {
      if (!this.rules[cat]) continue;

      const categoryResults = this.rules[cat].filter(
        (rule) =>
          rule.title.toLowerCase().includes(searchTerm) ||
          rule.description.toLowerCase().includes(searchTerm)
      );

      results.push(
        ...categoryResults.map((rule) => ({
          ...rule,
          category: cat,
          relevance: this.calculateRelevance(rule, searchTerm),
        }))
      );
    }

    // Sort by relevance (exact title matches first, then description matches)
    return results.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Get a specific rule by exact title match
   * @param {string} title - Exact rule title
   * @param {string} category - Optional category
   * @returns {Object|null} Rule object or null if not found
   */
  async getRule(title, category = null) {
    const searchCategories = category ? [category] : Object.keys(this.rules);

    for (const cat of searchCategories) {
      if (!this.rules[cat]) continue;

      const rule = this.rules[cat].find(
        (r) => r.title.toLowerCase() === title.toLowerCase()
      );

      if (rule) {
        return { ...rule, category: cat };
      }
    }

    return null;
  }

  /**
   * Get all rules in a category
   * @param {string} category - Category name
   * @returns {Array} Array of rules in category
   */
  async getCategory(category) {
    if (!this.rules[category]) {
      return [];
    }

    return this.rules[category].map((rule) => ({
      ...rule,
      category,
    }));
  }

  /**
   * Get available categories
   * @returns {Array} Array of category names
   */
  getCategories() {
    return Object.keys(this.rules);
  }

  /**
   * Calculate relevance score for search results
   * @param {Object} rule - Rule object
   * @param {string} searchTerm - Search term
   * @returns {number} Relevance score
   */
  calculateRelevance(rule, searchTerm) {
    let score = 0;

    // Exact title match gets highest score
    if (rule.title.toLowerCase() === searchTerm) {
      score += 100;
    }
    // Title contains search term
    else if (rule.title.toLowerCase().includes(searchTerm)) {
      score += 50;
    }

    // Description contains search term
    if (rule.description.toLowerCase().includes(searchTerm)) {
      score += 25;
    }

    // Boost score for shorter rules (likely more specific)
    if (rule.description.length < 200) {
      score += 10;
    }

    return score;
  }

  /**
   * Add a custom rule (for homebrew content)
   * @param {Object} rule - Rule object with title, description, source
   * @param {string} category - Category to add to
   */
  addRule(rule, category) {
    if (!this.rules[category]) {
      this.rules[category] = [];
    }

    this.rules[category].push({
      ...rule,
      source: rule.source || "Homebrew",
    });
  }

  /**
   * Get random rule from a category (useful for inspiration)
   * @param {string} category - Category name
   * @returns {Object|null} Random rule or null
   */
  getRandomRule(category = null) {
    const searchCategories = category ? [category] : Object.keys(this.rules);
    const availableRules = [];

    for (const cat of searchCategories) {
      if (this.rules[cat]) {
        availableRules.push(
          ...this.rules[cat].map((rule) => ({ ...rule, category: cat }))
        );
      }
    }

    if (availableRules.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * availableRules.length);
    return availableRules[randomIndex];
  }
}

// Export singleton instance
export const srdLookup = new SRDLookupService();

// Export class for testing
export { SRDLookupService };
