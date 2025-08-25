/**
 * Two-Tier AI Tools Test API Endpoint
 * Test endpoint for validating tool functionality
 */

import { NextResponse } from "next/server";
import { twoTierAI } from "@/lib/ai/twoTierAIService";
import { createClient } from "@supabase/supabase-js";

export async function POST(request) {
  try {
    const {
      campaignId,
      testType = "dice_roll",
      userMessage = "Test the dice rolling system",
      tier = "DM",
    } = await request.json();

    if (!campaignId) {
      return NextResponse.json(
        { error: "campaignId is required" },
        { status: 400 }
      );
    }

    // Create basic test context
    const testContext = {
      currentRound: 1,
      currentChapter: 1,
      storyBible: "Test campaign for validating two-tier AI system",
      recentMessages: [],
    };

    const testCharacterInfo = {
      name: "Test Character",
      class: "Fighter",
      level: 5,
    };

    console.log(`🧪 Testing ${tier} tier with ${testType}`);

    // Generate AI response using two-tier system
    const aiResponse = await twoTierAI.generateResponse({
      userMessage,
      campaignId,
      campaignContext: testContext,
      messageHistory: [],
      characterInfo: testCharacterInfo,
      tier,
    });

    return NextResponse.json({
      success: true,
      testType,
      tier,
      aiResponse,
      message: "Tool test completed successfully",
    });
  } catch (error) {
    console.error("Tool test error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  return NextResponse.json({
    message: "Two-Tier AI Tools Test Endpoint",
    usage: "POST with campaignId, testType, userMessage, and tier",
    availableTestTypes: [
      "dice_roll",
      "rule_lookup",
      "encounter_generation",
      "npc_generation",
      "campaign_analysis",
    ],
    availableTiers: ["DM", "DIRECTOR"],
  });
}
