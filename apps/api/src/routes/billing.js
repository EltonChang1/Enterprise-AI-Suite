import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { addAuditEntry, getTenantState } from "../store.js";
import { authorize } from "../middleware/context.js";
import { createCheckoutSession, hasStripe, verifyStripeWebhook } from "../lib/stripe.js";

const usageSchema = z.object({
  category: z.enum(["workflow_run", "agent_task", "api_call", "analytics_compute"]),
  units: z.number().positive()
});

const unitCosts = {
  workflow_run: 0.05,
  agent_task: 0.2,
  api_call: 0.002,
  analytics_compute: 0.08
};

export const billingRouter = Router();

billingRouter.get("/usage", authorize("read:billing"), (req, res) => {
  const tenant = getTenantState(req.ctx.tenantId);
  res.json({ data: tenant.billing.usageEvents });
});

billingRouter.post("/usage", authorize("write:workflows"), (req, res) => {
  const parsed = usageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid usage payload" });
  }
  const tenant = getTenantState(req.ctx.tenantId);
  const event = {
    id: uuidv4(),
    ...parsed.data,
    recordedAt: new Date().toISOString()
  };
  tenant.billing.usageEvents.unshift(event);
  addAuditEntry(req.ctx.tenantId, {
    actorId: req.ctx.userId,
    actorRole: req.ctx.userRole,
    action: "RECORD_USAGE",
    module: "billing",
    resourceId: event.id,
    payload: { category: event.category, units: event.units }
  });
  res.status(201).json({ data: event });
});

billingRouter.get("/invoice", authorize("read:billing"), (req, res) => {
  const tenant = getTenantState(req.ctx.tenantId);
  const usageTotal = tenant.billing.usageEvents.reduce((sum, event) => sum + event.units * unitCosts[event.category], 0);
  const subscriptionTotal = tenant.billing.subscription.seats * tenant.billing.subscription.pricePerSeat;
  const total = Number((subscriptionTotal + usageTotal).toFixed(2));
  res.json({
    data: {
      tenantId: req.ctx.tenantId,
      subscriptionTotal,
      usageTotal: Number(usageTotal.toFixed(2)),
      total,
      currency: "USD"
    }
  });
});

billingRouter.post("/checkout", authorize("read:billing"), async (req, res, next) => {
  try {
    if (!hasStripe()) {
      return res.status(400).json({ error: "Stripe not configured" });
    }
    const tenant = getTenantState(req.ctx.tenantId);
    const usageTotal = tenant.billing.usageEvents.reduce((sum, event) => sum + event.units * unitCosts[event.category], 0);
    const subscriptionTotal = tenant.billing.subscription.seats * tenant.billing.subscription.pricePerSeat;
    const total = Number((subscriptionTotal + usageTotal).toFixed(2));

    const session = await createCheckoutSession({
      tenantId: req.ctx.tenantId,
      amountUsd: total,
      metadata: {
        userId: req.ctx.userId
      }
    });

    return res.status(201).json({ data: { checkoutUrl: session.url, sessionId: session.id, total } });
  } catch (error) {
    next(error);
  }
});

billingRouter.post("/webhook", (req, res) => {
  try {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      return res.status(400).json({ error: "Missing stripe-signature header" });
    }
    const event = verifyStripeWebhook(req.body, signature);
    if (!event) {
      return res.status(400).json({ error: "Stripe webhook not configured" });
    }
    return res.json({ received: true, type: event.type, id: event.id });
  } catch (error) {
    return res.status(400).json({ error: "Invalid Stripe webhook", details: error.message });
  }
});
