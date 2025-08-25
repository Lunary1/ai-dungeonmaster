/**
 * Credits System for AI Dungeonmaster
 * Handles round consumption, free rounds, and credit management
 */

import { supabase } from "./supabase";

// Credit pack configurations (placeholder pricing)
export const CREDIT_PACKS = {
  small: { size: 10, price: 499, name: "Starter Pack" }, // $4.99
  medium: { size: 50, price: 1999, name: "Adventure Pack" }, // $19.99
  large: { size: 100, price: 3499, name: "Epic Campaign Pack" }, // $34.99
};

export const FREE_ROUNDS_LIMIT = 5;

/**
 * Consume a round credit (free round or paid credit)
 * @param {string} campaignId - Campaign UUID
 * @returns {Promise<{ok: boolean, type?: string, error?: string, free_rounds_remaining?: number, credits_balance?: number}>}
 */
export async function consumeRoundCredit(campaignId) {
  try {
    const { data, error } = await supabase.rpc("consume_round_credit", {
      campaign_uuid: campaignId,
    });

    if (error) {
      console.error("Error consuming round credit:", error);
      return { ok: false, error: error.message };
    }

    return data;
  } catch (error) {
    console.error("Error in consumeRoundCredit:", error);
    return { ok: false, error: "Failed to consume round credit" };
  }
}

/**
 * Add credits to a campaign after successful payment
 * @param {string} campaignId - Campaign UUID
 * @param {number} creditAmount - Number of credits to add
 * @returns {Promise<{ok: boolean, credits_balance?: number, credits_added?: number, error?: string}>}
 */
export async function addCampaignCredits(campaignId, creditAmount) {
  try {
    const { data, error } = await supabase.rpc("add_campaign_credits", {
      campaign_uuid: campaignId,
      credit_amount: creditAmount,
    });

    if (error) {
      console.error("Error adding campaign credits:", error);
      return { ok: false, error: error.message };
    }

    return data;
  } catch (error) {
    console.error("Error in addCampaignCredits:", error);
    return { ok: false, error: "Failed to add credits" };
  }
}

/**
 * Get current credit status for a campaign
 * @param {string} campaignId - Campaign UUID
 * @returns {Promise<{ok: boolean, free_rounds_used?: number, free_rounds_remaining?: number, credits_balance?: number, can_advance?: boolean, error?: string}>}
 */
export async function getCampaignCreditStatus(campaignId) {
  try {
    const { data, error } = await supabase.rpc("get_campaign_credit_status", {
      campaign_uuid: campaignId,
    });

    if (error) {
      console.error("Error getting campaign credit status:", error);
      return { ok: false, error: error.message };
    }

    return data;
  } catch (error) {
    console.error("Error in getCampaignCreditStatus:", error);
    return { ok: false, error: "Failed to get credit status" };
  }
}

/**
 * Check if user is the campaign owner (can purchase credits)
 * @param {string} campaignId - Campaign UUID
 * @param {string} userId - User UUID
 * @returns {Promise<boolean>}
 */
export async function isCampaignOwner(campaignId, userId) {
  try {
    const { data, error } = await supabase
      .from("campaigns")
      .select("owner_id")
      .eq("id", campaignId)
      .single();

    if (error) {
      console.error("Error checking campaign ownership:", error);
      return false;
    }

    return data?.owner_id === userId;
  } catch (error) {
    console.error("Error in isCampaignOwner:", error);
    return false;
  }
}

/**
 * Get campaign usage history
 * @param {string} campaignId - Campaign UUID
 * @param {number} limit - Number of recent events to fetch
 * @returns {Promise<Array>}
 */
export async function getCampaignUsageHistory(campaignId, limit = 20) {
  try {
    const { data, error } = await supabase
      .from("usage_events")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error getting usage history:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Error in getCampaignUsageHistory:", error);
    return [];
  }
}

/**
 * Get user's payment history for a campaign
 * @param {string} campaignId - Campaign UUID
 * @param {string} userId - User UUID
 * @returns {Promise<Array>}
 */
export async function getCampaignPaymentHistory(campaignId, userId) {
  try {
    const { data, error } = await supabase
      .from("payment_events")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error getting payment history:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Error in getCampaignPaymentHistory:", error);
    return [];
  }
}

/**
 * Create a payment event record (before processing payment)
 * @param {string} campaignId - Campaign UUID
 * @param {string} userId - User UUID
 * @param {string} packKey - Credit pack key (small, medium, large)
 * @returns {Promise<{ok: boolean, payment_event_id?: string, error?: string}>}
 */
export async function createPaymentEvent(campaignId, userId, packKey) {
  try {
    const pack = CREDIT_PACKS[packKey];
    if (!pack) {
      return { ok: false, error: "Invalid credit pack" };
    }

    const { data, error } = await supabase
      .from("payment_events")
      .insert({
        user_id: userId,
        campaign_id: campaignId,
        provider: "stripe",
        pack_size: pack.size,
        amount_usd: pack.price,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating payment event:", error);
      return { ok: false, error: error.message };
    }

    return { ok: true, payment_event_id: data.id };
  } catch (error) {
    console.error("Error in createPaymentEvent:", error);
    return { ok: false, error: "Failed to create payment event" };
  }
}

/**
 * Update payment event status
 * @param {string} paymentEventId - Payment event UUID
 * @param {string} status - New status (completed, failed, refunded)
 * @param {string} stripePaymentIntentId - Stripe payment intent ID
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function updatePaymentEventStatus(
  paymentEventId,
  status,
  stripePaymentIntentId = null
) {
  try {
    const updateData = { status };
    if (stripePaymentIntentId) {
      updateData.stripe_payment_intent_id = stripePaymentIntentId;
    }

    const { error } = await supabase
      .from("payment_events")
      .update(updateData)
      .eq("id", paymentEventId);

    if (error) {
      console.error("Error updating payment event status:", error);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    console.error("Error in updatePaymentEventStatus:", error);
    return { ok: false, error: "Failed to update payment status" };
  }
}

/**
 * Format credits display for UI
 * @param {number} freeRoundsRemaining - Free rounds left
 * @param {number} creditsBalance - Paid credits available
 * @returns {string}
 */
export function formatCreditsDisplay(freeRoundsRemaining, creditsBalance) {
  if (freeRoundsRemaining > 0) {
    return `${freeRoundsRemaining} free rounds remaining`;
  }
  if (creditsBalance > 0) {
    return `${creditsBalance} credit${
      creditsBalance === 1 ? "" : "s"
    } remaining`;
  }
  return "No credits remaining";
}

/**
 * Calculate progress for free rounds
 * @param {number} freeRoundsUsed - Free rounds consumed
 * @returns {number} Progress percentage (0-100)
 */
export function calculateFreeRoundsProgress(freeRoundsUsed) {
  return Math.min(100, (freeRoundsUsed / FREE_ROUNDS_LIMIT) * 100);
}

/**
 * Determine if campaign needs paywall
 * @param {number} freeRoundsRemaining - Free rounds left
 * @param {number} creditsBalance - Paid credits available
 * @returns {boolean}
 */
export function needsPaywall(freeRoundsRemaining, creditsBalance) {
  return freeRoundsRemaining === 0 && creditsBalance === 0;
}
