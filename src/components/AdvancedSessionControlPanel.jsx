"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export default function AdvancedSessionControlPanel({
  campaignId,
  sessionData,
  isDM = false,
}) {
  // Core session state
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionTimer, setSessionTimer] = useState(0);
  const [breakMode, setBreakMode] = useState(false);
  const [breakTimer, setBreakTimer] = useState(0);

  // Party monitoring
  const [partyHealth, setPartyHealth] = useState([]);
  const [playerStatuses, setPlayerStatuses] = useState([]);

  // Session controls
  const [pauseSession, setPauseSession] = useState(false);
  const [sessionNotes, setSessionNotes] = useState("");
  const [emergencyMode, setEmergencyMode] = useState(false);

  // Live metrics
  const [sessionMetrics, setSessionMetrics] = useState({
    totalMessages: 0,
    combatRounds: 0,
    npcsIntroduced: 0,
    plotBeatsAdvanced: 0,
    playerEngagement: 0,
  });

  // Timer management
  useEffect(() => {
    let interval;

    if (sessionActive && !pauseSession && !breakMode) {
      interval = setInterval(() => {
        setSessionTimer((prev) => prev + 1);
      }, 1000);
    } else if (breakMode) {
      interval = setInterval(() => {
        setBreakTimer((prev) => {
          if (prev <= 1) {
            setBreakMode(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [sessionActive, pauseSession, breakMode]);

  // Load party data
  const loadPartyData = useCallback(async () => {
    if (!campaignId) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      // Load party health and status
      const { data: characters } = await supabase
        .from("characters")
        .select(
          `
          id, name, class, level, user_id,
          current_hp, max_hp, temp_hp,
          status_effects, resources,
          user_profiles (display_name)
        `
        )
        .eq("campaign_id", campaignId);

      if (characters) {
        setPartyHealth(
          characters.map((char) => ({
            id: char.id,
            name: char.name,
            class: char.class,
            level: char.level,
            currentHP: char.current_hp || char.max_hp || 0,
            maxHP: char.max_hp || 0,
            tempHP: char.temp_hp || 0,
            statusEffects: char.status_effects || [],
            resources: char.resources || {},
            playerName: char.user_profiles?.display_name || "Unknown",
          }))
        );
      }
    } catch (error) {
      console.error("Error loading party data:", error);
    }
  }, [campaignId]);

  // Start/stop session
  const toggleSession = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const newSessionState = !sessionActive;

      const response = await fetch(
        `/api/campaigns/${campaignId}/session-control`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: newSessionState ? "start" : "stop",
            timestamp: new Date().toISOString(),
          }),
        }
      );

      if (response.ok) {
        setSessionActive(newSessionState);
        if (newSessionState) {
          setSessionTimer(0);
          loadPartyData();
        }
      }
    } catch (error) {
      console.error("Error toggling session:", error);
    }
  };

  // Start break
  const startBreak = (minutes = 15) => {
    setBreakMode(true);
    setBreakTimer(minutes * 60);

    // Broadcast break to all players
    broadcastSessionUpdate({
      type: "break_started",
      duration: minutes,
      message: `Break time! ${minutes} minutes.`,
    });
  };

  // Emergency pause
  const emergencyPause = () => {
    setEmergencyMode(true);
    setPauseSession(true);

    broadcastSessionUpdate({
      type: "emergency_pause",
      message: "Session paused by DM. Please wait for further instructions.",
    });
  };

  // Broadcast session updates
  const broadcastSessionUpdate = async (update) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(`/api/campaigns/${campaignId}/broadcast`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "session_update",
          data: update,
        }),
      });
    } catch (error) {
      console.error("Error broadcasting session update:", error);
    }
  };

  // Format time display
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  // Load session data on mount
  useEffect(() => {
    if (sessionData?.sessionStarted) {
      setSessionActive(true);
      loadPartyData();
    }
  }, [sessionData, loadPartyData]);

  if (!isDM) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4">
        <div className="text-center text-gray-400">
          Session control panel is only available to the DM.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          🎮 Session Control Panel
          {sessionActive && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-green-400 text-sm">LIVE</span>
            </div>
          )}
        </h2>

        {emergencyMode && (
          <div className="bg-red-600 text-white px-3 py-1 rounded-lg text-sm font-bold animate-pulse">
            🚨 EMERGENCY MODE
          </div>
        )}
      </div>

      {/* Session Timer and Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="text-sm text-gray-300 mb-1">Session Time</div>
          <div className="text-2xl font-bold text-white">
            {formatTime(sessionTimer)}
          </div>
          {sessionActive && (
            <div className="text-xs text-green-400 mt-1">
              {pauseSession ? "⏸️ Paused" : "▶️ Running"}
            </div>
          )}
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="text-sm text-gray-300 mb-1">Break Timer</div>
          <div className="text-2xl font-bold text-white">
            {breakMode ? formatTime(breakTimer) : "--:--"}
          </div>
          {breakMode && (
            <div className="text-xs text-yellow-400 mt-1">
              ☕ Break in progress
            </div>
          )}
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="text-sm text-gray-300 mb-1">Session Metrics</div>
          <div className="text-lg font-bold text-white">
            {sessionMetrics.totalMessages} msgs
          </div>
          <div className="text-xs text-blue-400 mt-1">
            {sessionMetrics.combatRounds} rounds •{" "}
            {sessionMetrics.npcsIntroduced} NPCs
          </div>
        </div>
      </div>

      {/* Main Controls */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={toggleSession}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
            sessionActive
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-green-600 hover:bg-green-700 text-white"
          }`}
        >
          {sessionActive ? "⏹️ End Session" : "▶️ Start Session"}
        </button>

        {sessionActive && (
          <>
            <button
              onClick={() => setPauseSession(!pauseSession)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                pauseSession
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-yellow-600 hover:bg-yellow-700 text-white"
              }`}
            >
              {pauseSession ? "▶️ Resume" : "⏸️ Pause"}
            </button>

            <button
              onClick={() => startBreak(15)}
              disabled={breakMode}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              ☕ 15min Break
            </button>

            <button
              onClick={() => startBreak(5)}
              disabled={breakMode}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              ⚡ 5min Break
            </button>

            <button
              onClick={emergencyPause}
              className="bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              🚨 Emergency Pause
            </button>
          </>
        )}
      </div>

      {/* Party Health Monitor */}
      {sessionActive && partyHealth.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white">👥 Party Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {partyHealth.map((character) => (
              <div
                key={character.id}
                className="bg-slate-700/50 rounded-lg p-3"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-semibold text-white">
                      {character.name}
                    </div>
                    <div className="text-sm text-gray-300">
                      {character.class} {character.level} •{" "}
                      {character.playerName}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">
                      {character.currentHP}/{character.maxHP}
                    </div>
                    {character.tempHP > 0 && (
                      <div className="text-xs text-blue-400">
                        +{character.tempHP} temp
                      </div>
                    )}
                  </div>
                </div>

                {/* HP Bar */}
                <div className="w-full bg-gray-600 rounded-full h-2 mb-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      character.currentHP / character.maxHP > 0.5
                        ? "bg-green-500"
                        : character.currentHP / character.maxHP > 0.25
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                    style={{
                      width: `${Math.max(
                        0,
                        (character.currentHP / character.maxHP) * 100
                      )}%`,
                    }}
                  ></div>
                </div>

                {/* Status Effects */}
                {character.statusEffects.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {character.statusEffects.map((effect, index) => (
                      <span
                        key={index}
                        className="text-xs bg-purple-600 text-white px-2 py-1 rounded"
                      >
                        {effect}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session Notes */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          Session Notes
        </label>
        <textarea
          value={sessionNotes}
          onChange={(e) => setSessionNotes(e.target.value)}
          className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
          rows={3}
          placeholder="Quick notes for this session..."
        />
      </div>
    </div>
  );
}
