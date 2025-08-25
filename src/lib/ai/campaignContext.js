// Campaign context assembly for AI DM storytelling
import { z } from "zod";

const SummarySchema = z.object({
  id: z.string(),
  campaign_id: z.string(),
  content: z.string(),
  last_message_id: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

/**
 * Build campaign context for AI DM narration
 * @param {string} campaignId - Campaign ID
 * @param {object} client - Supabase client
 * @param {number} limit - Number of recent messages to include (default: 20)
 * @returns {object} - { summary, recentMessages, campaignInfo }
 */
export async function buildCampaignContext(campaignId, client, limit = 20) {
  try {
    // Get campaign basic info
    const { data: campaign } = await client
      .from("campaigns")
      .select("name, description")
      .eq("id", campaignId)
      .single();

    // Get latest summary
    const { data: summaryData } = await client
      .from("campaign_summaries")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let summary = null;
    if (summaryData) {
      summary = SummarySchema.parse(summaryData);
    }

    // Get recent messages since summary (or last N messages)
    let messagesQuery = client
      .from("campaign_logs")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (summary?.last_message_id) {
      // Get messages created after the last summarized message
      const { data: lastMessage } = await client
        .from("campaign_logs")
        .select("timestamp")
        .eq("id", summary.last_message_id)
        .single();

      if (lastMessage) {
        messagesQuery = messagesQuery.gt("timestamp", lastMessage.timestamp);
      }
    }

    const { data: recentMessages } = await messagesQuery;

    // Format for AI consumption
    const contextMessages = (recentMessages || [])
      .reverse() // Chronological order
      .map((log) => ({
        role:
          log.metadata?.source === "ai_dm" || log.metadata?.is_ai_response
            ? "assistant"
            : "user",
        content:
          log.metadata?.source === "ai_dm" || log.metadata?.is_ai_response
            ? log.ai_output
            : `[${log.input_type}] ${log.user_input}`,
        timestamp: log.timestamp,
      }));

    return {
      summary: summary?.content || null,
      recentMessages: contextMessages,
      campaignInfo: {
        name: campaign?.name || "Unknown Campaign",
        description: campaign?.description || "",
      },
      messageCount: recentMessages?.length || 0,
    };
  } catch (error) {
    console.error("Error building campaign context:", error);
    return {
      summary: null,
      recentMessages: [],
      campaignInfo: { name: "Unknown Campaign", description: "" },
      messageCount: 0,
    };
  }
}

/**
 * Check if campaign needs summarization and trigger if needed
 * @param {string} campaignId - Campaign ID
 * @param {object} client - Supabase client
 * @param {number} threshold - Number of new messages to trigger summary (default: 10)
 */
export async function maybeSummarizeCampaign(
  campaignId,
  client,
  threshold = 10
) {
  try {
    // Get latest summary
    const { data: latestSummary } = await client
      .from("campaign_summaries")
      .select("last_message_id, created_at")
      .eq("campaign_id", campaignId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Count messages since last summary
    let messageQuery = client
      .from("campaign_logs")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId);

    if (latestSummary?.last_message_id) {
      const { data: lastMessage } = await client
        .from("campaign_logs")
        .select("timestamp")
        .eq("id", latestSummary.last_message_id)
        .single();

      if (lastMessage) {
        messageQuery = messageQuery.gt("timestamp", lastMessage.timestamp);
      }
    }

    const { count } = await messageQuery;

    if (count >= threshold) {
      console.log(
        `Triggering summarization for campaign ${campaignId} (${count} new messages)`
      );
      await createCampaignSummary(campaignId, client);
    }
  } catch (error) {
    console.error("Error in maybeSummarizeCampaign:", error);
    // Don't throw - summarization failures shouldn't break the main flow
  }
}

/**
 * Create or update campaign summary
 * @param {string} campaignId - Campaign ID
 * @param {object} client - Supabase client
 */
async function createCampaignSummary(campaignId, client) {
  try {
    const { enhancedAIService } = await import("../enhancedAIService.js");

    // Get latest summary
    const { data: latestSummary } = await client
      .from("campaign_summaries")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get messages to summarize (last 20 for context)
    let messagesQuery = client
      .from("campaign_logs")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("timestamp", { ascending: false })
      .limit(20);

    if (latestSummary?.last_message_id) {
      const { data: lastMessage } = await client
        .from("campaign_logs")
        .select("timestamp")
        .eq("id", latestSummary.last_message_id)
        .single();

      if (lastMessage) {
        messagesQuery = messagesQuery.gt("timestamp", lastMessage.timestamp);
      }
    }

    const { data: messagesToSummarize } = await messagesQuery;

    if (!messagesToSummarize || messagesToSummarize.length === 0) {
      return;
    }

    // Prepare summary context
    const previousSummary = latestSummary?.content || "";
    const messageText = messagesToSummarize
      .reverse()
      .map((log) => {
        const timestamp = new Date(log.timestamp).toISOString();
        return `[${timestamp}] ${log.input_type}: ${
          log.metadata?.source === "ai_dm" || log.metadata?.is_ai_response
            ? log.ai_output
            : log.user_input
        }`;
      })
      .join("\n");

    // Generate summary using AI
    const summaryPrompt = `You are summarizing recent events in a D&D campaign. Create a concise summary (120-200 words) that captures:
- Major events and story developments
- NPCs encountered and their significance  
- Unresolved quests or plot threads
- Current party location and status
- Important items gained or lost

Previous summary: ${previousSummary || "This is the beginning of the campaign."}

Recent events to summarize:
${messageText}

Format: "Since [date]: [summary content]"`;

    const summaryResult = await enhancedAIService.generateNarrative(
      summaryPrompt,
      { campaign: { name: "Summary Generation" } },
      [],
      [],
      []
    );

    const latestMessageId =
      messagesToSummarize[messagesToSummarize.length - 1]?.id;

    // Save summary
    const summaryData = {
      campaign_id: campaignId,
      content: summaryResult.content.trim(),
      last_message_id: latestMessageId,
      updated_at: new Date().toISOString(),
    };

    if (latestSummary) {
      // Update existing summary
      await client
        .from("campaign_summaries")
        .update(summaryData)
        .eq("id", latestSummary.id);
    } else {
      // Create new summary
      await client.from("campaign_summaries").insert({
        ...summaryData,
        created_at: new Date().toISOString(),
      });
    }

    console.log(`Campaign summary updated for ${campaignId}`);
  } catch (error) {
    console.error("Error creating campaign summary:", error);
    // Don't throw - let the main flow continue
  }
}
