import Stripe from "stripe";
import { config } from "../config.js";

let stripe;

export function hasStripe() {
  return Boolean(config.stripe.secretKey);
}

export function getStripe() {
  if (!hasStripe()) {
    return null;
  }
  if (stripe) {
    return stripe;
  }
  stripe = new Stripe(config.stripe.secretKey);
  return stripe;
}

export async function createCheckoutSession({ tenantId, amountUsd, metadata = {} }) {
  const client = getStripe();
  if (!client) {
    return null;
  }
  const unitAmount = Math.max(100, Math.round(amountUsd * 100));
  return client.checkout.sessions.create({
    mode: "payment",
    success_url: config.stripe.successUrl,
    cancel_url: config.stripe.cancelUrl,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: unitAmount,
          product_data: {
            name: `Enterprise AI Suite invoice (${tenantId})`
          }
        }
      }
    ],
    metadata: {
      tenantId,
      ...metadata
    }
  });
}

export function verifyStripeWebhook(rawBody, signature) {
  const client = getStripe();
  if (!client || !config.stripe.webhookSecret) {
    return null;
  }
  return client.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
}
