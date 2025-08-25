"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export default function PlayerStatusMonitor({
  campaignId,
  sessionActive = false,
}) {
  // Player status tracking
  const [playerStatuses, setPlayerStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [realTimeChannel, setRealTimeChannel] = useState(null);

  // Status types
  const statusTypes = {
    online: { color: "bg-green-500", label: "Online", icon: "🟢" },
    away: { color: "bg-yellow-500", label: "Away", icon: "🟡" },
    busy: { color: "bg-red-500", label: "Busy", icon: "🔴" },
    offline: { color: "bg-gray-500", label: "Offline", icon: "⚫" },
  };

  // Player requests and interactions
  const [playerRequests, setPlayerRequests] = useState([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [newRequest, setNewRequest] = useState({
    type: "question",
    message: "",
    priority: "normal",
  });

  // Load campaign players and their statuses
  const loadPlayerStatuses = useCallback(async () => {
    if (!campaignId) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      // Get campaign players with their profiles
      const { data: players } = await supabase
        .from("campaign_players")
        .select(
          `
          user_id,
          role,
          user_profiles (
            id,
            display_name,
            email,
            avatar_url
          )
        `
        )
        .eq("campaign_id", campaignId);

      if (players) {
        // Initialize player statuses
        const statuses = players.map((player) => ({
          userId: player.user_id,
          name:
            player.user_profiles?.display_name ||
            player.user_profiles?.email ||
            "Unknown",
          role: player.role,
          status: "offline",
          lastSeen: null,
          currentActivity: null,
          readiness: false,
          attentionLevel: 0,
          avatar: player.user_profiles?.avatar_url,
        }));

        setPlayerStatuses(statuses);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error loading player statuses:", error);
      setLoading(false);
    }
  }, [campaignId]);

  // Set up real-time status monitoring
  const setupRealtimeMonitoring = useCallback(() => {
    if (!campaignId) return;

    // Create a channel for player status updates
    const channel = supabase.channel(`player-status-${campaignId}`, {
      config: {
        broadcast: { self: true },
      },
    });

    // Listen for status updates
    channel.on("broadcast", { event: "status_update" }, (payload) => {
      const { userId, status, activity, readiness, attention } =
        payload.payload;

      setPlayerStatuses((prev) =>
        prev.map((player) =>
          player.userId === userId
            ? {
                ...player,
                status: status || player.status,
                currentActivity: activity || player.currentActivity,
                readiness:
                  readiness !== undefined ? readiness : player.readiness,
                attentionLevel:
                  attention !== undefined ? attention : player.attentionLevel,
                lastSeen: new Date().toISOString(),
              }
            : player
        )
      );
    });

    // Listen for player requests
    channel.on("broadcast", { event: "player_request" }, (payload) => {
      const request = payload.payload;
      setPlayerRequests((prev) => [request, ...prev].slice(0, 10)); // Keep last 10 requests
    });

    // Subscribe to the channel
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("Player status monitoring connected");
      }
    });

    setRealTimeChannel(channel);

    // Cleanup function
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [campaignId]);

  // Send status update
  const updatePlayerStatus = async (status, activity = null) => {
    if (!realTimeChannel) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      await realTimeChannel.send({
        type: "broadcast",
        event: "status_update",
        payload: {
          userId: session.user.id,
          status,
          activity,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  // Set player readiness
  const setReadiness = async (ready) => {
    if (!realTimeChannel) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      await realTimeChannel.send({
        type: "broadcast",
        event: "status_update",
        payload: {
          userId: session.user.id,
          readiness: ready,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error setting readiness:", error);
    }
  };

  // Send player request
  const sendPlayerRequest = async () => {
    if (!newRequest.message.trim() || !realTimeChannel) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const request = {
        id: Date.now().toString(),
        userId: session.user.id,
        type: newRequest.type,
        message: newRequest.message,
        priority: newRequest.priority,
        timestamp: new Date().toISOString(),
        resolved: false,
      };

      await realTimeChannel.send({
        type: "broadcast",
        event: "player_request",
        payload: request,
      });

      setNewRequest({ type: "question", message: "", priority: "normal" });
      setShowRequestForm(false);
    } catch (error) {
      console.error("Error sending player request:", error);
    }
  };

  // Resolve player request
  const resolveRequest = async (requestId) => {
    setPlayerRequests((prev) =>
      prev.map((req) =>
        req.id === requestId ? { ...req, resolved: true } : req
      )
    );
  };

  // Initialize on mount
  useEffect(() => {
    loadPlayerStatuses();
    const cleanup = setupRealtimeMonitoring();

    return cleanup;
  }, [loadPlayerStatuses, setupRealtimeMonitoring]);

  // Auto-update status based on activity
  useEffect(() => {
    if (!sessionActive) return;

    // Set status to online when session is active
    updatePlayerStatus("online", "In session");

    // Set up periodic ping to maintain online status
    const interval = setInterval(() => {
      updatePlayerStatus("online", "In session");
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [sessionActive, updatePlayerStatus]);

  if (loading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4">
        <div className="text-center text-gray-400">
          Loading player statuses...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">
          👥 Player Status Monitor
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRequestForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
          >
            📝 Request Help
          </button>
        </div>
      </div>

      {/* Player status grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {playerStatuses.map((player) => (
          <div key={player.userId} className="bg-slate-700/50 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {player.avatar ? (
                  <img
                    src={player.avatar}
                    alt={player.name}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center text-white text-sm">
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="font-semibold text-white">{player.name}</div>
                  <div className="text-xs text-gray-400 capitalize">
                    {player.role}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <div
                  className={`w-3 h-3 rounded-full ${
                    statusTypes[player.status]?.color || "bg-gray-500"
                  }`}
                ></div>
                <span className="text-xs text-gray-300">
                  {statusTypes[player.status]?.label || "Unknown"}
                </span>
              </div>
            </div>

            {/* Current activity */}
            {player.currentActivity && (
              <div className="text-sm text-gray-300 mb-2">
                {player.currentActivity}
              </div>
            )}

            {/* Readiness indicator */}
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  player.readiness ? "bg-green-400" : "bg-gray-500"
                }`}
              ></div>
              <span className="text-xs text-gray-400">
                {player.readiness ? "Ready" : "Not ready"}
              </span>
            </div>

            {/* Attention level */}
            <div className="space-y-1">
              <div className="text-xs text-gray-400">Attention</div>
              <div className="w-full bg-gray-600 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${player.attentionLevel}%` }}
                ></div>
              </div>
            </div>

            {/* Last seen */}
            {player.lastSeen && (
              <div className="text-xs text-gray-500 mt-2">
                Last seen: {new Date(player.lastSeen).toLocaleTimeString()}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick status controls for current user */}
      <div className="bg-slate-700/30 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Your Status</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {Object.entries(statusTypes).map(([status, config]) => (
            <button
              key={status}
              onClick={() => updatePlayerStatus(status)}
              className="flex items-center gap-1 bg-slate-600 hover:bg-slate-500 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              {config.icon} {config.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setReadiness(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
          >
            ✅ Ready
          </button>
          <button
            onClick={() => setReadiness(false)}
            className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition-colors"
          >
            ⏳ Not Ready
          </button>
        </div>
      </div>

      {/* Player requests */}
      {playerRequests.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white">
            📋 Player Requests
          </h3>
          <div className="space-y-2">
            {playerRequests.map((request) => (
              <div
                key={request.id}
                className={`border rounded-lg p-3 ${
                  request.resolved
                    ? "bg-green-900/20 border-green-700"
                    : request.priority === "urgent"
                    ? "bg-red-900/20 border-red-700"
                    : "bg-slate-700/50 border-slate-600"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-white capitalize">
                        {request.type}
                      </span>
                      {request.priority === "urgent" && (
                        <span className="text-xs bg-red-600 text-white px-2 py-1 rounded">
                          URGENT
                        </span>
                      )}
                      {request.resolved && (
                        <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">
                          RESOLVED
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-300">
                      {request.message}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(request.timestamp).toLocaleTimeString()}
                    </div>
                  </div>

                  {!request.resolved && (
                    <button
                      onClick={() => resolveRequest(request.id)}
                      className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs transition-colors"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request form modal */}
      {showRequestForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">
              Send Request
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Request Type
                </label>
                <select
                  value={newRequest.type}
                  onChange={(e) =>
                    setNewRequest((prev) => ({ ...prev, type: e.target.value }))
                  }
                  className="w-full bg-slate-900/50 border border-slate-600 rounded px-3 py-2 text-white"
                >
                  <option value="question">Question</option>
                  <option value="clarification">Clarification</option>
                  <option value="break">Break Request</option>
                  <option value="technical">Technical Issue</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Priority
                </label>
                <select
                  value={newRequest.priority}
                  onChange={(e) =>
                    setNewRequest((prev) => ({
                      ...prev,
                      priority: e.target.value,
                    }))
                  }
                  className="w-full bg-slate-900/50 border border-slate-600 rounded px-3 py-2 text-white"
                >
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Message
                </label>
                <textarea
                  value={newRequest.message}
                  onChange={(e) =>
                    setNewRequest((prev) => ({
                      ...prev,
                      message: e.target.value,
                    }))
                  }
                  className="w-full bg-slate-900/50 border border-slate-600 rounded px-3 py-2 text-white resize-none"
                  rows={3}
                  placeholder="Describe your request..."
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={sendPlayerRequest}
                disabled={!newRequest.message.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded transition-colors"
              >
                Send Request
              </button>
              <button
                onClick={() => setShowRequestForm(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
