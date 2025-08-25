"use client";

import { useState, useEffect } from "react";

export default function CharacterSheet({
  campaignId,
  onClose,
  onCharacterUpdate,
}) {
  const [character, setCharacter] = useState({
    name: "",
    class: "Fighter",
    level: 1,
    race: "Human",
    background: "",
    alignment: "Neutral",

    // Ability Scores
    abilities: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },

    // Proficiencies
    skillProficiencies: [],
    savingThrowProficiencies: [],

    // Combat Stats
    hitPoints: { current: 8, maximum: 8, temporary: 0 },
    armorClass: 10,
    speed: 30,

    // Character Details
    personality: "",
    ideals: "",
    bonds: "",
    flaws: "",
    backstory: "",

    // Spell Casting (if applicable)
    spellcastingAbility: null,
    spellSlots: {
      1: { total: 0, used: 0 },
      2: { total: 0, used: 0 },
      3: { total: 0, used: 0 },
      4: { total: 0, used: 0 },
      5: { total: 0, used: 0 },
      6: { total: 0, used: 0 },
      7: { total: 0, used: 0 },
      8: { total: 0, used: 0 },
      9: { total: 0, used: 0 },
    },
  });

  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("stats");

  // D&D 5e Data
  const classes = [
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
  const races = [
    "Human",
    "Elf",
    "Dwarf",
    "Halfling",
    "Dragonborn",
    "Gnome",
    "Half-Elf",
    "Half-Orc",
    "Tiefling",
  ];
  const alignments = [
    "Lawful Good",
    "Neutral Good",
    "Chaotic Good",
    "Lawful Neutral",
    "Neutral",
    "Chaotic Neutral",
    "Lawful Evil",
    "Neutral Evil",
    "Chaotic Evil",
  ];

  const skills = {
    Acrobatics: "dexterity",
    "Animal Handling": "wisdom",
    Arcana: "intelligence",
    Athletics: "strength",
    Deception: "charisma",
    History: "intelligence",
    Insight: "wisdom",
    Intimidation: "charisma",
    Investigation: "intelligence",
    Medicine: "wisdom",
    Nature: "intelligence",
    Perception: "wisdom",
    Performance: "charisma",
    Persuasion: "charisma",
    Religion: "intelligence",
    "Sleight of Hand": "dexterity",
    Stealth: "dexterity",
    Survival: "wisdom",
  };

  useEffect(() => {
    loadCharacter();
  }, [campaignId]);

  const loadCharacter = async () => {
    try {
      const response = await fetch(`/api/character?campaignId=${campaignId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.character) {
          setCharacter((prev) => ({ ...prev, ...data.character }));
        }
      }
    } catch (error) {
      console.error("Error loading character:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveCharacter = async () => {
    try {
      const response = await fetch("/api/character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, character }),
      });

      if (response.ok) {
        onCharacterUpdate?.(character);
        // Auto-save success feedback could be added here
      }
    } catch (error) {
      console.error("Error saving character:", error);
    }
  };

  // Auto-save on character changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isLoading) {
        saveCharacter();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [character, isLoading]);

  // Calculations
  const getAbilityModifier = (score) => Math.floor((score - 10) / 2);
  const getProficiencyBonus = () => Math.ceil(character.level / 4) + 1;

  const getSkillModifier = (skillName) => {
    const ability = skills[skillName];
    const abilityMod = getAbilityModifier(character.abilities[ability]);
    const profBonus = character.skillProficiencies.includes(skillName)
      ? getProficiencyBonus()
      : 0;
    return abilityMod + profBonus;
  };

  const getSavingThrowModifier = (ability) => {
    const abilityMod = getAbilityModifier(character.abilities[ability]);
    const profBonus = character.savingThrowProficiencies.includes(ability)
      ? getProficiencyBonus()
      : 0;
    return abilityMod + profBonus;
  };

  const updateAbility = (ability, value) => {
    const numValue = parseInt(value) || 0;
    setCharacter((prev) => ({
      ...prev,
      abilities: {
        ...prev.abilities,
        [ability]: Math.max(1, Math.min(20, numValue)),
      },
    }));
  };

  const toggleSkillProficiency = (skillName) => {
    setCharacter((prev) => ({
      ...prev,
      skillProficiencies: prev.skillProficiencies.includes(skillName)
        ? prev.skillProficiencies.filter((s) => s !== skillName)
        : [...prev.skillProficiencies, skillName],
    }));
  };

  const toggleSaveProficiency = (ability) => {
    setCharacter((prev) => ({
      ...prev,
      savingThrowProficiencies: prev.savingThrowProficiencies.includes(ability)
        ? prev.savingThrowProficiencies.filter((s) => s !== ability)
        : [...prev.savingThrowProficiencies, ability],
    }));
  };

  const rollAbilityScore = () => {
    // Roll 4d6, drop lowest
    const rolls = Array.from(
      { length: 4 },
      () => Math.floor(Math.random() * 6) + 1
    );
    rolls.sort((a, b) => b - a);
    return rolls.slice(0, 3).reduce((sum, roll) => sum + roll, 0);
  };

  const generateRandomStats = () => {
    const newAbilities = {};
    Object.keys(character.abilities).forEach((ability) => {
      newAbilities[ability] = rollAbilityScore();
    });
    setCharacter((prev) => ({ ...prev, abilities: newAbilities }));
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-purple-900 p-6 rounded-lg">
          <div className="text-white">Loading character sheet...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in-scale">
      <div className="bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden border border-purple-500 animate-glow shadow-2xl">
        {/* Header */}
        <div className="bg-black bg-opacity-30 p-4 border-b border-purple-500">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white animate-text-glow flex items-center gap-2">
              📋 <span className="animate-shimmer">Character Sheet</span>
            </h2>
            <button
              onClick={onClose}
              className="text-purple-300 hover:text-white text-2xl font-bold transition-all duration-300 hover:scale-110"
            >
              ×
            </button>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <input
              type="text"
              placeholder="Character Name"
              value={character.name}
              onChange={(e) =>
                setCharacter((prev) => ({ ...prev, name: e.target.value }))
              }
              className="bg-purple-800 bg-opacity-50 border border-purple-600 rounded px-3 py-2 text-white placeholder-purple-300"
            />
            <select
              value={character.class}
              onChange={(e) =>
                setCharacter((prev) => ({ ...prev, class: e.target.value }))
              }
              className="bg-purple-800 bg-opacity-50 border border-purple-600 rounded px-3 py-2 text-white"
            >
              {classes.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Level"
              value={character.level}
              onChange={(e) =>
                setCharacter((prev) => ({
                  ...prev,
                  level: parseInt(e.target.value) || 1,
                }))
              }
              className="bg-purple-800 bg-opacity-50 border border-purple-600 rounded px-3 py-2 text-white"
              min="1"
              max="20"
            />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-black bg-opacity-20 p-2 border-b border-purple-500">
          <div className="flex space-x-2">
            {["stats", "skills", "combat", "spells", "details"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded font-medium capitalize transition-all duration-300 ${
                  activeTab === tab
                    ? "bg-purple-600 text-white animate-glow transform scale-105"
                    : "bg-purple-800 bg-opacity-50 text-purple-300 hover:text-white hover:bg-purple-700 hover:bg-opacity-60"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] custom-scrollbar animate-fade-in-scale">
          {activeTab === "stats" && (
            <StatsTab
              character={character}
              setCharacter={setCharacter}
              updateAbility={updateAbility}
              getAbilityModifier={getAbilityModifier}
              generateRandomStats={generateRandomStats}
              races={races}
              alignments={alignments}
            />
          )}

          {activeTab === "skills" && (
            <SkillsTab
              character={character}
              skills={skills}
              getSkillModifier={getSkillModifier}
              getSavingThrowModifier={getSavingThrowModifier}
              toggleSkillProficiency={toggleSkillProficiency}
              toggleSaveProficiency={toggleSaveProficiency}
              getProficiencyBonus={getProficiencyBonus}
            />
          )}

          {activeTab === "combat" && (
            <CombatTab
              character={character}
              setCharacter={setCharacter}
              getAbilityModifier={getAbilityModifier}
            />
          )}

          {activeTab === "spells" && (
            <SpellsTab character={character} setCharacter={setCharacter} />
          )}

          {activeTab === "details" && (
            <DetailsTab character={character} setCharacter={setCharacter} />
          )}
        </div>
      </div>
    </div>
  );
}

// Stats Tab Component
function StatsTab({
  character,
  setCharacter,
  updateAbility,
  getAbilityModifier,
  generateRandomStats,
  races,
  alignments,
}) {
  return (
    <div className="space-y-6">
      {/* Race and Alignment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-purple-200 text-sm font-medium mb-2">
            Race
          </label>
          <select
            value={character.race}
            onChange={(e) =>
              setCharacter((prev) => ({ ...prev, race: e.target.value }))
            }
            className="w-full bg-purple-800 bg-opacity-50 border border-purple-600 rounded px-3 py-2 text-white"
          >
            {races.map((race) => (
              <option key={race} value={race}>
                {race}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-purple-200 text-sm font-medium mb-2">
            Alignment
          </label>
          <select
            value={character.alignment}
            onChange={(e) =>
              setCharacter((prev) => ({ ...prev, alignment: e.target.value }))
            }
            className="w-full bg-purple-800 bg-opacity-50 border border-purple-600 rounded px-3 py-2 text-white"
          >
            {alignments.map((alignment) => (
              <option key={alignment} value={alignment}>
                {alignment}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Ability Scores */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-white">Ability Scores</h3>
          <button
            onClick={generateRandomStats}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm font-medium transition-all duration-300 hover:scale-105 animate-bounce-gentle"
          >
            🎲 Roll Stats
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(character.abilities).map(([ability, score]) => {
            const modifier = getAbilityModifier(score);
            return (
              <div
                key={ability}
                className="bg-purple-800 bg-opacity-30 rounded-lg p-4 text-center"
              >
                <label className="block text-purple-200 text-sm font-medium mb-2 capitalize">
                  {ability}
                </label>
                <input
                  type="number"
                  value={score}
                  onChange={(e) => updateAbility(ability, e.target.value)}
                  className="w-full bg-purple-900 border border-purple-600 rounded px-3 py-2 text-white text-center text-xl font-bold"
                  min="1"
                  max="20"
                />
                <div className="text-purple-200 text-sm mt-2">
                  Modifier: {modifier >= 0 ? "+" : ""}
                  {modifier}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Skills Tab Component
function SkillsTab({
  character,
  skills,
  getSkillModifier,
  getSavingThrowModifier,
  toggleSkillProficiency,
  toggleSaveProficiency,
  getProficiencyBonus,
}) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <span className="text-purple-200">
          Proficiency Bonus: +{getProficiencyBonus()}
        </span>
      </div>

      {/* Saving Throws */}
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Saving Throws</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.keys(character.abilities).map((ability) => {
            const modifier = getSavingThrowModifier(ability);
            const isProficient =
              character.savingThrowProficiencies.includes(ability);
            return (
              <div
                key={ability}
                onClick={() => toggleSaveProficiency(ability)}
                className={`p-3 rounded cursor-pointer transition-colors ${
                  isProficient
                    ? "bg-purple-600 bg-opacity-50 border border-purple-400"
                    : "bg-purple-800 bg-opacity-30 border border-purple-600"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-white capitalize">
                    {ability.substring(0, 3)}
                  </span>
                  <span className="text-white font-bold">
                    {modifier >= 0 ? "+" : ""}
                    {modifier}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Skills */}
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Skills</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {Object.entries(skills).map(([skillName, ability]) => {
            const modifier = getSkillModifier(skillName);
            const isProficient =
              character.skillProficiencies.includes(skillName);
            return (
              <div
                key={skillName}
                onClick={() => toggleSkillProficiency(skillName)}
                className={`p-3 rounded cursor-pointer transition-colors ${
                  isProficient
                    ? "bg-purple-600 bg-opacity-50 border border-purple-400"
                    : "bg-purple-800 bg-opacity-30 border border-purple-600"
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-white">{skillName}</span>
                    <span className="text-purple-300 text-sm ml-2">
                      ({ability.substring(0, 3)})
                    </span>
                  </div>
                  <span className="text-white font-bold">
                    {modifier >= 0 ? "+" : ""}
                    {modifier}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Combat Tab Component
function CombatTab({ character, setCharacter, getAbilityModifier }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Hit Points */}
        <div className="bg-purple-800 bg-opacity-30 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Hit Points</h3>
          <div className="space-y-2">
            <div>
              <label className="block text-purple-200 text-sm">
                Current HP
              </label>
              <input
                type="number"
                value={character.hitPoints.current}
                onChange={(e) =>
                  setCharacter((prev) => ({
                    ...prev,
                    hitPoints: {
                      ...prev.hitPoints,
                      current: parseInt(e.target.value) || 0,
                    },
                  }))
                }
                className="w-full bg-purple-900 border border-purple-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-purple-200 text-sm">
                Maximum HP
              </label>
              <input
                type="number"
                value={character.hitPoints.maximum}
                onChange={(e) =>
                  setCharacter((prev) => ({
                    ...prev,
                    hitPoints: {
                      ...prev.hitPoints,
                      maximum: parseInt(e.target.value) || 0,
                    },
                  }))
                }
                className="w-full bg-purple-900 border border-purple-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-purple-200 text-sm">
                Temporary HP
              </label>
              <input
                type="number"
                value={character.hitPoints.temporary}
                onChange={(e) =>
                  setCharacter((prev) => ({
                    ...prev,
                    hitPoints: {
                      ...prev.hitPoints,
                      temporary: parseInt(e.target.value) || 0,
                    },
                  }))
                }
                className="w-full bg-purple-900 border border-purple-600 rounded px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>

        {/* Armor Class */}
        <div className="bg-purple-800 bg-opacity-30 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Armor Class</h3>
          <input
            type="number"
            value={character.armorClass}
            onChange={(e) =>
              setCharacter((prev) => ({
                ...prev,
                armorClass: parseInt(e.target.value) || 10,
              }))
            }
            className="w-full bg-purple-900 border border-purple-600 rounded px-3 py-2 text-white text-2xl text-center"
          />
          <div className="text-purple-200 text-sm mt-2 text-center">
            Base AC (10 + Dex:{" "}
            {10 + getAbilityModifier(character.abilities.dexterity)})
          </div>
        </div>

        {/* Speed */}
        <div className="bg-purple-800 bg-opacity-30 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">Speed</h3>
          <input
            type="number"
            value={character.speed}
            onChange={(e) =>
              setCharacter((prev) => ({
                ...prev,
                speed: parseInt(e.target.value) || 30,
              }))
            }
            className="w-full bg-purple-900 border border-purple-600 rounded px-3 py-2 text-white text-2xl text-center"
          />
          <div className="text-purple-200 text-sm mt-2 text-center">
            feet per turn
          </div>
        </div>
      </div>

      {/* Initiative */}
      <div className="bg-purple-800 bg-opacity-30 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-2">
          Initiative Modifier
        </h3>
        <div className="text-2xl font-bold text-center text-white">
          {getAbilityModifier(character.abilities.dexterity) >= 0 ? "+" : ""}
          {getAbilityModifier(character.abilities.dexterity)}
        </div>
        <div className="text-purple-200 text-sm text-center">
          Dexterity modifier
        </div>
      </div>
    </div>
  );
}

// Spells Tab Component
function SpellsTab({ character, setCharacter }) {
  const spellcastingClasses = [
    "Bard",
    "Cleric",
    "Druid",
    "Paladin",
    "Ranger",
    "Sorcerer",
    "Warlock",
    "Wizard",
  ];
  const isSpellcaster = spellcastingClasses.includes(character.class);

  if (!isSpellcaster) {
    return (
      <div className="text-center text-purple-200">
        <p className="text-lg">
          Your class ({character.class}) doesn't typically cast spells.
        </p>
        <p className="text-sm mt-2">
          If you have spells through other means, this feature will be enhanced
          in future updates.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-white">Spell Slots</h3>
      <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
        {Object.entries(character.spellSlots).map(([level, slots]) => (
          <div
            key={level}
            className="bg-purple-800 bg-opacity-30 rounded-lg p-3 text-center"
          >
            <div className="text-purple-200 text-sm mb-2">Level {level}</div>
            <div className="space-y-2">
              <input
                type="number"
                placeholder="Total"
                value={slots.total}
                onChange={(e) =>
                  setCharacter((prev) => ({
                    ...prev,
                    spellSlots: {
                      ...prev.spellSlots,
                      [level]: {
                        ...prev.spellSlots[level],
                        total: parseInt(e.target.value) || 0,
                      },
                    },
                  }))
                }
                className="w-full bg-purple-900 border border-purple-600 rounded px-2 py-1 text-white text-sm"
                min="0"
              />
              <input
                type="number"
                placeholder="Used"
                value={slots.used}
                onChange={(e) =>
                  setCharacter((prev) => ({
                    ...prev,
                    spellSlots: {
                      ...prev.spellSlots,
                      [level]: {
                        ...prev.spellSlots[level],
                        used: parseInt(e.target.value) || 0,
                      },
                    },
                  }))
                }
                className="w-full bg-purple-900 border border-purple-600 rounded px-2 py-1 text-white text-sm"
                min="0"
                max={slots.total}
              />
            </div>
            <div className="text-white text-sm mt-1">
              {slots.total - slots.used}/{slots.total}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Details Tab Component
function DetailsTab({ character, setCharacter }) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-purple-200 text-sm font-medium mb-2">
          Background
        </label>
        <input
          type="text"
          value={character.background}
          onChange={(e) =>
            setCharacter((prev) => ({ ...prev, background: e.target.value }))
          }
          className="w-full bg-purple-800 bg-opacity-50 border border-purple-600 rounded px-3 py-2 text-white"
          placeholder="e.g., Soldier, Criminal, Folk Hero..."
        />
      </div>

      <div>
        <label className="block text-purple-200 text-sm font-medium mb-2">
          Personality Traits
        </label>
        <textarea
          value={character.personality}
          onChange={(e) =>
            setCharacter((prev) => ({ ...prev, personality: e.target.value }))
          }
          className="w-full bg-purple-800 bg-opacity-50 border border-purple-600 rounded px-3 py-2 text-white h-20 resize-none"
          placeholder="How does your character act and behave?"
        />
      </div>

      <div>
        <label className="block text-purple-200 text-sm font-medium mb-2">
          Ideals
        </label>
        <textarea
          value={character.ideals}
          onChange={(e) =>
            setCharacter((prev) => ({ ...prev, ideals: e.target.value }))
          }
          className="w-full bg-purple-800 bg-opacity-50 border border-purple-600 rounded px-3 py-2 text-white h-16 resize-none"
          placeholder="What drives your character?"
        />
      </div>

      <div>
        <label className="block text-purple-200 text-sm font-medium mb-2">
          Bonds
        </label>
        <textarea
          value={character.bonds}
          onChange={(e) =>
            setCharacter((prev) => ({ ...prev, bonds: e.target.value }))
          }
          className="w-full bg-purple-800 bg-opacity-50 border border-purple-600 rounded px-3 py-2 text-white h-16 resize-none"
          placeholder="Who or what is important to your character?"
        />
      </div>

      <div>
        <label className="block text-purple-200 text-sm font-medium mb-2">
          Flaws
        </label>
        <textarea
          value={character.flaws}
          onChange={(e) =>
            setCharacter((prev) => ({ ...prev, flaws: e.target.value }))
          }
          className="w-full bg-purple-800 bg-opacity-50 border border-purple-600 rounded px-3 py-2 text-white h-16 resize-none"
          placeholder="What are your character's weaknesses?"
        />
      </div>

      <div>
        <label className="block text-purple-200 text-sm font-medium mb-2">
          Backstory
        </label>
        <textarea
          value={character.backstory}
          onChange={(e) =>
            setCharacter((prev) => ({ ...prev, backstory: e.target.value }))
          }
          className="w-full bg-purple-800 bg-opacity-50 border border-purple-600 rounded px-3 py-2 text-white h-32 resize-none"
          placeholder="Tell your character's story..."
        />
      </div>
    </div>
  );
}
