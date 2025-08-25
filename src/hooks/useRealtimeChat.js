import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";

export function useRealtimeChat(campaignId) {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const channelRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Load initial messages from API
  const loadInitialMessages = useCallback(async () => {
    console.log("🔄 Loading initial messages for campaign:", campaignId);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        console.log("❌ No session found");
        return;
      }

      console.log("📡 Fetching from API...");
      const response = await fetch(`/api/campaigns/${campaignId}/session`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log(
          "✅ Initial messages loaded:",
          data.sessionLogs?.length || 0,
          "messages"
        );
        setMessages(data.sessionLogs || []);
      } else {
        console.error(
          "❌ Failed to load initial messages:",
          response.status,
          response.statusText
        );
      }
    } catch (err) {
      console.error("❌ Error loading initial messages:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  // Reconnection function
  const reconnectChannel = useCallback(async () => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.log("❌ Max reconnection attempts reached");
      setError(
        "Connection failed after multiple attempts. Please refresh the page."
      );
      return;
    }

    reconnectAttemptsRef.current++;
    console.log(
      `🔄 Attempting to reconnect... (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
    );

    // Clear existing error
    setError(null);

    // Remove old channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Wait a bit before reconnecting (exponential backoff)
    const delay = Math.min(
      1000 * Math.pow(2, reconnectAttemptsRef.current - 1),
      10000
    );
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Create new channel
    setupRealtimeChannel();
  }, [campaignId]);

  // Setup realtime channel function
  const setupRealtimeChannel = useCallback(() => {
    if (!campaignId) return;

    const channel = supabase.channel(`campaign-${campaignId}`, {
      config: {
        broadcast: { self: true, ack: true },
      },
    });

    // Listen for broadcast messages
    channel.on("broadcast", { event: "new_message" }, (payload) => {
      console.log("📻 Received broadcast message:", payload);

      if (payload.payload && payload.payload.message) {
        console.log("➕ Adding new message to state:", payload.payload.message);
        setMessages((prev) => {
          // Check if message already exists to prevent duplicates
          const exists = prev.some(
            (msg) =>
              msg.id === payload.payload.message.id ||
              (msg.timestamp === payload.payload.message.timestamp &&
                msg.user_input === payload.payload.message.user_input)
          );

          if (exists) {
            console.log("🔄 Message already exists, skipping duplicate");
            return prev;
          }

          console.log(
            "✅ Message added to state. Total messages:",
            prev.length + 1
          );
          return [...prev, payload.payload.message];
        });
      } else {
        console.log("⚠️ Received broadcast but no message data:", payload);
      }
    });

    // Subscribe to the channel with enhanced error handling
    channel.subscribe((status) => {
      console.log(`Realtime subscription status: ${status}`);
      if (status === "SUBSCRIBED") {
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0; // Reset reconnection attempts on successful connection
        console.log(`Connected to realtime channel: campaign-${campaignId}`);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setIsConnected(false);
        console.log("❌ Channel error or timeout, attempting to reconnect...");

        // Schedule reconnection
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectChannel();
        }, 2000);
      } else if (status === "CLOSED") {
        setIsConnected(false);
        console.log("📪 Channel closed");
      }
    });

    channelRef.current = channel;
  }, [campaignId, reconnectChannel]);

  // Set up realtime subscription
  useEffect(() => {
    if (!campaignId) return;

    // Setup the initial channel
    setupRealtimeChannel();

    // Load initial messages
    loadInitialMessages();

    // Cleanup function
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
      reconnectAttemptsRef.current = 0;
    };
  }, [campaignId, setupRealtimeChannel, loadInitialMessages]);

  // Send message function
  const sendMessage = useCallback(
    async (messageData) => {
      console.log("📤 Sending message:", messageData);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("Not authenticated");
        }

        // For AI narration, send the user's message immediately via broadcast
        if (messageData.input_type === "ai_narration") {
          console.log("📡 Broadcasting user question immediately...");

          // Create a temporary message object for immediate broadcast
          const userMessage = {
            id: `temp-${Date.now()}`,
            campaign_id: campaignId,
            user_input: messageData.user_input,
            ai_output: "",
            input_type: "message",
            timestamp: new Date().toISOString(),
            metadata: {
              user_id: session.user.id,
              source: "dm_interface",
              ai_processing: true,
            },
          };

          // Broadcast the user's question immediately
          if (channelRef.current) {
            await channelRef.current.send({
              type: "broadcast",
              event: "new_message",
              payload: {
                message: userMessage,
                sender: session.user.id,
              },
            });
            console.log("📻 User question broadcast sent");
          }
        }

        // Send to API for database storage and AI processing
        console.log("💾 Saving to database via API...");
        const response = await fetch(`/api/session/${campaignId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(messageData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to send message");
        }

        const result = await response.json();
        console.log("✅ Message saved to database:", result);

        // For AI narration, broadcast the AI response when it's ready
        if (messageData.input_type === "ai_narration" && result.message) {
          console.log("📡 Broadcasting AI response...");

          const aiMessage = {
            id: `ai-${Date.now()}`,
            campaign_id: campaignId,
            user_input: "",
            ai_output: result.message,
            input_type: "message", // Use 'message' type since 'ai_response' not allowed by DB constraint
            timestamp: new Date().toISOString(),
            metadata: {
              source: "ai_dm",
              directive: result.directive,
              is_ai_response: true, // Use metadata flag to identify AI responses
            },
          };

          if (channelRef.current) {
            await channelRef.current.send({
              type: "broadcast",
              event: "new_message",
              payload: {
                message: aiMessage,
                sender: "ai",
              },
            });
            console.log("📻 AI response broadcast sent");
          }
        } else if (result.log) {
          // For regular messages, broadcast the stored log entry
          console.log("📡 Broadcasting message to realtime channel...");
          if (channelRef.current) {
            const broadcastResult = await channelRef.current.send({
              type: "broadcast",
              event: "new_message",
              payload: {
                message: result.log,
                sender: session.user.id,
              },
            });

            console.log("📻 Broadcast result:", broadcastResult);
          }
        }

        return result;
      } catch (err) {
        console.error("❌ Error sending message:", err);
        setError(err.message);
        throw err;
      }
    },
    [campaignId]
  );

  return {
    messages,
    sendMessage,
    isConnected,
    loading,
    error,
    refetch: loadInitialMessages,
    reconnect: reconnectChannel,
  };
}
