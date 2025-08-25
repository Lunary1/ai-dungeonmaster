"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export default function SessionAnalyticsDashboard({
  campaignId,
  sessionActive = false,
}) {
  // Analytics state
  const [sessionMetrics, setSessionMetrics] = useState({
    duration: 0,
    messageCount: 0,
    playerEngagement: {},
    storyPacing: { slow: 0, normal: 0, fast: 0 },
    encounterStats: { total: 0, combat: 0, social: 0, exploration: 0 },
    diceRolls: { total: 0, natural20s: 0, natural1s: 0, average: 0 },
    aiInteractions: { director: 0, dm: 0, toolCalls: 0 },
  });

  const [performanceMetrics, setPerformanceMetrics] = useState({
    responseTime: 0,
    connectionQuality: "good",
    activeConnections: 0,
    dataTransfer: 0,
  });

  const [playerAnalytics, setPlayerAnalytics] = useState([]);
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Live metric collection
  const [metricInterval, setMetricInterval] = useState(null);

  // Load session analytics
  const loadSessionAnalytics = useCallback(async () => {
    if (!campaignId) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      // Load current session metrics
      const response = await fetch(`/api/campaigns/${campaignId}/analytics`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSessionMetrics(data.sessionMetrics || sessionMetrics);
        setPlayerAnalytics(data.playerAnalytics || []);
        setTimeSeriesData(data.timeSeriesData || []);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error loading session analytics:", error);
      setLoading(false);
    }
  }, [campaignId, sessionMetrics]);

  // Start live metric collection
  const startMetricCollection = useCallback(() => {
    if (metricInterval) return;

    const interval = setInterval(async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        // Collect real-time metrics
        const response = await fetch(
          `/api/campaigns/${campaignId}/analytics/live`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (response.ok) {
          const liveData = await response.json();

          // Update session metrics
          setSessionMetrics((prev) => ({
            ...prev,
            ...liveData.sessionMetrics,
          }));

          // Update performance metrics
          setPerformanceMetrics((prev) => ({
            ...prev,
            ...liveData.performanceMetrics,
          }));

          // Add to time series
          setTimeSeriesData((prev) => [
            ...prev.slice(-50), // Keep last 50 data points
            {
              timestamp: new Date().toISOString(),
              messageCount: liveData.sessionMetrics?.messageCount || 0,
              playerActivity: liveData.sessionMetrics?.playerEngagement || {},
              pacing: liveData.sessionMetrics?.storyPacing || { normal: 1 },
            },
          ]);
        }
      } catch (error) {
        console.error("Error collecting live metrics:", error);
      }
    }, 30000); // Every 30 seconds

    setMetricInterval(interval);
  }, [campaignId, metricInterval]);

  // Stop metric collection
  const stopMetricCollection = useCallback(() => {
    if (metricInterval) {
      clearInterval(metricInterval);
      setMetricInterval(null);
    }
  }, [metricInterval]);

  // Calculate engagement score
  const calculateEngagementScore = (player) => {
    const { messageCount = 0, diceRolls = 0, lastActivity = null } = player;
    const timeSinceActivity = lastActivity
      ? (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60) // minutes
      : 999;

    let score = 0;
    score += Math.min(messageCount * 2, 20); // Up to 20 points for messages
    score += Math.min(diceRolls * 3, 15); // Up to 15 points for dice rolls
    score -= Math.min(timeSinceActivity, 30); // Penalty for inactivity

    return Math.max(0, Math.min(100, score));
  };

  // Get story pacing recommendation
  const getPacingRecommendation = () => {
    const { slow, normal, fast } = sessionMetrics.storyPacing;
    const total = slow + normal + fast;

    if (total === 0) return { text: "No data yet", color: "text-gray-400" };

    const slowPercent = (slow / total) * 100;
    const fastPercent = (fast / total) * 100;

    if (slowPercent > 60) {
      return {
        text: "Consider speeding up the pace",
        color: "text-yellow-400",
      };
    } else if (fastPercent > 60) {
      return {
        text: "Consider slowing down the pace",
        color: "text-orange-400",
      };
    } else {
      return { text: "Good story pacing", color: "text-green-400" };
    }
  };

  // Initialize analytics
  useEffect(() => {
    loadSessionAnalytics();
  }, [loadSessionAnalytics]);

  // Start/stop metric collection based on session state
  useEffect(() => {
    if (sessionActive) {
      startMetricCollection();
    } else {
      stopMetricCollection();
    }

    return () => stopMetricCollection();
  }, [sessionActive, startMetricCollection, stopMetricCollection]);

  if (loading) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4">
        <div className="text-center text-gray-400">Loading analytics...</div>
      </div>
    );
  }

  const pacingRecommendation = getPacingRecommendation();

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          📊 Session Analytics
          {sessionActive && (
            <span className="text-sm bg-green-600 text-white px-2 py-1 rounded">
              LIVE
            </span>
          )}
        </h2>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-400">
            {Math.floor(sessionMetrics.duration / 60)}m
          </div>
          <div className="text-sm text-gray-300">Session Duration</div>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400">
            {sessionMetrics.messageCount}
          </div>
          <div className="text-sm text-gray-300">Messages Sent</div>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-400">
            {sessionMetrics.encounterStats.total}
          </div>
          <div className="text-sm text-gray-300">Encounters</div>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-400">
            {sessionMetrics.diceRolls.total}
          </div>
          <div className="text-sm text-gray-300">Dice Rolls</div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-slate-700/30 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3">
          🚀 Performance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-300">Response Time</div>
            <div className="font-bold text-white">
              {performanceMetrics.responseTime}ms
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-300">Connection Quality</div>
            <div
              className={`font-bold capitalize ${
                performanceMetrics.connectionQuality === "excellent"
                  ? "text-green-400"
                  : performanceMetrics.connectionQuality === "good"
                  ? "text-blue-400"
                  : performanceMetrics.connectionQuality === "fair"
                  ? "text-yellow-400"
                  : "text-red-400"
              }`}
            >
              {performanceMetrics.connectionQuality}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-300">Active Players</div>
            <div className="font-bold text-white">
              {performanceMetrics.activeConnections}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-300">Data Transfer</div>
            <div className="font-bold text-white">
              {(performanceMetrics.dataTransfer / 1024).toFixed(1)}KB
            </div>
          </div>
        </div>
      </div>

      {/* Story Pacing Analysis */}
      <div className="bg-slate-700/30 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3">
          📈 Story Pacing
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Pacing Analysis</span>
            <span className={pacingRecommendation.color}>
              {pacingRecommendation.text}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Slow</span>
              <span className="text-gray-400">
                {sessionMetrics.storyPacing.slow}
              </span>
            </div>
            <div className="w-full bg-gray-600 rounded-full h-2">
              <div
                className="bg-red-500 h-2 rounded-full"
                style={{
                  width: `${
                    (sessionMetrics.storyPacing.slow /
                      Math.max(
                        1,
                        sessionMetrics.storyPacing.slow +
                          sessionMetrics.storyPacing.normal +
                          sessionMetrics.storyPacing.fast
                      )) *
                    100
                  }%`,
                }}
              ></div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Normal</span>
              <span className="text-gray-400">
                {sessionMetrics.storyPacing.normal}
              </span>
            </div>
            <div className="w-full bg-gray-600 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{
                  width: `${
                    (sessionMetrics.storyPacing.normal /
                      Math.max(
                        1,
                        sessionMetrics.storyPacing.slow +
                          sessionMetrics.storyPacing.normal +
                          sessionMetrics.storyPacing.fast
                      )) *
                    100
                  }%`,
                }}
              ></div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Fast</span>
              <span className="text-gray-400">
                {sessionMetrics.storyPacing.fast}
              </span>
            </div>
            <div className="w-full bg-gray-600 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{
                  width: `${
                    (sessionMetrics.storyPacing.fast /
                      Math.max(
                        1,
                        sessionMetrics.storyPacing.slow +
                          sessionMetrics.storyPacing.normal +
                          sessionMetrics.storyPacing.fast
                      )) *
                    100
                  }%`,
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Player Engagement */}
      {playerAnalytics.length > 0 && (
        <div className="bg-slate-700/30 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">
            👥 Player Engagement
          </h3>
          <div className="space-y-3">
            {playerAnalytics.map((player) => {
              const engagementScore = calculateEngagementScore(player);
              return (
                <div
                  key={player.userId}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center text-white text-sm">
                      {player.name?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div>
                      <div className="font-semibold text-white">
                        {player.name || "Unknown"}
                      </div>
                      <div className="text-sm text-gray-400">
                        {player.messageCount || 0} messages •{" "}
                        {player.diceRolls || 0} rolls
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-600 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          engagementScore >= 80
                            ? "bg-green-500"
                            : engagementScore >= 60
                            ? "bg-yellow-500"
                            : engagementScore >= 40
                            ? "bg-orange-500"
                            : "bg-red-500"
                        }`}
                        style={{ width: `${engagementScore}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-300 w-8 text-right">
                      {engagementScore}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Interactions */}
      <div className="bg-slate-700/30 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3">🤖 AI Usage</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-xl font-bold text-purple-400">
              {sessionMetrics.aiInteractions.director}
            </div>
            <div className="text-sm text-gray-300">Director Tier</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-blue-400">
              {sessionMetrics.aiInteractions.dm}
            </div>
            <div className="text-sm text-gray-300">DM Tier</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-green-400">
              {sessionMetrics.aiInteractions.toolCalls}
            </div>
            <div className="text-sm text-gray-300">Tool Calls</div>
          </div>
        </div>
      </div>

      {/* Dice Statistics */}
      {sessionMetrics.diceRolls.total > 0 && (
        <div className="bg-slate-700/30 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">
            🎲 Dice Statistics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-lg font-bold text-white">
                {sessionMetrics.diceRolls.total}
              </div>
              <div className="text-sm text-gray-300">Total Rolls</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-400">
                {sessionMetrics.diceRolls.natural20s}
              </div>
              <div className="text-sm text-gray-300">Natural 20s</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-red-400">
                {sessionMetrics.diceRolls.natural1s}
              </div>
              <div className="text-sm text-gray-300">Natural 1s</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-400">
                {sessionMetrics.diceRolls.average.toFixed(1)}
              </div>
              <div className="text-sm text-gray-300">Average Roll</div>
            </div>
          </div>
        </div>
      )}

      {/* Session Summary */}
      <div className="bg-slate-700/30 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3">
          📋 Session Summary
        </h3>
        <div className="space-y-2 text-sm text-gray-300">
          <div>
            <strong>Encounter Breakdown:</strong>{" "}
            {sessionMetrics.encounterStats.combat} combat,{" "}
            {sessionMetrics.encounterStats.social} social,{" "}
            {sessionMetrics.encounterStats.exploration} exploration
          </div>
          <div>
            <strong>Activity Level:</strong>{" "}
            {sessionMetrics.messageCount > 50
              ? "High"
              : sessionMetrics.messageCount > 20
              ? "Medium"
              : "Low"}{" "}
            ({sessionMetrics.messageCount} messages)
          </div>
          <div>
            <strong>Player Participation:</strong> {playerAnalytics.length}{" "}
            active players
          </div>
          {sessionActive && (
            <div className="text-green-400">
              <strong>Status:</strong> Session is currently active and being
              monitored
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
