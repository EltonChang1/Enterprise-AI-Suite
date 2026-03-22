import { Router } from "express";
import { z } from "zod";
import { addAuditEntry } from "../store.js";
import { authorize } from "../middleware/context.js";
import { markAgentTaskApproved } from "../repositories/agentRepository.js";
import {
  approveGovernanceRequest,
  listGovernancePolicies,
  listGovernanceApprovals,
  listGovernanceAuditLogs,
  listGovernancePolicyVersions,
  upsertGovernancePolicy
} from "../repositories/governanceRepository.js";

const policySchema = z.object({
  id: z.string().min(3),
  name: z.string().min(3),
  enabled: z.boolean(),
  when: z.string().min(3),
  action: z.string().min(3),
  changeReason: z.string().max(300).optional()
});

export const governanceRouter = Router();

governanceRouter.get("/policies", authorize("read:governance"), async (req, res, next) => {
  try {
    const policies = await listGovernancePolicies(req.ctx.tenantId);
    res.json({ data: policies });
  } catch (error) {
    next(error);
  }
});

governanceRouter.post("/policies", authorize("write:workflows"), async (req, res, next) => {
  const parsed = policySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid policy payload" });
  }
  try {
    const { changeReason, ...policy } = parsed.data;
    await upsertGovernancePolicy(req.ctx.tenantId, policy, {
      changedBy: req.ctx.userId,
      changeReason
    });
    addAuditEntry(req.ctx.tenantId, {
      actorId: req.ctx.userId,
      actorRole: req.ctx.userRole,
      action: "UPSERT_POLICY",
      module: "governance",
      resourceId: policy.id,
      payload: { name: policy.name, enabled: policy.enabled, changeReason: changeReason || null }
    });
    res.status(201).json({ data: policy });
  } catch (error) {
    next(error);
  }
});

governanceRouter.get("/policies/:id/versions", authorize("read:governance"), async (req, res, next) => {
  try {
    const versions = await listGovernancePolicyVersions(req.ctx.tenantId, req.params.id, 100);
    res.json({ data: versions });
  } catch (error) {
    next(error);
  }
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
