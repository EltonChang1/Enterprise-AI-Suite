import { Router } from "express";
import { z } from "zod";
import { issueAccessToken, verifyAccessToken } from "../lib/auth.js";

const schema = z.object({
  email: z.string().email(),
  tenantId: z.string().min(2),
  role: z.enum(["admin", "analyst", "operator", "approver"]).default("admin")
});

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid login payload" });
  }
  const { email, tenantId, role } = parsed.data;
  const token = issueAccessToken({ id: email, email, role, tenantId });
  return res.json({
    token,
    user: {
      id: email,
      email,
      role,
      tenantId
    }
  });
});

const oidcSchema = z.object({
  idToken: z.string().min(20),
  tenantId: z.string().min(2).optional(),
  role: z.enum(["admin", "analyst", "operator", "approver"]).default("analyst")
});

authRouter.post("/oidc/exchange", async (req, res) => {
  const parsed = oidcSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid OIDC exchange payload" });
  }
  try {
    const claims = await verifyAccessToken(parsed.data.idToken);
    const user = {
      id: String(claims.sub || claims.email || "oidc-user"),
      email: String(claims.email || "oidc-user@example.com"),
      role: parsed.data.role,
      tenantId: parsed.data.tenantId || String(claims.tenantId || "demo-enterprise")
    };
    const token = issueAccessToken(user);
    return res.json({ token, user });
  } catch (error) {
    return res.status(401).json({ error: "OIDC token validation failed", details: error.message });
  }
});
