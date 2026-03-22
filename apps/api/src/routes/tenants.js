import { Router } from "express";
import { z } from "zod";
import { authorize } from "../middleware/context.js";
import { listTenantMetadata, upsertTenant } from "../store.js";

const tenantSchema = z.object({
  tenantId: z.string().min(2),
  name: z.string().min(2),
  status: z.enum(["active", "suspended"]).default("active")
});

export const tenantsRouter = Router();

tenantsRouter.get("/", authorize("read:governance"), (_req, res) => {
  res.json({ data: listTenantMetadata() });
});

tenantsRouter.post("/", authorize("write:workflows"), (req, res) => {
  const parsed = tenantSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid tenant payload" });
  }
  const tenant = upsertTenant(parsed.data.tenantId, parsed.data);
  return res.status(201).json({ data: tenant });
});
