import { getPgPool } from "../lib/postgres.js";
import { getTenantState } from "../store.js";

export async function listWorkflowDefinitions(tenantId) {
  const pool = getPgPool();
  if (pool) {
    const result = await pool.query(
      `SELECT id, name, trigger, steps, created_at AS "createdAt"
       FROM workflow_definitions
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT 500`,
      [tenantId]
    );
    return result.rows;
  }

  const tenant = getTenantState(tenantId);
  return tenant.workflows.definitions;
}

export async function createWorkflowDefinition(tenantId, definition) {
  const pool = getPgPool();
  if (pool) {
    await pool.query(
      `INSERT INTO workflow_definitions (id, tenant_id, name, trigger, steps, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [definition.id, tenantId, definition.name, definition.trigger, JSON.stringify(definition.steps), definition.createdAt]
    );
    return definition;
  }

  const tenant = getTenantState(tenantId);
  tenant.workflows.definitions.unshift(definition);
  return definition;
}

export async function getWorkflowDefinitionById(tenantId, workflowId) {
  const pool = getPgPool();
  if (pool) {
    const result = await pool.query(
      `SELECT id, name, trigger, steps, created_at AS "createdAt"
       FROM workflow_definitions
       WHERE tenant_id = $1 AND id = $2
       LIMIT 1`,
      [tenantId, workflowId]
    );
    return result.rows[0] || null;
  }

  const tenant = getTenantState(tenantId);
  return tenant.workflows.definitions.find((item) => item.id === workflowId) || null;
}

export async function createWorkflowRun(tenantId, run) {
  const pool = getPgPool();
  if (pool) {
    await pool.query(
      `INSERT INTO workflow_runs (id, tenant_id, workflow_id, status, steps_executed, started_at, finished_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [run.id, tenantId, run.workflowId, run.status, run.stepsExecuted, run.startedAt, run.finishedAt]
    );
    return run;
  }

  const tenant = getTenantState(tenantId);
  tenant.workflows.runs.unshift(run);
  return run;
}

export async function listWorkflowRuns(tenantId) {
  const pool = getPgPool();
  if (pool) {
    const result = await pool.query(
      `SELECT id, workflow_id AS "workflowId", status, steps_executed AS "stepsExecuted", started_at AS "startedAt", finished_at AS "finishedAt"
       FROM workflow_runs
       WHERE tenant_id = $1
       ORDER BY started_at DESC
       LIMIT 500`,
      [tenantId]
    );
    return result.rows;
  }

  const tenant = getTenantState(tenantId);
  return tenant.workflows.runs;
}
