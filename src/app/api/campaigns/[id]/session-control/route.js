// API route for advanced session control - start/stop/pause sessions, breaks, emergency controls
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create Supabase client with service role key for admin operations
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

// POST - Control session state (start/stop/pause/break/emergency)
export async function POST(request, { params }) {
  const campaignId = params.id;

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { action, timestamp, duration, message } = await request.json();

    // Verify user is campaign owner
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, owner_id, created_by")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const isOwner =
      user.id === campaign.owner_id || user.id === campaign.created_by;

    if (!isOwner) {
      return NextResponse.json(
        { error: "Only the campaign owner can control session state" },
        { status: 403 }
      );
    }

    let updateData = {};
    let sessionEvent = null;

    switch (action) {
      case "start":
        updateData = {
          is_active: true,
          session_started_at: timestamp || new Date().toISOString(),
          session_paused: false,
          updated_at: new Date().toISOString(),
        };
        sessionEvent = {
          type: "session_started",
          message: "Session has started!",
          timestamp: timestamp || new Date().toISOString(),
        };
        break;

      case "stop":
        updateData = {
          is_active: false,
          session_ended_at: timestamp || new Date().toISOString(),
          session_paused: false,
          updated_at: new Date().toISOString(),
        };
        sessionEvent = {
          type: "session_ended",
          message: "Session has ended. Thank you for playing!",
          timestamp: timestamp || new Date().toISOString(),
        };
        break;

      case "pause":
        updateData = {
          session_paused: true,
          session_paused_at: timestamp || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        sessionEvent = {
          type: "session_paused",
          message: message || "Session paused by DM",
          timestamp: timestamp || new Date().toISOString(),
        };
        break;

      case "resume":
        updateData = {
          session_paused: false,
          session_resumed_at: timestamp || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        sessionEvent = {
          type: "session_resumed",
          message: "Session resumed!",
          timestamp: timestamp || new Date().toISOString(),
        };
        break;

      case "break":
        // Breaks don't change campaign state, just broadcast to players
        sessionEvent = {
          type: "break_started",
          message: message || `Break time! ${duration || 15} minutes.`,
          duration: duration || 15,
          timestamp: timestamp || new Date().toISOString(),
        };
        break;

      case "emergency_pause":
        updateData = {
          session_paused: true,
          session_paused_at: timestamp || new Date().toISOString(),
          emergency_pause: true,
          updated_at: new Date().toISOString(),
        };
        sessionEvent = {
          type: "emergency_pause",
          message:
            message ||
            "Session paused by DM. Please wait for further instructions.",
          timestamp: timestamp || new Date().toISOString(),
        };
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Update campaign state if needed
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from("campaigns")
        .update(updateData)
        .eq("id", campaignId);

      if (updateError) {
        console.error("Error updating campaign:", updateError);
        return NextResponse.json(
          { error: "Failed to update session state" },
          { status: 500 }
        );
      }
    }

    // Log session event
    if (sessionEvent) {
      const { error: logError } = await supabase.from("campaign_logs").insert([
        {
          campaign_id: campaignId,
          user_input: `Session Control: ${action}`,
          ai_output: sessionEvent.message,
          input_type: "session_control",
          timestamp: sessionEvent.timestamp,
          metadata: {
            action,
            duration,
            user_id: user.id,
            source: "session_control",
          },
        },
      ]);

      if (logError) {
        console.error("Error logging session event:", logError);
      }
    }

    // Broadcast session update to all connected clients
    if (sessionEvent) {
      // This would be handled by real-time subscriptions
      // The broadcast endpoint will pick up the new log entry
    }

    return NextResponse.json({
      success: true,
      action,
      sessionEvent,
      timestamp: timestamp || new Date().toISOString(),
    });
  } catch (error) {
    console.error("Session control error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET - Get current session state and metrics
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

    // Get campaign with session state
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select(
        `
        id, name, owner_id, created_by,
        is_active, session_started_at, session_ended_at,
        session_paused, session_paused_at, session_resumed_at,
        emergency_pause, updated_at
      `
      )
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Check if user is member of this campaign
    const { data: membership } = await supabase
      .from("campaign_players")
      .select("user_id, role")
      .eq("campaign_id", campaignId)
      .eq("user_id", user.id)
      .single();

    const isOwner =
      user.id === campaign.owner_id || user.id === campaign.created_by;

    if (!membership && !isOwner) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Calculate session duration if active
    let sessionDuration = 0;
    if (campaign.is_active && campaign.session_started_at) {
      const startTime = new Date(campaign.session_started_at);
      const currentTime = new Date();
      sessionDuration = Math.floor((currentTime - startTime) / 1000); // Duration in seconds
    }

    // Get recent session events
    const { data: recentEvents, error: eventsError } = await supabase
      .from("campaign_logs")
      .select("user_input, ai_output, input_type, timestamp, metadata")
      .eq("campaign_id", campaignId)
      .eq("input_type", "session_control")
      .order("timestamp", { ascending: false })
      .limit(10);

    if (eventsError) {
      console.error("Error loading session events:", eventsError);
    }

    // Get basic session metrics (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentLogs, error: logsError } = await supabase
      .from("campaign_logs")
      .select("input_type, timestamp, metadata")
      .eq("campaign_id", campaignId)
      .gte("timestamp", oneHourAgo);

    let sessionMetrics = {
      messageCount: 0,
      diceRolls: 0,
      encounterActions: 0,
      playerActivity: {},
    };

    if (!logsError && recentLogs) {
      sessionMetrics.messageCount = recentLogs.filter(
        (log) =>
          log.input_type === "message" || log.input_type === "ai_narration"
      ).length;

      sessionMetrics.diceRolls = recentLogs.filter(
        (log) => log.input_type === "dice_roll"
      ).length;

      sessionMetrics.encounterActions = recentLogs.filter(
        (log) => log.input_type === "encounter_action"
      ).length;

      // Count activity per player
      recentLogs.forEach((log) => {
        const userId = log.metadata?.user_id;
        if (userId) {
          sessionMetrics.playerActivity[userId] =
            (sessionMetrics.playerActivity[userId] || 0) + 1;
        }
      });
    }

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        isActive: campaign.is_active,
        sessionStartedAt: campaign.session_started_at,
        sessionEndedAt: campaign.session_ended_at,
        sessionPaused: campaign.session_paused,
        sessionPausedAt: campaign.session_paused_at,
        sessionResumedAt: campaign.session_resumed_at,
        emergencyPause: campaign.emergency_pause,
        sessionDuration,
      },
      recentEvents: recentEvents || [],
      sessionMetrics,
      isDM,
    });
  } catch (error) {
    console.error("Get session state error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
