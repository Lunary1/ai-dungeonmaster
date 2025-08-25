// API route for live encounter management - initiative tracking, combat state, turn management
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

// POST - Manage encounter state (start/end/update turn/add participant)
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

    const { action, encounterId, encounterData, participantData, turnData } =
      await request.json();

    // Verify user is DM/owner of this campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, dm_id, owner_id, created_by")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const isDM =
      user.id === campaign.dm_id ||
      user.id === campaign.owner_id ||
      user.id === campaign.created_by;

    if (!isDM) {
      return NextResponse.json(
        { error: "Only the DM can manage encounters" },
        { status: 403 }
      );
    }

    let result = {};

    switch (action) {
      case "start":
        // Create new encounter
        const newEncounter = {
          id: `encounter_${Date.now()}`,
          campaign_id: campaignId,
          name: encounterData?.name || "New Encounter",
          type: encounterData?.type || "combat",
          description: encounterData?.description || "",
          is_active: true,
          current_round: 1,
          current_turn: 0,
          participants: [],
          created_at: new Date().toISOString(),
          created_by: user.id,
        };

        // Store encounter in campaign entities
        const { error: encounterError } = await supabase
          .from("campaign_entities")
          .insert([
            {
              campaign_id: campaignId,
              entity_type: "encounter",
              name: newEncounter.name,
              data: newEncounter,
              created_by: user.id,
              created_at: new Date().toISOString(),
            },
          ]);

        if (encounterError) {
          console.error("Error creating encounter:", encounterError);
          return NextResponse.json(
            { error: "Failed to create encounter" },
            { status: 500 }
          );
        }

        // Log encounter start
        await supabase.from("campaign_logs").insert([
          {
            campaign_id: campaignId,
            user_input: `Started encounter: ${newEncounter.name}`,
            ai_output: `⚔️ **${newEncounter.name}** has begun! ${newEncounter.description}`,
            input_type: "encounter_action",
            timestamp: new Date().toISOString(),
            metadata: {
              action: "start_encounter",
              encounter_id: newEncounter.id,
              encounter_type: newEncounter.type,
              user_id: user.id,
            },
          },
        ]);

        result = { encounter: newEncounter };
        break;

      case "end":
        // End active encounter
        const { data: activeEncounter, error: fetchError } = await supabase
          .from("campaign_entities")
          .select("id, data")
          .eq("campaign_id", campaignId)
          .eq("entity_type", "encounter")
          .eq("data->is_active", true)
          .single();

        if (fetchError || !activeEncounter) {
          return NextResponse.json(
            { error: "No active encounter found" },
            { status: 404 }
          );
        }

        // Update encounter to inactive
        const updatedEncounterData = {
          ...activeEncounter.data,
          is_active: false,
          ended_at: new Date().toISOString(),
        };

        const { error: endError } = await supabase
          .from("campaign_entities")
          .update({ data: updatedEncounterData })
          .eq("id", activeEncounter.id);

        if (endError) {
          console.error("Error ending encounter:", endError);
          return NextResponse.json(
            { error: "Failed to end encounter" },
            { status: 500 }
          );
        }

        // Log encounter end
        await supabase.from("campaign_logs").insert([
          {
            campaign_id: campaignId,
            user_input: `Ended encounter: ${activeEncounter.data.name}`,
            ai_output: `🏁 **${activeEncounter.data.name}** has ended! The encounter lasted ${activeEncounter.data.current_round} rounds.`,
            input_type: "encounter_action",
            timestamp: new Date().toISOString(),
            metadata: {
              action: "end_encounter",
              encounter_id: activeEncounter.data.id,
              final_round: activeEncounter.data.current_round,
              user_id: user.id,
            },
          },
        ]);

        result = { success: true, encounterId: activeEncounter.data.id };
        break;

      case "add_participant":
        // Add participant to active encounter
        const { data: currentEncounter, error: getCurrentError } =
          await supabase
            .from("campaign_entities")
            .select("id, data")
            .eq("campaign_id", campaignId)
            .eq("entity_type", "encounter")
            .eq("data->is_active", true)
            .single();

        if (getCurrentError || !currentEncounter) {
          return NextResponse.json(
            { error: "No active encounter found" },
            { status: 404 }
          );
        }

        const participant = {
          id: `participant_${Date.now()}`,
          name: participantData.name,
          initiative: participantData.initiative,
          hp: participantData.hp,
          maxHp: participantData.hp,
          ac: participantData.ac,
          type: participantData.type,
          conditions: [],
          isActive: false,
          added_at: new Date().toISOString(),
        };

        const updatedParticipants = [
          ...(currentEncounter.data.participants || []),
          participant,
        ].sort((a, b) => b.initiative - a.initiative);

        const { error: addParticipantError } = await supabase
          .from("campaign_entities")
          .update({
            data: {
              ...currentEncounter.data,
              participants: updatedParticipants,
            },
          })
          .eq("id", currentEncounter.id);

        if (addParticipantError) {
          console.error("Error adding participant:", addParticipantError);
          return NextResponse.json(
            { error: "Failed to add participant" },
            { status: 500 }
          );
        }

        result = { participant, participants: updatedParticipants };
        break;

      case "next_turn":
        // Advance to next turn
        const { data: turnEncounter, error: getTurnError } = await supabase
          .from("campaign_entities")
          .select("id, data")
          .eq("campaign_id", campaignId)
          .eq("entity_type", "encounter")
          .eq("data->is_active", true)
          .single();

        if (getTurnError || !turnEncounter) {
          return NextResponse.json(
            { error: "No active encounter found" },
            { status: 404 }
          );
        }

        const participants = turnEncounter.data.participants || [];
        let nextTurn = (turnEncounter.data.current_turn || 0) + 1;
        let nextRound = turnEncounter.data.current_round || 1;

        if (nextTurn >= participants.length) {
          nextTurn = 0;
          nextRound += 1;
        }

        // Update active participant
        const updatedTurnParticipants = participants.map((p, index) => ({
          ...p,
          isActive: index === nextTurn,
        }));

        const { error: turnError } = await supabase
          .from("campaign_entities")
          .update({
            data: {
              ...turnEncounter.data,
              current_turn: nextTurn,
              current_round: nextRound,
              participants: updatedTurnParticipants,
            },
          })
          .eq("id", turnEncounter.id);

        if (turnError) {
          console.error("Error advancing turn:", turnError);
          return NextResponse.json(
            { error: "Failed to advance turn" },
            { status: 500 }
          );
        }

        // Log turn change
        const activeParticipant = updatedTurnParticipants[nextTurn];
        await supabase.from("campaign_logs").insert([
          {
            campaign_id: campaignId,
            user_input: `Advanced to next turn`,
            ai_output: `🔄 **Round ${nextRound}**: It's now ${
              activeParticipant?.name || "Unknown"
            }'s turn!`,
            input_type: "encounter_action",
            timestamp: new Date().toISOString(),
            metadata: {
              action: "next_turn",
              encounter_id: turnEncounter.data.id,
              round: nextRound,
              turn: nextTurn,
              active_participant: activeParticipant?.name,
              user_id: user.id,
            },
          },
        ]);

        result = {
          currentRound: nextRound,
          currentTurn: nextTurn,
          activeParticipant,
          participants: updatedTurnParticipants,
        };
        break;

      case "update_participant":
        // Update participant (HP, conditions, etc.)
        const { data: updateEncounter, error: getUpdateError } = await supabase
          .from("campaign_entities")
          .select("id, data")
          .eq("campaign_id", campaignId)
          .eq("entity_type", "encounter")
          .eq("data->is_active", true)
          .single();

        if (getUpdateError || !updateEncounter) {
          return NextResponse.json(
            { error: "No active encounter found" },
            { status: 404 }
          );
        }

        const updatedUpdateParticipants = (
          updateEncounter.data.participants || []
        ).map((p) =>
          p.id === participantData.id ? { ...p, ...participantData } : p
        );

        const { error: updateParticipantError } = await supabase
          .from("campaign_entities")
          .update({
            data: {
              ...updateEncounter.data,
              participants: updatedUpdateParticipants,
            },
          })
          .eq("id", updateEncounter.id);

        if (updateParticipantError) {
          console.error("Error updating participant:", updateParticipantError);
          return NextResponse.json(
            { error: "Failed to update participant" },
            { status: 500 }
          );
        }

        result = { participants: updatedUpdateParticipants };
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Encounter management error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET - Get active encounter state
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

    // Get active encounter
    const { data: activeEncounter, error: encounterError } = await supabase
      .from("campaign_entities")
      .select("id, name, data, created_at")
      .eq("campaign_id", campaignId)
      .eq("entity_type", "encounter")
      .eq("data->is_active", true)
      .single();

    if (encounterError && encounterError.code !== "PGRST116") {
      console.error("Error fetching active encounter:", encounterError);
      return NextResponse.json(
        { error: "Failed to fetch encounter" },
        { status: 500 }
      );
    }

    // Get recent encounter history
    const { data: encounterHistory, error: historyError } = await supabase
      .from("campaign_entities")
      .select("id, name, data, created_at")
      .eq("campaign_id", campaignId)
      .eq("entity_type", "encounter")
      .order("created_at", { ascending: false })
      .limit(10);

    if (historyError) {
      console.error("Error fetching encounter history:", historyError);
    }

    return NextResponse.json({
      encounter: activeEncounter?.data || null,
      encounterHistory: encounterHistory || [],
      isDM,
    });
  } catch (error) {
    console.error("Get encounter error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
