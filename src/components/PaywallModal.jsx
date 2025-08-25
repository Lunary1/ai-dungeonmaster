/**
 * PaywallModal Component
 * Displays when campaign runs out of credits and host needs to purchase more
 */

"use client";

import { useState } from "react";
import { CREDIT_PACKS } from "../lib/credits";

export default function PaywallModal({
  isOpen,
  onClose,
  campaignId,
  campaignName,
  isOwner,
  onPurchaseInitiated,
}) {
  const [selectedPack, setSelectedPack] = useState("medium");
  const [processing, setProcessing] = useState(false);

  if (!isOpen) return null;

  const handlePurchase = async () => {
    if (!isOwner) return;

    setProcessing(true);
    try {
      // This will be implemented when we add Stripe integration
      if (onPurchaseInitiated) {
        await onPurchaseInitiated(selectedPack);
      }
    } catch (error) {
      console.error("Purchase failed:", error);
    } finally {
      setProcessing(false);
    }
  };

  const formatPrice = (cents) => `$${(cents / 100).toFixed(2)}`;
  const formatCreditsPerDollar = (pack) =>
    (pack.size / (pack.price / 100)).toFixed(1);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-2xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="p-6 border-b border-slate-600">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
              🎲
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                Adventure Awaits!
              </h2>
              <p className="text-slate-300 text-sm">{campaignName}</p>
            </div>
          </div>
          <p className="text-slate-300 text-sm">
            Your free rounds have been used up. Purchase more rounds to continue
            your epic adventure!
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {isOwner ? (
            <>
              {/* Credit Pack Selection */}
              <div className="space-y-3 mb-6">
                <h3 className="text-white font-medium mb-3">
                  Choose Your Adventure Pack:
                </h3>
                {Object.entries(CREDIT_PACKS).map(([key, pack]) => (
                  <label
                    key={key}
                    className={`block p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedPack === key
                        ? "border-purple-500 bg-purple-500/10"
                        : "border-slate-600 bg-slate-700/30 hover:border-slate-500"
                    }`}
                  >
                    <input
                      type="radio"
                      name="creditPack"
                      value={key}
                      checked={selectedPack === key}
                      onChange={(e) => setSelectedPack(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-white font-medium">
                          {pack.name}
                        </div>
                        <div className="text-slate-300 text-sm">
                          {pack.size} rounds • {formatCreditsPerDollar(pack)}{" "}
                          rounds per $1
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-bold">
                          {formatPrice(pack.price)}
                        </div>
                        {key === "medium" && (
                          <div className="text-xs text-green-400">
                            Most Popular
                          </div>
                        )}
                        {key === "large" && (
                          <div className="text-xs text-blue-400">
                            Best Value
                          </div>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              {/* Purchase Button */}
              <button
                onClick={handlePurchase}
                disabled={processing}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-all"
              >
                {processing ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Processing...
                  </div>
                ) : (
                  `Purchase ${CREDIT_PACKS[selectedPack].name} - ${formatPrice(
                    CREDIT_PACKS[selectedPack].price
                  )}`
                )}
              </button>

              {/* Security Note */}
              <p className="text-xs text-slate-400 text-center mt-3">
                🔒 Secure payment powered by Stripe
              </p>
            </>
          ) : (
            /* Non-owner message */
            <div className="text-center">
              <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                ⏳
              </div>
              <h3 className="text-white font-medium mb-2">Waiting for Host</h3>
              <p className="text-slate-300 text-sm mb-4">
                The campaign host needs to purchase more rounds to continue the
                adventure.
              </p>
              <p className="text-xs text-slate-400">
                Only the campaign host can purchase credits. You'll be notified
                when the campaign continues!
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-600">
          <button
            onClick={onClose}
            className="w-full text-slate-400 hover:text-white text-sm py-2 transition-colors"
          >
            {isOwner ? "Maybe Later" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
