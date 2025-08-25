import { NextResponse } from "next/server";
import { memoryService } from "@/lib/memoryService";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");

    if (!campaignId) {
      return NextResponse.json(
        { error: "Campaign ID required" },
        { status: 400 }
      );
    }

    // Get character from memory service
    const character = await memoryService.getCharacter(campaignId);

    return NextResponse.json({ character });
  } catch (error) {
    console.error("Error fetching character:", error);
    return NextResponse.json(
      { error: "Failed to fetch character" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { campaignId, character } = await request.json();

    if (!campaignId || !character) {
      return NextResponse.json(
        { error: "Campaign ID and character data required" },
        { status: 400 }
      );
    }

    // Save character using memory service
    await memoryService.saveCharacter(campaignId, character);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving character:", error);
    return NextResponse.json(
      { error: "Failed to save character" },
      { status: 500 }
    );
  }
}
