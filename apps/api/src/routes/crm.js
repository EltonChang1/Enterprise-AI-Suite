import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { addAuditEntry } from "../store.js";
import { authorize } from "../middleware/context.js";
import { createContact, listContacts } from "../repositories/contactRepository.js";

const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  company: z.string().min(2),
  stage: z.enum(["lead", "qualified", "proposal", "customer"]).default("lead")
});

export const crmRouter = Router();

crmRouter.get("/contacts", authorize("read:crm"), async (req, res, next) => {
  try {
    const contacts = await listContacts(req.ctx.tenantId);
    res.json({ data: contacts });
  } catch (error) {
    next(error);
  }
});

crmRouter.post("/contacts", authorize("write:crm"), async (req, res, next) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid contact payload" });
  }
  try {
    const contact = {
      id: uuidv4(),
      ...parsed.data,
      createdAt: new Date().toISOString()
    };
    await createContact(req.ctx.tenantId, contact);
    addAuditEntry(req.ctx.tenantId, {
      actorId: req.ctx.userId,
      actorRole: req.ctx.userRole,
      action: "CREATE_CONTACT",
      module: "crm",
      resourceId: contact.id,
      payload: { email: contact.email, stage: contact.stage }
    });
    res.status(201).json({ data: contact });
  } catch (error) {
    next(error);
  }
});
