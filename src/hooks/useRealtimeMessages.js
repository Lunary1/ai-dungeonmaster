import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Custom hook for realtime campaign messages using Supabase Realtime
 * @param {string} campaignId - The campaign ID to subscribe to
 * @returns {object} { messages, sendMessage, loading, error, isConnected }
 */
export function useRealtimeMessages(campaignId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef(null);
  const messagesRef = useRef(messages);

  // Keep ref in sync with state for subscription callbacks
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Load initial message history
  const loadInitialMessages = useCallback(async () => {
    if (!campaignId) return;

    try {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Authentication required");
        return;
      }

      const response = await fetch(`/api/session/${campaignId}?limit=50`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load message history");
      }

      const data = await response.json();
      setMessages(data.logs || []);
    } catch (err) {
      console.error("Error loading initial messages:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  // Set up realtime subscription
  useEffect(() => {
    if (!campaignId) return;

    const setupRealtimeSubscription = async () => {
      try {
        // Clean up existing subscription
        if (channelRef.current) {
          await supabase.removeChannel(channelRef.current);
        }

        // Create new channel for this campaign
        const channel = supabase
          .channel(`campaign:${campaignId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "campaign_logs",
              filter: `campaign_id=eq.${campaignId}`,
            },
            (payload) => {
              console.log("Realtime message received:", payload);
              const newMessage = payload.new;

              // Add new message to list, avoiding duplicates
              setMessages((prevMessages) => {
                const messageExists = prevMessages.some(
                  (msg) => msg.id === newMessage.id
                );
                if (messageExists) return prevMessages;

                return [...prevMessages, newMessage];
              });
            }
          )
          .on("subscribe", (status, err) => {
            if (status === "SUBSCRIBED") {
              console.log(
                `Subscribed to campaign:${campaignId} realtime updates`
              );
              setIsConnected(true);
            } else if (err) {
              console.error("Subscription error:", err);
              setError("Failed to connect to realtime updates");
              setIsConnected(false);
            }
          })
          .on("error", (err) => {
            console.error("Realtime channel error:", err);
            setError("Realtime connection error");
            setIsConnected(false);
          });

        channelRef.current = channel;
        channel.subscribe();
      } catch (err) {
        console.error("Error setting up realtime subscription:", err);
        setError("Failed to setup realtime connection");
      }
    };

    // Load initial messages first, then setup realtime
    loadInitialMessages().then(() => {
      setupRealtimeSubscription();
    });

    // Cleanup on unmount or campaignId change
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [campaignId, loadInitialMessages]);

  // Send message function (optimistic updates)
  const sendMessage = useCallback(
    async (messageData) => {
      if (!campaignId) {
        throw new Error("Campaign ID is required");
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("Authentication required");
        }

        // Optimistic update - add message immediately
        const optimisticMessage = {
          id: `temp-${Date.now()}`,
          ...messageData,
          campaign_id: campaignId,
          timestamp: new Date().toISOString(),
          created_at: new Date().toISOString(),
          metadata: { ...messageData.metadata, optimistic: true },
        };

        setMessages((prev) => [...prev, optimisticMessage]);

        // Send to server
        const response = await fetch(`/api/session/${campaignId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(messageData),
        });

        if (!response.ok) {
          // Remove optimistic message on failure
          setMessages((prev) =>
            prev.filter((msg) => msg.id !== optimisticMessage.id)
          );
          throw new Error("Failed to send message");
        }

        const result = await response.json();

        // Replace optimistic message with real one from server response
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === optimisticMessage.id
              ? {
                  ...optimisticMessage,
                  id: result.log_id,
                  metadata: { ...messageData.metadata },
                }
              : msg
          )
        );

        return result;
      } catch (err) {
        console.error("Error sending message:", err);
        throw err;
      }
    },
    [campaignId]
  );

  return {
    messages,
    sendMessage,
    loading,
    error,
    isConnected,
    refresh: loadInitialMessages,
  };
}
