"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Check current session first
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          await loadUserProfile(session.user);
          await loadCampaigns();
        } else {
          router.push("/login");
          return;
        }

        setLoading(false);
      } catch (error) {
        if (mounted) {
          console.error("Auth initialization error:", error);
          router.push("/login");
        }
      }
    };

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_IN" && session) {
        setUser(session.user);
        await loadUserProfile(session.user);
        await loadCampaigns();
        setLoading(false);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        router.push("/login");
      } else if (event === "TOKEN_REFRESHED" && session) {
        setUser(session.user);
      }
    });

    initializeAuth();

    // Cleanup
    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [router]);

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

  const loadUserProfile = async (user) => {
    try {
      console.log("Loading profile for user:", user.id);

      const { data: profile, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      console.log("Profile query result:", { profile, error });

      if (error && error.code === "PGRST116") {
        // Profile doesn't exist, create it
        console.log("Creating new profile for user:", user.id);

        const displayName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "Adventurer";

        const { data: newProfile, error: insertError } = await supabase
          .from("user_profiles")
          .insert({
            id: user.id,
            display_name: displayName,
            email: user.email,
            // role stays null until user selects it
          })
          .select()
          .single();

        console.log("Profile creation result:", { newProfile, insertError });

        if (insertError) {
          console.error("Error creating user profile:", insertError);
          // Still set a basic profile object for display
          setProfile({
            id: user.id,
            display_name: displayName,
            email: user.email,
            role: null,
          });
        } else {
          setProfile(newProfile);
          console.log("Profile created successfully for new user");
        }
      } else if (!error && profile) {
        setProfile(profile);
        console.log("Profile loaded successfully");
      } else {
        console.error("Error loading user profile:", error);
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  };

  const loadCampaigns = async () => {
    try {
      // Get the current session to send in the request
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers = {
        "Content-Type": "application/json",
      };

      // Add authorization header if we have a session
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const response = await fetch("/api/campaigns", { headers });
      const data = await response.json();

      if (response.ok) {
        setCampaigns(data.campaigns);
        setError(""); // Clear any previous errors
      } else {
        if (response.status === 401) {
          // Session expired, redirect to login
          await supabase.auth.signOut();
          router.push("/login");
          return;
        }
        // Only show database-related errors as user-friendly messages
        if (data.error && data.error.includes("foreign key relationship")) {
          setError(
            "Database setup required. Please run the database fix script."
          );
        } else if (data.error && data.error.includes("infinite recursion")) {
          setError(
            "Database configuration issue. Please check your RLS policies."
          );
        } else {
          setError(data.error || "Failed to load campaigns");
        }
      }
    } catch (err) {
      console.error("Campaigns fetch error:", err);
      setError("Unable to connect to the server. Please try again.");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const CreateCampaignModal = () => {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [creating, setCreating] = useState(false);

    const handleCreate = async (e) => {
      e.preventDefault();
      setCreating(true);
      setError("");

      try {
        // Get the current session for authorization
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const headers = {
          "Content-Type": "application/json",
        };

        // Add authorization header if we have a session
        if (session?.access_token) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
        }

        const response = await fetch("/api/campaigns", {
          method: "POST",
          headers,
          body: JSON.stringify({ name, description }),
        });

        const data = await response.json();

        if (response.ok) {
          setMessage("Campaign created successfully!");
          setShowCreateCampaign(false);
          loadCampaigns();
          setName("");
          setDescription("");
          setError(""); // Clear any previous errors
        } else {
          // Provide user-friendly error messages
          if (data.error && data.error.includes("infinite recursion")) {
            setError(
              "Database configuration issue detected. Please run the database fix script to resolve RLS policy conflicts."
            );
          } else if (data.error && data.error.includes("foreign key")) {
            setError(
              "Database setup incomplete. Please ensure all required tables and relationships are properly configured."
            );
          } else {
            setError(data.error || "Failed to create campaign");
          }
        }
      } catch (err) {
        console.error("Campaign creation error:", err);
        setError(
          "Unable to create campaign. Please check your connection and try again."
        );
      } finally {
        setCreating(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md border border-slate-600">
          <h2 className="text-xl font-bold mb-4 text-white">
            Create New Campaign
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">
                Campaign Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter campaign name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Optional campaign description"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg"
              >
                {creating ? "Creating..." : "Create Campaign"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateCampaign(false)}
                className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-medium py-2 px-4 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        {/* Header */}
        <Header />

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          {/* Messages */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="text-red-400 text-xl">⚠️</div>
                <div className="flex-1">
                  <h4 className="text-red-300 font-medium mb-1">
                    Something went wrong
                  </h4>
                  <p className="text-red-300/90 text-sm">{error}</p>
                  {error.includes("database") && (
                    <div className="mt-3 p-3 bg-red-500/10 rounded border border-red-500/30">
                      <p className="text-red-300/80 text-xs mb-2">
                        <strong>Quick Fix:</strong> Run the database fix script
                        in your Supabase SQL editor
                      </p>
                      <code className="text-red-200 text-xs bg-red-500/20 px-2 py-1 rounded">
                        Execute: database-fix.sql
                      </code>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setError("")}
                  className="text-red-400 hover:text-red-300 text-lg leading-none"
                  title="Dismiss"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {message && (
            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 mb-6">
              <p className="text-green-300">{message}</p>
              <button
                onClick={() => setMessage("")}
                className="text-green-400 hover:text-green-300 text-sm mt-1"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Campaigns List */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Player Campaigns */}
            <div className="bg-white/10 backdrop-blur-lg rounded-lg border border-white/20 p-6">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-2xl">🎭</span>
                <h2 className="text-xl font-bold text-white">
                  Player Campaigns
                </h2>
                <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full text-sm">
                  {
                    campaigns.filter(
                      (campaign) =>
                        campaign.dm_id !== user?.id &&
                        campaign.owner_id !== user?.id
                    ).length
                  }
                </span>
              </div>

              {campaigns.filter(
                (campaign) =>
                  campaign.dm_id !== user?.id && campaign.owner_id !== user?.id
              ).length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">🗺️</div>
                  <h3 className="text-lg font-medium text-white mb-2">
                    No Adventures Yet
                  </h3>
                  <p className="text-slate-300 text-sm mb-4">
                    Join a campaign to start your adventure!
                  </p>
                  <button
                    onClick={() => router.push("/join")}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    Join Campaign
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {campaigns
                    .filter(
                      (campaign) =>
                        campaign.dm_id !== user?.id &&
                        campaign.owner_id !== user?.id
                    )
                    .map((campaign) => (
                      <div
                        key={campaign.id}
                        className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors cursor-pointer group"
                        onClick={() => router.push(`/campaign/${campaign.id}`)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-white font-medium group-hover:text-blue-300 transition-colors">
                              {campaign.name}
                            </h3>
                            {campaign.description && (
                              <p className="text-slate-300 text-sm mt-1 line-clamp-2">
                                {campaign.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
                              <span>🎭 Player</span>
                              <span>
                                Joined{" "}
                                {new Date(
                                  campaign.created_at
                                ).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="text-slate-400 group-hover:text-white transition-colors">
                            →
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* DM Campaigns */}
            <div className="bg-white/10 backdrop-blur-lg rounded-lg border border-white/20 p-6">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-2xl">👑</span>
                <h2 className="text-xl font-bold text-white">My Campaigns</h2>
                <span className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full text-sm">
                  {
                    campaigns.filter(
                      (campaign) =>
                        campaign.dm_id === user?.id ||
                        campaign.owner_id === user?.id
                    ).length
                  }
                </span>
              </div>

              {campaigns.filter(
                (campaign) =>
                  campaign.dm_id === user?.id || campaign.owner_id === user?.id
              ).length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">🏰</div>
                  <h3 className="text-lg font-medium text-white mb-2">
                    No Campaigns Created
                  </h3>
                  <p className="text-slate-300 text-sm mb-4">
                    Create your first campaign and start your story!
                  </p>
                  <button
                    onClick={() => setShowCreateCampaign(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    Create Campaign
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {campaigns
                    .filter(
                      (campaign) =>
                        campaign.dm_id === user?.id ||
                        campaign.owner_id === user?.id
                    )
                    .map((campaign) => (
                      <div
                        key={campaign.id}
                        className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors cursor-pointer group"
                        onClick={() => router.push(`/campaign/${campaign.id}`)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-white font-medium group-hover:text-purple-300 transition-colors">
                              {campaign.name}
                            </h3>
                            {campaign.description && (
                              <p className="text-slate-300 text-sm mt-1 line-clamp-2">
                                {campaign.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
                              <span>👑 DM</span>
                              <span>
                                Created{" "}
                                {new Date(
                                  campaign.created_at
                                ).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="text-slate-400 group-hover:text-white transition-colors">
                            →
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Modals */}
        {showCreateCampaign && <CreateCampaignModal />}
      </div>
    </>
  );
}
