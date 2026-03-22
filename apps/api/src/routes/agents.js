import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { addAuditEntry, getTenantState } from "../store.js";
import { authorize } from "../middleware/context.js";
import { enqueueJob } from "../lib/queue.js";

const taskSchema = z.object({
  objective: z.string().min(4),
  riskScore: z.number().min(0).max(1).default(0.2),
  requestedByModule: z.enum(["crm", "analytics", "workflow", "billing", "governance"]).default("workflow")
});

export const agentsRouter = Router();

agentsRouter.get("/tasks", authorize("read:agents"), (req, res) => {
  const tenant = getTenantState(req.ctx.tenantId);
  res.json({ data: tenant.agents.tasks });
});

agentsRouter.post("/tasks", authorize("write:agents"), async (req, res, next) => {
  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid task payload" });
  }

  const tenant = getTenantState(req.ctx.tenantId);
  const requiresApproval = parsed.data.riskScore >= 0.7;
  const task = {
    id: uuidv4(),
    ...parsed.data,
    status: requiresApproval ? "pending_approval" : "completed",
    confidence: Number((0.55 + Math.random() * 0.4).toFixed(2)),
    outcome: requiresApproval ? null : `Executed objective: ${parsed.data.objective}`,
    createdAt: new Date().toISOString()
  };

  tenant.agents.tasks.unshift(task);

  if (requiresApproval) {
    tenant.governance.approvals.unshift({
      id: uuidv4(),
      taskId: task.id,
      type: "agent-task",
      status: "pending",
      requestedAt: new Date().toISOString(),
      requestedBy: req.ctx.userId
    });
  }

  try {
    await enqueueJob("agent-task", {
      tenantId: req.ctx.tenantId,
      taskId: task.id,
      objective: task.objective,
      requiresApproval
    });

    addAuditEntry(req.ctx.tenantId, {
      actorId: req.ctx.userId,
      actorRole: req.ctx.userRole,
      action: "CREATE_AGENT_TASK",
      module: "agents",
      resourceId: task.id,
      payload: { objective: task.objective, riskScore: task.riskScore, status: task.status }
    });

    res.status(201).json({ data: task, requiresApproval });
  } catch (error) {
    next(error);
  }
});
