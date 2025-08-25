"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "../../../components/Header";
import { supabase } from "../../../lib/supabase";

export default function CampaignDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [campaign, setCampaign] = useState(null);
  const [players, setPlayers] = useState([]);
  const [playerCounts, setPlayerCounts] = useState({
    totalPlayers: 0,
    totalCharacters: 0,
  });
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "" });
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [campaignStarting, setCampaignStarting] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [notification, setNotification] = useState("");

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

        setCurrentUser(session.user);

        // Load campaign details
        const { data: campaignData, error: campaignError } = await supabase
          .from("campaigns")
          .select("*")
          .eq("id", params.id)
          .single();

        if (campaignError) throw campaignError;

        // If campaign doesn't have a join code, generate one
        if (
          !campaignData.invite_code &&
          campaignData.owner_id === session.user.id
        ) {
          try {
            const response = await fetch(
              `/api/campaigns/${params.id}/rotate-invite`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                  "Content-Type": "application/json",
                },
              }
            );

            if (response.ok) {
              const data = await response.json();
              campaignData.invite_code = data.join_code;
            }
          } catch (err) {
            console.log("Could not generate join code:", err);
          }
        }

        setCampaign(campaignData);

        // Check if campaign session has been started
        // Use updated_at timestamp as indicator (updated recently = session started)
        if (campaignData.is_active) {
          const now = new Date();
          const campaignUpdated = new Date(campaignData.updated_at);
          const timeSinceUpdate = now - campaignUpdated;

          // Consider started if updated in last 24 hours
          if (timeSinceUpdate < 24 * 60 * 60 * 1000) {
            setSessionStarted(true);
          }
        }

        // Check if current user has a character in this campaign
        const { data: userCharacter } = await supabase
          .from("characters")
          .select("id")
          .eq("campaign_id", params.id)
          .eq("user_id", session.user.id)
          .single();

        // If user is not the owner and doesn't have a character, redirect to character creation
        const isOwner = campaignData.owner_id === session.user.id;
        if (!isOwner && !userCharacter) {
          router.push(`/character/create?campaignId=${params.id}`);
          return;
        }

        // Load players who joined the campaign (from campaign_players table)
        // Note: campaign_players.user_id references user_profiles(id), not auth.users(id)
        const { data: campaignPlayersData, error: playersError } =
          await supabase
            .from("campaign_players")
            .select(
              `
            user_id,
            user_profiles!inner (
              id,
              display_name,
              email
            )
          `
            )
            .eq("campaign_id", params.id);

        console.log("Campaign players query result:", {
          campaignPlayersData,
          playersError,
        });

        // Load characters separately (for character count, not for member display)
        const { data: charactersData, error: charactersError } = await supabase
          .from("characters")
          .select(
            `
            id,
            name,
            class,
            level,
            user_id
          `
          )
          .eq("campaign_id", params.id);

        console.log("Characters query result:", {
          charactersData,
          charactersError,
        });

        // Load user profiles for characters (characters.user_id references auth.users(id))
        let characterProfiles = {};
        if (charactersData && charactersData.length > 0) {
          const characterUserIds = charactersData.map((char) => char.user_id);
          const { data: profilesData } = await supabase
            .from("user_profiles")
            .select("id, display_name, email")
            .in("id", characterUserIds);

          if (profilesData) {
            characterProfiles = profilesData.reduce((acc, profile) => {
              acc[profile.id] = profile;
              return acc;
            }, {});
          }
        }

        if (charactersError && Object.keys(charactersError).length > 0) {
          console.error("Error loading characters:", charactersError);
        }
        if (playersError && Object.keys(playersError).length > 0) {
          console.error("Error loading campaign players:", playersError);
        }

        // If both queries have significant errors, show error
        if (
          (charactersError && Object.keys(charactersError).length > 0) ||
          (playersError && Object.keys(playersError).length > 0)
        ) {
          console.error(
            "Error loading members - characters error:",
            charactersError,
            "players error:",
            playersError
          );
        } else {
          // Filter logic for owner-only system (no more DMs)
          const isOwner = (userId) => {
            return userId === campaignData.owner_id;
          };

          // Show all joined members (accounts), excluding the owner for this list
          const allMembers = (campaignPlayersData || [])
            .filter((player) => !isOwner(player.user_id))
            .map((player) => {
              // Check if this player has a character
              const playerCharacter = (charactersData || []).find(
                (char) => char.user_id === player.user_id
              );

              return {
                id: playerCharacter?.id || null,
                name: playerCharacter?.name || "No Character",
                class: playerCharacter?.class || "Pending",
                level: playerCharacter?.level || "-",
                user_id: player.user_id,
                role: "player",
                profiles: player.user_profiles || {
                  display_name: "Unknown",
                  email: "",
                },
                hasCharacter: !!playerCharacter,
              };
            });

          // Add the owner to the displayed players list if they have a character
          const ownerCharacter = (charactersData || []).find(
            (char) => char.user_id === campaignData.owner_id
          );

          let displayPlayers = [...allMembers];
          if (ownerCharacter) {
            // Get owner profile
            const { data: ownerProfile } = await supabase
              .from("user_profiles")
              .select("id, display_name, email")
              .eq("id", campaignData.owner_id)
              .single();

            displayPlayers.unshift({
              id: ownerCharacter.id,
              name: ownerCharacter.name,
              class: ownerCharacter.class,
              level: ownerCharacter.level,
              user_id: campaignData.owner_id,
              role: "owner",
              profiles: ownerProfile || {
                display_name: "Campaign Owner",
                email: "",
              },
              hasCharacter: true,
            });
          }

          console.log("Final members list:", allMembers);
          console.log("Display players list:", displayPlayers);
          setPlayers(displayPlayers);

          // Set total counts including the owner
          const totalPlayerCount = allMembers.length + 1; // +1 for owner
          const ownerCharacterForCount = (charactersData || []).find(
            (char) => char.user_id === campaignData.owner_id
          );
          const totalCharacterCount =
            allMembers.filter((p) => p.hasCharacter).length +
            (ownerCharacterForCount ? 1 : 0);

          // Store counts for display
          setPlayerCounts({
            totalPlayers: totalPlayerCount,
            totalCharacters: totalCharacterCount,
          });
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

      // Set up polling for session status changes (for real-time notifications)
      const checkSessionStatus = async () => {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) return;

          const { data: updatedCampaign } = await supabase
            .from("campaigns")
            .select("is_active, updated_at")
            .eq("id", params.id)
            .single();

          // Check if campaign was recently started
          if (updatedCampaign?.is_active) {
            const now = new Date();
            const campaignUpdated = new Date(updatedCampaign.updated_at);
            const timeSinceUpdate = now - campaignUpdated;

            // Consider started if updated in last 24 hours
            if (timeSinceUpdate < 24 * 60 * 60 * 1000 && !sessionStarted) {
              setSessionStarted(true);
              // Show notification that campaign has started
              if (campaign?.owner_id !== session.user.id) {
                // This is a player - show notification
                setNotification(
                  "🎲 Campaign has started! Click 'Go to Campaign' to join."
                );
                setTimeout(() => setNotification(""), 5000);
              }
            }
          }
        } catch (err) {
          console.error("Error checking session status:", err);
        }
      };

      // Check every 2 seconds for session status updates (more responsive)
      const pollInterval = setInterval(checkSessionStatus, 2000);

      // Cleanup interval on unmount
      return () => clearInterval(pollInterval);
    }
  }, [params.id, router]);

  const copyJoinCode = async () => {
    if (campaign?.invite_code) {
      await navigator.clipboard.writeText(campaign.invite_code);
      setCopyMessage("Join code copied!");
      setTimeout(() => setCopyMessage(""), 2000);
    }
  };

  const copyJoinLink = async () => {
    const joinLink = `${window.location.origin}/join?code=${campaign?.invite_code}`;
    await navigator.clipboard.writeText(joinLink);
    setCopyMessage("Join link copied!");
    setTimeout(() => setCopyMessage(""), 2000);
  };

  const regenerateJoinCode = async () => {
    if (!campaign) return;

    setRegenerating(true);
    setCopyMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Authentication required");
        return;
      }

      const response = await fetch(
        `/api/campaigns/${campaign.id}/rotate-invite`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to regenerate join code");
      }

      // Update campaign state with new join code
      setCampaign((prev) => ({
        ...prev,
        invite_code: data.join_code,
      }));

      setCopyMessage("New join code generated!");
      setTimeout(() => setCopyMessage(""), 3000);
    } catch (err) {
      console.error("Error regenerating join code:", err);
      setError(err.message);
    } finally {
      setRegenerating(false);
    }
  };

  const startEdit = () => {
    setEditForm({
      name: campaign?.name || "",
      description: campaign?.description || "",
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditForm({ name: "", description: "" });
  };

  const updateCampaign = async () => {
    if (!campaign || !editForm.name.trim()) return;

    setUpdating(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Authentication required");
        return;
      }

      const response = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editForm.name.trim(),
          description: editForm.description.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update campaign");
      }

      // Update campaign state
      setCampaign(data.campaign);
      setEditing(false);
      setCopyMessage("Campaign updated successfully!");
      setTimeout(() => setCopyMessage(""), 3000);
    } catch (err) {
      console.error("Error updating campaign:", err);
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const deleteCampaign = async () => {
    if (
      !campaign ||
      !window.confirm(
        `Are you sure you want to delete "${campaign.name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Authentication required");
        return;
      }

      const response = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete campaign");
      }

      // Redirect to dashboard after successful deletion
      router.push("/dashboard");
    } catch (err) {
      console.error("Error deleting campaign:", err);
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const startCampaign = async () => {
    if (!campaign) return;

    setCampaignStarting(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Authentication required");
        return;
      }

      const response = await fetch(`/api/campaigns/${campaign.id}/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start campaign");
      }

      // Mark session as started
      setSessionStarted(true);

      // Redirect to session page after a brief delay
      setTimeout(() => {
        router.push(`/campaign/${params.id}/session`);
      }, 1000);
    } catch (err) {
      console.error("Error starting campaign:", err);
      setError(err.message);
    } finally {
      setCampaignStarting(false);
    }
  };

  const goToCampaign = () => {
    router.push(`/campaign/${params.id}/session`);
  };

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

  // All players are just players now (no DMs)
  const currentUserPlayer = players.find((p) => p.user_id === currentUser?.id);

  // Check if user is campaign owner
  const isOwner = currentUser && currentUser.id === campaign?.owner_id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <Header />

      {/* Real-time Notification */}
      {notification && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg border border-green-500">
            {notification}
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        {campaign && (
          <div className="max-w-4xl mx-auto">
            {/* Campaign Header */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6 mb-6">
              {editing ? (
                /* Edit Mode */
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Campaign Name
                    </label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter campaign name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      rows={3}
                      className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter campaign description"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={updateCampaign}
                      disabled={updating || !editForm.name.trim()}
                      className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      {updating ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={updating}
                      className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h1 className="text-3xl font-bold text-white">
                      {campaign.name}
                    </h1>
                    {(campaign.dm_id === currentUser?.id ||
                      campaign.owner_id === currentUser?.id) && (
                      <div className="flex gap-2">
                        <button
                          onClick={startEdit}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg transition-colors text-sm"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={deleteCampaign}
                          disabled={deleting}
                          className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1 rounded-lg transition-colors text-sm"
                        >
                          {deleting ? "Deleting..." : "🗑️ Delete"}
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-gray-300 mb-4">
                    {campaign.description || "No description provided."}
                  </p>
                </div>
              )}

              {/* Campaign Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-400">
                    {playerCounts.totalPlayers}
                  </div>
                  <div className="text-sm text-gray-300">Players</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-400">
                    {playerCounts.totalCharacters}
                  </div>
                  <div className="text-sm text-gray-300">
                    Characters Created
                  </div>
                </div>
              </div>

              {/* Join Code Section */}
              <div className="bg-slate-700/30 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold text-white">
                    🔗 Invite Others
                  </h3>
                  {campaign.owner_id === currentUser?.id &&
                    campaign.invite_code && (
                      <button
                        onClick={regenerateJoinCode}
                        disabled={regenerating}
                        className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1 rounded-lg transition-colors text-sm"
                      >
                        {regenerating ? (
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                            Generating...
                          </div>
                        ) : (
                          "🔄 New Code"
                        )}
                      </button>
                    )}
                </div>
                {campaign.invite_code ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">
                        Join Code
                      </label>
                      <div className="flex">
                        <input
                          type="text"
                          value={campaign.invite_code}
                          readOnly
                          className="flex-1 bg-slate-900/50 border border-slate-600 rounded-l-lg px-3 py-2 text-white font-mono text-lg tracking-wider text-center"
                        />
                        <button
                          onClick={copyJoinCode}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-r-lg transition-colors"
                        >
                          📋 Copy
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">
                        Direct Join Link
                      </label>
                      <div className="flex">
                        <input
                          type="text"
                          value={`${
                            typeof window !== "undefined"
                              ? window.location.origin
                              : ""
                          }/join?code=${campaign.invite_code}`}
                          readOnly
                          className="flex-1 bg-slate-900/50 border border-slate-600 rounded-l-lg px-3 py-2 text-white text-sm"
                        />
                        <button
                          onClick={copyJoinLink}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-r-lg transition-colors"
                        >
                          🔗 Copy Link
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                    <div className="text-yellow-300 text-sm">
                      {campaign.owner_id === currentUser?.id ? (
                        <>
                          <strong>Join code not available.</strong> As the
                          campaign owner, you can reload the page to generate
                          one, or contact support if the issue persists.
                        </>
                      ) : (
                        <>
                          <strong>Join code not available.</strong> Ask the
                          campaign owner to check the campaign settings.
                        </>
                      )}
                    </div>
                  </div>
                )}
                {copyMessage && (
                  <div className="text-green-400 text-sm mt-2 flex items-center gap-1">
                    <span>✓</span> {copyMessage}
                  </div>
                )}
                {campaign.invite_code && (
                  <div className="mt-3 p-3 bg-slate-600/30 rounded border border-slate-600">
                    <p className="text-xs text-gray-300">
                      <strong>
                        Share this code or link with friends to invite them to
                        your campaign.
                      </strong>
                      {campaign.owner_id === currentUser?.id && (
                        <span className="block mt-1 text-gray-400">
                          As the campaign owner, you can regenerate the join
                          code if needed for security.
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* Start Campaign Button */}
              {campaign.owner_id === currentUser?.id ? (
                <div className="text-center">
                  {sessionStarted ? (
                    <button
                      onClick={goToCampaign}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-4 rounded-lg text-xl font-bold transition-all transform hover:scale-105 shadow-lg"
                    >
                      🎮 Go to Campaign
                    </button>
                  ) : (
                    <button
                      onClick={startCampaign}
                      disabled={campaignStarting}
                      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-4 rounded-lg text-xl font-bold transition-all transform hover:scale-105 shadow-lg"
                    >
                      {campaignStarting ? (
                        <span className="flex items-center gap-2">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Starting Campaign...
                        </span>
                      ) : (
                        "🎲 Start Campaign"
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  {sessionStarted ? (
                    <button
                      onClick={goToCampaign}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-4 rounded-lg text-xl font-bold transition-all transform hover:scale-105 shadow-lg"
                    >
                      🎮 Go to Campaign
                    </button>
                  ) : (
                    <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                      <div className="text-yellow-300 text-center">
                        ⏳ Waiting for campaign owner to start the campaign
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Players List */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">
                👥 Campaign Members
              </h2>

              {/* All Players */}
              {players.length > 0 ? (
                <div>
                  <h3 className="text-lg font-medium text-blue-400 mb-3">
                    ⚔️ Players
                  </h3>
                  <div className="grid gap-3">
                    {players.map((player) => (
                      <div
                        key={player.id}
                        className={`border rounded-lg p-4 ${
                          player.role === "owner"
                            ? "bg-purple-900/30 border-purple-700"
                            : "bg-blue-900/30 border-blue-700"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-semibold text-white">
                              {player.name}
                            </div>
                            <div className="text-sm text-blue-300">
                              {player.class} • Level {player.level}
                            </div>
                            <div className="text-xs text-gray-400">
                              {player.profiles?.display_name ||
                                player.profiles?.email}
                            </div>
                          </div>
                          <div
                            className={`font-semibold ${
                              player.role === "owner"
                                ? "text-purple-400"
                                : "text-blue-400"
                            }`}
                          >
                            {player.role === "owner" ? "👑 Owner" : "Player"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-2">
                    No players have joined yet
                  </div>
                  <div className="text-sm text-gray-500">
                    Share the join code above to invite players!
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
