// API route for session analytics and metrics - real-time session monitoring
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getAuthenticatedUser(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    return error ? null : user;
  } catch {
    return null;
  }
}

// GET - Get session analytics and metrics
export async function GET(request, { params }) {
  const campaignId = params.id;

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check campaign access
    const { data: membership } = await supabase
      .from("campaign_players")
      .select("user_id, role")
      .eq("campaign_id", campaignId)
      .eq("user_id", user.id)
      .single();

    const { data: campaign } = await supabase
      .from("campaigns")
      .select("dm_id, owner_id, created_by, session_started_at, is_active")
      .eq("id", campaignId)
      .single();

    const isDM =
      campaign &&
      (user.id === campaign.dm_id ||
        user.id === campaign.owner_id ||
        user.id === campaign.created_by);

    if (!membership && !isDM) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Calculate session duration
    let sessionDuration = 0;
    if (campaign?.is_active && campaign?.session_started_at) {
      const startTime = new Date(campaign.session_started_at);
      const currentTime = new Date();
      sessionDuration = Math.floor((currentTime - startTime) / 1000);
    }

    // Get session time boundaries
    const sessionStart =
      campaign?.session_started_at ||
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const currentTime = new Date().toISOString();

    // Get all campaign logs for the session
    const { data: sessionLogs, error: logsError } = await supabase
      .from("campaign_logs")
      .select("id, user_input, ai_output, input_type, timestamp, metadata")
      .eq("campaign_id", campaignId)
      .gte("timestamp", sessionStart)
      .lte("timestamp", currentTime)
      .order("timestamp", { ascending: true });

    if (logsError) {
      console.error("Error fetching session logs:", logsError);
      return NextResponse.json(
        { error: "Failed to fetch session data" },
        { status: 500 }
      );
    }

    // Get campaign players for engagement analysis
    const { data: players, error: playersError } = await supabase
      .from("campaign_players")
      .select(
        `
        user_id,
        role,
        user_profiles (
          id,
          display_name,
          email
        )
      `
      )
      .eq("campaign_id", campaignId);

    if (playersError) {
      console.error("Error fetching players:", playersError);
    }

    // Process analytics
    const analytics = processSessionAnalytics(
      sessionLogs || [],
      players || [],
      sessionDuration
    );

    return NextResponse.json({
      sessionMetrics: analytics.sessionMetrics,
      playerAnalytics: analytics.playerAnalytics,
      timeSeriesData: analytics.timeSeriesData,
      performanceMetrics: analytics.performanceMetrics,
      sessionDuration,
      isDM,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function processSessionAnalytics(logs, players, sessionDuration) {
  const sessionMetrics = {
    duration: sessionDuration,
    messageCount: 0,
    playerEngagement: {},
    storyPacing: { slow: 0, normal: 0, fast: 0 },
    encounterStats: { total: 0, combat: 0, social: 0, exploration: 0 },
    diceRolls: {
      total: 0,
      natural20s: 0,
      natural1s: 0,
      average: 0,
      values: [],
    },
    aiInteractions: { director: 0, dm: 0, toolCalls: 0 },
  };

  const playerAnalytics = {};
  const timeSeriesData = [];

  // Initialize player analytics
  players.forEach((player) => {
    const playerId = player.user_id;
    playerAnalytics[playerId] = {
      userId: playerId,
      name:
        player.user_profiles?.display_name ||
        player.user_profiles?.email ||
        "Unknown",
      role: player.role,
      messageCount: 0,
      diceRolls: 0,
      lastActivity: null,
      engagementScore: 0,
      averageResponseTime: 0,
      topActions: {},
    };
  });

  // Process each log entry
  logs.forEach((log, index) => {
    const userId = log.metadata?.user_id;
    const inputType = log.input_type;
    const timestamp = new Date(log.timestamp);

    // Count messages
    if (inputType === "message" || inputType === "ai_narration") {
      sessionMetrics.messageCount++;
      if (userId && playerAnalytics[userId]) {
        playerAnalytics[userId].messageCount++;
        playerAnalytics[userId].lastActivity = log.timestamp;
      }
    }

    // Count dice rolls
    if (inputType === "dice_roll") {
      sessionMetrics.diceRolls.total++;
      if (userId && playerAnalytics[userId]) {
        playerAnalytics[userId].diceRolls++;
        playerAnalytics[userId].lastActivity = log.timestamp;
      }

      // Extract dice results from AI output
      const diceResults = extractDiceResults(log.ai_output);
      diceResults.forEach((result) => {
        sessionMetrics.diceRolls.values.push(result);
        if (result === 20) sessionMetrics.diceRolls.natural20s++;
        if (result === 1) sessionMetrics.diceRolls.natural1s++;
      });
    }

    // Count encounters
    if (inputType === "encounter_action") {
      sessionMetrics.encounterStats.total++;
      const encounterType = log.metadata?.encounter_type || "combat";
      if (sessionMetrics.encounterStats[encounterType] !== undefined) {
        sessionMetrics.encounterStats[encounterType]++;
      }
    }

    // Count AI interactions
    if (log.metadata?.ai_tier === "director") {
      sessionMetrics.aiInteractions.director++;
    } else if (log.metadata?.ai_tier === "dm") {
      sessionMetrics.aiInteractions.dm++;
    }

    if (log.metadata?.tool_calls) {
      sessionMetrics.aiInteractions.toolCalls +=
        log.metadata.tool_calls.length || 1;
    }

    // Analyze story pacing (simplified)
    if (inputType === "ai_narration") {
      const wordCount = (log.ai_output || "").split(" ").length;
      if (wordCount < 50) {
        sessionMetrics.storyPacing.fast++;
      } else if (wordCount > 150) {
        sessionMetrics.storyPacing.slow++;
      } else {
        sessionMetrics.storyPacing.normal++;
      }
    }

    // Create time series data points (every 10 messages)
    if (index % 10 === 0) {
      timeSeriesData.push({
        timestamp: log.timestamp,
        messageCount: sessionMetrics.messageCount,
        playerActivity: { ...sessionMetrics.playerEngagement },
        pacing: { ...sessionMetrics.storyPacing },
      });
    }

    // Track player activity
    if (userId && playerAnalytics[userId]) {
      const action = inputType.replace("_", " ");
      if (!playerAnalytics[userId].topActions[action]) {
        playerAnalytics[userId].topActions[action] = 0;
      }
      playerAnalytics[userId].topActions[action]++;
    }
  });

  // Calculate dice roll average
  if (sessionMetrics.diceRolls.values.length > 0) {
    sessionMetrics.diceRolls.average =
      sessionMetrics.diceRolls.values.reduce((a, b) => a + b, 0) /
      sessionMetrics.diceRolls.values.length;
  }

  // Calculate engagement scores
  Object.values(playerAnalytics).forEach((player) => {
    let score = 0;
    score += Math.min(player.messageCount * 2, 20); // Up to 20 points for messages
    score += Math.min(player.diceRolls * 3, 15); // Up to 15 points for dice rolls

    // Penalty for inactivity
    if (player.lastActivity) {
      const timeSinceActivity =
        (Date.now() - new Date(player.lastActivity).getTime()) / (1000 * 60); // minutes
      score -= Math.min(timeSinceActivity, 30);
    }

    player.engagementScore = Math.max(0, Math.min(100, score));
  });

  // Performance metrics (simulated for now - would be real in production)
  const performanceMetrics = {
    responseTime: Math.floor(Math.random() * 200) + 50, // 50-250ms
    connectionQuality:
      logs.length > 50 ? "excellent" : logs.length > 20 ? "good" : "fair",
    activeConnections: Object.values(playerAnalytics).filter(
      (p) => p.lastActivity
    ).length,
    dataTransfer: logs.length * 1024, // Rough estimate
  };

  return {
    sessionMetrics,
    playerAnalytics: Object.values(playerAnalytics),
    timeSeriesData,
    performanceMetrics,
  };
}

function extractDiceResults(aiOutput) {
  if (!aiOutput) return [];

  // Look for dice roll results in format like "Rolled: 15" or "Result: 8"
  const rollMatches = aiOutput.match(
    /(?:rolled?|result):?\s*\*?\*?(\d+)\*?\*?/gi
  );
  const results = [];

  if (rollMatches) {
    rollMatches.forEach((match) => {
      const number = match.match(/(\d+)/);
      if (number) {
        results.push(parseInt(number[1]));
      }
    });
  }

  return results;
}
