import { NextResponse } from "next/server";
import { memoryService } from "@/lib/memoryService";

export async function POST(request) {
  try {
    const { campaign, characters } = await request.json();

    if (!campaign || !campaign.name) {
      return NextResponse.json(
        { error: "Campaign name required" },
        { status: 400 }
      );
    }

    // Generate a campaign ID based on the name
    const campaignId =
      campaign.name.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now();

    // Save campaign information
    await memoryService.createCampaign(campaignId, {
      name: campaign.name,
      description: campaign.description || "",
      currentLocation: campaign.currentLocation || "",
      partyLevel: campaign.partyLevel || 1,
      sessionNotes: campaign.sessionNotes || "",
      importedFrom: campaign.importedFrom || "manual",
      importedAt: new Date().toISOString(),
    });

    // Import all characters
    if (characters && characters.length > 0) {
      for (const character of characters) {
        await memoryService.saveCharacter(campaignId, {
          ...character,
          importedAt: new Date().toISOString(),
        });
      }
    }

    // Add initial Dragon of Icespire Peak context if it's that campaign
    if (
      campaign.name.toLowerCase().includes("icespire") ||
      campaign.name.toLowerCase().includes("dragon")
    ) {
      await memoryService.addCampaignContext(campaignId, {
        module: "Dragon of Icespire Peak",
        setting: "Sword Coast, Phandalin region",
        keyLocations: [
          "Phandalin",
          "Icespire Peak",
          "Gnomengarde",
          "Umbrage Hill",
          "Butterskull Ranch",
          "Logging Camp",
          "Mountain's Toe Gold Mine",
        ],
        keyNPCs: [
          "Toblen Stonehill (Innkeeper)",
          "Sister Garaele (Cleric)",
          "Harbin Wester (Townmaster)",
          "Barthen (Trader)",
          "Cryovain (White Dragon)",
          "Falcon (Manticore)",
        ],
        mainQuest:
          "Investigate the white dragon Cryovain terrorizing the region",
      });
    }

    return NextResponse.json({
      success: true,
      campaignId,
      message: `Campaign "${campaign.name}" imported successfully with ${
        characters?.length || 0
      } characters.`,
    });
  } catch (error) {
    console.error("Error importing campaign:", error);
    return NextResponse.json(
      { error: "Failed to import campaign" },
      { status: 500 }
    );
  }
}
