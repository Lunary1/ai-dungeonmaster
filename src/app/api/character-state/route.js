import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Authentication helper function
async function getAuthenticatedUser(request) {
  try {
    const authorization = request.headers.get("authorization");

    if (authorization?.startsWith("Bearer ")) {
      const token = authorization.substring(7);

      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      const {
        data: { user },
        error,
      } = await client.auth.getUser(token);

      if (error || !user) {
        return { user: null, error, client: null };
      }

      return { user, error: null, client };
    }

    return {
      user: null,
      error: new Error("No authorization header"),
      client: null,
    };
  } catch (error) {
    console.error("Auth helper error:", error);
    return { user: null, error, client: null };
  }
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const campaignId = url.searchParams.get("campaignId");

    if (!campaignId) {
      return NextResponse.json(
        { error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    // Get the authenticated user
    const {
      user,
      error: authError,
      client,
    } = await getAuthenticatedUser(request);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = client;

    // First check if user has access to this campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, owner_id, current_round")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Check if user is owner or a member (AI-only system)
    let hasAccess = campaign.owner_id === user.id;

    if (!hasAccess) {
      const { data: membership } = await supabase
        .from("campaign_players")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      hasAccess = !!membership;
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get user's character for this campaign (only static data)
    const { data: character, error: characterError } = await supabase
      .from("characters")
      .select(
        `
        id, name, class, race, background, alignment,
        strength, dexterity, constitution, intelligence, wisdom, charisma,
        hit_points_max, created_at, updated_at
      `
      )
      .eq("campaign_id", campaignId)
      .eq("user_id", user.id)
      .single();

    if (characterError && characterError.code !== "PGRST116") {
      console.error("Character fetch error:", characterError);
      return NextResponse.json(
        { error: "Failed to fetch character" },
        { status: 500 }
      );
    }

    // If no character exists, return empty state
    if (!character) {
      return NextResponse.json({
        character: null,
        characterState: null,
        hasCharacter: false,
      });
    }

    // Get the current character state for the current round (all dynamic data)
    const { data: characterState, error: stateError } = await supabase
      .from("character_states")
      .select(
        `
        id, campaign_id, character_id, round,
        hp_current, xp, level, armor_class,
        inventory_json, notes, created_at
      `
      )
      .eq("campaign_id", campaignId)
      .eq("character_id", character.id)
      .eq("round", campaign.current_round || 1)
      .single();

    if (stateError && stateError.code !== "PGRST116") {
      console.error("Character state fetch error:", stateError);
      // Don't fail if character state doesn't exist, just return base character
    }

    // If no character state exists for current round, create one based on character's base data
    let currentState = characterState;
    if (!characterState) {
      // For new character states, we need to determine the starting values
      // Check if this is the first round or if we need to inherit from previous round
      let inheritedState = null;

      if (campaign.current_round > 1) {
        // Look for the most recent character state to inherit from
        const { data: previousState } = await supabase
          .from("character_states")
          .select(
            `
            hp_current, xp, level, armor_class, inventory_json
          `
          )
          .eq("campaign_id", campaignId)
          .eq("character_id", character.id)
          .lt("round", campaign.current_round)
          .order("round", { ascending: false })
          .limit(1)
          .single();

        inheritedState = previousState;
      }

      // If no previous state exists, use default starting values
      const newState = {
        campaign_id: campaignId,
        character_id: character.id,
        round: campaign.current_round || 1,
        hp_current: inheritedState?.hp_current ?? character.hit_points_max, // Start at full HP
        xp: inheritedState?.xp ?? 0, // Start with 0 XP
        level: inheritedState?.level ?? 1, // Start at level 1
        armor_class: inheritedState?.armor_class ?? 10, // Default AC
        inventory_json: inheritedState?.inventory_json ?? [],
        notes: null,
      };

      const { data: createdState, error: createError } = await supabase
        .from("character_states")
        .insert(newState)
        .select()
        .single();

      if (createError) {
        console.error("Error creating character state:", createError);
        // Still return character data even if state creation fails
        currentState = newState;
      } else {
        currentState = createdState;
      }
    }

    return NextResponse.json({
      character,
      characterState: currentState,
      hasCharacter: true,
    });
  } catch (error) {
    console.error("Character state API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { campaignId, characterId, updates } = body;

    if (!campaignId || !characterId) {
      return NextResponse.json(
        { error: "Campaign ID and Character ID are required" },
        { status: 400 }
      );
    }

    // Get the authenticated user
    const {
      user,
      error: authError,
      client,
    } = await getAuthenticatedUser(request);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = client;

    // Verify user owns this character
    const { data: character, error: characterError } = await supabase
      .from("characters")
      .select("id, campaign_id, user_id")
      .eq("id", characterId)
      .eq("campaign_id", campaignId)
      .eq("user_id", user.id)
      .single();

    if (characterError || !character) {
      return NextResponse.json(
        { error: "Character not found or access denied" },
        { status: 404 }
      );
    }

    // Get current campaign round
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("current_round")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const currentRound = campaign.current_round || 1;

    // Update or create character state
    const { data: existingState } = await supabase
      .from("character_states")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("character_id", characterId)
      .eq("round", currentRound)
      .single();

    let result;
    if (existingState) {
      // Update existing state
      const { data, error } = await supabase
        .from("character_states")
        .update(updates)
        .eq("id", existingState.id)
        .select()
        .single();

      if (error) {
        throw error;
      }
      result = data;
    } else {
      // Create new state
      const newState = {
        campaign_id: campaignId,
        character_id: characterId,
        round: currentRound,
        ...updates,
      };

      const { data, error } = await supabase
        .from("character_states")
        .insert(newState)
        .select()
        .single();

      if (error) {
        throw error;
      }
      result = data;
    }

    return NextResponse.json({ characterState: result });
  } catch (error) {
    console.error("Character state update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
