"use client";

import { useState, useRef } from "react";

export default function CampaignImporter({ onCampaignImported, onClose }) {
  const [activeTab, setActiveTab] = useState("campaign");
  const [campaignData, setCampaignData] = useState({
    name: "Dragon of Icespire Peak",
    description: "",
    currentLocation: "",
    sessionNotes: "",
    keyNPCs: "",
    activeQuests: "",
    partyLevel: 1,
    importedFrom: "dndbeyond",
  });
  const [characters, setCharacters] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (event, type) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const text = await file.text();

      if (type === "character") {
        // Handle different character sheet formats
        let characterData;

        if (file.name.endsWith(".json")) {
          // D&D Beyond JSON export
          characterData = JSON.parse(text);
          const processedCharacter = processDnDBeyondCharacter(characterData);
          setCharacters((prev) => [...prev, processedCharacter]);
        } else if (file.name.endsWith(".txt") || file.name.endsWith(".md")) {
          // Text-based character sheet
          const processedCharacter = parseTextCharacterSheet(text);
          setCharacters((prev) => [...prev, processedCharacter]);
        }
      } else if (type === "campaign") {
        // Handle campaign notes/session logs
        setCampaignData((prev) => ({
          ...prev,
          sessionNotes: text,
          description: extractCampaignDescription(text),
        }));
      }
    } catch (error) {
      console.error("Error parsing file:", error);
      alert("Error parsing file. Please check the format and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const processDnDBeyondCharacter = (data) => {
    // Process D&D Beyond character data
    return {
      name: data.name || "Imported Character",
      class: data.classes?.[0]?.definition?.name || "Fighter",
      level: data.classes?.[0]?.level || 1,
      race: data.race?.fullName || "Human",
      background: data.background?.definition?.name || "",
      abilities: {
        strength: data.stats?.[0]?.value || 10,
        dexterity: data.stats?.[1]?.value || 10,
        constitution: data.stats?.[2]?.value || 10,
        intelligence: data.stats?.[3]?.value || 10,
        wisdom: data.stats?.[4]?.value || 10,
        charisma: data.stats?.[5]?.value || 10,
      },
      hitPoints: {
        current: data.baseHitPoints || 8,
        maximum: data.baseHitPoints || 8,
        temporary: 0,
      },
      armorClass: data.armorClass || 10,
      speed: data.race?.weightSpeeds?.normal?.walk || 30,
      skillProficiencies: extractSkillProficiencies(data),
      savingThrowProficiencies: extractSavingThrowProficiencies(data),
      personality: data.traits?.personalityTraits || "",
      ideals: data.traits?.ideals || "",
      bonds: data.traits?.bonds || "",
      flaws: data.traits?.flaws || "",
      backstory: data.backstory || "",
      importedFrom: "dndbeyond",
    };
  };

  const parseTextCharacterSheet = (text) => {
    // Basic text parsing for character sheets
    const lines = text.split("\n");
    const character = {
      name: "Imported Character",
      class: "Fighter",
      level: 1,
      race: "Human",
      abilities: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      hitPoints: { current: 8, maximum: 8, temporary: 0 },
      armorClass: 10,
      speed: 30,
      skillProficiencies: [],
      savingThrowProficiencies: [],
      importedFrom: "text",
    };

    // Parse common patterns
    lines.forEach((line) => {
      const lower = line.toLowerCase();
      if (lower.includes("name:"))
        character.name = line.split(":")[1]?.trim() || character.name;
      if (lower.includes("class:"))
        character.class = line.split(":")[1]?.trim() || character.class;
      if (lower.includes("level:"))
        character.level =
          parseInt(line.split(":")[1]?.trim()) || character.level;
      if (lower.includes("race:"))
        character.race = line.split(":")[1]?.trim() || character.race;

      // Parse ability scores
      if (lower.includes("strength:"))
        character.abilities.strength =
          parseInt(line.split(":")[1]?.trim()) || 10;
      if (lower.includes("dexterity:"))
        character.abilities.dexterity =
          parseInt(line.split(":")[1]?.trim()) || 10;
      if (lower.includes("constitution:"))
        character.abilities.constitution =
          parseInt(line.split(":")[1]?.trim()) || 10;
      if (lower.includes("intelligence:"))
        character.abilities.intelligence =
          parseInt(line.split(":")[1]?.trim()) || 10;
      if (lower.includes("wisdom:"))
        character.abilities.wisdom = parseInt(line.split(":")[1]?.trim()) || 10;
      if (lower.includes("charisma:"))
        character.abilities.charisma =
          parseInt(line.split(":")[1]?.trim()) || 10;
    });

    return character;
  };

  const extractSkillProficiencies = (data) => {
    const proficiencies = [];
    data.modifiers?.forEach((mod) => {
      if (mod.type === "proficiency" && mod.subType === "ability-check") {
        const skillName = mod.friendlySubtypeName;
        if (skillName) proficiencies.push(skillName);
      }
    });
    return proficiencies;
  };

  const extractSavingThrowProficiencies = (data) => {
    const proficiencies = [];
    data.modifiers?.forEach((mod) => {
      if (mod.type === "proficiency" && mod.subType === "saving-throw") {
        const abilityName = mod.friendlySubtypeName?.toLowerCase();
        if (abilityName) proficiencies.push(abilityName);
      }
    });
    return proficiencies;
  };

  const extractCampaignDescription = (text) => {
    // Extract key information from campaign notes
    const lines = text.split("\n").slice(0, 10); // First 10 lines
    return lines.join(" ").substring(0, 500) + "...";
  };

  const handleImportCampaign = async () => {
    setIsLoading(true);
    try {
      // Save campaign data
      const response = await fetch("/api/campaign/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign: campaignData,
          characters: characters,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        onCampaignImported?.(result.campaignId);
        onClose?.();
      } else {
        throw new Error("Failed to import campaign");
      }
    } catch (error) {
      console.error("Error importing campaign:", error);
      alert("Error importing campaign. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden border border-purple-500 animate-fade-in-scale">
        {/* Header */}
        <div className="bg-black bg-opacity-30 p-4 border-b border-purple-500">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white animate-text-glow flex items-center gap-2">
              🐉 <span className="animate-shimmer">Import D&D Campaign</span>
            </h2>
            <button
              onClick={onClose}
              className="text-purple-300 hover:text-white text-2xl font-bold transition-all duration-300 hover:scale-110"
            >
              ×
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-black bg-opacity-20 p-2 border-b border-purple-500">
          <div className="flex space-x-2">
            {["campaign", "characters", "review"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded font-medium capitalize transition-all duration-300 ${
                  activeTab === tab
                    ? "bg-purple-600 text-white animate-glow transform scale-105"
                    : "bg-purple-800 bg-opacity-50 text-purple-300 hover:text-white hover:bg-purple-700"
                }`}
              >
                {tab === "campaign" && "📚"} {tab === "characters" && "⚔️"}{" "}
                {tab === "review" && "📋"} {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
          {/* Campaign Tab */}
          {activeTab === "campaign" && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">
                  📚 Campaign Information
                </h3>
                <p className="text-purple-200">
                  Set up your Dragon of Icespire Peak campaign details
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-purple-200 text-sm font-medium mb-2">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    value={campaignData.name}
                    onChange={(e) =>
                      setCampaignData((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="w-full bg-purple-800 bg-opacity-50 border border-purple-600 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-purple-200 text-sm font-medium mb-2">
                    Party Level
                  </label>
                  <input
                    type="number"
                    value={campaignData.partyLevel}
                    onChange={(e) =>
                      setCampaignData((prev) => ({
                        ...prev,
                        partyLevel: parseInt(e.target.value) || 1,
                      }))
                    }
                    className="w-full bg-purple-800 bg-opacity-50 border border-purple-600 rounded px-3 py-2 text-white"
                    min="1"
                    max="20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-purple-200 text-sm font-medium mb-2">
                  Current Location
                </label>
                <input
                  type="text"
                  value={campaignData.currentLocation}
                  onChange={(e) =>
                    setCampaignData((prev) => ({
                      ...prev,
                      currentLocation: e.target.value,
                    }))
                  }
                  placeholder="e.g., Phandalin, Icespire Peak, etc."
                  className="w-full bg-purple-800 bg-opacity-50 border border-purple-600 rounded px-3 py-2 text-white placeholder-purple-300"
                />
              </div>

              <div>
                <label className="block text-purple-200 text-sm font-medium mb-2">
                  Campaign Description
                </label>
                <textarea
                  value={campaignData.description}
                  onChange={(e) =>
                    setCampaignData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Brief description of your campaign progress..."
                  className="w-full bg-purple-800 bg-opacity-50 border border-purple-600 rounded px-3 py-2 text-white placeholder-purple-300 h-24 resize-none"
                />
              </div>

              <div>
                <label className="block text-purple-200 text-sm font-medium mb-2">
                  Session Notes / Campaign Log
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => handleFileUpload(e, "campaign")}
                    accept=".txt,.md,.json"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors"
                  >
                    📁 Upload Session Notes
                  </button>
                </div>
                <textarea
                  value={campaignData.sessionNotes}
                  onChange={(e) =>
                    setCampaignData((prev) => ({
                      ...prev,
                      sessionNotes: e.target.value,
                    }))
                  }
                  placeholder="Paste your session notes, or upload a file above..."
                  className="w-full bg-purple-800 bg-opacity-50 border border-purple-600 rounded px-3 py-2 text-white placeholder-purple-300 h-32 resize-none"
                />
              </div>
            </div>
          )}

          {/* Characters Tab */}
          {activeTab === "characters" && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">
                  ⚔️ Import Characters
                </h3>
                <p className="text-purple-200">
                  Upload character sheets from D&D Beyond or text files
                </p>
              </div>

              <div className="flex gap-4 mb-4">
                <input
                  type="file"
                  onChange={(e) => handleFileUpload(e, "character")}
                  accept=".json,.txt,.md"
                  multiple
                  className="hidden"
                  id="character-upload"
                />
                <label
                  htmlFor="character-upload"
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg cursor-pointer transition-colors flex items-center gap-2"
                >
                  📄 Upload Character Sheets
                </label>
                <button
                  onClick={() =>
                    setCharacters((prev) => [
                      ...prev,
                      {
                        name: "New Character",
                        class: "Fighter",
                        level: campaignData.partyLevel,
                        race: "Human",
                        abilities: {
                          strength: 10,
                          dexterity: 10,
                          constitution: 10,
                          intelligence: 10,
                          wisdom: 10,
                          charisma: 10,
                        },
                        hitPoints: { current: 8, maximum: 8, temporary: 0 },
                        armorClass: 10,
                        speed: 30,
                        skillProficiencies: [],
                        savingThrowProficiencies: [],
                        importedFrom: "manual",
                      },
                    ])
                  }
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors"
                >
                  ➕ Add Manually
                </button>
              </div>

              {characters.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-white">
                    Imported Characters:
                  </h4>
                  {characters.map((character, index) => (
                    <div
                      key={index}
                      className="bg-purple-800 bg-opacity-30 rounded-lg p-4 border border-purple-600"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h5 className="text-white font-medium">
                            {character.name}
                          </h5>
                          <p className="text-purple-200 text-sm">
                            Level {character.level} {character.race}{" "}
                            {character.class}
                          </p>
                          <p className="text-purple-300 text-xs mt-1">
                            Imported from: {character.importedFrom}
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            setCharacters((prev) =>
                              prev.filter((_, i) => i !== index)
                            )
                          }
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {characters.length === 0 && (
                <div className="text-center text-purple-300 py-8">
                  <p>No characters imported yet.</p>
                  <p className="text-sm mt-2">
                    Upload D&D Beyond character exports or add characters
                    manually.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Review Tab */}
          {activeTab === "review" && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">
                  📋 Review & Import
                </h3>
                <p className="text-purple-200">
                  Review your campaign setup before importing
                </p>
              </div>

              <div className="bg-purple-800 bg-opacity-30 rounded-lg p-4 border border-purple-600">
                <h4 className="text-white font-medium mb-2">
                  Campaign: {campaignData.name}
                </h4>
                <p className="text-purple-200 text-sm">
                  Party Level: {campaignData.partyLevel}
                </p>
                <p className="text-purple-200 text-sm">
                  Location: {campaignData.currentLocation || "Not specified"}
                </p>
                <p className="text-purple-200 text-sm">
                  Characters: {characters.length}
                </p>
              </div>

              {characters.length > 0 && (
                <div className="bg-purple-800 bg-opacity-30 rounded-lg p-4 border border-purple-600">
                  <h4 className="text-white font-medium mb-2">
                    Party Members:
                  </h4>
                  <div className="space-y-2">
                    {characters.map((character, index) => (
                      <div key={index} className="text-purple-200 text-sm">
                        • {character.name} - Level {character.level}{" "}
                        {character.race} {character.class}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleImportCampaign}
                  disabled={isLoading || !campaignData.name}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  {isLoading ? "Importing..." : "🚀 Import Campaign"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
