"use client";

import { useState, useEffect } from "react";

export default function DiceAnimation({ isRolling, result, onComplete }) {
  const [currentFace, setCurrentFace] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isRolling) {
      setIsAnimating(true);

      // Animate dice faces for 1.5 seconds
      const interval = setInterval(() => {
        setCurrentFace(Math.floor(Math.random() * 20) + 1);
      }, 100);

      const timeout = setTimeout(() => {
        clearInterval(interval);
        setCurrentFace(result || Math.floor(Math.random() * 20) + 1);
        setIsAnimating(false);
        onComplete?.();
      }, 1500);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [isRolling, result, onComplete]);

  const getDiceEmoji = (face) => {
    // Use different dice faces or numbers
    const faces = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
    if (face <= 6) return faces[face - 1];
    return face.toString();
  };

  return (
    <div className="inline-flex items-center justify-center">
      {isAnimating ? (
        <div className="relative">
          {/* Spinning dice container */}
          <div
            className={`
            transform transition-all duration-100 
            ${isAnimating ? "animate-spin scale-110" : "scale-100"}
          `}
          >
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg shadow-lg flex items-center justify-center border-2 border-yellow-300">
              <span className="text-xl font-bold text-yellow-900">
                {getDiceEmoji(currentFace)}
              </span>
            </div>
          </div>

          {/* Sparkle effects */}
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`absolute w-1 h-1 bg-yellow-300 rounded-full animate-ping`}
                style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: "1s",
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="transform transition-all duration-300 hover:scale-105">
          <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg shadow-md flex items-center justify-center border border-yellow-300">
            <span className="text-lg font-bold text-yellow-900">
              {getDiceEmoji(currentFace)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function MultiDiceAnimation({
  diceCount = 1,
  isRolling,
  results = [],
  onComplete,
}) {
  const [animatingDice, setAnimatingDice] = useState([]);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    if (isRolling) {
      setAnimatingDice(Array(diceCount).fill(true));
      setCompletedCount(0);
    }
  }, [isRolling, diceCount]);

  const handleDiceComplete = (index) => {
    setAnimatingDice((prev) => {
      const newState = [...prev];
      newState[index] = false;
      return newState;
    });

    setCompletedCount((prev) => {
      const newCount = prev + 1;
      if (newCount === diceCount) {
        onComplete?.();
      }
      return newCount;
    });
  };

  return (
    <div className="flex gap-2 flex-wrap justify-center">
      {Array(diceCount)
        .fill(0)
        .map((_, index) => (
          <DiceAnimation
            key={index}
            isRolling={animatingDice[index]}
            result={results[index]}
            onComplete={() => handleDiceComplete(index)}
          />
        ))}
    </div>
  );
}
