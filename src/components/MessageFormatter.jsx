"use client";

import { useState } from "react";

export default function MessageFormatter({ content, type }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Parse markdown-style formatting
  const formatText = (text) => {
    if (!text) return text;

    // Split text into parts, handling multiple formatting types
    const parts = [];
    let current = text;
    let index = 0;

    // Regular expressions for different formatting
    const patterns = [
      {
        regex: /\*\*(.*?)\*\*/g,
        component: "bold",
        className: "font-bold text-yellow-300",
      },
      {
        regex: /\*(.*?)\*/g,
        component: "italic",
        className: "italic text-purple-200",
      },
      {
        regex: /`(.*?)`/g,
        component: "code",
        className:
          "bg-purple-900 bg-opacity-50 px-1 rounded font-mono text-green-300",
      },
      {
        regex: /~~(.*?)~~/g,
        component: "strikethrough",
        className: "line-through text-gray-400",
      },
      {
        regex: /__(.*?)__/g,
        component: "underline",
        className: "underline text-blue-300",
      },
    ];

    // Convert text to JSX with formatting
    const processText = (str) => {
      let result = str;

      patterns.forEach(({ regex, className }) => {
        result = result.replace(regex, (match, content) => {
          return `<span class="${className}">${content}</span>`;
        });
      });

      return result;
    };

    const processedText = processText(text);

    // Parse the HTML-like structure into React components
    return (
      <div
        dangerouslySetInnerHTML={{ __html: processedText }}
        className="leading-relaxed"
      />
    );
  };

  // Special formatting for different message types
  const getMessageIcon = () => {
    switch (type) {
      case "dm":
        return <span className="text-xl animate-pulse">🧙‍♂️</span>;
      case "player":
        return <span className="text-xl">⚔️</span>;
      case "system":
        return <span className="text-xl animate-spin-slow">⚙️</span>;
      default:
        return <span className="text-xl">💬</span>;
    }
  };

  // Check if message is a dice roll result
  const isDiceRoll =
    content.includes("🎲") ||
    content.includes("Total:") ||
    content.includes("rolled");

  // Check if message is long and should be collapsible
  const isLongMessage = content.length > 300;

  return (
    <div className="relative group">
      {/* Message Icon */}
      <div className="absolute -left-10 top-0 opacity-70 group-hover:opacity-100 transition-opacity">
        {getMessageIcon()}
      </div>

      {/* Dice Roll Enhancement */}
      {isDiceRoll && (
        <div className="absolute -top-2 -right-2 z-10">
          <div className="animate-bounce">
            <span className="text-2xl">🎲</span>
          </div>
        </div>
      )}

      {/* Message Content */}
      <div className="relative">
        {formatText(
          isLongMessage && !isExpanded
            ? content.substring(0, 300) + "..."
            : content
        )}

        {/* Expand/Collapse for long messages */}
        {isLongMessage && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors"
          >
            {isExpanded ? "🔼 Show Less" : "🔽 Show More"}
          </button>
        )}
      </div>

      {/* Message Enhancement Effects */}
      {type === "dm" && (
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-transparent rounded-lg pointer-events-none" />
      )}

      {isDiceRoll && (
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-600/20 to-transparent rounded-lg pointer-events-none animate-pulse-slow" />
      )}
    </div>
  );
}
