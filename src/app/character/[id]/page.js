"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { diceService } from "@/lib/enhancedDiceService";

export default function CharacterSheetPage({ params }) {
  const [user, setUser] = useState(null);
  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [characterId, setCharacterId] = useState(null);

  const router = useRouter();

  useEffect(() => {
    const initializeParams = async () => {
      const resolvedParams = await params;
      setCharacterId(resolvedParams.id);
    };
    initializeParams();
  }, [params]);

  useEffect(() => {
    if (characterId) {
      checkUser();
      loadCharacter();
    }
  }, [characterId]);

  const checkUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setUser(user);
  };

  const loadCharacter = async () => {
    try {
      const response = await fetch(`/api/characters/${characterId}`);
      const data = await response.json();

      if (response.ok) {
        setCharacter(data.character);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Failed to load character");
    } finally {
      setLoading(false);
    }
  };

  const handleAbilityCheck = (ability, skillName = null) => {
    if (!character) return;

    const abilityScore = character[ability.toLowerCase()];
    const abilityModifier = diceService.calculateAbilityModifier(abilityScore);
    const proficiencyBonus = diceService.calculateProficiencyBonus(
      character.level
    );

    // For MVP, assume no proficiency bonuses for skills
    const result = diceService.rollAbilityCheck(abilityModifier, 0);

    const checkName = skillName || `${ability} check`;
    setMessage(
      `${character.name} rolled ${checkName}: ${diceService.formatRollResult(
        result
      )}`
    );
  };

  const handleSavingThrow = (ability) => {
    if (!character) return;

    const abilityScore = character[ability.toLowerCase()];
    const abilityModifier = diceService.calculateAbilityModifier(abilityScore);

    // For MVP, assume no proficiency bonuses for saves
    const result = diceService.rollAbilityCheck(abilityModifier, 0);

    setMessage(
      `${
        character.name
      } rolled ${ability} saving throw: ${diceService.formatRollResult(result)}`
    );
  };

  const EditableField = ({
    label,
    value,
    field,
    type = "text",
    min,
    max,
    onChange,
  }) => {
    const [editValue, setEditValue] = useState(value);
    const [isEditing, setIsEditing] = useState(false);

    const handleSave = async () => {
      try {
        const response = await fetch(`/api/characters/${characterId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            [field]: type === "number" ? parseInt(editValue) : editValue,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setCharacter(data.character);
          setIsEditing(false);
          setMessage("Character updated successfully");
        } else {
          const data = await response.json();
          setError(data.error);
        }
      } catch (err) {
        setError("Failed to update character");
      }
    };

    const handleCancel = () => {
      setEditValue(value);
      setIsEditing(false);
    };

    if (isEditing) {
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            {label}
          </label>
          <div className="flex gap-2">
            <input
              type={type}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              min={min}
              max={max}
              className="flex-1 px-3 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
            >
              ✓
            </button>
            <button
              onClick={handleCancel}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-300">
          {label}
        </label>
        <div
          onClick={() => setIsEditing(true)}
          className="px-3 py-1 bg-white/5 border border-white/10 rounded text-white cursor-pointer hover:bg-white/10 transition-colors"
        >
          {value || "Click to edit"}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading character...</div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">Character not found</div>
          <button
            onClick={() => router.push("/dashboard")}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  router.push(`/campaign/${character.campaign_id}`)
                }
                className="text-white hover:text-purple-300 text-2xl"
              >
                ←
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">
                  {character.name}
                </h1>
                <p className="text-slate-300 text-sm">
                  Level {character.level} {character.race} {character.class}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setEditing(!editing)}
                className={`px-4 py-2 rounded-lg ${
                  editing
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-purple-600 hover:bg-purple-700"
                } text-white`}
              >
                {editing ? "Done Editing" : "Edit Character"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Messages */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
            <p className="text-red-300">{error}</p>
            <button
              onClick={() => setError("")}
              className="text-red-400 hover:text-red-300 text-sm mt-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {message && (
          <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 mb-6">
            <div
              className="text-green-300"
              dangerouslySetInnerHTML={{
                __html: message.replace(
                  /\*\*(.*?)\*\*/g,
                  '<strong class="text-yellow-400">$1</strong>'
                ),
              }}
            />
            <button
              onClick={() => setMessage("")}
              className="text-green-400 hover:text-green-300 text-sm mt-1"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Basic Info */}
          <div className="bg-white/10 backdrop-blur-lg rounded-lg border border-white/20 p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              Character Info
            </h2>
            <div className="space-y-4">
              <EditableField label="Name" value={character.name} field="name" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Class
                  </label>
                  <div className="px-3 py-1 bg-white/5 border border-white/10 rounded text-white">
                    {character.class}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Race
                  </label>
                  <div className="px-3 py-1 bg-white/5 border border-white/10 rounded text-white">
                    {character.race}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <EditableField
                  label="Level"
                  value={character.level}
                  field="level"
                  type="number"
                  min="1"
                  max="20"
                />
                <EditableField
                  label="Experience"
                  value={character.experience_points || 0}
                  field="experience_points"
                  type="number"
                  min="0"
                />
              </div>
              <EditableField
                label="Background"
                value={character.background}
                field="background"
              />
              <EditableField
                label="Alignment"
                value={character.alignment}
                field="alignment"
              />
            </div>
          </div>

          {/* Ability Scores */}
          <div className="bg-white/10 backdrop-blur-lg rounded-lg border border-white/20 p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              Ability Scores
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                ["Strength", "strength"],
                ["Dexterity", "dexterity"],
                ["Constitution", "constitution"],
                ["Intelligence", "intelligence"],
                ["Wisdom", "wisdom"],
                ["Charisma", "charisma"],
              ].map(([label, field]) => {
                const score = character[field];
                const modifier = diceService.calculateAbilityModifier(score);

                return (
                  <div
                    key={field}
                    className="bg-white/5 rounded-lg p-4 text-center"
                  >
                    <div className="text-slate-300 text-sm font-medium mb-1">
                      {label}
                    </div>
                    {editing ? (
                      <EditableField
                        label=""
                        value={score}
                        field={field}
                        type="number"
                        min="3"
                        max="20"
                      />
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-white mb-1">
                          {score}
                        </div>
                        <div className="text-slate-400 text-sm">
                          {modifier >= 0 ? "+" : ""}
                          {modifier}
                        </div>
                        <button
                          onClick={() => handleAbilityCheck(label)}
                          className="mt-2 bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded text-xs"
                        >
                          Roll Check
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {!editing && (
              <div className="mt-6">
                <h3 className="text-white font-medium mb-3">Saving Throws</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    "Strength",
                    "Dexterity",
                    "Constitution",
                    "Intelligence",
                    "Wisdom",
                    "Charisma",
                  ].map((ability) => (
                    <button
                      key={ability}
                      onClick={() => handleSavingThrow(ability)}
                      className="bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded text-sm border border-white/10"
                    >
                      {ability.slice(0, 3)} Save
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Combat Stats */}
          <div className="bg-white/10 backdrop-blur-lg rounded-lg border border-white/20 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Combat Stats</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Armor Class
                  </label>
                  {editing ? (
                    <EditableField
                      label=""
                      value={character.armor_class}
                      field="armor_class"
                      type="number"
                      min="1"
                      max="30"
                    />
                  ) : (
                    <div className="text-3xl font-bold text-white text-center bg-white/5 rounded-lg py-4">
                      {character.armor_class}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Hit Points
                  </label>
                  <div className="text-center bg-white/5 rounded-lg py-4">
                    {editing ? (
                      <div className="space-y-2">
                        <EditableField
                          label="Current"
                          value={character.hit_points_current}
                          field="hit_points_current"
                          type="number"
                          min="0"
                        />
                        <EditableField
                          label="Maximum"
                          value={character.hit_points_max}
                          field="hit_points_max"
                          type="number"
                          min="1"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-white">
                          {character.hit_points_current}
                        </div>
                        <div className="text-slate-300">
                          / {character.hit_points_max}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {!editing && (
                <div className="space-y-2">
                  <h3 className="text-white font-medium">Quick Actions</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        const result =
                          diceService.parseRollCommand("/roll 1d20");
                        setMessage(
                          `${
                            character.name
                          } rolled initiative: ${diceService.formatRollResult(
                            result
                          )}`
                        );
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm"
                    >
                      Initiative
                    </button>
                    <button
                      onClick={() => {
                        const dexMod = diceService.calculateAbilityModifier(
                          character.dexterity
                        );
                        const result = diceService.rollAbilityCheck(dexMod, 0);
                        setMessage(
                          `${
                            character.name
                          } rolled Dexterity (Stealth): ${diceService.formatRollResult(
                            result
                          )}`
                        );
                      }}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded text-sm"
                    >
                      Stealth
                    </button>
                    <button
                      onClick={() => {
                        const wisMod = diceService.calculateAbilityModifier(
                          character.wisdom
                        );
                        const result = diceService.rollAbilityCheck(wisMod, 0);
                        setMessage(
                          `${
                            character.name
                          } rolled Wisdom (Perception): ${diceService.formatRollResult(
                            result
                          )}`
                        );
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm"
                    >
                      Perception
                    </button>
                    <button
                      onClick={() => {
                        const chaMod = diceService.calculateAbilityModifier(
                          character.charisma
                        );
                        const result = diceService.rollAbilityCheck(chaMod, 0);
                        setMessage(
                          `${
                            character.name
                          } rolled Charisma (Persuasion): ${diceService.formatRollResult(
                            result
                          )}`
                        );
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded text-sm"
                    >
                      Persuasion
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Inventory */}
        <div className="mt-6 bg-white/10 backdrop-blur-lg rounded-lg border border-white/20 p-6">
          <h2 className="text-xl font-bold text-white mb-4">Inventory</h2>
          <div className="text-slate-300">
            {character.inventory &&
            Array.isArray(JSON.parse(character.inventory)) ? (
              JSON.parse(character.inventory).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {JSON.parse(character.inventory).map((item, index) => (
                    <div
                      key={index}
                      className="bg-white/5 rounded-lg p-3 border border-white/10"
                    >
                      <div className="text-white font-medium">
                        {item.name || `Item ${index + 1}`}
                      </div>
                      {item.quantity && (
                        <div className="text-slate-400 text-sm">
                          Qty: {item.quantity}
                        </div>
                      )}
                      {item.description && (
                        <div className="text-slate-300 text-sm mt-1">
                          {item.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p>No items in inventory.</p>
              )
            ) : (
              <p>No items in inventory.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
