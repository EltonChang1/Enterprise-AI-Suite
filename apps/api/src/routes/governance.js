import { Router } from "express";
import { z } from "zod";
import { addAuditEntry, getTenantState } from "../store.js";
import { authorize } from "../middleware/context.js";
import { markAgentTaskApproved } from "../repositories/agentRepository.js";
import {
  approveGovernanceRequest,
  listGovernanceApprovals,
  listGovernanceAuditLogs
} from "../repositories/governanceRepository.js";

const policySchema = z.object({
  id: z.string().min(3),
  name: z.string().min(3),
  enabled: z.boolean(),
  when: z.string().min(3),
  action: z.string().min(3)
});

export const governanceRouter = Router();

governanceRouter.get("/policies", authorize("read:governance"), (req, res) => {
  const tenant = getTenantState(req.ctx.tenantId);
  res.json({ data: tenant.governance.policies });
});

governanceRouter.post("/policies", authorize("write:workflows"), (req, res) => {
  const parsed = policySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid policy payload" });
  }
  const tenant = getTenantState(req.ctx.tenantId);
  const existingIndex = tenant.governance.policies.findIndex((policy) => policy.id === parsed.data.id);
  if (existingIndex >= 0) {
    tenant.governance.policies[existingIndex] = parsed.data;
  } else {
    tenant.governance.policies.unshift(parsed.data);
  }
  addAuditEntry(req.ctx.tenantId, {
    actorId: req.ctx.userId,
    actorRole: req.ctx.userRole,
    action: "UPSERT_POLICY",
    module: "governance",
    resourceId: parsed.data.id,
    payload: { name: parsed.data.name, enabled: parsed.data.enabled }
  });
  res.status(201).json({ data: parsed.data });
});

governanceRouter.get("/audit", authorize("read:governance"), async (req, res, next) => {
  try {
    const logs = await listGovernanceAuditLogs(req.ctx.tenantId, 200);
    res.json({ data: logs });
  } catch (error) {
    next(error);
  }
});

governanceRouter.get("/approvals", authorize("read:governance"), async (req, res, next) => {
  try {
    const approvals = await listGovernanceApprovals(req.ctx.tenantId);
    res.json({ data: approvals });
  } catch (error) {
    next(error);
  }
});

governanceRouter.post("/approvals/:id/approve", authorize("approve:governance"), async (req, res, next) => {
  try {
    const approval = await approveGovernanceRequest(req.ctx.tenantId, req.params.id, req.ctx.userId);
    if (!approval) {
      return res.status(404).json({ error: "Approval request not found" });
    }

    const approvedOutcome = "Approved execution by governance reviewer";
    await markAgentTaskApproved(req.ctx.tenantId, approval.taskId, approvedOutcome);

    addAuditEntry(req.ctx.tenantId, {
      actorId: req.ctx.userId,
      actorRole: req.ctx.userRole,
      action: "APPROVE_REQUEST",
      module: "governance",
      resourceId: approval.id,
      payload: { taskId: approval.taskId }
    });

    res.json({ data: approval });
  } catch (error) {
    next(error);
  }
});
