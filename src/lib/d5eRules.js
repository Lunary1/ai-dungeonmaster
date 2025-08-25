/**
 * D&D 5e Rules Helper Library
 * Provides consistent calculations and validations for character mechanics
 */

// D&D 5e SRD Ability Modifier Calculation
export function calculateAbilityModifier(abilityScore) {
  return Math.floor((abilityScore - 10) / 2);
}

// D&D 5e Proficiency Bonus by Level
export function calculateProficiencyBonus(level) {
  if (level < 1) return 2;
  if (level > 20) return 6;
  return Math.ceil(level / 4) + 1;
}

// Skill to Ability mappings per D&D 5e SRD
export const SKILL_ABILITIES = {
  acrobatics: "dexterity",
  animal_handling: "wisdom",
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
  sleight_of_hand: "dexterity",
  stealth: "dexterity",
  survival: "wisdom",
};

// Calculate skill modifier with proficiency
export function calculateSkillModifier(
  character,
  skillName,
  proficiencyType = "NONE"
) {
  const ability = SKILL_ABILITIES[skillName.toLowerCase().replace(/ /g, "_")];
  if (!ability) return 0;

  const abilityScore = character[ability] || 10;
  const abilityMod = calculateAbilityModifier(abilityScore);
  const profBonus = calculateProficiencyBonus(character.level || 1);

  let skillMod = abilityMod;

  if (proficiencyType === "PROFICIENT") {
    skillMod += profBonus;
  } else if (proficiencyType === "EXPERTISE") {
    skillMod += profBonus * 2;
  }

  return skillMod;
}

// Standard D&D 5e classes
export const CLASSES = [
  "Barbarian",
  "Bard",
  "Cleric",
  "Druid",
  "Fighter",
  "Monk",
  "Paladin",
  "Ranger",
  "Rogue",
  "Sorcerer",
  "Warlock",
  "Wizard",
];

// Standard D&D 5e races
export const RACES = [
  "Dragonborn",
  "Dwarf",
  "Elf",
  "Gnome",
  "Half-Elf",
  "Halfling",
  "Half-Orc",
  "Human",
  "Tiefling",
];

// Hit die by class for HP calculations
export const CLASS_HIT_DIE = {
  Barbarian: 12,
  Fighter: 10,
  Paladin: 10,
  Ranger: 10,
  Bard: 8,
  Cleric: 8,
  Druid: 8,
  Monk: 8,
  Rogue: 8,
  Warlock: 8,
  Sorcerer: 6,
  Wizard: 6,
};

// Calculate default HP for a character
export function calculateDefaultHP(
  characterClass,
  constitutionScore,
  level = 1
) {
  const hitDie = CLASS_HIT_DIE[characterClass] || 8;
  const conMod = calculateAbilityModifier(constitutionScore);

  // Level 1: max hit die + con mod
  // Additional levels: average hit die + con mod
  const level1HP = hitDie + conMod;
  const additionalLevels = level - 1;
  const avgHitDie = Math.floor(hitDie / 2) + 1;
  const additionalHP = additionalLevels * (avgHitDie + conMod);

  return Math.max(1, level1HP + additionalHP);
}

// Validate ability score range
export function validateAbilityScore(score) {
  return score >= 3 && score <= 30; // Extended range for magical effects
}

// Validate character level
export function validateLevel(level) {
  return level >= 1 && level <= 20;
}

// Format modifier with + or - sign
export function formatModifier(modifier) {
  return modifier >= 0 ? `+${modifier}` : `${modifier}`;
}

// Roll ability score using 4d6 drop lowest method
export function rollAbilityScore() {
  const rolls = Array.from(
    { length: 4 },
    () => Math.floor(Math.random() * 6) + 1
  );
  rolls.sort((a, b) => b - a);
  return rolls.slice(0, 3).reduce((sum, roll) => sum + roll, 0);
}

// Standard D&D 5e skills list
export const SKILLS = [
  "Acrobatics",
  "Animal Handling",
  "Arcana",
  "Athletics",
  "Deception",
  "History",
  "Insight",
  "Intimidation",
  "Investigation",
  "Medicine",
  "Nature",
  "Perception",
  "Performance",
  "Persuasion",
  "Religion",
  "Sleight of Hand",
  "Stealth",
  "Survival",
];

// Proficiency types
export const PROFICIENCY_TYPES = {
  NONE: "NONE",
  PROFICIENT: "PROFICIENT",
  EXPERTISE: "EXPERTISE",
};

// Calculate saving throw modifier
export function calculateSavingThrowModifier(
  character,
  ability,
  isProficient = false
) {
  const abilityScore = character[ability] || 10;
  const abilityMod = calculateAbilityModifier(abilityScore);
  const profBonus = isProficient
    ? calculateProficiencyBonus(character.level || 1)
    : 0;

  return abilityMod + profBonus;
}
