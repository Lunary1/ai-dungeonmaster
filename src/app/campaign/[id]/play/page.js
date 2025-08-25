"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "../../../../components/Header";
import ChatWindow from "../../../../components/ChatWindow";
import CharacterSidebar from "../../../../components/CharacterSidebar";
import { supabase } from "../../../../lib/supabase";

export default function CampaignGamePage() {
  const params = useParams();
  const router = useRouter();
  const [campaign, setCampaign] = useState(null);
  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadCampaignData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }

        // Load campaign
        const { data: campaignData, error: campaignError } = await supabase
          .from("campaigns")
          .select("*")
          .eq("id", params.id)
          .single();

        if (campaignError) throw campaignError;
        setCampaign(campaignData);

        // Load user's character in this campaign
        const { data: characterData } = await supabase
          .from("characters")
          .select("*")
          .eq("campaign_id", params.id)
          .eq("user_id", session.user.id)
          .single();

        if (characterData) {
          setCharacter(characterData);
        }

        setLoading(false);
      } catch (err) {
        console.error("Error loading campaign:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    if (params.id) {
      loadCampaignData();
    }
  }, [params.id, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <Header />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-white">Loading campaign...</div>
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

      {/* Campaign Header with Back Button */}
      <div className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(`/campaign/${params.id}`)}
                className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg transition-colors text-sm"
              >
                ← Back to Details
              </button>
              {campaign && (
                <div>
                  <h1 className="text-xl font-bold text-white">
                    {campaign.name}
                  </h1>
                  <div className="text-sm text-gray-400">Campaign Session</div>
                </div>
              )}
            </div>
            <div className="text-sm text-gray-400">🎲 Game in Progress</div>
          </div>
        </div>
      </div>

      {/* Game Interface */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <ChatWindow campaignId={params.id} character={character} />
          </div>

          {character && (
            <div className="lg:w-80">
              <CharacterSidebar character={character} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
