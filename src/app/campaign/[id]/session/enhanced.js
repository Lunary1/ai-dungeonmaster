// Enhanced session page with Phase 4 real-time collaboration components
"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "../../../../components/Header";
import CharacterDisplay from "../../../../components/CharacterDisplay";
import AdvancedSessionControlPanel from "../../../../components/AdvancedSessionControlPanel";
import LiveEncounterManager from "../../../../components/LiveEncounterManager";
import PlayerStatusMonitor from "../../../../components/PlayerStatusMonitor";
import SessionAnalyticsDashboard from "../../../../components/SessionAnalyticsDashboard";
import MobileSessionInterface from "../../../../components/MobileSessionInterface";
import { supabase } from "../../../../lib/supabase";
import { useRealtimeChat } from "../../../../hooks/useRealtimeChat";
import {
  calculateProgress,
  formatRoundDisplay,
  getNextChapterBoundary,
} from "../../../../lib/hybridLinearTypes";

export default function EnhancedCampaignSessionPage() {
  const params = useParams();
  const router = useRouter();
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [isDM, setIsDM] = useState(false);

  // Phase 4 state management
  const [sessionState, setSessionState] = useState(null);
  const [analyticsVisible, setAnalyticsVisible] = useState(false);
  const [encounterActive, setEncounterActive] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Legacy session state
  const [playerMessage, setPlayerMessage] = useState("");
  const [dmMessage, setDmMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingDirective, setPendingDirective] = useState(null);

  // Character state management
  const [character, setCharacter] = useState(null);
  const [characterState, setCharacterState] = useState(null);
  const [characterLoading, setCharacterLoading] = useState(true);

  // Ref for chat container auto-scroll
  const chatContainerRef = useRef(null);

  // Hybrid Linear Campaign state
  const [advancingRound, setAdvancingRound] = useState(false);
  const [activeNpcSessions, setActiveNpcSessions] = useState([]);
  const [npcMessage, setNpcMessage] = useState("");
  const [npcMessages, setNpcMessages] = useState([]);
  const [sendingNpcMessage, setSendingNpcMessage] = useState(false);
  const [showNpcSelector, setShowNpcSelector] = useState(false);
  const [showPlayerNpcChat, setShowPlayerNpcChat] = useState(true);

  // Use realtime chat hook
  const {
    messages: realtimeMessages,
    sendMessage: sendRealtimeMessage,
    loading: messagesLoading,
    error: messagesError,
    isConnected,
    refetch: refetchMessages,
  } = useRealtimeChat(params.id);

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const loadSessionData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }

        setCurrentUser(session.user);

        // Load campaign details
        const { data: campaignData, error: campaignError } = await supabase
          .from("campaigns")
          .select("*")
          .eq("id", params.id)
          .single();

        if (campaignError) {
          throw new Error(campaignError.message || "Failed to load campaign");
        }

        setCampaign(campaignData);

        // Check if user is DM
        const userIsDM =
          session.user.id === campaignData.dm_id ||
          session.user.id === campaignData.owner_id ||
          session.user.id === campaignData.created_by;
        setIsDM(userIsDM);

        // Load session state
        await loadSessionState(params.id, session.access_token);

        // Load character data if player
        if (!userIsDM) {
          await loadCharacterData(params.id, session.user.id);
        }

        setLoading(false);
      } catch (err) {
        console.error("Error loading session data:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    loadSessionData();
  }, [params.id, router]);

  const loadSessionState = async (campaignId, token) => {
    try {
      const response = await fetch(
        `/api/campaigns/${campaignId}/session-control`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSessionState(data.sessionState);
        setEncounterActive(data.sessionState?.current_encounter_id !== null);
      }
    } catch (err) {
      console.error("Error loading session state:", err);
    }
  };

  const loadCharacterData = async (campaignId, userId) => {
    try {
      setCharacterLoading(true);

      // Get user's character for this campaign
      const { data: characterData, error: characterError } = await supabase
        .from("characters")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .single();

      if (characterError && characterError.code !== "PGRST116") {
        // Not found error
        throw new Error(characterError.message);
      }

      setCharacter(characterData || null);

      // Load character state if character exists
      if (characterData) {
        const { data: stateData } = await supabase
          .from("character_state")
          .select("*")
          .eq("character_id", characterData.id)
          .single();

        setCharacterState(stateData || null);
      }
    } catch (err) {
      console.error("Error loading character data:", err);
    } finally {
      setCharacterLoading(false);
    }
  };

  const handleSessionControl = async (action, data = {}) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `/api/campaigns/${params.id}/session-control`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action, ...data }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        setSessionState(result.sessionState);
        return result;
      }
    } catch (err) {
      console.error("Session control error:", err);
    }
  };

  const handleEncounterUpdate = (encounterData) => {
    setEncounterActive(encounterData.active);
    if (sessionState) {
      setSessionState({
        ...sessionState,
        current_encounter_id: encounterData.active ? encounterData.id : null,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <Header />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-white">Loading session...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <Header />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-red-400">Error: {error}</div>
        </div>
      </div>
    );
  }

  // Mobile interface
  if (isMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <MobileSessionInterface
          campaignId={params.id}
          isDM={isDM}
          sessionState={sessionState}
          character={character}
          onSessionControl={handleSessionControl}
          onEncounterUpdate={handleEncounterUpdate}
        />
      </div>
    );
  }

  // Desktop interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <Header />

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left Sidebar - Phase 4 Controls */}
        <div
          className={`transition-all duration-300 ${
            sidebarCollapsed ? "w-16" : "w-80"
          } bg-slate-800/50 backdrop-blur-sm border-r border-slate-700 flex flex-col`}
        >
          {/* Sidebar Toggle */}
          <div className="p-4 border-b border-slate-700">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center gap-2 text-white hover:text-purple-400 transition-colors"
            >
              <span className="text-lg">{sidebarCollapsed ? "➡️" : "⬅️"}</span>
              {!sidebarCollapsed && <span>Collapse Panel</span>}
            </button>
          </div>

          {!sidebarCollapsed && (
            <>
              {/* DM Session Controls */}
              {isDM && (
                <div className="p-4 border-b border-slate-700">
                  <AdvancedSessionControlPanel
                    campaignId={params.id}
                    sessionState={sessionState}
                    onSessionControl={handleSessionControl}
                    compact={false}
                  />
                </div>
              )}

              {/* Player Status Monitor */}
              <div className="p-4 border-b border-slate-700 flex-1 overflow-y-auto">
                <PlayerStatusMonitor
                  campaignId={params.id}
                  isDM={isDM}
                  currentUserId={currentUser?.id}
                />
              </div>

              {/* Analytics Toggle */}
              <div className="p-4 border-t border-slate-700">
                <button
                  onClick={() => setAnalyticsVisible(!analyticsVisible)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  {analyticsVisible ? "Hide Analytics" : "Show Analytics"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Session Analytics Dashboard */}
          {analyticsVisible && (
            <div className="h-80 border-b border-slate-700 bg-slate-800/30">
              <SessionAnalyticsDashboard
                campaignId={params.id}
                isDM={isDM}
                isExpanded={true}
              />
            </div>
          )}

          {/* Active Encounter Manager */}
          {encounterActive && isDM && (
            <div className="h-60 border-b border-slate-700 bg-slate-800/30">
              <LiveEncounterManager
                campaignId={params.id}
                encounterId={sessionState?.current_encounter_id}
                onEncounterUpdate={handleEncounterUpdate}
              />
            </div>
          )}

          {/* Chat Interface */}
          <div className="flex-1 flex">
            {/* Chat Messages */}
            <div className="flex-1 flex flex-col">
              {/* Connection Status */}
              <div className="p-2 bg-slate-800/50 border-b border-slate-700">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        isConnected ? "bg-green-500" : "bg-red-500"
                      }`}
                    ></div>
                    <span className="text-sm text-gray-300">
                      {isConnected ? "Connected" : "Disconnected"}
                    </span>
                  </div>

                  {campaign && (
                    <div className="text-sm text-gray-300">
                      <span className="font-semibold">{campaign.name}</span>
                      {sessionState?.session_status && (
                        <span
                          className={`ml-2 px-2 py-1 rounded text-xs ${
                            sessionState.session_status === "active"
                              ? "bg-green-600"
                              : sessionState.session_status === "paused"
                              ? "bg-yellow-600"
                              : sessionState.session_status === "break"
                              ? "bg-blue-600"
                              : "bg-gray-600"
                          }`}
                        >
                          {sessionState.session_status.toUpperCase()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Messages Container */}
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4"
              >
                {messagesLoading ? (
                  <div className="text-center text-gray-400">
                    Loading messages...
                  </div>
                ) : messagesError ? (
                  <div className="text-center text-red-400">
                    Error loading messages
                  </div>
                ) : realtimeMessages && realtimeMessages.length > 0 ? (
                  realtimeMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-4 rounded-lg ${
                        message.input_type === "ai_narration"
                          ? "bg-purple-900/30 border border-purple-700"
                          : message.input_type === "dice_roll"
                          ? "bg-green-900/30 border border-green-700"
                          : "bg-slate-800/50 border border-slate-600"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-sm text-gray-400">
                          {message.input_type === "ai_narration"
                            ? "🎭 AI Narrator"
                            : message.input_type === "dice_roll"
                            ? "🎲 Dice Roll"
                            : message.metadata?.user_name || "Unknown User"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </div>
                      </div>

                      {message.user_input && (
                        <div className="text-white mb-2">
                          <strong>Input:</strong> {message.user_input}
                        </div>
                      )}

                      {message.ai_output && (
                        <div className="text-gray-200 whitespace-pre-wrap">
                          {message.ai_output}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-400 py-8">
                    <div className="text-lg mb-2">
                      🎲 Ready to begin your adventure!
                    </div>
                    <div className="text-sm">
                      {isDM
                        ? "Start the session and begin narrating your story."
                        : "Wait for your DM to begin the session."}
                    </div>
                  </div>
                )}
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-slate-700 bg-slate-800/50">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={isDM ? dmMessage : playerMessage}
                    onChange={(e) =>
                      isDM
                        ? setDmMessage(e.target.value)
                        : setPlayerMessage(e.target.value)
                    }
                    placeholder={
                      isDM ? "Narrate your story..." : "What do you want to do?"
                    }
                    className="flex-1 bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={
                      sending || (!dmMessage.trim() && !playerMessage.trim())
                    }
                    className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    {sending ? "⏳" : "📤"}
                  </button>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleQuickAction("dice_roll")}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
                  >
                    🎲 Roll Dice
                  </button>
                  {isDM && (
                    <>
                      <button
                        onClick={() => handleQuickAction("encounter")}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
                      >
                        ⚔️ Encounter
                      </button>
                      <button
                        onClick={() => handleQuickAction("npc")}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                      >
                        👤 NPC
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right Sidebar - Character Sheet */}
            {!isDM && character && (
              <div className="w-80 border-l border-slate-700 bg-slate-800/30">
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-white mb-4">
                    Your Character
                  </h3>
                  <CharacterDisplay
                    character={character}
                    characterState={characterState}
                    compact={true}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  async function handleSendMessage() {
    const message = isDM ? dmMessage.trim() : playerMessage.trim();
    if (!message || sending) return;

    setSending(true);
    try {
      await sendRealtimeMessage(message, isDM ? "dm_action" : "player_action");

      if (isDM) {
        setDmMessage("");
      } else {
        setPlayerMessage("");
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setSending(false);
    }
  }

  async function handleQuickAction(action) {
    let message = "";

    switch (action) {
      case "dice_roll":
        message = "/roll 1d20";
        break;
      case "encounter":
        if (isDM) {
          message = "/encounter random";
        }
        break;
      case "npc":
        if (isDM) {
          message = "/npc generate";
        }
        break;
    }

    if (message) {
      if (isDM) {
        setDmMessage(message);
      } else {
        setPlayerMessage(message);
      }
    }
  }
}
