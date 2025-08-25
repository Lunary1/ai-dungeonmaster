"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "../../components/Header";
import { supabase } from "../../lib/supabase";

export default function JoinCampaignPage() {
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for join code in URL
  useEffect(() => {
    const codeFromUrl = searchParams.get("code");
    if (codeFromUrl) {
      setJoinCode(codeFromUrl);
    }
  }, [searchParams]);

  const handleJoinCampaign = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      setError("Please enter a join code");
      return;
    }

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

      const response = await fetch("/api/campaigns/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          inviteCode: joinCode.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to join campaign");
      }

      // Success! Redirect to dashboard
      router.push("/dashboard");
    } catch (err) {
      console.error("Error joining campaign:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Header />

      <div className="pt-16">
        <div className="max-w-md mx-auto p-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              Join Campaign
            </h1>
            <p className="text-gray-300">
              Enter your campaign join code to get started
            </p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
              <div className="text-red-300">{error}</div>
            </div>
          )}

          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-8">
            <form onSubmit={handleJoinCampaign} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Campaign Join Code *
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  required
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-lg tracking-wider text-center"
                  placeholder="Enter campaign code..."
                />
                <p className="text-xs text-gray-400 mt-1">
                  Ask your Dungeon Master for the campaign join code
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !joinCode.trim()}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-all"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Joining campaign...
                  </div>
                ) : (
                  "🚀 Join Campaign"
                )}
              </button>
            </form>

            {/* Help Section */}
            <div className="mt-8 bg-blue-900/20 border border-blue-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-300 mb-3">
                📝 How to Join
              </h3>
              <ol className="text-blue-200 text-sm space-y-2">
                <li>1. Get the campaign join code from your Dungeon Master</li>
                <li>2. Enter the code above and click "Join Campaign"</li>
                <li>3. You'll be added to the campaign member list</li>
                <li>
                  4. Create your character when you first visit the campaign
                </li>
                <li>5. Start playing!</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
