// CharacterSidebar component for displaying character sheets and quick actions
import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function CharacterSidebar({
  campaignId,
  onDiceRoll,
  onSkillCheck,
}) {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedCharacter, setExpandedCharacter] = useState(null);

  useEffect(() => {
    if (campaignId) {
      fetchCharacters();
    }
  }, [campaignId]);

  const fetchCharacters = async () => {
    try {
      setLoading(true);
      setError(null); // Clear any previous errors

      // Get session for auth token
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(`/api/characters?campaignId=${campaignId}`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCharacters(data.characters || []);
      } else if (response.status === 404 || response.status === 401) {
        // No characters yet or not authenticated - both are normal states
        setCharacters([]);
      } else if (response.status >= 500) {
        // Only show error for actual server errors
        throw new Error("Server error occurred");
      } else {
        // For other client errors, just show empty state
        setCharacters([]);
      }
    } catch (err) {
      console.error("Character fetch error:", err);
      // Only set error for actual network/server errors
      if (err.name === "TypeError" || err.message.includes("fetch")) {
        setError("Unable to connect to server");
      } else {
        setCharacters([]); // Just show empty state for other errors
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateModifier = (score) => {
    return Math.floor((score - 10) / 2);
  };

  const formatModifier = (modifier) => {
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
  };

  const getSkillModifier = (character, skill) => {
    const skillAbilities = {
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

    const ability = skillAbilities[skill.toLowerCase()];
    if (!ability || !character[ability]) return 0;

    const abilityMod = calculateModifier(character[ability]);
    const level = character.level || 1;
    const proficiencyBonus = Math.ceil(level / 4) + 1;

    // Check if proficient (simplified check)
    const isProficient =
      character.skill_proficiencies?.includes(skill.toLowerCase()) || false;

    return abilityMod + (isProficient ? proficiencyBonus : 0);
  };

  const handleQuickRoll = (rollType, modifier = 0, label = "") => {
    const command = `/roll 1d20${modifier >= 0 ? "+" : ""}${modifier}`;
    onDiceRoll && onDiceRoll(command, label);
  };

  const handleAbilityCheck = (character, ability) => {
    const modifier = calculateModifier(character[ability]);
    handleQuickRoll(
      "ability",
      modifier,
      `${ability.charAt(0).toUpperCase() + ability.slice(1)} Check`
    );
  };

  const handleSkillCheckClick = (character, skill) => {
    const modifier = getSkillModifier(character, skill);
    onSkillCheck && onSkillCheck(`/check ${skill} ${modifier}`, skill);
  };

  const skills = [
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

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-700 rounded mb-4"></div>
          <div className="h-32 bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700">
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <h3 className="text-white font-medium flex items-center">
          <span className="mr-2">🧙‍♂️</span>
          Characters
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="bg-amber-900/20 border border-amber-500 rounded-lg p-3 mb-4">
            <p className="text-amber-400 text-sm mb-2">⚠️ {error}</p>
            <button
              onClick={fetchCharacters}
              className="text-amber-300 hover:text-amber-200 text-xs underline"
            >
              Try again
            </button>
          </div>
        )}

        {characters.length === 0 && !error ? (
          <div className="text-center text-slate-400 py-8">
            <div className="text-4xl mb-4">🧙‍♂️</div>
            <h4 className="text-lg text-white mb-2">No Character Yet</h4>
            <p className="text-sm mb-4 text-slate-300">
              Create a character to track stats, skills, and join the adventure!
            </p>
            <a
              href={`/character/create?campaignId=${campaignId}`}
              className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              ✨ Create Character
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {characters.map((character) => (
              <div
                key={character.id}
                className="bg-slate-800 rounded-lg border border-slate-700"
              >
                {/* Character Header */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() =>
                    setExpandedCharacter(
                      expandedCharacter === character.id ? null : character.id
                    )
                  }
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-medium">
                        {character.name}
                      </h4>
                      <p className="text-slate-400 text-sm">
                        Level {character.level} {character.race}{" "}
                        {character.class}
                      </p>
                    </div>
                    <span className="text-slate-400">
                      {expandedCharacter === character.id ? "▼" : "▶"}
                    </span>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                    <div className="bg-slate-700 rounded p-2 text-center">
                      <div className="text-slate-400 text-xs">HP</div>
                      <div className="text-white font-medium">
                        {character.hit_points_current ||
                          character.hit_points_max}
                        /{character.hit_points_max}
                      </div>
                    </div>
                    <div className="bg-slate-700 rounded p-2 text-center">
                      <div className="text-slate-400 text-xs">AC</div>
                      <div className="text-white font-medium">
                        {character.armor_class}
                      </div>
                    </div>
                    <div className="bg-slate-700 rounded p-2 text-center">
                      <div className="text-slate-400 text-xs">Init</div>
                      <div className="text-white font-medium">
                        {formatModifier(calculateModifier(character.dexterity))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Character Details */}
                {expandedCharacter === character.id && (
                  <div className="border-t border-slate-700 p-4 space-y-4">
                    {/* Ability Scores */}
                    <div>
                      <h5 className="text-white font-medium mb-2 text-sm">
                        Ability Scores
                      </h5>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {[
                          "strength",
                          "dexterity",
                          "constitution",
                          "intelligence",
                          "wisdom",
                          "charisma",
                        ].map((ability) => (
                          <button
                            key={ability}
                            onClick={() =>
                              handleAbilityCheck(character, ability)
                            }
                            className="bg-slate-700 hover:bg-slate-600 rounded p-2 text-center transition-colors"
                          >
                            <div className="text-slate-300 text-xs uppercase">
                              {ability.slice(0, 3)}
                            </div>
                            <div className="text-white font-medium">
                              {character[ability]}
                            </div>
                            <div className="text-slate-400 text-xs">
                              {formatModifier(
                                calculateModifier(character[ability])
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Saving Throws */}
                    <div>
                      <h5 className="text-white font-medium mb-2 text-sm">
                        Saving Throws
                      </h5>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        {[
                          "strength",
                          "dexterity",
                          "constitution",
                          "intelligence",
                          "wisdom",
                          "charisma",
                        ].map((ability) => {
                          const isProficient =
                            character.saving_throw_proficiencies?.includes(
                              ability
                            ) || false;
                          const modifier = calculateModifier(
                            character[ability]
                          );
                          const profBonus = isProficient
                            ? Math.ceil((character.level || 1) / 4) + 1
                            : 0;
                          const total = modifier + profBonus;

                          return (
                            <button
                              key={ability}
                              onClick={() =>
                                handleQuickRoll(
                                  "save",
                                  total,
                                  `${ability} Save`
                                )
                              }
                              className="bg-slate-700 hover:bg-slate-600 rounded px-2 py-1 text-left transition-colors flex justify-between"
                            >
                              <span className="text-slate-300 capitalize">
                                {ability.slice(0, 3)}
                              </span>
                              <span className="text-white">
                                {formatModifier(total)}
                                {isProficient && (
                                  <span className="text-green-400 ml-1">●</span>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Skills */}
                    <div>
                      <h5 className="text-white font-medium mb-2 text-sm">
                        Skills
                      </h5>
                      <div className="grid grid-cols-1 gap-1 text-xs max-h-32 overflow-y-auto">
                        {skills.map((skill) => {
                          const modifier = getSkillModifier(character, skill);
                          const isProficient =
                            character.skill_proficiencies?.includes(
                              skill.toLowerCase()
                            ) || false;

                          return (
                            <button
                              key={skill}
                              onClick={() =>
                                handleSkillCheckClick(character, skill)
                              }
                              className="bg-slate-700 hover:bg-slate-600 rounded px-2 py-1 text-left transition-colors flex justify-between"
                            >
                              <span className="text-slate-300">{skill}</span>
                              <span className="text-white">
                                {formatModifier(modifier)}
                                {isProficient && (
                                  <span className="text-green-400 ml-1">●</span>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div>
                      <h5 className="text-white font-medium mb-2 text-sm">
                        Quick Actions
                      </h5>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <button
                          onClick={() =>
                            handleQuickRoll(
                              "initiative",
                              calculateModifier(character.dexterity),
                              "Initiative"
                            )
                          }
                          className="bg-green-700 hover:bg-green-600 rounded px-3 py-2 text-white transition-colors"
                        >
                          🏃 Initiative
                        </button>
                        <button
                          onClick={() =>
                            handleQuickRoll("death", 0, "Death Save")
                          }
                          className="bg-red-700 hover:bg-red-600 rounded px-3 py-2 text-white transition-colors"
                        >
                          💀 Death Save
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Dice Section */}
      <div className="border-t border-slate-700 p-4">
        <h4 className="text-white font-medium mb-2 text-sm">Quick Dice</h4>
        <div className="grid grid-cols-4 gap-2 text-xs">
          {["d4", "d6", "d8", "d10", "d12", "d20", "d100"].map((die) => (
            <button
              key={die}
              onClick={() => onDiceRoll && onDiceRoll(`/roll 1${die}`, die)}
              className="bg-purple-700 hover:bg-purple-600 rounded py-2 text-white transition-colors"
            >
              {die}
            </button>
          ))}
          <button
            onClick={() => onDiceRoll && onDiceRoll("/roll 1d20", "Advantage")}
            className="bg-blue-700 hover:bg-blue-600 rounded py-2 text-white transition-colors col-span-2"
          >
            ADV
          </button>
        </div>
      </div>
    </div>
  );
}
