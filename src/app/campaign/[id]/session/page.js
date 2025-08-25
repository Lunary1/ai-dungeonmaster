"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "../../../../components/Header";
import CharacterDisplay from "../../../../components/CharacterDisplay";
import { supabase } from "../../../../lib/supabase";
import { useRealtimeChat } from "../../../../hooks/useRealtimeChat";
import {
  calculateProgress,
  formatRoundDisplay,
  getNextChapterBoundary,
} from "../../../../lib/hybridLinearTypes";

export default function CampaignSessionPage() {
  const params = useParams();
  const router = useRouter();
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playerMessage, setPlayerMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingDirective, setPendingDirective] = useState(null);

  // Character state management
  const [character, setCharacter] = useState(null);
  const [characterState, setCharacterState] = useState(null);
  const [characterLoading, setCharacterLoading] = useState(true);

  // Ref for chat container auto-scroll
  const chatContainerRef = useRef(null);

  // Use realtime chat hook
  const {
    messages: realtimeMessages,
    sendMessage: sendRealtimeMessage,
    loading: messagesLoading,
    error: messagesError,
    isConnected,
    refetch: refetchMessages,
    reconnect: reconnectChat,
  } = useRealtimeChat(params.id);

  const loadSessionData = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const response = await fetch(`/api/campaigns/${params.id}/session`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load session");
      }

      setSessionData(data);

      console.log("Session data loaded:", data);

      // If session hasn't started and user is not DM, show waiting message
      if (!data.sessionStarted && !data.isDM) {
        // Show waiting for DM screen
      }

      setLoading(false);
    } catch (err) {
      console.error("Error loading session:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  const loadCharacterData = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        return;
      }

      const response = await fetch(
        `/api/character-state?campaignId=${params.id}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        setCharacter(data.character);
        setCharacterState(data.characterState);
      } else {
        console.error("Error loading character:", data.error);
      }
    } catch (err) {
      console.error("Error loading character data:", err);
    } finally {
      setCharacterLoading(false);
    }
  };

  const updateCharacterState = async (updates) => {
    try {
      if (!character) return;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        return;
      }

      const response = await fetch("/api/character-state", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          campaignId: params.id,
          characterId: character.id,
          updates,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setCharacterState(data.characterState);
      } else {
        console.error("Error updating character state:", data.error);
      }
    } catch (err) {
      console.error("Error updating character state:", err);
    }
  };

  useEffect(() => {
    if (params.id) {
      loadSessionData();
      loadCharacterData();
      // Note: No more polling needed - realtime messages hook handles message updates
    }
  }, [params.id, router]);

  const [showScrollButton, setShowScrollButton] = useState(false);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const scrollToBottom = () => {
      if (chatContainerRef.current) {
        const container = chatContainerRef.current;
        const isNearBottom =
          container.scrollHeight -
            container.scrollTop -
            container.clientHeight <
          100;

        // Only auto-scroll if user is near the bottom (not manually scrolled up)
        if (isNearBottom) {
          container.scrollTop = container.scrollHeight;
        }
      }
    };

    // Scroll to bottom when messages change
    scrollToBottom();

    // Also scroll to bottom with a slight delay to ensure DOM is updated
    const timeoutId = setTimeout(scrollToBottom, 100);

    return () => clearTimeout(timeoutId);
  }, [realtimeMessages]);

  // Handle scroll events to show/hide scroll-to-bottom button
  useEffect(() => {
    const handleScroll = () => {
      if (chatContainerRef.current) {
        const container = chatContainerRef.current;
        const isNearBottom =
          container.scrollHeight -
            container.scrollTop -
            container.clientHeight <
          100;
        setShowScrollButton(!isNearBottom);
      }
    };

    const container = chatContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, []);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
      setShowScrollButton(false);
    }
  };

  // Merge realtime messages with session data
  const combinedSessionData = sessionData
    ? {
        ...sessionData,
        sessionLogs: realtimeMessages || sessionData.sessionLogs || [],
      }
    : null;

  const sendAiNarrationRequest = async (message) => {
    setSending(true);
    try {
      // Use our realtime message function to ensure broadcasting
      const result = await sendRealtimeMessage({
        user_input: message,
        input_type: "ai_narration",
      });

      console.log("AI narration response:", result);

      // Set pending directive if AI suggests a roll
      if (result.directive?.requiresRoll) {
        setPendingDirective(result.directive);
      }

      // No need to refetch - the AI response will be broadcast automatically
    } catch (err) {
      console.error("Error getting AI narration:", err);
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleRollDirective = async (directive) => {
    try {
      // Construct dice notation based on directive
      let diceNotation = "1d20";

      if (directive.ability) {
        // For now, just add a basic modifier - could be enhanced with character stats
        diceNotation += "+0"; // Would normally get ability modifier from character
      }

      // Use our realtime message function to ensure broadcasting
      await sendRealtimeMessage({
        user_input: `/roll ${diceNotation}`,
        input_type: "dice_roll",
      });

      setPendingDirective(null);
      // No need to refetch - the dice result will be broadcast automatically
    } catch (err) {
      console.error("Error rolling dice:", err);
    }
  };

  const sendPlayerRequest = async (e) => {
    e.preventDefault();
    if (!playerMessage.trim() || sending) return;

    setSending(true);
    try {
      await sendRealtimeMessage({
        user_input: playerMessage,
        input_type: "player_request",
        metadata: { source: "player_interface" },
      });

      setPlayerMessage("");
    } catch (err) {
      console.error("Error sending player request:", err);
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const sendDMMessage = async (e) => {
    e.preventDefault();
    if (!dmMessage.trim() || sending) return;

    setSending(true);
    try {
      await sendRealtimeMessage({
        user_input: dmMessage,
        input_type: "message",
        metadata: { source: "dm_interface" },
      });

      setDmMessage("");
    } catch (err) {
      console.error("Error sending DM message:", err);
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  // Hybrid Linear Campaign functions
  const advanceRound = async () => {
    if (advancingRound) return;

    setAdvancingRound(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(
        `/api/campaigns/${params.id}/advance-round`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to advance round");
      }

      const result = await response.json();

      // Trigger a refetch to update the session data with new round info
      await loadSessionData();

      // Show success message or summary if available
      if (result.autosummary) {
        console.log("Round advanced with summary:", result.autosummary);
      }
      if (result.chapterSummary) {
        console.log("Chapter completed with summary:", result.chapterSummary);
      }
    } catch (err) {
      console.error("Error advancing round:", err);
      setError(err.message);
    } finally {
      setAdvancingRound(false);
    }
  };

  const openNpcTalk = async (npcId, npcName) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(`/api/campaigns/${params.id}/npc-talk`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "open",
          npcId,
          npcName,
        }),
      });

      if (response.ok) {
        // Add to local state
        setActiveNpcSessions((prev) => [
          ...prev,
          { npcId, npcName, openedAt: new Date() },
        ]);
        console.log(`NPC talk session opened for ${npcName}`);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to open NPC session");
      }
    } catch (err) {
      console.error("Error opening NPC talk:", err);
      setError(err.message);
    }
  };

  const closeNpcTalk = async (npcId) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(`/api/campaigns/${params.id}/npc-talk`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "close",
          npcId,
        }),
      });

      if (response.ok) {
        // Remove from local state
        setActiveNpcSessions((prev) =>
          prev.filter((session) => session.npcId !== npcId)
        );
        console.log(`NPC talk session closed for ${npcId}`);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to close NPC session");
      }
    } catch (err) {
      console.error("Error closing NPC talk:", err);
      setError(err.message);
    }
  };

  const sendNpcMessage = async (npcId, message) => {
    setSendingNpcMessage(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(`/api/campaigns/${params.id}/npc-talk`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          npcId,
          playerMessage: message,
        }),
      });

      if (response.ok) {
        const result = await response.json();

        // Add player message to local state
        setNpcMessages((prev) => [
          ...prev,
          { type: "player", message },
          { type: "npc", message: result.npcResponse },
        ]);

        setNpcMessage("");
      }
    } catch (err) {
      console.error("Error sending NPC message:", err);
      setError(err.message);
    } finally {
      setSendingNpcMessage(false);
    }
  };

  const loadActiveNpcSessions = async () => {
    // For now, we'll manage NPC sessions locally since they're stored in memory
    // In a production app, you'd fetch from the database
    console.log("Active NPC sessions managed locally");
  };

  // Load active NPC sessions on mount
  useEffect(() => {
    if (sessionData) {
      loadActiveNpcSessions();
    }
  }, [sessionData]);

  if (loading || messagesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <Header />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-white">Loading session...</div>
        </div>
      </div>
    );
  }

  if (error || messagesError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <Header />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-red-400">Error: {error || messagesError}</div>
        </div>
      </div>
    );
  }

  if (!combinedSessionData?.sessionStarted && !combinedSessionData?.isDM) {
    // Player waiting screen
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-8">
              <div className="text-6xl mb-4">⏳</div>
              <h1 className="text-3xl font-bold text-white mb-4">
                Waiting for Campaign to Start
              </h1>
              <p className="text-gray-300 mb-6">
                The Dungeon Master hasn't started the session yet. You'll be
                notified when the campaign begins!
              </p>
              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                <div className="text-blue-300 font-medium mb-2">
                  Campaign: {combinedSessionData?.campaign?.name}
                </div>
                <div className="text-blue-200 text-sm">
                  {combinedSessionData?.campaign?.description}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Session interface
  return (
    <div className="h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col">
      <Header />
      <div className="container mx-auto px-4 py-2 flex-1 min-h-0">
        <div className="grid grid-cols-12 gap-6 h-full">
          {/* Main Chat Area */}
          <div className="col-span-8">
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg h-full flex flex-col">
              <div className="p-4 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                      🎲 {combinedSessionData?.campaign?.name}
                      <span className="text-sm bg-green-600 px-2 py-1 rounded">
                        LIVE
                      </span>
                    </h1>

                    {/* Round/Chapter Progress */}
                    {combinedSessionData?.campaign && (
                      <div className="flex items-center gap-3">
                        <div className="text-sm text-slate-300">
                          {formatRoundDisplay(
                            combinedSessionData.campaign.current_round || 1,
                            combinedSessionData.campaign.current_chapter || 1
                          )}
                        </div>
                        <div className="w-24 bg-slate-700 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${calculateProgress(
                                combinedSessionData.campaign.current_round || 1,
                                combinedSessionData.campaign.target_rounds ||
                                  200
                              )}%`,
                            }}
                          />
                        </div>
                        <div className="text-xs text-slate-400">
                          {combinedSessionData.campaign.current_round || 1}/
                          {combinedSessionData.campaign.target_rounds || 200}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Connection Status */}
                  <div className="flex items-center gap-2">
                    {isConnected ? (
                      <span className="text-xs bg-green-600 px-2 py-1 rounded flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
                        REALTIME
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        {messagesError ? (
                          <>
                            <span className="text-xs bg-red-600 px-2 py-1 rounded flex items-center gap-1">
                              <div className="w-2 h-2 bg-red-300 rounded-full"></div>
                              CONNECTION ERROR
                            </span>
                            <button
                              onClick={reconnectChat}
                              className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded transition-colors"
                              title="Reconnect to realtime chat"
                            >
                              🔄 RECONNECT
                            </button>
                          </>
                        ) : (
                          <span className="text-xs bg-yellow-600 px-2 py-1 rounded flex items-center gap-1">
                            <div className="w-2 h-2 bg-yellow-300 rounded-full animate-pulse"></div>
                            CONNECTING...
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Error Banner */}
                {messagesError && (
                  <div className="mt-2 p-2 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm flex items-center justify-between">
                    <span>⚠️ {messagesError}</span>
                    <button
                      onClick={() => {
                        setError(null);
                        reconnectChat();
                      }}
                      className="text-red-300 hover:text-white ml-2"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Chat Log - Scrollable Messages Area */}
              <div
                ref={chatContainerRef}
                className="flex-1 min-h-0 max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent p-6 relative"
              >
                <div className="space-y-6">
                  {combinedSessionData?.sessionLogs?.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">🎲</div>
                      <div className="text-slate-400 text-lg font-medium mb-2">
                        No messages yet
                      </div>
                      <div className="text-slate-500 text-sm">
                        Start the adventure by sending your first message!
                      </div>
                    </div>
                  ) : (
                    combinedSessionData.sessionLogs.map((log, index) => {
                      // Determine message type and alignment
                      const isDMMessage =
                        log.input_type === "message" &&
                        log.metadata?.source === "dm_interface";
                      const isAIResponse =
                        log.metadata?.source === "ai_dm" ||
                        log.metadata?.is_ai_response ||
                        log.input_type === "ai_narration";
                      const isPlayerRequest =
                        log.input_type === "player_request";

                      if (isDMMessage) {
                        // DM messages on the right side
                        return (
                          <div
                            key={index}
                            className="flex justify-end chat-bubble-right"
                          >
                            <div className="max-w-[70%] bg-gradient-to-br from-purple-600 to-purple-700 rounded-l-2xl rounded-tr-2xl p-4 ml-4 shadow-lg border border-purple-500/20">
                              <div className="text-purple-100 text-xs font-semibold mb-2 flex items-center gap-1">
                                👑 DM
                              </div>
                              <div className="text-white leading-relaxed">
                                {log.user_input}
                              </div>
                              <div className="text-xs text-purple-200/80 mt-2 flex justify-end">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                        );
                      } else if (isAIResponse) {
                        // Check if this is a campaign introduction
                        const isCampaignIntro =
                          log.metadata?.is_campaign_start ||
                          log.metadata?.source === "auto_introduction";

                        // AI responses on the left side - consistent amber styling
                        return (
                          <div
                            key={index}
                            className="flex justify-start chat-bubble-left"
                          >
                            <div className="max-w-[85%] bg-gradient-to-br from-amber-600 to-amber-700 border border-amber-500/20 rounded-r-2xl rounded-tl-2xl p-4 mr-4 shadow-lg">
                              <div className="text-amber-100 text-xs font-semibold mb-2 flex items-center gap-1">
                                {isCampaignIntro ? (
                                  <>
                                    🌟 Campaign Introduction
                                    <span className="text-xs bg-amber-800/50 px-2 py-0.5 rounded-full border border-amber-500/30">
                                      ✨ Adventure Begins
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    🧙‍♂️ AI Dungeon Master
                                    {log.metadata?.directive?.requiresRoll && (
                                      <span className="text-xs bg-amber-800/50 px-2 py-0.5 rounded-full border border-amber-500/30">
                                        🎲 Roll Required
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                              <div className="text-white whitespace-pre-wrap leading-relaxed">
                                {log.ai_output}
                              </div>
                              {isCampaignIntro && (
                                <div className="mt-3 text-sm text-amber-100 bg-amber-800/30 rounded-lg p-3 border border-amber-500/20">
                                  <div className="flex items-center gap-1 font-medium mb-1">
                                    🎭 Welcome to the Adventure!
                                  </div>
                                  <div className="text-amber-200 text-xs">
                                    This introduction was automatically
                                    generated based on your campaign details.
                                    The adventure awaits!
                                  </div>
                                </div>
                              )}
                              {log.metadata?.directive?.requiresRoll && (
                                <div className="mt-3 text-sm text-amber-100 bg-amber-800/30 rounded-lg p-3 border border-amber-500/20">
                                  <div className="flex items-center gap-1 font-medium mb-1">
                                    💡 Roll Suggestion
                                  </div>
                                  <div className="text-amber-200">
                                    {log.metadata.directive.reason ||
                                      "A roll may be needed"}
                                    {log.metadata.directive.dc &&
                                      ` (DC ${log.metadata.directive.dc})`}
                                  </div>
                                </div>
                              )}
                              <div
                                className={`text-xs ${
                                  isCampaignIntro
                                    ? "text-emerald-200/80"
                                    : "text-amber-200/80"
                                } mt-2 flex justify-start`}
                              >
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                        );
                      } else if (isPlayerRequest) {
                        // Player requests on the right (but styled differently from DM)
                        return (
                          <div
                            key={index}
                            className="flex justify-end chat-bubble-right"
                          >
                            <div className="max-w-[70%] bg-gradient-to-br from-blue-600 to-blue-700 rounded-l-2xl rounded-tr-2xl p-4 ml-4 shadow-lg border border-blue-500/20">
                              <div className="text-blue-100 text-xs font-semibold mb-2 flex items-center gap-1">
                                ⚔️ Player
                              </div>
                              <div className="text-white leading-relaxed">
                                {log.user_input}
                              </div>
                              <div className="text-xs text-blue-200/80 mt-2 flex justify-end">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                        );
                      } else {
                        // Legacy/other message types - fallback to old display
                        return (
                          <div
                            key={index}
                            className="bg-slate-700/50 rounded-lg p-4"
                          >
                            {log.user_input !== "DM_CAMPAIGN_START" && (
                              <div className="border-l-4 border-gray-500 pl-4 mb-3">
                                <div className="text-gray-300 text-sm font-medium mb-1">
                                  {combinedSessionData.isDM ? "DM" : "Input"}
                                </div>
                                <div className="text-gray-200">
                                  {log.user_input}
                                </div>
                              </div>
                            )}
                            <div className="border-l-4 border-green-500 pl-4">
                              <div className="text-green-300 text-sm font-medium mb-1">
                                AI Response
                              </div>
                              <div className="text-gray-200 whitespace-pre-wrap">
                                {log.ai_output}
                              </div>
                            </div>
                            <div className="text-xs text-gray-400 mt-2">
                              {new Date(log.created_at).toLocaleTimeString()}
                            </div>
                          </div>
                        );
                      }
                    })
                  )}
                </div>

                {/* Floating Scroll to Bottom Button */}
                {showScrollButton && (
                  <button
                    onClick={scrollToBottom}
                    className="fixed bottom-32 right-8 bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg z-10 transition-all hover:scale-110"
                    title="Scroll to bottom"
                  >
                    ⬇️
                  </button>
                )}
              </div>
              {/* Input Area */}
              <div className="flex-shrink-0 p-4 border-t border-slate-700 bg-slate-800/30">
                {/* All players use the same interface in AI-only system */}
                <div className="space-y-3">
                  {/* Player Message Input */}
                  <form onSubmit={sendPlayerRequest} className="flex gap-2">
                    <input
                      type="text"
                      value={playerMessage}
                      onChange={(e) => setPlayerMessage(e.target.value)}
                      placeholder="Describe your action or ask a question..."
                      className="flex-1 bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={sending}
                    />
                    <button
                      type="submit"
                      disabled={sending || !playerMessage.trim()}
                      className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg transition-colors"
                    >
                      {sending ? "Sending..." : "Ask the DM"}
                    </button>
                  </form>

                  {/* Roll Directive Panel */}
                  {pendingDirective && (
                    <div className="bg-amber-900/20 border border-amber-600 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-amber-300 font-medium text-sm">
                          🎲 Roll Required
                        </h4>
                        <button
                          onClick={() => setPendingDirective(null)}
                          className="text-amber-400 hover:text-amber-300 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-amber-200 text-sm mb-3">
                        {pendingDirective.reason ||
                          "A roll may be needed for this action"}
                      </p>
                      <div className="flex gap-2 text-xs text-amber-300 mb-3">
                        {pendingDirective.ability && (
                          <span>Ability: {pendingDirective.ability}</span>
                        )}
                        {pendingDirective.dc && (
                          <span>DC: {pendingDirective.dc}</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRollDirective(pendingDirective)}
                          className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                        >
                          Roll Now ({pendingDirective.rollType})
                        </button>
                        <button
                          onClick={() => setPendingDirective(null)}
                          className="px-3 py-2 border border-amber-600 text-amber-300 rounded text-sm font-medium hover:bg-amber-900/20 transition-colors"
                        >
                          Skip Roll
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Player Guidance */}
                  <div className="bg-purple-900/20 border border-purple-600 rounded-lg p-3">
                    <p className="text-purple-200 text-sm">
                      <strong>🎭 Player Guide:</strong> Describe what you want
                      to do, and the AI DM will determine consequences, suggest
                      rolls, and narrate the story!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="col-span-4">
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg h-full flex flex-col">
              <div className="p-4 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
                {/* Player Sidebar - Same for All Users */}
                <div>
                  <h2 className="text-lg font-bold text-white mb-4">
                    ⚔️ Player Info
                  </h2>
                  <div className="space-y-4">
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <h3 className="text-purple-300 font-medium mb-2">
                        Your Character
                      </h3>
                      <div className="text-sm text-gray-300">
                        {characterLoading ? (
                          <div>Loading character...</div>
                        ) : (
                          <CharacterDisplay
                            character={character}
                            characterState={characterState}
                            onUpdate={updateCharacterState}
                          />
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <h3 className="text-purple-300 font-medium mb-2">
                        Quick Actions
                      </h3>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <button className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded">
                          🎲 Roll Dice
                        </button>
                        <button className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded">
                          📋 Character Sheet
                        </button>
                        <button className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded">
                          🎒 Inventory
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
