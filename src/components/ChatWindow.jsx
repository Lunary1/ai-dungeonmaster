"use client";

import { useState, useEffect, useRef } from "react";
import CharacterSheet from "./CharacterSheet";
import CampaignImporter from "./CampaignImporter";
import MessageFormatter from "./MessageFormatter";
import {
  TypingIndicator,
  SpellCastingLoader,
  DiceRollLoader,
} from "./LoadingAnimations";
import DiceAnimation from "./DiceAnimation";

export default function ChatWindow({
  campaignId = "default-campaign",
  character = null,
}) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: "dm",
      content:
        "**🧙‍♂️ Welcome, brave adventurer!** \n\nI am your AI Dungeonmaster. You find yourself standing at the entrance of a mysterious tavern called **'The Prancing Pony'**. The wooden sign *creaks in the wind*, and warm light spills out from the windows.\n\n**What would you like to do?**\n\n*Try commands like:*\n• `/roll 1d20` - Roll a d20\n• `/check perception` - Make a perception check\n• `/character create` - Create your character",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState("thinking"); // 'thinking', 'rolling', 'casting'
  const [showCharacterSheet, setShowCharacterSheet] = useState(false);
  const [showCampaignImporter, setShowCampaignImporter] = useState(false);
  const [currentCharacter, setCurrentCharacter] = useState(character);
  const [isRollingDice, setIsRollingDice] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setCurrentCharacter(character);
  }, [character]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: "player",
      content: inputMessage.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    // Determine loading type based on message content
    if (userMessage.content.startsWith("/roll")) {
      setLoadingType("rolling");
      setIsRollingDice(true);
    } else if (
      userMessage.content.includes("spell") ||
      userMessage.content.includes("magic")
    ) {
      setLoadingType("casting");
    } else {
      setLoadingType("thinking");
    }

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          campaignId: campaignId,
          messageHistory: messages.slice(-10), // Send last 10 messages for context
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get AI response");
      }

      const data = await response.json();

      const aiMessage = {
        id: Date.now() + 1,
        type: data.message.includes("🎲") ? "system" : "dm",
        content: data.message,
        timestamp: new Date(),
      };

      // Add a slight delay for dice rolls to show animation
      if (loadingType === "rolling") {
        setTimeout(() => {
          setMessages((prev) => [...prev, aiMessage]);
          setIsRollingDice(false);
        }, 1000);
      } else {
        setMessages((prev) => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage = {
        id: Date.now() + 1,
        type: "system",
        content:
          "Sorry, there was an error processing your message. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getMessageStyle = (type) => {
    switch (type) {
      case "dm":
        return "bg-purple-800 bg-opacity-50 border-purple-600 text-purple-100";
      case "player":
        return "bg-blue-800 bg-opacity-50 border-blue-600 text-blue-100 ml-auto";
      case "system":
        return "bg-gray-800 bg-opacity-50 border-gray-600 text-gray-300 mx-auto";
      default:
        return "bg-gray-800 bg-opacity-50 border-gray-600 text-gray-300";
    }
  };

  const getTavernMessageStyle = (type) => {
    switch (type) {
      case "dm":
        return "bg-slate-700/50 border border-slate-600 text-white";
      case "player":
        return "bg-blue-900/30 border border-blue-700 text-blue-100";
      case "system":
        return "bg-green-900/30 border border-green-700 text-green-100";
      default:
        return "bg-slate-800/30 border border-slate-600 text-slate-300";
    }
  };

  const getMessageLabel = (type) => {
    switch (type) {
      case "dm":
        return "🐉 Dungeonmaster";
      case "player":
        return "⚔️ You";
      case "system":
        return "🔧 System";
      default:
        return "Unknown";
    }
  };

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg p-6 shadow-2xl">
      {/* Chat Header */}
      <div className="mb-6 pb-4 border-b border-slate-700">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-semibold text-amber-100 flex items-center gap-2 font-serif">
              <span className="animate-bounce text-2xl">🎲</span>
              Campaign Tales
            </h2>
            <p className="text-amber-200 text-sm mt-1">
              Campaign:{" "}
              <span className="text-amber-300 font-mono">{campaignId}</span>
            </p>
            <p className="text-amber-200 text-sm">
              Speak your actions, roll the dice, and let the adventure unfold...
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowCampaignImporter(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              📥 Import Campaign
            </button>
            <button
              onClick={() => setShowCharacterSheet(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              📋 Character Sheet
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="max-h-96 overflow-y-auto mb-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`p-4 rounded-lg ${getTavernMessageStyle(message.type)}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium font-serif">
                {getMessageLabel(message.type)}
              </span>
              <span className="text-xs opacity-70">
                {message.timestamp.toLocaleTimeString()}
              </span>
            </div>

            {/* Enhanced message content */}
            <MessageFormatter content={message.content} type={message.type} />
          </div>
        ))}

        {/* Enhanced Loading indicators */}
        {isLoading && (
          <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium font-serif text-amber-200">
                🐉 Dungeonmaster
              </span>
              <span className="text-xs opacity-70">thinking...</span>
            </div>
            {loadingType === "rolling" ? (
              <DiceRollLoader />
            ) : loadingType === "casting" ? (
              <SpellCastingLoader />
            ) : (
              <TypingIndicator />
            )}
          </div>
        )}

        {/* Dice Animation */}
        {isRollingDice && <DiceAnimation />}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-700 pt-4">
        <div className="flex gap-2">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Describe your actions, ask questions, or use commands..."
            className="flex-1 bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
            rows="2"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors font-medium"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-amber-300 border-t-transparent rounded-full animate-spin"></div>
                <span>Sending...</span>
              </div>
            ) : (
              "Send"
            )}
          </button>
        </div>

        <div className="mt-2 text-xs text-amber-300 opacity-75">
          <span className="font-medium">Quick commands:</span> /roll 1d20+5,
          /check perception, /save dexterity, /initiative, /help
        </div>
      </div>

      {/* Character Sheet Modal */}
      {showCharacterSheet && (
        <CharacterSheet
          campaignId={campaignId}
          onClose={() => setShowCharacterSheet(false)}
          onCharacterUpdate={(character) => setCurrentCharacter(character)}
        />
      )}

      {/* Campaign Importer Modal */}
      {showCampaignImporter && (
        <CampaignImporter
          onClose={() => setShowCampaignImporter(false)}
          onCampaignImported={(newCampaignId) => {
            setCampaignId(newCampaignId);
            setShowCampaignImporter(false);

            // Add a welcome message for the imported campaign
            const welcomeMessage = {
              id: Date.now(),
              type: "system",
              content: `🎉 **Campaign imported successfully!** Your adventure continues... The memories of your previous sessions echo in the air as the story unfolds once more.`,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, welcomeMessage]);
          }}
        />
      )}
    </div>
  );
}
