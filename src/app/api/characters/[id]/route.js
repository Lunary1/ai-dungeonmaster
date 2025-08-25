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

// D&D 5e SRD class and race validation
const VALID_CLASSES = [
  "Barbarian",
  "Bard",
  "Cleric",
  "Druid",
  "Fighter",
  "Monk",
  "Paladin",
  "Ranger",
  "Rogue",
  "Sorcerer",
  "Warlock",
  "Wizard",
];

const VALID_RACES = [
  "Dragonborn",
  "Dwarf",
  "Elf",
  "Gnome",
  "Half-Elf",
  "Halfling",
  "Half-Orc",
  "Human",
  "Tiefling",
];

const VALID_ALIGNMENTS = [
  "Lawful Good",
  "Neutral Good",
  "Chaotic Good",
  "Lawful Neutral",
  "True Neutral",
  "Chaotic Neutral",
  "Lawful Evil",
  "Neutral Evil",
  "Chaotic Evil",
];

export async function GET(request, { params }) {
  try {
    const { id: characterId } = await params;

    // Get the authenticated user using the same method as campaigns API
    const {
      user,
      error: authError,
      client,
    } = await getAuthenticatedUser(request);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = client;

    // Get character - check if user owns the character OR is a member of the campaign
    const { data: character, error: characterError } = await supabase
      .from("characters")
      .select(
        `
        *,
        campaigns(name, owner_id)
      `
      )
      .eq("id", characterId)
      .single();

    if (characterError || !character) {
      console.error("Character fetch error:", characterError);
      return NextResponse.json(
        { error: "Character not found" },
        { status: 404 }
      );
    }

    // Check if user has access - either owns the character or is owner of the campaign (AI-only)
    const hasAccess =
      character.user_id === user.id ||
      character.campaigns?.owner_id === user.id;

    if (!hasAccess) {
      // Also check if user is a member of the campaign
      const { data: membership } = await supabase
        .from("campaign_players")
        .select("id")
        .eq("campaign_id", character.campaign_id)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (!membership) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    return NextResponse.json({
      character,
    });
  } catch (error) {
    console.error("Character fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const { id: characterId } = await params;
    const characterData = await request.json();

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

    // Validate required fields
    const {
      campaignId,
      name,
      characterClass,
      race,
      level = 1,
      strength = 10,
      dexterity = 10,
      constitution = 10,
      intelligence = 10,
      wisdom = 10,
      charisma = 10,
      hitPointsMax,
      armorClass = 10,
      background,
      alignment,
      inventory = [],
    } = characterData;

    // Validation
    if (!campaignId || !name || !characterClass || !race) {
      return NextResponse.json(
        { error: "Campaign ID, name, class, and race are required" },
        { status: 400 }
      );
    }

    if (name.length === 0 || name.length > 50) {
      return NextResponse.json(
        { error: "Character name must be 1-50 characters" },
        { status: 400 }
      );
    }

    if (!VALID_CLASSES.includes(characterClass)) {
      return NextResponse.json(
        { error: `Invalid class. Must be one of: ${VALID_CLASSES.join(", ")}` },
        { status: 400 }
      );
    }

    if (!VALID_RACES.includes(race)) {
      return NextResponse.json(
        { error: `Invalid race. Must be one of: ${VALID_RACES.join(", ")}` },
        { status: 400 }
      );
    }

    if (alignment && !VALID_ALIGNMENTS.includes(alignment)) {
      return NextResponse.json(
        {
          error: `Invalid alignment. Must be one of: ${VALID_ALIGNMENTS.join(
            ", "
          )}`,
        },
        { status: 400 }
      );
    }

    // Validate ability scores (3-20 per D&D 5e SRD)
    const abilityScores = {
      strength,
      dexterity,
      constitution,
      intelligence,
      wisdom,
      charisma,
    };
    for (const [ability, score] of Object.entries(abilityScores)) {
      if (score < 3 || score > 20) {
        return NextResponse.json(
          { error: `${ability} must be between 3 and 20` },
          { status: 400 }
        );
      }
    }

    // Validate level
    if (level < 1 || level > 20) {
      return NextResponse.json(
        { error: "Level must be between 1 and 20" },
        { status: 400 }
      );
    }

    // Check if user is a member of the campaign
    const { data: membership, error: membershipError } = await supabase
      .from("campaign_players")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "You are not a member of this campaign" },
        { status: 403 }
      );
    }

    // Check if user already has a character in this campaign (MVP limit: 1 per user per campaign)
    const { data: existingCharacter, error: existingError } = await supabase
      .from("characters")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (existingError && existingError.code !== "PGRST116") {
      console.error("Existing character check error:", existingError);
      return NextResponse.json(
        { error: "Failed to check existing characters" },
        { status: 500 }
      );
    }

    if (existingCharacter) {
      return NextResponse.json(
        { error: "You already have a character in this campaign" },
        { status: 400 }
      );
    }

    // Calculate HP if not provided (default for level 1)
    const calculatedHitPointsMax =
      hitPointsMax || calculateDefaultHP(characterClass, constitution, level);

    // Create character
    const { data: character, error: characterError } = await supabase
      .from("characters")
      .insert({
        campaign_id: campaignId,
        user_id: user.id,
        name: name.trim(),
        class: characterClass,
        race,
        level,
        strength,
        dexterity,
        constitution,
        intelligence,
        wisdom,
        charisma,
        hit_points_max: calculatedHitPointsMax,
        hit_points_current: calculatedHitPointsMax,
        armor_class: armorClass,
        background: background?.trim() || null,
        alignment: alignment || null,
        inventory: JSON.stringify(inventory),
        is_active: true,
      })
      .select()
      .single();

    if (characterError) {
      console.error("Character creation error:", characterError);
      return NextResponse.json(
        { error: "Failed to create character" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      character,
      message: "Character created successfully",
    });
  } catch (error) {
    console.error("Character creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const characterId = params.id;
    const updateData = await request.json();

    // Get the authenticated user
    const { user, error: authError } = await getServerUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createServerSupabaseClient();

    // Verify character ownership
    const { data: character, error: characterError } = await supabase
      .from("characters")
      .select("*")
      .eq("id", characterId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (characterError || !character) {
      return NextResponse.json(
        { error: "Character not found or access denied" },
        { status: 404 }
      );
    }

    // Validate updated fields if provided
    const allowedUpdates = [
      "name",
      "level",
      "experience_points",
      "hit_points_current",
      "armor_class",
      "strength",
      "dexterity",
      "constitution",
      "intelligence",
      "wisdom",
      "charisma",
      "background",
      "alignment",
      "inventory",
    ];

    const updates = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (allowedUpdates.includes(key) && value !== undefined) {
        updates[key] = value;
      }
    }

    // Validate updated values
    if (
      updates.name &&
      (updates.name.length === 0 || updates.name.length > 50)
    ) {
      return NextResponse.json(
        { error: "Character name must be 1-50 characters" },
        { status: 400 }
      );
    }

    if (updates.level && (updates.level < 1 || updates.level > 20)) {
      return NextResponse.json(
        { error: "Level must be between 1 and 20" },
        { status: 400 }
      );
    }

    // Validate ability scores
    const abilityKeys = [
      "strength",
      "dexterity",
      "constitution",
      "intelligence",
      "wisdom",
      "charisma",
    ];
    for (const ability of abilityKeys) {
      if (updates[ability] && (updates[ability] < 3 || updates[ability] > 20)) {
        return NextResponse.json(
          { error: `${ability} must be between 3 and 20` },
          { status: 400 }
        );
      }
    }

    if (updates.hit_points_current && updates.hit_points_current < 0) {
      return NextResponse.json(
        { error: "Current hit points cannot be negative" },
        { status: 400 }
      );
    }

    if (updates.inventory && Array.isArray(updates.inventory)) {
      updates.inventory = JSON.stringify(updates.inventory);
    }

    // Update character
    const { data: updatedCharacter, error: updateError } = await supabase
      .from("characters")
      .update(updates)
      .eq("id", characterId)
      .select()
      .single();

    if (updateError) {
      console.error("Character update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update character" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      character: updatedCharacter,
      message: "Character updated successfully",
    });
  } catch (error) {
    console.error("Character update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper function to calculate default HP for new characters
function calculateDefaultHP(characterClass, constitution, level) {
  // Hit die by class (D&D 5e SRD)
  const hitDice = {
    Barbarian: 12,
    Fighter: 10,
    Paladin: 10,
    Ranger: 10,
    Bard: 8,
    Cleric: 8,
    Druid: 8,
    Monk: 8,
    Rogue: 8,
    Warlock: 8,
    Sorcerer: 6,
    Wizard: 6,
  };

  const hitDie = hitDice[characterClass] || 8;
  const conModifier = Math.floor((constitution - 10) / 2);

  // Level 1: max hit die + CON modifier
  // Higher levels: previous HP + average of hit die + CON modifier
  if (level === 1) {
    return Math.max(1, hitDie + conModifier);
  } else {
    const level1HP = hitDie + conModifier;
    const additionalHP =
      (level - 1) * (Math.floor(hitDie / 2) + 1 + conModifier);
    return Math.max(level, level1HP + additionalHP);
  }
}
