"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import Button from "@/components/Button";

export default function CharactersPage() {
  const [characters, setCharacters] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.push("/login");
        return;
      }

      await Promise.all([loadCharacters(), loadCampaigns()]);
    } catch (error) {
      console.error("Error loading user data:", error);
      setError("Failed to load characters. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadCharacters = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers = {
        "Content-Type": "application/json",
      };

      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      // Get all user's characters across all campaigns
      const { data: userCharacters, error } = await supabase
        .from("characters")
        .select(
          `
          *,
          campaigns(id, name)
        `
        )
        .eq("user_id", session.user.id)
        .eq("is_active", true)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Characters fetch error:", error);
        setError("Failed to load characters");
        return;
      }

      setCharacters(userCharacters || []);
    } catch (error) {
      console.error("Characters load error:", error);
      setError("Failed to load characters");
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

  const formatModifier = (mod) => {
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  const calculateProficiencyBonus = (level) => {
    return Math.ceil(level / 4) + 1;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading characters...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Your Characters
            </h1>
            <p className="text-slate-300">
              Manage your D&D 5e characters across all campaigns
            </p>
          </div>
          <Button onClick={() => router.push("/characters/new")}>
            ⚔️ Create Character
          </Button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* Characters Grid */}
        {characters.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-lg rounded-lg border border-white/20 p-12 text-center">
            <div className="text-6xl mb-4">⚔️</div>
            <h3 className="text-xl font-medium text-white mb-2">
              No Characters Yet
            </h3>
            <p className="text-slate-300 mb-6">
              Create your first D&D 5e character to begin your adventures!
            </p>
            <Button onClick={() => router.push("/characters/new")}>
              Create Your First Character
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {characters.map((character) => (
              <div
                key={character.id}
                className="bg-white/10 backdrop-blur-lg rounded-lg border border-white/20 p-6 hover:bg-white/15 transition-colors cursor-pointer"
                onClick={() => router.push(`/character/${character.id}`)}
              >
                {/* Character Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {character.name}
                    </h3>
                    <p className="text-slate-300 text-sm">
                      Level {character.level} {character.race} {character.class}
                    </p>
                  </div>
                  <div className="text-2xl">
                    {character.class === "Fighter" && "⚔️"}
                    {character.class === "Wizard" && "🔮"}
                    {character.class === "Rogue" && "🗡️"}
                    {character.class === "Cleric" && "✨"}
                    {character.class === "Ranger" && "🏹"}
                    {character.class === "Barbarian" && "🪓"}
                    {character.class === "Bard" && "🎵"}
                    {character.class === "Druid" && "🌿"}
                    {character.class === "Monk" && "🥋"}
                    {character.class === "Paladin" && "⚡"}
                    {character.class === "Sorcerer" && "🔥"}
                    {character.class === "Warlock" && "👹"}
                    {![
                      "Fighter",
                      "Wizard",
                      "Rogue",
                      "Cleric",
                      "Ranger",
                      "Barbarian",
                      "Bard",
                      "Druid",
                      "Monk",
                      "Paladin",
                      "Sorcerer",
                      "Warlock",
                    ].includes(character.class) && "⚔️"}
                  </div>
                </div>

                {/* Campaign Info */}
                {character.campaigns && (
                  <div className="mb-4 px-3 py-2 bg-purple-500/20 rounded border border-purple-500/30">
                    <p className="text-purple-200 text-sm">
                      📖 {character.campaigns.name}
                    </p>
                  </div>
                )}

                {/* Core Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center">
                    <div className="text-sm text-slate-400">AC</div>
                    <div className="text-lg font-bold text-white">
                      {character.armor_class || 10}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-slate-400">HP</div>
                    <div className="text-lg font-bold text-white">
                      {character.hit_points_current ||
                        character.hit_points_max ||
                        1}
                      /{character.hit_points_max || 1}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-slate-400">Prof</div>
                    <div className="text-lg font-bold text-white">
                      +{calculateProficiencyBonus(character.level)}
                    </div>
                  </div>
                </div>

                {/* Ability Scores */}
                <div className="grid grid-cols-6 gap-2 text-xs">
                  {[
                    "strength",
                    "dexterity",
                    "constitution",
                    "intelligence",
                    "wisdom",
                    "charisma",
                  ].map((ability) => (
                    <div key={ability} className="text-center">
                      <div className="text-slate-400 uppercase">
                        {ability.slice(0, 3)}
                      </div>
                      <div className="text-white font-semibold">
                        {character[ability] || 10}
                      </div>
                      <div className="text-slate-300">
                        {formatModifier(
                          calculateAbilityMod(character[ability] || 10)
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Updated{" "}
                    {new Date(character.updated_at).toLocaleDateString()}
                  </span>
                  <span className="text-purple-300">Click to view →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
