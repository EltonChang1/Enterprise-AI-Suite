import { getPgPool } from "../lib/postgres.js";
import { getTenantState } from "../store.js";

export async function listAgentTasks(tenantId) {
  const pool = getPgPool();
  if (pool) {
    const result = await pool.query(
      `SELECT id,
              objective,
              risk_score::float8 AS "riskScore",
              requested_by_module AS "requestedByModule",
              status,
              confidence::float8 AS confidence,
              outcome,
              created_at AS "createdAt"
       FROM agent_tasks
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT 500`,
      [tenantId]
    );
    return result.rows;
  }

  const tenant = getTenantState(tenantId);
  return tenant.agents.tasks;
}

export async function createAgentTask(tenantId, task) {
  const pool = getPgPool();
  if (pool) {
    await pool.query(
      `INSERT INTO agent_tasks
         (id, tenant_id, objective, risk_score, requested_by_module, status, confidence, outcome, created_at, updated_at)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        task.id,
        tenantId,
        task.objective,
        task.riskScore,
        task.requestedByModule,
        task.status,
        task.confidence,
        task.outcome,
        task.createdAt,
        task.createdAt
      ]
    );
    return task;
  }

  const tenant = getTenantState(tenantId);
  tenant.agents.tasks.unshift(task);
  return task;
}

export async function markAgentTaskApproved(tenantId, taskId, outcome) {
  const pool = getPgPool();
  if (pool) {
    await pool.query(
      `UPDATE agent_tasks
       SET status = 'completed',
           outcome = $3,
           updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, taskId, outcome]
    );
    return;
  }

  const tenant = getTenantState(tenantId);
  const task = tenant.agents.tasks.find((item) => item.id === taskId);
  if (task && task.status === "pending_approval") {
    task.status = "completed";
    task.outcome = outcome;
  }
}
