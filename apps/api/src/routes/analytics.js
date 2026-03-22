import { Router } from "express";
import { getTenantState } from "../store.js";
import { authorize } from "../middleware/context.js";
import { cacheGetJson, cacheSetJson } from "../lib/redis.js";
import { listContacts } from "../repositories/contactRepository.js";
import { listWorkflowRuns } from "../repositories/workflowRepository.js";
import { listAgentTasks } from "../repositories/agentRepository.js";
import { listBillingUsageEvents } from "../repositories/billingRepository.js";
import { listGovernanceApprovals, listGovernanceAuditLogs } from "../repositories/governanceRepository.js";

export const analyticsRouter = Router();

analyticsRouter.get("/dashboard", authorize("read:analytics"), async (req, res, next) => {
  const cacheKey = `analytics:${req.ctx.tenantId}:dashboard:v1`;
  try {
    const cached = await cacheGetJson(cacheKey);
    if (cached) {
      return res.json({ data: cached, source: "redis-cache" });
    }

    const tenant = getTenantState(req.ctx.tenantId);

    const [contacts, workflows, tasks, usageEvents, approvals, auditLogs] = await Promise.all([
      listContacts(req.ctx.tenantId),
      listWorkflowRuns(req.ctx.tenantId),
      listAgentTasks(req.ctx.tenantId),
      listBillingUsageEvents(req.ctx.tenantId),
      listGovernanceApprovals(req.ctx.tenantId),
      listGovernanceAuditLogs(req.ctx.tenantId, 500)
    ]);

    const stageCounts = contacts.reduce(
      (acc, contact) => {
        acc[contact.stage] = (acc[contact.stage] || 0) + 1;
        return acc;
      },
      { lead: 0, qualified: 0, proposal: 0, customer: 0 }
    );

    const completionRate = tasks.length
      ? Number((tasks.filter((task) => task.status === "completed").length / tasks.length).toFixed(2))
      : 1;

    const usageByCategory = usageEvents.reduce((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + event.units;
      return acc;
    }, {});

    const payload = {
      tenantId: req.ctx.tenantId,
      crm: {
        totalContacts: contacts.length,
        stageCounts
      },
      operations: {
        workflowRuns: workflows.length,
        agentTasks: tasks.length,
        agentCompletionRate: completionRate
      },
      finance: {
        usageByCategory
      },
      governance: {
        pendingApprovals: approvals.filter((request) => request.status === "pending").length,
        policyCount: tenant.governance.policies.length,
        auditEvents: auditLogs.length
      }
    };

    await cacheSetJson(cacheKey, payload, 30);
    return res.json({ data: payload, source: "computed" });
  } catch (error) {
    next(error);
  }
});
