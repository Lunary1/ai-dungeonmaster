"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export default function MobileSessionInterface({
  campaignId,
  sessionData,
  character,
  isDM = false,
}) {
  // Mobile-specific state
  const [mobileView, setMobileView] = useState("chat"); // 'chat', 'dice', 'character', 'status'
  const [isLandscape, setIsLandscape] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("connected");

  // Quick access state
  const [quickDice, setQuickDice] = useState("d20");
  const [quickMessage, setQuickMessage] = useState("");
  const [characterHP, setCharacterHP] = useState(character?.current_hp || 0);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Mobile chat state
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Touch gestures
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  // Detect device orientation
  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerHeight < window.innerWidth);
    };

    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);

    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  // Connection monitoring
  useEffect(() => {
    const checkConnection = () => {
      if (navigator.onLine) {
        setConnectionStatus("connected");
        setIsOfflineMode(false);
      } else {
        setConnectionStatus("offline");
        setIsOfflineMode(true);
      }
    };

    checkConnection();
    window.addEventListener("online", checkConnection);
    window.addEventListener("offline", checkConnection);

    return () => {
      window.removeEventListener("online", checkConnection);
      window.removeEventListener("offline", checkConnection);
    };
  }, []);

  // Load messages for mobile
  const loadMessages = useCallback(async () => {
    if (!campaignId || isOfflineMode) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `/api/campaigns/${campaignId}/session?limit=20`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMessages(data.sessionLogs || []);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  }, [campaignId, isOfflineMode]);

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || sending || isOfflineMode) return;

    setSending(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/session/${campaignId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_input: newMessage,
          input_type: "message",
          metadata: { source: "mobile_interface" },
        }),
      });

      if (response.ok) {
        setNewMessage("");
        loadMessages(); // Refresh messages
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  // Quick dice roll
  const quickRoll = async (diceType) => {
    if (isOfflineMode) {
      // Offline mode - local dice roll
      const sides = parseInt(diceType.replace("d", ""));
      const result = Math.floor(Math.random() * sides) + 1;

      // Add to local messages
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          user_input: `Rolling ${diceType}`,
          ai_output: `🎲 Rolled ${diceType}: **${result}**`,
          timestamp: new Date().toISOString(),
          metadata: { source: "offline_dice" },
        },
      ]);
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/session/${campaignId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_input: `/roll ${diceType}`,
          input_type: "dice_roll",
          metadata: { source: "mobile_quick_roll" },
        }),
      });

      if (response.ok) {
        loadMessages();
      }
    } catch (error) {
      console.error("Error rolling dice:", error);
    }
  };

  // Touch gesture handling
  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      // Swipe left - next view
      const views = ["chat", "dice", "character", "status"];
      const currentIndex = views.indexOf(mobileView);
      const nextIndex = (currentIndex + 1) % views.length;
      setMobileView(views[nextIndex]);
    }

    if (isRightSwipe) {
      // Swipe right - previous view
      const views = ["chat", "dice", "character", "status"];
      const currentIndex = views.indexOf(mobileView);
      const prevIndex =
        currentIndex === 0 ? views.length - 1 : currentIndex - 1;
      setMobileView(views[prevIndex]);
    }
  };

  // Initialize mobile interface
  useEffect(() => {
    if (sessionData?.sessionStarted) {
      loadMessages();
    }
  }, [sessionData, loadMessages]);

  const mobileViews = {
    chat: { icon: "💬", label: "Chat" },
    dice: { icon: "🎲", label: "Dice" },
    character: { icon: "👤", label: "Character" },
    status: { icon: "📊", label: "Status" },
  };

  return (
    <div
      className="bg-slate-900 text-white min-h-screen flex flex-col relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Status bar */}
      <div className="bg-slate-800 px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              connectionStatus === "connected"
                ? "bg-green-400"
                : connectionStatus === "reconnecting"
                ? "bg-yellow-400"
                : "bg-red-400"
            }`}
          ></div>
          <span className="capitalize">{connectionStatus}</span>
          {isOfflineMode && (
            <span className="text-yellow-400">Offline Mode</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {sessionData?.sessionStarted && (
            <span className="text-green-400">🔴 LIVE</span>
          )}
          <button
            onClick={() => setShowQuickActions(!showQuickActions)}
            className="text-blue-400"
          >
            ⚡
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* View content */}
        <div className="flex-1 overflow-auto p-4">
          {mobileView === "chat" && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold mb-4">💬 Campaign Chat</h2>

              {/* Messages */}
              <div className="space-y-2 mb-4">
                {messages.slice(-10).map((message) => (
                  <div key={message.id} className="bg-slate-800 rounded-lg p-3">
                    {message.user_input && (
                      <div className="text-blue-300 text-sm mb-1">
                        {message.user_input}
                      </div>
                    )}
                    {message.ai_output && (
                      <div className="text-white">{message.ai_output}</div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>

              {/* Message input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={
                    isOfflineMode
                      ? "Offline - messages will send when reconnected"
                      : "Type a message..."
                  }
                  className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 text-sm"
                  disabled={sending || isOfflineMode}
                  onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending || isOfflineMode}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  {sending ? "..." : "📤"}
                </button>
              </div>
            </div>
          )}

          {mobileView === "dice" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold mb-4">🎲 Quick Dice</h2>

              {/* Common dice */}
              <div className="grid grid-cols-2 gap-3">
                {["d4", "d6", "d8", "d10", "d12", "d20"].map((dice) => (
                  <button
                    key={dice}
                    onClick={() => quickRoll(dice)}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg p-4 text-center transition-colors"
                  >
                    <div className="text-2xl mb-1">🎲</div>
                    <div className="font-bold">{dice.toUpperCase()}</div>
                  </button>
                ))}
              </div>

              {/* Advantage/Disadvantage */}
              <div className="space-y-2">
                <h3 className="font-semibold">
                  D20 with Advantage/Disadvantage
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => quickRoll("2d20kh1")}
                    className="bg-green-700 hover:bg-green-600 rounded-lg p-3 text-center"
                  >
                    <div>⬆️ Advantage</div>
                    <div className="text-sm">2d20 keep highest</div>
                  </button>
                  <button
                    onClick={() => quickRoll("2d20kl1")}
                    className="bg-red-700 hover:bg-red-600 rounded-lg p-3 text-center"
                  >
                    <div>⬇️ Disadvantage</div>
                    <div className="text-sm">2d20 keep lowest</div>
                  </button>
                </div>
              </div>

              {/* Custom dice */}
              <div className="space-y-2">
                <h3 className="font-semibold">Custom Roll</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g., 2d6+3"
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && e.target.value) {
                        quickRoll(e.target.value);
                        e.target.value = "";
                      }
                    }}
                  />
                  <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                    Roll
                  </button>
                </div>
              </div>
            </div>
          )}

          {mobileView === "character" && character && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold mb-4">👤 {character.name}</h2>

              {/* Character stats */}
              <div className="bg-slate-800 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-400">Class & Level</div>
                    <div className="font-bold">
                      {character.class} {character.level}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Armor Class</div>
                    <div className="font-bold">
                      {character.armor_class || 10}
                    </div>
                  </div>
                </div>

                {/* HP Management */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Hit Points</span>
                    <span className="font-bold">
                      {characterHP}/{character.max_hp}
                    </span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        characterHP / character.max_hp > 0.5
                          ? "bg-green-500"
                          : characterHP / character.max_hp > 0.25
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                      style={{
                        width: `${(characterHP / character.max_hp) * 100}%`,
                      }}
                    ></div>
                  </div>

                  {/* HP adjustment buttons */}
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() =>
                        setCharacterHP(Math.max(0, characterHP - 1))
                      }
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                    >
                      -1
                    </button>
                    <button
                      onClick={() =>
                        setCharacterHP(Math.max(0, characterHP - 5))
                      }
                      className="bg-red-700 hover:bg-red-800 text-white px-3 py-1 rounded text-sm"
                    >
                      -5
                    </button>
                    <button
                      onClick={() =>
                        setCharacterHP(
                          Math.min(character.max_hp, characterHP + 1)
                        )
                      }
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                    >
                      +1
                    </button>
                    <button
                      onClick={() =>
                        setCharacterHP(
                          Math.min(character.max_hp, characterHP + 5)
                        )
                      }
                      className="bg-green-700 hover:bg-green-800 text-white px-3 py-1 rounded text-sm"
                    >
                      +5
                    </button>
                  </div>
                </div>

                {/* Ability scores */}
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  {["STR", "DEX", "CON", "INT", "WIS", "CHA"].map((ability) => (
                    <div key={ability} className="bg-slate-700 rounded p-2">
                      <div className="text-xs text-gray-400">{ability}</div>
                      <div className="font-bold">
                        {character.ability_scores?.[ability.toLowerCase()] ||
                          10}
                      </div>
                      <div className="text-xs">
                        {Math.floor(
                          (character.ability_scores?.[ability.toLowerCase()] ||
                            10 - 10) / 2
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {mobileView === "status" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold mb-4">📊 Session Status</h2>

              {/* Session info */}
              <div className="bg-slate-800 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Session Status</span>
                  <span
                    className={
                      sessionData?.sessionStarted
                        ? "text-green-400"
                        : "text-red-400"
                    }
                  >
                    {sessionData?.sessionStarted ? "🔴 Live" : "⭕ Not Started"}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">Connection</span>
                  <span
                    className={
                      connectionStatus === "connected"
                        ? "text-green-400"
                        : "text-red-400"
                    }
                  >
                    {connectionStatus}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">Device</span>
                  <span className="text-blue-400">
                    📱 Mobile {isLandscape ? "🔄" : "📱"}
                  </span>
                </div>
              </div>

              {/* Quick status actions */}
              <div className="space-y-2">
                <h3 className="font-semibold">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button className="bg-green-700 hover:bg-green-600 rounded-lg p-3 text-center text-sm">
                    ✅ Ready
                  </button>
                  <button className="bg-yellow-700 hover:bg-yellow-600 rounded-lg p-3 text-center text-sm">
                    ⏸️ Break
                  </button>
                  <button className="bg-blue-700 hover:bg-blue-600 rounded-lg p-3 text-center text-sm">
                    ❓ Question
                  </button>
                  <button className="bg-red-700 hover:bg-red-600 rounded-lg p-3 text-center text-sm">
                    🚨 Help
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom navigation */}
        <div className="bg-slate-800 border-t border-slate-700 px-4 py-2">
          <div className="grid grid-cols-4 gap-1">
            {Object.entries(mobileViews).map(([view, config]) => (
              <button
                key={view}
                onClick={() => setMobileView(view)}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded transition-colors ${
                  mobileView === view
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <div className="text-lg">{config.icon}</div>
                <div className="text-xs">{config.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions overlay */}
      {showQuickActions && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 m-4 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">⚡ Quick Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => {
                  quickRoll("d20");
                  setShowQuickActions(false);
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 rounded-lg p-3 text-left"
              >
                🎲 Roll d20
              </button>
              <button
                onClick={() => {
                  setMobileView("chat");
                  setShowQuickActions(false);
                }}
                className="w-full bg-green-600 hover:bg-green-700 rounded-lg p-3 text-left"
              >
                💬 Send Message
              </button>
              <button
                onClick={() => {
                  setMobileView("character");
                  setShowQuickActions(false);
                }}
                className="w-full bg-purple-600 hover:bg-purple-700 rounded-lg p-3 text-left"
              >
                👤 Character Sheet
              </button>
              <button
                onClick={() => setShowQuickActions(false)}
                className="w-full bg-gray-600 hover:bg-gray-700 rounded-lg p-3 text-left"
              >
                ❌ Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
