"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

export default function CreateCharacterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId");

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [character, setCharacter] = useState({
    name: "",
    race: "",
    class: "",
    level: 1,
    background: "",
    alignment: "True Neutral",
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    hit_points: 8,
    armor_class: 10,
  });

  useEffect(() => {
    checkUser();
  }, []);

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

  const rollStats = () => {
    const rollStat = () => {
      // Roll 4d6, drop lowest
      const rolls = Array.from(
        { length: 4 },
        () => Math.floor(Math.random() * 6) + 1
      );
      rolls.sort((a, b) => b - a);
      return rolls.slice(0, 3).reduce((sum, roll) => sum + roll, 0);
    };

    setCharacter((prev) => ({
      ...prev,
      strength: rollStat(),
      dexterity: rollStat(),
      constitution: rollStat(),
      intelligence: rollStat(),
      wisdom: rollStat(),
      charisma: rollStat(),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !campaignId) return;

    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/characters/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          campaignId: campaignId,
          name: character.name,
          characterClass: character.class,
          race: character.race,
          level: character.level,
          background: character.background,
          alignment: character.alignment,
          strength: character.strength,
          dexterity: character.dexterity,
          constitution: character.constitution,
          intelligence: character.intelligence,
          wisdom: character.wisdom,
          charisma: character.charisma,
          hitPointsMax: character.hit_points,
          armorClass: character.armor_class,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Redirect back to campaign if character was created for a specific campaign
        if (campaignId) {
          router.push(`/campaign/${campaignId}`);
        } else {
          // Otherwise redirect to the new character page
          router.push(`/character/${data.character.id}`);
        }
      } else {
        setError(data.error || "Failed to create character");
      }
    } catch (err) {
      setError("Failed to create character");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h1 className="text-2xl font-bold text-white mb-6">
            Create Character
          </h1>

          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Character Name
                </label>
                <input
                  type="text"
                  value={character.name}
                  onChange={(e) =>
                    setCharacter((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Level
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={character.level}
                  onChange={(e) =>
                    setCharacter((prev) => ({
                      ...prev,
                      level: parseInt(e.target.value),
                    }))
                  }
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Race
                </label>
                <select
                  value={character.race}
                  onChange={(e) =>
                    setCharacter((prev) => ({ ...prev, race: e.target.value }))
                  }
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
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
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Class
                </label>
                <select
                  value={character.class}
                  onChange={(e) =>
                    setCharacter((prev) => ({ ...prev, class: e.target.value }))
                  }
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
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
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Background
                </label>
                <select
                  value={character.background}
                  onChange={(e) =>
                    setCharacter((prev) => ({
                      ...prev,
                      background: e.target.value,
                    }))
                  }
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
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

            {/* Ability Scores */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white">
                  Ability Scores
                </h3>
                <button
                  type="button"
                  onClick={rollStats}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm"
                >
                  🎲 Roll Stats
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  "strength",
                  "dexterity",
                  "constitution",
                  "intelligence",
                  "wisdom",
                  "charisma",
                ].map((ability) => (
                  <div key={ability}>
                    <label className="block text-slate-300 text-sm font-medium mb-1 capitalize">
                      {ability}
                    </label>
                    <input
                      type="number"
                      min="3"
                      max="18"
                      value={character[ability]}
                      onChange={(e) =>
                        setCharacter((prev) => ({
                          ...prev,
                          [ability]: parseInt(e.target.value),
                        }))
                      }
                      className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Combat Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Hit Points
                </label>
                <input
                  type="number"
                  min="1"
                  value={character.hit_points}
                  onChange={(e) =>
                    setCharacter((prev) => ({
                      ...prev,
                      hit_points: parseInt(e.target.value),
                    }))
                  }
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Armor Class
                </label>
                <input
                  type="number"
                  min="1"
                  value={character.armor_class}
                  onChange={(e) =>
                    setCharacter((prev) => ({
                      ...prev,
                      armor_class: parseInt(e.target.value),
                    }))
                  }
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 bg-slate-600 hover:bg-slate-700 text-white py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  loading ||
                  !character.name ||
                  !character.race ||
                  !character.class
                }
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white py-2 rounded-lg"
              >
                {loading ? "Creating..." : "Create Character"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
