// NpcCard component for displaying and managing NPCs
import React, { useState } from "react";

export default function NpcCard({
  npc,
  onUpdate,
  onDelete,
  isEditable = false,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(npc);

  const calculateModifier = (score) => {
    return Math.floor((score - 10) / 2);
  };

  const formatModifier = (modifier) => {
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
  };

  const getCRColor = (cr) => {
    if (cr === "0" || cr === "1/8" || cr === "1/4" || cr === "1/2")
      return "text-green-400";
    if (cr === "1" || cr === "2") return "text-yellow-400";
    if (cr === "3" || cr === "4" || cr === "5") return "text-orange-400";
    return "text-red-400";
  };

  const getRelationshipColor = (relationship) => {
    switch (relationship) {
      case "ally":
        return "text-green-400 bg-green-900/20";
      case "enemy":
        return "text-red-400 bg-red-900/20";
      case "neutral":
        return "text-yellow-400 bg-yellow-900/20";
      default:
        return "text-slate-400 bg-slate-900/20";
    }
  };

  const handleSave = async () => {
    if (onUpdate) {
      await onUpdate(editData);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditData(npc);
    setIsEditing(false);
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      {/* NPC Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {isEditing ? (
              <input
                type="text"
                value={editData.name}
                onChange={(e) =>
                  setEditData({ ...editData, name: e.target.value })
                }
                className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-lg font-medium w-full"
              />
            ) : (
              <h3 className="text-white text-lg font-medium">{npc.name}</h3>
            )}

            <div className="flex items-center space-x-2 mt-1">
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={editData.race}
                    onChange={(e) =>
                      setEditData({ ...editData, race: e.target.value })
                    }
                    className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-300 w-20"
                    placeholder="Race"
                  />
                  <input
                    type="text"
                    value={editData.class_type || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, class_type: e.target.value })
                    }
                    className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-300 w-24"
                    placeholder="Class"
                  />
                </>
              ) : (
                <p className="text-slate-300 text-sm">
                  {npc.race}{" "}
                  {npc.class_type &&
                    npc.class_type !== "Commoner" &&
                    `${npc.class_type}`}
                </p>
              )}

              <span
                className={`px-2 py-1 rounded text-xs ${getRelationshipColor(
                  npc.relationship_to_party
                )}`}
              >
                {npc.relationship_to_party || "unknown"}
              </span>
            </div>

            {npc.location && (
              <p className="text-slate-400 text-sm mt-1">📍 {npc.location}</p>
            )}
          </div>

          <div className="flex items-center space-x-2 ml-4">
            {isEditable && (
              <>
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSave}
                      className="p-2 text-green-400 hover:bg-green-900/20 rounded transition-colors"
                      title="Save"
                    >
                      ✓
                    </button>
                    <button
                      onClick={handleCancel}
                      className="p-2 text-red-400 hover:bg-red-900/20 rounded transition-colors"
                      title="Cancel"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-2 text-blue-400 hover:bg-blue-900/20 rounded transition-colors"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => onDelete && onDelete(npc.id)}
                      className="p-2 text-red-400 hover:bg-red-900/20 rounded transition-colors"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </>
                )}
              </>
            )}

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-slate-400 hover:bg-slate-700 rounded transition-colors"
            >
              {isExpanded ? "▼" : "▶"}
            </button>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-4 gap-2 mt-4 text-xs">
          <div className="bg-slate-700 rounded p-2 text-center">
            <div className="text-slate-400">AC</div>
            <div className="text-white font-medium">{npc.armor_class}</div>
          </div>
          <div className="bg-slate-700 rounded p-2 text-center">
            <div className="text-slate-400">HP</div>
            <div className="text-white font-medium">{npc.hit_points}</div>
          </div>
          <div className="bg-slate-700 rounded p-2 text-center">
            <div className="text-slate-400">Speed</div>
            <div className="text-white font-medium">{npc.speed} ft</div>
          </div>
          <div className="bg-slate-700 rounded p-2 text-center">
            <div className="text-slate-400">CR</div>
            <div
              className={`font-medium ${getCRColor(
                npc.stat_block?.challenge_rating || "0"
              )}`}
            >
              {npc.stat_block?.challenge_rating || "0"}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-slate-700 p-4 space-y-4">
          {/* Ability Scores */}
          <div>
            <h4 className="text-white font-medium mb-2 text-sm">
              Ability Scores
            </h4>
            <div className="grid grid-cols-6 gap-2 text-xs">
              {[
                "strength",
                "dexterity",
                "constitution",
                "intelligence",
                "wisdom",
                "charisma",
              ].map((ability) => (
                <div
                  key={ability}
                  className="bg-slate-700 rounded p-2 text-center"
                >
                  <div className="text-slate-300 uppercase">
                    {ability.slice(0, 3)}
                  </div>
                  <div className="text-white font-medium">{npc[ability]}</div>
                  <div className="text-slate-400">
                    {formatModifier(calculateModifier(npc[ability]))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stat Block Features */}
          {npc.stat_block && Object.keys(npc.stat_block).length > 0 && (
            <div>
              <h4 className="text-white font-medium mb-2 text-sm">
                Stat Block
              </h4>
              <div className="bg-slate-700 rounded p-3 text-xs space-y-2">
                {npc.stat_block.skills && npc.stat_block.skills.length > 0 && (
                  <div>
                    <strong className="text-slate-300">Skills:</strong>
                    <span className="text-white ml-1">
                      {npc.stat_block.skills.join(", ")}
                    </span>
                  </div>
                )}

                {npc.stat_block.saving_throws &&
                  npc.stat_block.saving_throws.length > 0 && (
                    <div>
                      <strong className="text-slate-300">Saving Throws:</strong>
                      <span className="text-white ml-1">
                        {npc.stat_block.saving_throws.join(", ")}
                      </span>
                    </div>
                  )}

                {npc.stat_block.damage_resistances &&
                  npc.stat_block.damage_resistances.length > 0 && (
                    <div>
                      <strong className="text-slate-300">
                        Damage Resistances:
                      </strong>
                      <span className="text-white ml-1">
                        {npc.stat_block.damage_resistances.join(", ")}
                      </span>
                    </div>
                  )}

                {npc.stat_block.senses && (
                  <div>
                    <strong className="text-slate-300">Senses:</strong>
                    <span className="text-white ml-1">
                      {npc.stat_block.senses}
                    </span>
                  </div>
                )}

                {npc.stat_block.languages &&
                  npc.stat_block.languages.length > 0 && (
                    <div>
                      <strong className="text-slate-300">Languages:</strong>
                      <span className="text-white ml-1">
                        {npc.stat_block.languages.join(", ")}
                      </span>
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* Personality */}
          {npc.personality && Object.keys(npc.personality).length > 0 && (
            <div>
              <h4 className="text-white font-medium mb-2 text-sm">
                Personality
              </h4>
              <div className="bg-slate-700 rounded p-3 text-xs space-y-2">
                {npc.personality.traits &&
                  npc.personality.traits.length > 0 && (
                    <div>
                      <strong className="text-slate-300">Traits:</strong>
                      <ul className="text-white ml-2 mt-1">
                        {npc.personality.traits.map((trait, index) => (
                          <li key={index}>• {trait}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                {npc.personality.ideals && (
                  <div>
                    <strong className="text-slate-300">Ideals:</strong>
                    <span className="text-white ml-1">
                      {npc.personality.ideals}
                    </span>
                  </div>
                )}

                {npc.personality.bonds && (
                  <div>
                    <strong className="text-slate-300">Bonds:</strong>
                    <span className="text-white ml-1">
                      {npc.personality.bonds}
                    </span>
                  </div>
                )}

                {npc.personality.flaws && (
                  <div>
                    <strong className="text-slate-300">Flaws:</strong>
                    <span className="text-white ml-1">
                      {npc.personality.flaws}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quest Hooks */}
          {npc.quest_hooks && npc.quest_hooks.length > 0 && (
            <div>
              <h4 className="text-white font-medium mb-2 text-sm">
                Quest Hooks
              </h4>
              <div className="bg-slate-700 rounded p-3">
                <ul className="text-white text-xs space-y-1">
                  {npc.quest_hooks.map((hook, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-yellow-400 mr-2">🗝️</span>
                      <span>{hook}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Dialogue Style & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {npc.dialogue_style && (
              <div>
                <h4 className="text-white font-medium mb-2 text-sm">
                  Dialogue Style
                </h4>
                <div className="bg-slate-700 rounded p-3">
                  <p className="text-white text-xs">{npc.dialogue_style}</p>
                </div>
              </div>
            )}

            {npc.occupation && (
              <div>
                <h4 className="text-white font-medium mb-2 text-sm">
                  Occupation
                </h4>
                <div className="bg-slate-700 rounded p-3">
                  <p className="text-white text-xs">{npc.occupation}</p>
                </div>
              </div>
            )}
          </div>

          {npc.notes && (
            <div>
              <h4 className="text-white font-medium mb-2 text-sm">DM Notes</h4>
              <div className="bg-slate-700 rounded p-3">
                <p className="text-white text-xs whitespace-pre-wrap">
                  {npc.notes}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
