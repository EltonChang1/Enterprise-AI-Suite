import { getPgPool } from "../lib/postgres.js";
import { getTenantState } from "../store.js";

const defaultPolicies = [
  {
    id: "policy-human-approval-high-risk",
    name: "Human approval for high-risk agent tasks",
    enabled: true,
    when: "riskScore >= 0.7",
    action: "require_approval"
  }
];

export async function listGovernancePolicies(tenantId) {
  const pool = getPgPool();
  if (pool) {
    const result = await pool.query(
      `SELECT policy_id AS id,
              name,
              enabled,
              condition_expr AS "when",
              action,
              created_at AS "createdAt",
              updated_at AS "updatedAt"
       FROM governance_policies
       WHERE tenant_id = $1
       ORDER BY updated_at DESC`,
      [tenantId]
    );

    if (result.rows.length > 0) {
      return result.rows;
    }

    for (const policy of defaultPolicies) {
      await upsertGovernancePolicy(tenantId, policy, {
        changedBy: "system-seed",
        changeReason: "initial tenant policy seed"
      });
    }

    const seeded = await pool.query(
      `SELECT policy_id AS id,
              name,
              enabled,
              condition_expr AS "when",
              action,
              created_at AS "createdAt",
              updated_at AS "updatedAt"
       FROM governance_policies
       WHERE tenant_id = $1
       ORDER BY updated_at DESC`,
      [tenantId]
    );
    return seeded.rows;
  }

  const tenant = getTenantState(tenantId);
  return tenant.governance.policies;
}

export async function upsertGovernancePolicy(tenantId, policy, metadata = {}) {
  const changedBy = metadata.changedBy || "system";
  const changeReason = metadata.changeReason || null;
  const pool = getPgPool();

  if (pool) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO governance_policies
           (tenant_id, policy_id, name, enabled, condition_expr, action, created_at, updated_at)
         VALUES
           ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT (tenant_id, policy_id)
         DO UPDATE SET
           name = EXCLUDED.name,
           enabled = EXCLUDED.enabled,
           condition_expr = EXCLUDED.condition_expr,
           action = EXCLUDED.action,
           updated_at = NOW()`,
        [tenantId, policy.id, policy.name, policy.enabled, policy.when, policy.action]
      );

      const nextVersionResult = await client.query(
        `SELECT COALESCE(MAX(version_no), 0) + 1 AS next_version
         FROM governance_policy_versions
         WHERE tenant_id = $1 AND policy_id = $2`,
        [tenantId, policy.id]
      );
      const versionNo = Number(nextVersionResult.rows[0]?.next_version || 1);

      await client.query(
        `INSERT INTO governance_policy_versions
           (tenant_id, policy_id, version_no, name, enabled, condition_expr, action, changed_by, change_reason, changed_at)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [tenantId, policy.id, versionNo, policy.name, policy.enabled, policy.when, policy.action, changedBy, changeReason]
      );

      await client.query("COMMIT");
      return policy;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  const tenant = getTenantState(tenantId);
  const existingIndex = tenant.governance.policies.findIndex((item) => item.id === policy.id);
  if (existingIndex >= 0) {
    tenant.governance.policies[existingIndex] = policy;
  } else {
    tenant.governance.policies.unshift(policy);
  }

  const nextVersionNo =
    tenant.governance.policyVersions
      .filter((version) => version.policyId === policy.id)
      .reduce((max, version) => Math.max(max, version.versionNo), 0) + 1;

  tenant.governance.policyVersions.unshift({
    policyId: policy.id,
    versionNo: nextVersionNo,
    name: policy.name,
    enabled: policy.enabled,
    when: policy.when,
    action: policy.action,
    changedBy,
    changeReason,
    changedAt: new Date().toISOString()
  });

  return policy;
}

export async function listGovernanceApprovals(tenantId) {
  const pool = getPgPool();
  if (pool) {
    const result = await pool.query(
      `SELECT id,
              task_id AS "taskId",
              type,
              status,
              requested_at AS "requestedAt",
              requested_by AS "requestedBy",
              approved_at AS "approvedAt",
              approved_by AS "approvedBy"
       FROM governance_approvals
       WHERE tenant_id = $1
       ORDER BY requested_at DESC
       LIMIT 500`,
      [tenantId]
    );
    return result.rows;
  }

  const tenant = getTenantState(tenantId);
  return tenant.governance.approvals;
}

export async function createGovernanceApproval(tenantId, approval) {
  const pool = getPgPool();
  if (pool) {
    await pool.query(
      `INSERT INTO governance_approvals
         (id, tenant_id, task_id, type, status, requested_at, requested_by, approved_at, approved_by)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        approval.id,
        tenantId,
        approval.taskId,
        approval.type,
        approval.status,
        approval.requestedAt,
        approval.requestedBy,
        approval.approvedAt || null,
        approval.approvedBy || null
      ]
    );
    return approval;
  }

  const tenant = getTenantState(tenantId);
  tenant.governance.approvals.unshift(approval);
  return approval;
}

export async function approveGovernanceRequest(tenantId, approvalId, approvedBy) {
  const pool = getPgPool();
  if (pool) {
    const result = await pool.query(
      `UPDATE governance_approvals
       SET status = 'approved',
           approved_at = NOW(),
           approved_by = $3
       WHERE tenant_id = $1 AND id = $2
       RETURNING id,
                 task_id AS "taskId",
                 type,
                 status,
                 requested_at AS "requestedAt",
                 requested_by AS "requestedBy",
                 approved_at AS "approvedAt",
                 approved_by AS "approvedBy"`,
      [tenantId, approvalId, approvedBy]
    );
    return result.rows[0] || null;
  }

  const tenant = getTenantState(tenantId);
  const approval = tenant.governance.approvals.find((item) => item.id === approvalId);
  if (!approval) {
    return null;
  }
  approval.status = "approved";
  approval.approvedAt = new Date().toISOString();
  approval.approvedBy = approvedBy;
  return approval;
}

export async function listGovernancePolicyVersions(tenantId, policyId, limit = 100) {
  const pool = getPgPool();
  if (pool) {
    const result = await pool.query(
      `SELECT policy_id AS "policyId",
              version_no AS "versionNo",
              name,
              enabled,
              condition_expr AS "when",
              action,
              changed_by AS "changedBy",
              change_reason AS "changeReason",
              changed_at AS "changedAt"
       FROM governance_policy_versions
       WHERE tenant_id = $1 AND policy_id = $2
       ORDER BY version_no DESC
       LIMIT $3`,
      [tenantId, policyId, limit]
    );
    return result.rows;
  }

  const tenant = getTenantState(tenantId);
  return tenant.governance.policyVersions
    .filter((item) => item.policyId === policyId)
    .sort((a, b) => b.versionNo - a.versionNo)
    .slice(0, limit);
}

export async function listGovernanceAuditLogs(tenantId, limit = 200) {
  const pool = getPgPool();
  if (pool) {
    const result = await pool.query(
      `SELECT id,
              at,
              actor_id AS "actorId",
              actor_role AS "actorRole",
              action,
              module,
              resource_id AS "resourceId",
              payload
       FROM governance_audit_logs
       WHERE tenant_id = $1
       ORDER BY at DESC
       LIMIT $2`,
      [tenantId, limit]
    );
    return result.rows;
  }

  const tenant = getTenantState(tenantId);
  return tenant.governance.auditLog.slice(0, limit);
}
