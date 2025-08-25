"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "../../components/Header";
import { supabase } from "../../lib/supabase";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }

        // Get campaigns where user has characters
        const { data: campaignsData, error: campaignsError } = await supabase
          .from("characters")
          .select(
            `
            campaign_id,
            role,
            campaigns (
              id,
              name,
              description,
              created_at,
              created_by
            )
          `
          )
          .eq("user_id", session.user.id);

        if (campaignsError) throw campaignsError;

        // Remove duplicates and format data
        const uniqueCampaigns = [];
        const seen = new Set();

        campaignsData?.forEach((item) => {
          if (item.campaigns && !seen.has(item.campaigns.id)) {
            seen.add(item.campaigns.id);
            uniqueCampaigns.push({
              ...item.campaigns,
              user_role: item.role,
            });
          }
        });

        setCampaigns(uniqueCampaigns);
        setLoading(false);
      } catch (err) {
        console.error("Error loading campaigns:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    loadCampaigns();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <Header />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-white">Loading campaigns...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <Header />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-red-400">Error: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">My Campaigns</h1>
            <p className="text-gray-300">View and manage your D&D campaigns</p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <button
              onClick={() => router.push("/campaigns/new")}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white p-6 rounded-lg transition-all transform hover:scale-105 text-left"
            >
              <div className="text-2xl mb-2">➕</div>
              <div className="text-xl font-bold">Create New Campaign</div>
              <div className="text-sm opacity-80">Start a new adventure</div>
            </button>

            <button
              onClick={() => router.push("/join")}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white p-6 rounded-lg transition-all transform hover:scale-105 text-left"
            >
              <div className="text-2xl mb-2">🎯</div>
              <div className="text-xl font-bold">Join Campaign</div>
              <div className="text-sm opacity-80">Enter a campaign code</div>
            </button>
          </div>

          {/* Campaigns List */}
          {campaigns.length > 0 ? (
            <div className="grid gap-6">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition-colors"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">
                        {campaign.name}
                      </h3>
                      <p className="text-gray-300 mb-3">
                        {campaign.description || "No description provided"}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span>
                          Created{" "}
                          {new Date(campaign.created_at).toLocaleDateString()}
                        </span>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            campaign.user_role === "dm"
                              ? "bg-purple-900/50 text-purple-300"
                              : "bg-blue-900/50 text-blue-300"
                          }`}
                        >
                          {campaign.user_role === "dm"
                            ? "🧙‍♂️ Dungeon Master"
                            : "⚔️ Player"}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/campaign/${campaign.id}`)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() =>
                          router.push(`/campaign/${campaign.id}/play`)
                        }
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        🎲 Play
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-12 text-center">
              <div className="text-6xl mb-4">🐉</div>
              <h3 className="text-xl font-bold text-white mb-2">
                No Campaigns Yet
              </h3>
              <p className="text-gray-300 mb-6">
                Start your first adventure or join an existing campaign!
              </p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => router.push("/campaigns/new")}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors"
                >
                  ➕ Create Campaign
                </button>
                <button
                  onClick={() => router.push("/join")}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors"
                >
                  🎯 Join Campaign
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
