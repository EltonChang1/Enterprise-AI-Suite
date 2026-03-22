import { getPgPool } from "../lib/postgres.js";
import { getTenantState } from "../store.js";

export const unitCosts = {
  workflow_run: 0.05,
  agent_task: 0.2,
  api_call: 0.002,
  analytics_compute: 0.08
};

export async function listBillingUsageEvents(tenantId) {
  const pool = getPgPool();
  if (pool) {
    const result = await pool.query(
      `SELECT id,
              category,
              units::float8 AS units,
              recorded_at AS "recordedAt"
       FROM billing_usage_events
       WHERE tenant_id = $1
       ORDER BY recorded_at DESC
       LIMIT 2000`,
      [tenantId]
    );
    return result.rows;
  }

  const tenant = getTenantState(tenantId);
  return tenant.billing.usageEvents;
}

export async function createBillingUsageEvent(tenantId, event) {
  const pool = getPgPool();
  if (pool) {
    await pool.query(
      `INSERT INTO billing_usage_events (id, tenant_id, category, units, recorded_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [event.id, tenantId, event.category, event.units, event.recordedAt]
    );
    return event;
  }

  const tenant = getTenantState(tenantId);
  tenant.billing.usageEvents.unshift(event);
  return event;
}

export async function getInvoiceSummary(tenantId) {
  const tenant = getTenantState(tenantId);
  const subscriptionTotal = tenant.billing.subscription.seats * tenant.billing.subscription.pricePerSeat;
  const usageEvents = await listBillingUsageEvents(tenantId);
  const usageTotal = usageEvents.reduce((sum, event) => sum + event.units * unitCosts[event.category], 0);

  return {
    tenantId,
    subscriptionTotal,
    usageTotal: Number(usageTotal.toFixed(2)),
    total: Number((subscriptionTotal + usageTotal).toFixed(2)),
    currency: "USD"
  };
}
