import React, { useState } from "react";

const CharacterDisplay = ({ character, characterState, onUpdate }) => {
  const [updating, setUpdating] = useState(false);

  if (!character) {
    return (
      <div className="text-sm text-gray-300">
        <div>No character created yet.</div>
        <button className="mt-2 text-blue-400 hover:text-blue-300 text-xs underline">
          Create Character
        </button>
      </div>
    );
  }

  // Calculate ability modifiers (always from base character)
  const getModifier = (score) => Math.floor((score - 10) / 2);
  const formatModifier = (modifier) =>
    modifier >= 0 ? `+${modifier}` : `${modifier}`;

  // Static data from characters table
  const maxHp = character.hit_points_max;

  // Dynamic data from character_states table (single source of truth)
  const currentHp = characterState?.hp_current ?? maxHp; // Default to full HP if no state
  const currentXp = characterState?.xp ?? 0;
  const currentLevel = characterState?.level ?? 1;
  const currentAC = characterState?.armor_class ?? 10;

  // Inventory from character_states only
  let inventory = [];
  try {
    const inventoryData = characterState?.inventory_json ?? [];
    inventory = Array.isArray(inventoryData)
      ? inventoryData
      : inventoryData && typeof inventoryData === "object"
      ? Object.values(inventoryData)
      : [];
  } catch (e) {
    console.error("Error parsing inventory:", e);
    inventory = [];
  }

  const handleStateUpdate = async (updates) => {
    if (onUpdate && !updating) {
      setUpdating(true);
      try {
        await onUpdate(updates);
      } catch (error) {
        console.error("Error updating character state:", error);
      } finally {
        setUpdating(false);
      }
    }
  };

  const handleHpChange = async (newHp) => {
    await handleStateUpdate({
      hp_current: Math.max(0, Math.min(newHp, maxHp)),
    });
  };

  return (
    <div className="space-y-3 text-sm">
      {/* Character Name & Basic Info */}
      <div>
        <div className="text-white font-semibold text-base">
          {character.name}
        </div>
        <div className="text-gray-400 text-xs">
          Level {currentLevel} {character.race} {character.class}
        </div>
      </div>

      {/* Health */}
      <div className="bg-slate-800/50 rounded p-2">
        <div className="flex justify-between items-center mb-1">
          <span className="text-red-300 font-medium">❤️ Health</span>
          <span className="text-white text-xs">
            {currentHp}/{maxHp}
          </span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className="bg-red-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.max(0, (currentHp / maxHp) * 100)}%` }}
          />
        </div>
        <div className="flex gap-1 mt-1">
          <button
            onClick={() => handleHpChange(currentHp - 1)}
            className="text-red-400 hover:text-red-300 text-xs px-1 disabled:opacity-50"
            disabled={currentHp <= 0 || updating}
          >
            -1
          </button>
          <button
            onClick={() => handleHpChange(currentHp + 1)}
            className="text-green-400 hover:text-green-300 text-xs px-1 disabled:opacity-50"
            disabled={currentHp >= maxHp || updating}
          >
            +1
          </button>
          {updating && (
            <span className="text-gray-400 text-xs">Updating...</span>
          )}
        </div>
      </div>

      {/* Ability Scores */}
      <div className="bg-slate-800/50 rounded p-2">
        <div className="text-blue-300 font-medium mb-2">🎯 Abilities</div>
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div className="flex justify-between">
            <span>STR:</span>
            <span className="text-white">
              {character.strength} (
              {formatModifier(getModifier(character.strength))})
            </span>
          </div>
          <div className="flex justify-between">
            <span>DEX:</span>
            <span className="text-white">
              {character.dexterity} (
              {formatModifier(getModifier(character.dexterity))})
            </span>
          </div>
          <div className="flex justify-between">
            <span>CON:</span>
            <span className="text-white">
              {character.constitution} (
              {formatModifier(getModifier(character.constitution))})
            </span>
          </div>
          <div className="flex justify-between">
            <span>INT:</span>
            <span className="text-white">
              {character.intelligence} (
              {formatModifier(getModifier(character.intelligence))})
            </span>
          </div>
          <div className="flex justify-between">
            <span>WIS:</span>
            <span className="text-white">
              {character.wisdom} (
              {formatModifier(getModifier(character.wisdom))})
            </span>
          </div>
          <div className="flex justify-between">
            <span>CHA:</span>
            <span className="text-white">
              {character.charisma} (
              {formatModifier(getModifier(character.charisma))})
            </span>
          </div>
        </div>
      </div>

      {/* Combat Stats */}
      <div className="bg-slate-800/50 rounded p-2">
        <div className="text-purple-300 font-medium mb-2">⚔️ Combat</div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span>AC:</span>
            <span className="text-white">{currentAC}</span>
          </div>
          <div className="flex justify-between">
            <span>XP:</span>
            <span className="text-white">
              {currentXp?.toLocaleString() || "0"}
            </span>
          </div>
        </div>
      </div>

      {/* Inventory Summary */}
      <div className="bg-slate-800/50 rounded p-2">
        <div className="text-yellow-300 font-medium mb-2">🎒 Inventory</div>
        {inventory.length > 0 ? (
          <div className="space-y-1 text-xs max-h-20 overflow-y-auto">
            {inventory.slice(0, 3).map((item, index) => (
              <div key={index} className="flex justify-between">
                <span className="truncate">
                  {item.name || `Item ${index + 1}`}
                </span>
                {item.quantity && (
                  <span className="text-gray-400">×{item.quantity}</span>
                )}
              </div>
            ))}
            {inventory.length > 3 && (
              <div className="text-gray-400 text-xs">
                +{inventory.length - 3} more items
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-400 text-xs">No items</div>
        )}
      </div>
    </div>
  );
};

export default CharacterDisplay;
