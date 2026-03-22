import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { addAuditEntry, getTenantState } from "../store.js";
import { authorize } from "../middleware/context.js";
import { enqueueJob } from "../lib/queue.js";
import {
  createWorkflowDefinition,
  createWorkflowRun,
  getWorkflowDefinitionById,
  listWorkflowDefinitions,
  listWorkflowRuns
} from "../repositories/workflowRepository.js";

const workflowSchema = z.object({
  name: z.string().min(3),
  trigger: z.enum(["manual", "schedule", "event"]).default("manual"),
  steps: z.array(z.object({ id: z.string(), type: z.string(), config: z.record(z.any()).default({}) })).min(1)
});

export const workflowsRouter = Router();

workflowsRouter.get("/", authorize("read:workflows"), async (req, res, next) => {
  try {
    const definitions = await listWorkflowDefinitions(req.ctx.tenantId);
    res.json({ data: definitions });
  } catch (error) {
    next(error);
  }
});

workflowsRouter.get("/runs", authorize("read:workflows"), async (req, res, next) => {
  try {
    const runs = await listWorkflowRuns(req.ctx.tenantId);
    res.json({ data: runs });
  } catch (error) {
    next(error);
  }
});

workflowsRouter.post("/", authorize("write:workflows"), async (req, res, next) => {
  const parsed = workflowSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid workflow payload" });
  }
  try {
    const definition = {
      id: uuidv4(),
      ...parsed.data,
      createdAt: new Date().toISOString()
    };
    await createWorkflowDefinition(req.ctx.tenantId, definition);
    addAuditEntry(req.ctx.tenantId, {
      actorId: req.ctx.userId,
      actorRole: req.ctx.userRole,
      action: "CREATE_WORKFLOW",
      module: "workflows",
      resourceId: definition.id,
      payload: { name: definition.name, trigger: definition.trigger }
    });
    res.status(201).json({ data: definition });
  } catch (error) {
    next(error);
  }
});

workflowsRouter.post("/:id/execute", authorize("write:workflows"), async (req, res, next) => {
  try {
    const definition = await getWorkflowDefinitionById(req.ctx.tenantId, req.params.id);
    if (!definition) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    const run = {
      id: uuidv4(),
      workflowId: definition.id,
      status: "completed",
      stepsExecuted: definition.steps.length,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString()
    };

    await createWorkflowRun(req.ctx.tenantId, run);

    const tenant = getTenantState(req.ctx.tenantId);
    tenant.billing.usageEvents.unshift({
      id: uuidv4(),
      category: "workflow_run",
      units: definition.steps.length,
      recordedAt: new Date().toISOString()
    });

    await enqueueJob("workflow-run", {
      tenantId: req.ctx.tenantId,
      workflowId: definition.id,
      runId: run.id,
      steps: run.stepsExecuted
    });

    addAuditEntry(req.ctx.tenantId, {
      actorId: req.ctx.userId,
      actorRole: req.ctx.userRole,
      action: "EXECUTE_WORKFLOW",
      module: "workflows",
      resourceId: run.id,
      payload: { workflowId: definition.id, steps: run.stepsExecuted }
    });

    res.status(201).json({ data: run });
  } catch (error) {
    next(error);
  }
});
