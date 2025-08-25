// ChatLog component for displaying campaign session history
import React, { useState, useEffect, useRef } from "react";
import MessageFormatter from "./MessageFormatter";

export default function ChatLog({ campaignId, refreshTrigger }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (campaignId) {
      fetchSessionHistory();
    }
  }, [campaignId, refreshTrigger]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const fetchSessionHistory = async () => {
    try {
      setLoading(true);
      setError(null); // Clear any previous errors
      const response = await fetch(`/api/session/${campaignId}?limit=100`);

      if (response.status === 401) {
        // User not authenticated - this is normal, don't show as error
        setLogs([]);
        return;
      }

      if (!response.ok) {
        // Only show error for actual server errors, not empty data
        if (response.status >= 500) {
          throw new Error("Server error occurred");
        }
        // For other errors (404, etc.), just show empty state
        setLogs([]);
        return;
      }

      const data = await response.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error("Session history fetch error:", err);
      // Only set error for actual network/server errors
      if (err.name === "TypeError" || err.message.includes("fetch")) {
        setError("Unable to connect to server");
      } else {
        setLogs([]); // Just show empty state for other errors
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getMessageTypeIcon = (inputType) => {
    switch (inputType) {
      case "dice_roll":
        return "🎲";
      case "skill_check":
        return "⚡";
      case "action":
        return "⚔️";
      default:
        return "💬";
    }
  };

  const getMessageTypeClass = (inputType) => {
    switch (inputType) {
      case "dice_roll":
        return "border-l-blue-500 bg-blue-50 dark:bg-blue-900/20";
      case "skill_check":
        return "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/20";
      case "action":
        return "border-l-red-500 bg-red-50 dark:bg-red-900/20";
      default:
        return "border-l-purple-500 bg-white dark:bg-slate-800";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        <span className="ml-2 text-slate-400">Loading session history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-amber-900/20 border border-amber-500 rounded-lg p-4 text-center">
        <p className="text-amber-400 mb-2">⚠️ {error}</p>
        <p className="text-slate-400 text-sm mb-3">
          Check your connection and try again
        </p>
        <button
          onClick={fetchSessionHistory}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded text-white text-sm transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
        <h3 className="text-white font-medium flex items-center">
          <span className="mr-2">📜</span>
          Session Log
        </h3>
        <span className="text-slate-400 text-sm">{logs.length} messages</span>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ maxHeight: "calc(100vh - 200px)" }}
      >
        {logs.length === 0 ? (
          <div className="text-center text-slate-400 py-12">
            <div className="text-6xl mb-4">🌟</div>
            <h3 className="text-xl text-white mb-2">
              Welcome to Your Adventure!
            </h3>
            <p className="text-slate-300 mb-4">
              This is where your epic story unfolds. Start by sending a message
              or rolling some dice!
            </p>
            <div className="bg-slate-800 rounded-lg p-4 text-left max-w-md mx-auto">
              <p className="text-sm text-slate-300 mb-2">
                💡 Try these commands:
              </p>
              <div className="space-y-1 text-sm">
                <div>
                  <code className="bg-slate-700 px-2 py-1 rounded text-purple-300">
                    /roll 1d20
                  </code>{" "}
                  <span className="text-slate-400">- Roll a d20</span>
                </div>
                <div>
                  <code className="bg-slate-700 px-2 py-1 rounded text-purple-300">
                    /check perception
                  </code>{" "}
                  <span className="text-slate-400">- Skill check</span>
                </div>
                <div>
                  <code className="bg-slate-700 px-2 py-1 rounded text-purple-300">
                    I look around
                  </code>{" "}
                  <span className="text-slate-400">- Roleplay action</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="space-y-2">
              {/* User Input */}
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  👤
                </div>
                <div className="flex-1 min-w-0">
                  <div className="bg-slate-700 rounded-lg px-4 py-2 border-l-4 border-blue-500">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-blue-300 text-sm font-medium">
                        {getMessageTypeIcon(log.input_type)} Player
                      </span>
                      <span className="text-slate-400 text-xs">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    <MessageFormatter message={log.user_input} />
                  </div>
                </div>
              </div>

              {/* AI Response */}
              <div className="flex items-start space-x-3 ml-4">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  🎲
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`rounded-lg px-4 py-2 border-l-4 ${getMessageTypeClass(
                      log.input_type
                    )}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-purple-300 text-sm font-medium">
                        ⚡ Dungeon Master
                      </span>
                      {log.metadata?.validation_warnings?.length > 0 && (
                        <span
                          className="text-yellow-400 text-xs"
                          title="D&D 5e Rule Warnings"
                        >
                          ⚠️
                        </span>
                      )}
                    </div>
                    <MessageFormatter message={log.ai_output} />

                    {/* Show roll results for dice rolls */}
                    {log.input_type === "dice_roll" &&
                      log.metadata?.roll_result && (
                        <div className="mt-2 p-2 bg-slate-600 rounded border-l-2 border-blue-400">
                          <div className="text-xs text-slate-300">
                            <strong>Roll Details:</strong>{" "}
                            {log.metadata.roll_result.notation}
                          </div>
                          <div className="text-sm text-white">
                            Individual Rolls: [
                            {log.metadata.roll_result.rolls?.join(", ")}]
                          </div>
                        </div>
                      )}

                    {/* Show skill check details */}
                    {log.input_type === "skill_check" &&
                      log.metadata?.roll_result && (
                        <div className="mt-2 p-2 bg-slate-600 rounded border-l-2 border-yellow-400">
                          <div className="text-xs text-slate-300">
                            <strong>Skill Check:</strong>{" "}
                            {log.user_input.split(" ")[1] || "Unknown"}
                          </div>
                          <div className="text-sm text-white">
                            d20: {log.metadata.roll_result.rolls?.[0]} +{" "}
                            {log.metadata.roll_result.modifier || 0} ={" "}
                            {log.metadata.roll_result.total}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
