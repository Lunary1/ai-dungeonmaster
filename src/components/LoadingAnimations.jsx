"use client";

export function TypingIndicator({ isVisible }) {
  if (!isVisible) return null;

  return (
    <div className="flex items-center space-x-2 p-3 bg-purple-800 bg-opacity-30 rounded-lg border border-purple-600 max-w-xs">
      <span className="text-purple-200 text-sm">🧙‍♂️ DM is thinking</span>
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
        <div
          className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
          style={{ animationDelay: "0.1s" }}
        ></div>
        <div
          className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
          style={{ animationDelay: "0.2s" }}
        ></div>
      </div>
    </div>
  );
}

export function SpellCastingLoader({ spellName = "Thinking", isVisible }) {
  if (!isVisible) return null;

  return (
    <div className="flex flex-col items-center p-6 bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-lg border border-purple-500 max-w-sm mx-auto">
      {/* Magic circle animation */}
      <div className="relative mb-4">
        <div className="w-16 h-16 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
        <div className="absolute inset-2 w-12 h-12 border-2 border-blue-400 border-b-transparent rounded-full animate-spin-reverse"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl animate-pulse">✨</span>
        </div>
      </div>

      {/* Spell text */}
      <div className="text-center">
        <div className="text-purple-200 text-sm mb-1">Casting...</div>
        <div className="text-white font-medium">{spellName}</div>
      </div>

      {/* Particle effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-purple-300 rounded-full animate-float"
            style={{
              left: `${10 + i * 10}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: "3s",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function DiceRollLoader({ isVisible }) {
  if (!isVisible) return null;

  return (
    <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-yellow-900/30 to-orange-900/30 rounded-lg border border-yellow-500 max-w-sm">
      {/* Rolling dice */}
      <div className="relative">
        <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg animate-spin shadow-lg"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-yellow-900 font-bold text-sm">🎲</span>
        </div>
      </div>

      <div className="text-yellow-200">
        <div className="text-sm font-medium">Rolling dice...</div>
        <div className="text-xs opacity-75">Calculating results</div>
      </div>
    </div>
  );
}

export function CharacterLoader({ action = "Loading", isVisible }) {
  if (!isVisible) return null;

  return (
    <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-blue-900/30 to-indigo-900/30 rounded-lg border border-blue-500 max-w-sm">
      {/* Character silhouette */}
      <div className="relative">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full animate-pulse shadow-lg flex items-center justify-center">
          <span className="text-blue-900 text-lg">👤</span>
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-ping"></div>
      </div>

      <div className="text-blue-200">
        <div className="text-sm font-medium">{action}...</div>
        <div className="text-xs opacity-75">Character sheet</div>
      </div>
    </div>
  );
}
