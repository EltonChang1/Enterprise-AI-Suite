import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { addAuditEntry } from "../store.js";
import { authorize } from "../middleware/context.js";
import { createCheckoutSession, hasStripe, verifyStripeWebhook } from "../lib/stripe.js";
import { createBillingUsageEvent, getInvoiceSummary, listBillingUsageEvents } from "../repositories/billingRepository.js";

const usageSchema = z.object({
  category: z.enum(["workflow_run", "agent_task", "api_call", "analytics_compute"]),
  units: z.number().positive()
});

export const billingRouter = Router();

billingRouter.get("/usage", authorize("read:billing"), async (req, res, next) => {
  try {
    const usageEvents = await listBillingUsageEvents(req.ctx.tenantId);
    res.json({ data: usageEvents });
  } catch (error) {
    next(error);
  }
});

billingRouter.post("/usage", authorize("write:workflows"), async (req, res, next) => {
  const parsed = usageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid usage payload" });
  }
  try {
    const event = {
      id: uuidv4(),
      ...parsed.data,
      recordedAt: new Date().toISOString()
    };
    await createBillingUsageEvent(req.ctx.tenantId, event);
    addAuditEntry(req.ctx.tenantId, {
      actorId: req.ctx.userId,
      actorRole: req.ctx.userRole,
      action: "RECORD_USAGE",
      module: "billing",
      resourceId: event.id,
      payload: { category: event.category, units: event.units }
    });
    res.status(201).json({ data: event });
  } catch (error) {
    next(error);
  }
});

billingRouter.get("/invoice", authorize("read:billing"), async (req, res, next) => {
  try {
    const invoice = await getInvoiceSummary(req.ctx.tenantId);
    res.json({ data: invoice });
  } catch (error) {
    next(error);
  }
});

billingRouter.post("/checkout", authorize("read:billing"), async (req, res, next) => {
  try {
    if (!hasStripe()) {
      return res.status(400).json({ error: "Stripe not configured" });
    }
    const invoice = await getInvoiceSummary(req.ctx.tenantId);
    const total = invoice.total;

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
