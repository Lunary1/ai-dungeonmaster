/**
 * Credits Purchase API
 * Handles Stripe payment processing for campaign credits
 */

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  CREDIT_PACKS,
  createPaymentEvent,
  updatePaymentEventStatus,
  addCampaignCredits,
  isCampaignOwner,
} from "@/lib/credits";

// Initialize Stripe (placeholder - will need actual Stripe secret key)
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function getAuthenticatedUser(request) {
  try {
    const authorization = request.headers.get("authorization");

    if (authorization?.startsWith("Bearer ")) {
      const token = authorization.substring(7);

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (error || !user) {
        throw new Error("Invalid token");
      }

      return user;
    }

    throw new Error("No authorization header");
  } catch (error) {
    console.error("Authentication error:", error);
    return null;
  }
}

// POST - Create payment intent and initiate purchase
export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { campaignId, packKey } = await request.json();

    // Validate inputs
    if (!campaignId || !packKey) {
      return NextResponse.json(
        { error: "Campaign ID and pack key required" },
        { status: 400 }
      );
    }

    if (!CREDIT_PACKS[packKey]) {
      return NextResponse.json(
        { error: "Invalid credit pack" },
        { status: 400 }
      );
    }

    // Verify user is campaign owner
    const isOwner = await isCampaignOwner(campaignId, user.id);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Only campaign owners can purchase credits" },
        { status: 403 }
      );
    }

    const pack = CREDIT_PACKS[packKey];

    // Create payment event record
    const paymentResult = await createPaymentEvent(
      campaignId,
      user.id,
      packKey
    );
    if (!paymentResult.ok) {
      return NextResponse.json({ error: paymentResult.error }, { status: 500 });
    }

    // In a real implementation, create Stripe PaymentIntent here
    // For now, we'll simulate the payment process
    const mockPaymentIntent = {
      id: `pi_mock_${Date.now()}`,
      client_secret: `pi_mock_${Date.now()}_secret_${Math.random()
        .toString(36)
        .substr(2, 9)}`,
      amount: pack.price,
      currency: "usd",
      status: "requires_payment_method",
    };

    // TODO: Replace with actual Stripe integration
    /*
    const paymentIntent = await stripe.paymentIntents.create({
      amount: pack.price,
      currency: 'usd',
      metadata: {
        campaign_id: campaignId,
        user_id: user.id,
        pack_size: pack.size,
        payment_event_id: paymentResult.payment_event_id
      }
    });
    */

    return NextResponse.json({
      success: true,
      client_secret: mockPaymentIntent.client_secret,
      payment_intent_id: mockPaymentIntent.id,
      payment_event_id: paymentResult.payment_event_id,
      pack: {
        name: pack.name,
        size: pack.size,
        price: pack.price,
      },
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    return NextResponse.json(
      { error: "Failed to create payment intent" },
      { status: 500 }
    );
  }
}

// PUT - Confirm payment and add credits
export async function PUT(request) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { paymentIntentId, paymentEventId, campaignId } =
      await request.json();

    // Validate inputs
    if (!paymentIntentId || !paymentEventId || !campaignId) {
      return NextResponse.json(
        {
          error:
            "Payment intent ID, payment event ID, and campaign ID required",
        },
        { status: 400 }
      );
    }

    // In a real implementation, verify payment with Stripe
    // For now, we'll simulate successful payment
    let paymentSucceeded = true;
    let packSize = 50; // Default to medium pack for simulation

    // TODO: Replace with actual Stripe verification
    /*
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    paymentSucceeded = paymentIntent.status === 'succeeded';
    packSize = parseInt(paymentIntent.metadata.pack_size);
    */

    if (paymentSucceeded) {
      // Update payment event status
      await updatePaymentEventStatus(
        paymentEventId,
        "completed",
        paymentIntentId
      );

      // Add credits to campaign
      const creditsResult = await addCampaignCredits(campaignId, packSize);

      if (creditsResult.ok) {
        return NextResponse.json({
          success: true,
          credits_added: creditsResult.credits_added,
          credits_balance: creditsResult.credits_balance,
          message: `Successfully added ${creditsResult.credits_added} credits to your campaign!`,
        });
      } else {
        // Payment succeeded but credits failed to add - this needs manual intervention
        console.error(
          "Payment succeeded but failed to add credits:",
          creditsResult.error
        );
        return NextResponse.json(
          {
            error:
              "Payment processed but failed to add credits. Please contact support.",
          },
          { status: 500 }
        );
      }
    } else {
      // Payment failed
      await updatePaymentEventStatus(paymentEventId, "failed", paymentIntentId);

      return NextResponse.json(
        { error: "Payment was not successful" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error confirming payment:", error);
    return NextResponse.json(
      { error: "Failed to confirm payment" },
      { status: 500 }
    );
  }
}

// GET - Get payment status
export async function GET(request) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");

    if (!campaignId) {
      return NextResponse.json(
        { error: "Campaign ID required" },
        { status: 400 }
      );
    }

    // Get recent payment events for this campaign and user
    const { data: paymentEvents, error } = await supabase
      .from("payment_events")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Error fetching payment events:", error);
      return NextResponse.json(
        { error: "Failed to fetch payment history" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      payment_events: paymentEvents || [],
    });
  } catch (error) {
    console.error("Error getting payment status:", error);
    return NextResponse.json(
      { error: "Failed to get payment status" },
      { status: 500 }
    );
  }
}
