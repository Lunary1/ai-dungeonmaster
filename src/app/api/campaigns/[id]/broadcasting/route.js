// API route for real-time status broadcasting - player status and presence management
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

// GET - Get current player statuses
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
      .select("dm_id, owner_id, created_by")
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

    // Get all player statuses from the presence table
    const { data: playerStatuses, error: statusError } = await supabase
      .from("player_presence")
      .select(
        `
        user_id,
        status,
        health_percentage,
        initiative_position,
        last_activity,
        custom_status,
        is_ready,
        requesting_help,
        has_pending_request,
        user_profiles (
          id,
          display_name,
          email
        )
      `
      )
      .eq("campaign_id", campaignId)
      .order("last_activity", { ascending: false });

    if (statusError) {
      console.error("Error fetching player statuses:", statusError);
      return NextResponse.json(
        { error: "Failed to fetch player statuses" },
        { status: 500 }
      );
    }

    // Get active requests
    const { data: activeRequests } = await supabase
      .from("player_requests")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    return NextResponse.json({
      playerStatuses: playerStatuses || [],
      activeRequests: activeRequests || [],
      isDM,
    });
  } catch (error) {
    console.error("Broadcasting error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Update player status or send request
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

    const body = await request.json();
    const { action, ...data } = body;

    // Check campaign access
    const { data: membership } = await supabase
      .from("campaign_players")
      .select("user_id, role")
      .eq("campaign_id", campaignId)
      .eq("user_id", user.id)
      .single();

    const { data: campaign } = await supabase
      .from("campaigns")
      .select("dm_id, owner_id, created_by")
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

    switch (action) {
      case "update_status":
        return await updatePlayerStatus(campaignId, user.id, data);

      case "send_request":
        return await sendPlayerRequest(campaignId, user.id, data, isDM);

      case "respond_to_request":
        return await respondToRequest(campaignId, user.id, data, isDM);

      case "broadcast_message":
        if (!isDM) {
          return NextResponse.json(
            { error: "Only DMs can broadcast messages" },
            { status: 403 }
          );
        }
        return await broadcastMessage(campaignId, user.id, data);

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Broadcasting POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function updatePlayerStatus(campaignId, userId, data) {
  const { status, healthPercentage, customStatus, isReady, requestingHelp } =
    data;

  try {
    // Upsert player presence
    const { data: updatedStatus, error } = await supabase
      .from("player_presence")
      .upsert(
        {
          campaign_id: campaignId,
          user_id: userId,
          status: status || "active",
          health_percentage: healthPercentage,
          custom_status: customStatus,
          is_ready: isReady,
          requesting_help: requestingHelp,
          last_activity: new Date().toISOString(),
        },
        {
          onConflict: "campaign_id,user_id",
        }
      )
      .select()
      .single();

    if (error) {
      console.error("Error updating player status:", error);
      return NextResponse.json(
        { error: "Failed to update status" },
        { status: 500 }
      );
    }

    // Broadcast the update to the campaign channel
    await supabase.channel(`campaign_${campaignId}`).send({
      type: "broadcast",
      event: "status_update",
      payload: {
        userId,
        status: updatedStatus,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      status: updatedStatus,
    });
  } catch (error) {
    console.error("Error in updatePlayerStatus:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function sendPlayerRequest(campaignId, userId, data, isDM) {
  const { type, message, priority = "normal", targetUserId } = data;

  try {
    // Create the request
    const { data: request, error } = await supabase
      .from("player_requests")
      .insert({
        campaign_id: campaignId,
        requesting_user_id: userId,
        target_user_id: targetUserId, // null for DM requests
        request_type: type,
        message,
        priority,
        status: "pending",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating request:", error);
      return NextResponse.json(
        { error: "Failed to send request" },
        { status: 500 }
      );
    }

    // Update player presence to indicate pending request
    await supabase.from("player_presence").upsert(
      {
        campaign_id: campaignId,
        user_id: userId,
        has_pending_request: true,
        last_activity: new Date().toISOString(),
      },
      {
        onConflict: "campaign_id,user_id",
      }
    );

    // Broadcast the request
    await supabase.channel(`campaign_${campaignId}`).send({
      type: "broadcast",
      event: "player_request",
      payload: {
        request,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      request,
    });
  } catch (error) {
    console.error("Error in sendPlayerRequest:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function respondToRequest(campaignId, userId, data, isDM) {
  const { requestId, response, responseMessage } = data;

  try {
    // Get the request first
    const { data: request, error: fetchError } = await supabase
      .from("player_requests")
      .select("*")
      .eq("id", requestId)
      .eq("campaign_id", campaignId)
      .single();

    if (fetchError || !request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Check if user can respond to this request
    const canRespond = isDM || request.target_user_id === userId;
    if (!canRespond) {
      return NextResponse.json(
        { error: "Not authorized to respond to this request" },
        { status: 403 }
      );
    }

    // Update the request
    const { data: updatedRequest, error: updateError } = await supabase
      .from("player_requests")
      .update({
        status: response, // 'approved', 'denied', 'completed'
        response_message: responseMessage,
        responded_by: userId,
        responded_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating request:", updateError);
      return NextResponse.json(
        { error: "Failed to respond to request" },
        { status: 500 }
      );
    }

    // Clear pending request flag if this was the last one
    const { data: pendingRequests } = await supabase
      .from("player_requests")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("requesting_user_id", request.requesting_user_id)
      .eq("status", "pending");

    if (!pendingRequests || pendingRequests.length === 0) {
      await supabase
        .from("player_presence")
        .update({ has_pending_request: false })
        .eq("campaign_id", campaignId)
        .eq("user_id", request.requesting_user_id);
    }

    // Broadcast the response
    await supabase.channel(`campaign_${campaignId}`).send({
      type: "broadcast",
      event: "request_response",
      payload: {
        request: updatedRequest,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      request: updatedRequest,
    });
  } catch (error) {
    console.error("Error in respondToRequest:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function broadcastMessage(campaignId, dmId, data) {
  const { message, type = "announcement", priority = "normal" } = data;

  try {
    // Log the broadcast
    await supabase.from("campaign_logs").insert({
      campaign_id: campaignId,
      user_input: message,
      input_type: "dm_broadcast",
      metadata: {
        user_id: dmId,
        broadcast_type: type,
        priority,
      },
    });

    // Send the broadcast
    await supabase.channel(`campaign_${campaignId}`).send({
      type: "broadcast",
      event: "dm_message",
      payload: {
        message,
        messageType: type,
        priority,
        dmId,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Broadcast sent successfully",
    });
  } catch (error) {
    console.error("Error in broadcastMessage:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
