"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../../../components/Header";
import { supabase } from "../../../lib/supabase";

export default function NewCampaignPage() {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    maxPlayers: 6,
    isPublic: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create campaign");
      }

      // Redirect to the new campaign
      router.push(`/campaign/${data.campaign.id}`);
    } catch (err) {
      console.error("Error creating campaign:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <button
              onClick={() => router.back()}
              className="text-gray-300 hover:text-white mb-4 flex items-center gap-2"
            >
              ← Back
            </button>
            <h1 className="text-3xl font-bold text-white mb-2">
              Create New Campaign
            </h1>
            <p className="text-gray-300">
              Set up your D&D adventure for players to join
            </p>
          </div>

          {/* Campaign Creation Form */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-8">
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
                <div className="text-red-300">{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Campaign Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  maxLength={100}
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter your campaign name"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Choose a memorable name for your adventure
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  maxLength={500}
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Describe your campaign world, setting, or story..."
                />
                <p className="text-xs text-gray-400 mt-1">
                  Help players understand what kind of adventure awaits
                </p>
              </div>

              {/* Max Players */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Maximum Players
                </label>
                <select
                  name="maxPlayers"
                  value={formData.maxPlayers}
                  onChange={handleInputChange}
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value={3}>3 Players</option>
                  <option value={4}>4 Players</option>
                  <option value={5}>5 Players</option>
                  <option value={6}>6 Players</option>
                  <option value={7}>7 Players</option>
                  <option value={8}>8 Players</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Recommended: 4-6 players for optimal gameplay
                </p>
              </div>

              {/* Privacy Settings */}
              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="isPublic"
                    checked={formData.isPublic}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-purple-600 bg-slate-900 border-slate-600 rounded focus:ring-purple-500 focus:ring-2"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-300">
                      Make campaign publicly discoverable
                    </div>
                    <div className="text-xs text-gray-400">
                      Others can find and request to join your campaign
                    </div>
                  </div>
                </label>
              </div>

              {/* Campaign Features Info */}
              <div className="bg-slate-700/30 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-2">
                  ✨ Your campaign will include:
                </h3>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• AI-powered Dungeon Master assistance</li>
                  <li>• Integrated dice rolling and character sheets</li>
                  <li>• Session logs and campaign memory</li>
                  <li>• Private join codes for invitation</li>
                  <li>• Real-time multiplayer chat</li>
                </ul>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={loading || !formData.name.trim()}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-all"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Creating Campaign...
                    </div>
                  ) : (
                    "🎲 Create Campaign"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => router.back()}
                  disabled={loading}
                  className="bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>

          {/* Help Section */}
          <div className="mt-8 bg-blue-900/20 border border-blue-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-300 mb-3">
              🧙‍♂️ New to D&D?
            </h3>
            <p className="text-blue-200 text-sm mb-3">
              Don't worry! Our AI Dungeon Master will help guide you through the
              adventure. You can always adjust campaign settings later.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() =>
                  window.open("https://dnd.wizards.com/how-to-play", "_blank")
                }
                className="text-blue-300 hover:text-blue-200 text-sm underline"
              >
                Learn D&D Basics
              </button>
              <button
                onClick={() =>
                  window.open(
                    "/sample-data/dragon-of-icespire-peak-campaign.txt",
                    "_blank"
                  )
                }
                className="text-blue-300 hover:text-blue-200 text-sm underline"
              >
                View Sample Campaign
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
