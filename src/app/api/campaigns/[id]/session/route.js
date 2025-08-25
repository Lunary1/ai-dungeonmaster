import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Generate automatic campaign introduction
async function generateCampaignIntroduction(campaign) {
  try {
    const prompt = `You are a D&D Dungeon Master starting a new adventure. Create an immersive opening introduction for a campaign with these details:

**Campaign Title:** ${campaign.name}
**Campaign Description:** ${campaign.description}

Write a compelling 2-3 paragraph introduction that:
- Sets the scene and atmosphere
- Hooks the players into the adventure
- Establishes the initial setting or situation
- Maintains the tone appropriate for the campaign description
- Ends with an engaging moment that invites player action

Write in second person ("You find yourselves...") as if speaking directly to the adventuring party. Keep it atmospheric and engaging, around 150-250 words.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert D&D Dungeon Master known for creating immersive and engaging campaign openings. Your introductions set the perfect tone and draw players immediately into the adventure.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 400,
      temperature: 0.8,
    });

    return response.choices[0]?.message?.content || null;
  } catch (error) {
    console.error("Error generating campaign introduction:", error);
    return null;
  }
}

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

export async function GET(request, { params }) {
  try {
    const {
      user,
      error: authError,
      client,
    } = await getAuthenticatedUser(request);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const campaignId = resolvedParams.id;

    // Get campaign details
    const { data: campaign, error: campaignError } = await client
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Check if user is part of this campaign
    const { data: membership, error: membershipError } = await client
      .from("campaign_players")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("user_id", user.id)
      .single();

    // Check if user is campaign owner
    const isOwner = campaign.owner_id === user.id;

    if (!isOwner && (!membership || membershipError)) {
      return NextResponse.json(
        { error: "You are not a member of this campaign" },
        { status: 403 }
      );
    }

    // Get campaign status - check if session has been started
    // We'll consider a campaign "started" if is_active is true and updated_at is recent
    // (indicating DM recently started the session)
    const now = new Date();
    const campaignUpdated = new Date(campaign.updated_at);
    const timeSinceUpdate = now - campaignUpdated;

    // Consider session started if campaign is active and was updated in last 24 hours
    // This is a simple heuristic - in production you'd want a dedicated session_started field
    const sessionStarted =
      campaign.is_active && timeSinceUpdate < 24 * 60 * 60 * 1000;

    // Get recent campaign logs for session history
    const { data: sessionLogs, error: logsError } = await client
      .from("campaign_logs")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("timestamp", { ascending: true })
      .limit(50);

    if (logsError) {
      console.error("Error fetching campaign logs:", logsError);
    } else {
      console.log(
        `Fetched ${sessionLogs?.length || 0} logs for campaign ${campaignId}`
      );
      console.log(
        "Session logs details:",
        sessionLogs?.map((log) => ({
          id: log.id,
          input_type: log.input_type,
          timestamp: log.timestamp,
          has_ai_output: !!log.ai_output,
          ai_output_length: log.ai_output?.length || 0,
        }))
      );
    }

    // Check if this is a brand new campaign with no logs - generate AI introduction
    let finalSessionLogs = sessionLogs || [];

    if (
      (!sessionLogs || sessionLogs.length === 0) &&
      campaign.name &&
      campaign.description
    ) {
      console.log("🎭 Generating automatic campaign introduction...");

      const introduction = await generateCampaignIntroduction(campaign);

      if (introduction) {
        // Store the introduction as the first campaign log
        const { data: introLog, error: introError } = await client
          .from("campaign_logs")
          .insert({
            campaign_id: campaignId,
            user_input: "CAMPAIGN_INTRODUCTION",
            input_type: "ai_narration",
            ai_output: introduction,
            timestamp: new Date().toISOString(),
            metadata: {
              source: "auto_introduction",
              is_campaign_start: true,
              generated_from: {
                title: campaign.name,
                description: campaign.description,
              },
            },
          })
          .select()
          .single();

        if (introError) {
          console.error("Error storing campaign introduction:", introError);
        } else {
          console.log("✅ Campaign introduction generated and stored!");
          finalSessionLogs = [introLog];
        }
      }
    }

    return NextResponse.json({
      campaign,
      user: {
        id: user.id,
        email: user.email,
        role: isOwner ? "owner" : "player",
      },
      sessionStarted,
      sessionLogs: finalSessionLogs,
      isOwner,
    });
  } catch (error) {
    console.error("Session status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
