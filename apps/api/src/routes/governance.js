import { Router } from "express";
import { z } from "zod";
import { addAuditEntry, getTenantState } from "../store.js";
import { authorize } from "../middleware/context.js";
import { markAgentTaskApproved } from "../repositories/agentRepository.js";

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

governanceRouter.get("/audit", authorize("read:governance"), (req, res) => {
  const tenant = getTenantState(req.ctx.tenantId);
  res.json({ data: tenant.governance.auditLog.slice(0, 200) });
});

governanceRouter.get("/approvals", authorize("read:governance"), (req, res) => {
  const tenant = getTenantState(req.ctx.tenantId);
  res.json({ data: tenant.governance.approvals });
});

governanceRouter.post("/approvals/:id/approve", authorize("approve:governance"), async (req, res, next) => {
  const tenant = getTenantState(req.ctx.tenantId);
  const approval = tenant.governance.approvals.find((item) => item.id === req.params.id);
  if (!approval) {
    return res.status(404).json({ error: "Approval request not found" });
  }
  approval.status = "approved";
  approval.approvedAt = new Date().toISOString();
  approval.approvedBy = req.ctx.userId;

  const task = tenant.agents.tasks.find((item) => item.id === approval.taskId);
  const approvedOutcome = `Approved execution: ${task?.objective || "task"}`;

  try {
    await markAgentTaskApproved(req.ctx.tenantId, approval.taskId, approvedOutcome);

    if (task && task.status === "pending_approval") {
      task.status = "completed";
      task.outcome = approvedOutcome;
    }

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
