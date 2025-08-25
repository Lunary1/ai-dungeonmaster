// API route for round advancement and campaign progression
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  AdvanceRoundResultSchema,
  calculateChapter,
  isChapterBoundary,
  isCampaignComplete,
  shouldTriggerSummary,
} from "@/lib/hybridLinearTypes";
import {
  buildCampaignContext,
  maybeSummarizeCampaign,
} from "@/lib/ai/campaignContext";
import { enhancedAIService } from "@/lib/enhancedAIService";

// Rate limiting for round advancement (prevent spam)
const roundAdvanceRateLimit = new Map();
const RATE_LIMIT_WINDOW = 30000; // 30 seconds between advances

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
        throw new Error("Invalid token");
      }

      return { user, client };
    }

    throw new Error("No authorization header");
  } catch (error) {
    console.error("Authentication error:", error);
    return null;
  }
}

export async function POST(request, { params }) {
  try {
    const resolvedParams = await params;
    const campaignId = resolvedParams.id;
    console.log("Advance round request for campaign:", campaignId);

    const auth = await getAuthenticatedUser(request);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, client } = auth;
    console.log("Authenticated user:", user.id);

    // Get campaign and verify DM permissions
    const { data: campaign, error: campaignError } = await client
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    console.log("Campaign query result:", {
      campaign: campaign?.id,
      error: campaignError,
    });

    if (campaignError || !campaign) {
      console.error("Campaign not found error:", campaignError);
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Only campaign owner can advance rounds (AI-only system)
    if (campaign.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Only the campaign owner can advance rounds" },
        { status: 403 }
      );
    }

    // Check and consume credits before advancing
    const { data: creditResult, error: creditError } = await client.rpc(
      "consume_round_credit",
      {
        campaign_uuid: campaignId,
      }
    );

    if (creditError) {
      console.error("Error consuming credit:", creditError);
      return NextResponse.json(
        { error: "Failed to process round credit" },
        { status: 500 }
      );
    }

    if (!creditResult.ok) {
      if (creditResult.error === "no_credits") {
        return NextResponse.json(
          {
            error: "no_credits",
            message:
              "No credits available. Host must purchase more credits to continue.",
            free_rounds_remaining: creditResult.free_rounds_remaining || 0,
            credits_balance: creditResult.credits_balance || 0,
          },
          { status: 402 } // Payment Required
        );
      }
      return NextResponse.json({ error: creditResult.error }, { status: 400 });
    }

    // Rate limiting check
    const rateLimitKey = `${user.id}-${campaignId}`;
    const lastAdvance = roundAdvanceRateLimit.get(rateLimitKey);
    if (lastAdvance && Date.now() - lastAdvance < RATE_LIMIT_WINDOW) {
      return NextResponse.json(
        { error: "Please wait before advancing again" },
        { status: 429 }
      );
    }

    // Check if campaign is already complete
    if (isCampaignComplete(campaign.current_round, campaign.target_rounds)) {
      return NextResponse.json(
        { error: "Campaign has reached its target length" },
        { status: 400 }
      );
    }

    // Calculate new round and chapter
    const newRound = campaign.current_round + 1;
    const newChapter = calculateChapter(newRound, campaign.rounds_per_chapter);
    const isNewChapter = newChapter > campaign.current_chapter;
    const isComplete = isCampaignComplete(newRound, campaign.target_rounds);

    // Update campaign round/chapter
    const { error: updateError } = await client
      .from("campaigns")
      .update({
        current_round: newRound,
        current_chapter: newChapter,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    if (updateError) {
      throw new Error(`Failed to update campaign: ${updateError.message}`);
    }

    // Log the round advancement
    await client.from("campaign_logs").insert({
      campaign_id: campaignId,
      user_input: `DM_ROUND_ADVANCE_${newRound}`,
      ai_output: `Round advanced to ${newRound} (Chapter ${newChapter})`,
      input_type: "round_advance",
      metadata: {
        previous_round: campaign.current_round,
        new_round: newRound,
        new_chapter: newChapter,
        is_chapter_boundary: isNewChapter,
        is_campaign_complete: isComplete,
      },
    });

    let result = {
      round: newRound,
      chapter: newChapter,
      isComplete,
      credit_type: creditResult.type,
      free_rounds_remaining: creditResult.free_rounds_remaining || 0,
      credits_balance: creditResult.credits_balance || 0,
    };

    // Trigger automatic summarization
    try {
      await maybeSummarizeCampaign(campaignId, client, 10);

      // Get the latest summary for result
      const { data: latestSummary } = await client
        .from("campaign_summaries")
        .select("content")
        .eq("campaign_id", campaignId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestSummary) {
        result.autosummary = latestSummary.content;
      }
    } catch (summaryError) {
      console.error("Error during summarization:", summaryError);
      // Don't fail the round advance for summarization errors
    }

    // Generate chapter summary at chapter boundaries
    if (isNewChapter) {
      try {
        const chapterSummary = await generateChapterSummary(
          campaignId,
          newChapter - 1, // Previous chapter
          client
        );

        if (chapterSummary) {
          // Store chapter checkpoint
          await client.from("chapter_checkpoints").upsert({
            campaign_id: campaignId,
            chapter: newChapter - 1,
            summary: chapterSummary,
          });

          result.chapterSummary = chapterSummary;
        }
      } catch (chapterError) {
        console.error("Error generating chapter summary:", chapterError);
        // Don't fail the round advance for chapter summary errors
      }
    }

    // Update rate limit
    roundAdvanceRateLimit.set(rateLimitKey, Date.now());

    // Validate result
    const validatedResult = AdvanceRoundResultSchema.parse(result);

    return NextResponse.json({
      success: true,
      ...validatedResult,
    });
  } catch (error) {
    console.error("Error advancing round:", error);
    return NextResponse.json(
      { error: "Failed to advance round" },
      { status: 500 }
    );
  }
}

async function generateChapterSummary(campaignId, chapter, client) {
  try {
    // Get all messages from the completed chapter
    const startRound = (chapter - 1) * 40 + 1;
    const endRound = chapter * 40;

    const { data: chapterLogs } = await client
      .from("campaign_logs")
      .select("user_input, ai_output, timestamp, metadata")
      .eq("campaign_id", campaignId)
      .gte("timestamp", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // Last 7 days as fallback
      .order("timestamp", { ascending: true })
      .limit(100);

    if (!chapterLogs || chapterLogs.length === 0) {
      return null;
    }

    // Build chapter context
    const chapterEvents = chapterLogs
      .map((log) => {
        const input =
          log.user_input !== `DM_ROUND_ADVANCE_${log.metadata?.new_round || ""}`
            ? log.user_input
            : "";
        return input && log.ai_output
          ? `${input}\n${log.ai_output}`
          : log.ai_output;
      })
      .filter(Boolean)
      .join("\n\n");

    const summaryPrompt = `You are creating a chapter summary for a D&D campaign. Chapter ${chapter} has concluded.

Create a comprehensive summary (200-300 words) covering:
- Major story developments and plot progression
- Key NPCs encountered and their significance
- Important locations visited
- Combat encounters and their outcomes
- Treasure found and equipment gained
- Character development and growth
- Unresolved plot threads leading into the next chapter

Chapter ${chapter} Events:
${chapterEvents}

Format: "Chapter ${chapter} Summary: [detailed summary content]"`;

    const summaryResult = await enhancedAIService.generateNarrative(
      summaryPrompt,
      { campaign: { name: "Chapter Summary Generation" } },
      [],
      [],
      []
    );

    return summaryResult.content;
  } catch (error) {
    console.error("Error generating chapter summary:", error);
    return null;
  }
}

// Cleanup expired rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of roundAdvanceRateLimit.entries()) {
    if (now - timestamp > RATE_LIMIT_WINDOW * 2) {
      roundAdvanceRateLimit.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW);
