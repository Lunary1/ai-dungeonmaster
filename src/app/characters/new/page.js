"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import Button from "@/components/Button";

// D&D 5e SRD compliant options
const CLASSES = [
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

const RACES = [
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

const ALIGNMENTS = [
  "Lawful Good",
  "Neutral Good",
  "Chaotic Good",
  "Lawful Neutral",
  "True Neutral",
  "Chaotic Neutral",
  "Lawful Evil",
  "Neutral Evil",
  "Chaotic Evil",
];

const BACKGROUNDS = [
  "Acolyte",
  "Criminal",
  "Folk Hero",
  "Noble",
  "Sage",
  "Soldier",
  "Charlatan",
  "Entertainer",
  "Guild Artisan",
  "Hermit",
  "Outlander",
  "Sailor",
];

export default function NewCharacterPage() {
  const [character, setCharacter] = useState({
    name: "",
    class: "",
    race: "",
    level: 1,
    background: "",
    alignment: "",
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    hitPointsMax: 0,
    armorClass: 10,
    campaignId: "",
  });

  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1); // Multi-step form
  const router = useRouter();

  useEffect(() => {
    checkAuthAndLoadCampaigns();
  }, []);

  const checkAuthAndLoadCampaigns = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.push("/login");
        return;
      }

      await loadCampaigns();
    } catch (error) {
      console.error("Auth/campaign load error:", error);
      setError("Failed to load campaign data");
    }
  };

  const loadCampaigns = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      };

      const response = await fetch("/api/campaigns", { headers });
      const data = await response.json();

      if (response.ok) {
        setCampaigns(data.campaigns || []);
      }
    } catch (error) {
      console.error("Campaigns load error:", error);
    }
  };

  const calculateAbilityMod = (score) => {
    return Math.floor((score - 10) / 2);
  };

  const calculateProficiencyBonus = (level) => {
    return Math.ceil(level / 4) + 1;
  };

  const calculateDefaultHP = (characterClass, constitution, level) => {
    const hitDie = {
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

    const baseHP = hitDie[characterClass] || 8;
    const conMod = calculateAbilityMod(constitution);
    return (
      baseHP +
      conMod +
      (level - 1) * (Math.floor(hitDie[characterClass] / 2) + 1 + conMod)
    );
  };

  const rollAbilityScore = () => {
    // Roll 4d6, drop lowest - standard D&D 5e method
    const rolls = Array.from(
      { length: 4 },
      () => Math.floor(Math.random() * 6) + 1
    );
    rolls.sort((a, b) => b - a);
    return rolls.slice(0, 3).reduce((sum, roll) => sum + roll, 0);
  };

  const rollAllAbilityScores = () => {
    setCharacter((prev) => ({
      ...prev,
      strength: rollAbilityScore(),
      dexterity: rollAbilityScore(),
      constitution: rollAbilityScore(),
      intelligence: rollAbilityScore(),
      wisdom: rollAbilityScore(),
      charisma: rollAbilityScore(),
    }));
  };

  const handleInputChange = (field, value) => {
    setCharacter((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Auto-calculate HP when class or constitution changes
    if (field === "class" || field === "constitution") {
      const newCharacter = { ...character, [field]: value };
      if (newCharacter.class && newCharacter.constitution) {
        const calculatedHP = calculateDefaultHP(
          newCharacter.class,
          parseInt(newCharacter.constitution),
          newCharacter.level
        );
        setCharacter((prev) => ({
          ...prev,
          [field]: value,
          hitPointsMax: calculatedHP,
        }));
      }
    }
  };

  const validateStep = (stepNumber) => {
    switch (stepNumber) {
      case 1:
        return character.name.trim() && character.class && character.race;
      case 2:
        return character.strength >= 3 && character.charisma >= 3; // All abilities should be valid
      case 3:
        return character.hitPointsMax > 0;
      default:
        return true;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Validation
      if (!character.name.trim()) {
        setError("Character name is required");
        return;
      }

      if (!character.class || !character.race) {
        setError("Class and race are required");
        return;
      }

      if (character.level < 1 || character.level > 20) {
        setError("Level must be between 1 and 20");
        return;
      }

      // Ability score validation
      const abilities = [
        "strength",
        "dexterity",
        "constitution",
        "intelligence",
        "wisdom",
        "charisma",
      ];
      for (const ability of abilities) {
        const score = parseInt(character[ability]);
        if (score < 3 || score > 20) {
          setError(`${ability} must be between 3 and 20`);
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      };

      // Determine API endpoint based on whether campaign is selected
      const apiEndpoint = character.campaignId
        ? "/api/characters/create"
        : "/api/characters/create";

      const characterData = {
        name: character.name.trim(),
        characterClass: character.class,
        race: character.race,
        level: parseInt(character.level),
        background: character.background || null,
        alignment: character.alignment || null,
        strength: parseInt(character.strength),
        dexterity: parseInt(character.dexterity),
        constitution: parseInt(character.constitution),
        intelligence: parseInt(character.intelligence),
        wisdom: parseInt(character.wisdom),
        charisma: parseInt(character.charisma),
        hitPointsMax: parseInt(character.hitPointsMax),
        armorClass: parseInt(character.armorClass),
        campaignId: character.campaignId || null,
      };

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(characterData),
      });

      const data = await response.json();

      if (response.ok) {
        router.push(`/character/${data.character.id}`);
      } else {
        setError(data.error || "Failed to create character");
      }
    } catch (error) {
      console.error("Character creation error:", error);
      setError("Failed to create character. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Create New Character
          </h1>
          <p className="text-slate-300">
            Build a D&D 5e character following SRD guidelines
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3].map((stepNum) => (
              <div
                key={stepNum}
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                  stepNum <= step
                    ? "bg-purple-600 text-white"
                    : "bg-slate-600 text-slate-300"
                }`}
              >
                {stepNum}
              </div>
            ))}
          </div>
          <div className="flex text-xs text-slate-400">
            <span className="flex-1">Basic Info</span>
            <span className="flex-1 text-center">Abilities</span>
            <span className="flex-1 text-right">Details</span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-white/10 backdrop-blur-lg rounded-lg border border-white/20 p-6"
        >
          {/* Step 1: Basic Information */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white mb-4">
                Basic Information
              </h2>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Character Name *
                  </label>
                  <input
                    type="text"
                    value={character.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter character name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Campaign (Optional)
                  </label>
                  <select
                    value={character.campaignId}
                    onChange={(e) =>
                      handleInputChange("campaignId", e.target.value)
                    }
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">No Campaign (Standalone)</option>
                    {campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Class *
                  </label>
                  <select
                    value={character.class}
                    onChange={(e) => handleInputChange("class", e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  >
                    <option value="">Select Class</option>
                    {CLASSES.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Race *
                  </label>
                  <select
                    value={character.race}
                    onChange={(e) => handleInputChange("race", e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  >
                    <option value="">Select Race</option>
                    {RACES.map((race) => (
                      <option key={race} value={race}>
                        {race}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Level
                  </label>
                  <input
                    type="number"
                    value={character.level}
                    onChange={(e) =>
                      handleInputChange("level", parseInt(e.target.value) || 1)
                    }
                    min="1"
                    max="20"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Background
                  </label>
                  <select
                    value={character.background}
                    onChange={(e) =>
                      handleInputChange("background", e.target.value)
                    }
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select Background</option>
                    {BACKGROUNDS.map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Alignment
                </label>
                <select
                  value={character.alignment}
                  onChange={(e) =>
                    handleInputChange("alignment", e.target.value)
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select Alignment</option>
                  {ALIGNMENTS.map((alignment) => (
                    <option key={alignment} value={alignment}>
                      {alignment}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Ability Scores */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">
                  Ability Scores
                </h2>
                <Button
                  type="button"
                  onClick={rollAllAbilityScores}
                  variant="secondary"
                >
                  🎲 Roll All (4d6 drop lowest)
                </Button>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { key: "strength", label: "Strength" },
                  { key: "dexterity", label: "Dexterity" },
                  { key: "constitution", label: "Constitution" },
                  { key: "intelligence", label: "Intelligence" },
                  { key: "wisdom", label: "Wisdom" },
                  { key: "charisma", label: "Charisma" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      {label}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={character[key]}
                        onChange={(e) =>
                          handleInputChange(key, parseInt(e.target.value) || 10)
                        }
                        min="3"
                        max="20"
                        className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <div className="w-12 text-center text-slate-300 text-sm">
                        {calculateAbilityMod(character[key]) >= 0 ? "+" : ""}
                        {calculateAbilityMod(character[key])}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-4">
                <h4 className="text-purple-200 font-medium mb-2">
                  Proficiency Bonus
                </h4>
                <p className="text-purple-100">
                  Level {character.level}: +
                  {calculateProficiencyBonus(character.level)}
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Combat Stats */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white">
                Combat Statistics
              </h2>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Hit Points (Max)
                  </label>
                  <input
                    type="number"
                    value={character.hitPointsMax}
                    onChange={(e) =>
                      handleInputChange(
                        "hitPointsMax",
                        parseInt(e.target.value) || 1
                      )
                    }
                    min="1"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  {character.class && character.constitution && (
                    <p className="text-xs text-slate-400 mt-1">
                      Suggested:{" "}
                      {calculateDefaultHP(
                        character.class,
                        character.constitution,
                        character.level
                      )}{" "}
                      HP
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Armor Class
                  </label>
                  <input
                    type="number"
                    value={character.armorClass}
                    onChange={(e) =>
                      handleInputChange(
                        "armorClass",
                        parseInt(e.target.value) || 10
                      )
                    }
                    min="1"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Base AC: 10 + Dex Modifier (
                    {10 + calculateAbilityMod(character.dexterity)}) + Armor
                  </p>
                </div>
              </div>

              <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg p-4">
                <h4 className="text-amber-200 font-medium mb-2">
                  Character Summary
                </h4>
                <p className="text-amber-100">
                  <strong>{character.name}</strong> - Level {character.level}{" "}
                  {character.race} {character.class}
                </p>
                <p className="text-amber-100 text-sm mt-1">
                  {character.hitPointsMax} HP, AC {character.armorClass}, Prof +
                  {calculateProficiencyBonus(character.level)}
                </p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
            <div>
              {step > 1 && (
                <Button type="button" onClick={prevStep} variant="secondary">
                  ← Previous
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={() => router.push("/characters")}
                variant="secondary"
              >
                Cancel
              </Button>

              {step < 3 ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={!validateStep(step)}
                >
                  Next →
                </Button>
              ) : (
                <Button type="submit" disabled={loading}>
                  {loading ? "Creating..." : "Create Character"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
