/**
 * CreditsDisplay Component
 * Shows current credit status, free rounds remaining, and progress
 */

"use client";

import { useState, useEffect } from "react";
import {
  getCampaignCreditStatus,
  formatCreditsDisplay,
  calculateFreeRoundsProgress,
  FREE_ROUNDS_LIMIT,
} from "../lib/credits";

export default function CreditsDisplay({
  campaignId,
  onPaywallNeeded,
  compact = false,
}) {
  const [creditStatus, setCreditStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCreditStatus();
  }, [campaignId]);

  const loadCreditStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const status = await getCampaignCreditStatus(campaignId);

      if (status.ok) {
        setCreditStatus(status);

        // Trigger paywall if needed
        if (!status.can_advance && onPaywallNeeded) {
          onPaywallNeeded();
        }
      } else {
        setError(status.error || "Failed to load credit status");
      }
    } catch (err) {
      console.error("Error loading credit status:", err);
      setError("Failed to load credit status");
    } finally {
      setLoading(false);
    }
  };

  // Refresh status when campaign advances
  const refreshStatus = () => {
    loadCreditStatus();
  };

  // Expose refresh function to parent components
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.refreshCreditsDisplay = refreshStatus;
    }
    return () => {
      if (typeof window !== "undefined") {
        delete window.refreshCreditsDisplay;
      }
    };
  }, []);

  if (loading) {
    return (
      <div
        className={`${
          compact ? "p-2" : "p-4"
        } bg-slate-800/50 border border-slate-600 rounded-lg`}
      >
        <div className="animate-pulse">
          <div className="h-4 bg-slate-700 rounded w-24 mb-2"></div>
          <div className="h-2 bg-slate-700 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`${
          compact ? "p-2" : "p-4"
        } bg-red-900/20 border border-red-600 rounded-lg`}
      >
        <div className="text-red-400 text-sm">⚠️ {error}</div>
      </div>
    );
  }

  if (!creditStatus) {
    return null;
  }

  const {
    free_rounds_remaining,
    credits_balance,
    can_advance,
    free_rounds_used,
    current_round,
  } = creditStatus;

  const inFreeRounds = free_rounds_remaining > 0;
  const freeRoundsProgress = calculateFreeRoundsProgress(free_rounds_used);

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        {inFreeRounds ? (
          <div className="flex items-center gap-1">
            <span className="text-green-400">🆓</span>
            <span className="text-white">{free_rounds_remaining}</span>
            <span className="text-slate-400">free left</span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-blue-400">💎</span>
            <span className="text-white">{credits_balance}</span>
            <span className="text-slate-400">credits</span>
          </div>
        )}
        {!can_advance && (
          <span className="text-red-400 text-xs">⚠️ No credits</span>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 bg-slate-800/50 border border-slate-600 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-medium">Campaign Credits</h3>
        <div className="text-xs text-slate-400">Round {current_round}</div>
      </div>

      {/* Status Display */}
      {inFreeRounds ? (
        /* Free Rounds Phase */
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-green-400 text-sm font-medium">
              🆓 Taste of Adventure
            </span>
            <span className="text-white text-sm">
              {free_rounds_remaining} of {FREE_ROUNDS_LIMIT} free rounds left
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
            <div
              className="bg-gradient-to-r from-green-500 to-green-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${freeRoundsProgress}%` }}
            ></div>
          </div>

          <p className="text-xs text-slate-400">
            Enjoying the adventure? You'll need to purchase credits after your
            free rounds.
          </p>
        </div>
      ) : (
        /* Paid Credits Phase */
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-400 text-sm font-medium">
              💎 Adventure Credits
            </span>
            <span className="text-white text-sm">
              {credits_balance} credit{credits_balance === 1 ? "" : "s"}{" "}
              remaining
            </span>
          </div>

          {/* Credits Status */}
          {credits_balance > 0 ? (
            <div className="flex items-center gap-2 p-2 bg-blue-900/20 border border-blue-600/30 rounded">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <span className="text-blue-300 text-sm">Campaign active</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2 bg-red-900/20 border border-red-600/30 rounded">
              <div className="w-2 h-2 bg-red-400 rounded-full"></div>
              <span className="text-red-300 text-sm">
                Credits needed to continue
              </span>
            </div>
          )}

          {credits_balance <= 5 && credits_balance > 0 && (
            <p className="text-xs text-yellow-400 mt-2">
              ⚠️ Low credits - consider purchasing more soon
            </p>
          )}
        </div>
      )}

      {/* Action Status */}
      {!can_advance && (
        <div className="mt-3 p-2 bg-amber-900/20 border border-amber-600/30 rounded">
          <div className="text-amber-300 text-sm font-medium">
            🛑 Campaign Paused
          </div>
          <div className="text-amber-200 text-xs">
            Host needs to purchase credits to continue
          </div>
        </div>
      )}
    </div>
  );
}
