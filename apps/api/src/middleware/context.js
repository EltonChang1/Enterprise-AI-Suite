import { config } from "../config.js";

export function withRequestContext(req, _res, next) {
  const fromAuth = req.auth || {};
  req.ctx = {
    tenantId: fromAuth.tenantId || req.header("x-tenant-id") || config.defaultTenant,
    userId: fromAuth.id || req.header("x-user-id") || "system",
    userRole: fromAuth.role || req.header("x-user-role") || "admin"
  };
  next();
}

const permissions = {
  admin: ["*"],
  analyst: ["read:crm", "read:analytics", "read:billing", "read:governance", "read:agents", "read:workflows"],
  operator: ["read:crm", "write:crm", "read:agents", "write:agents", "read:workflows", "write:workflows"],
  approver: ["read:governance", "approve:governance", "read:agents"]
};

export function authorize(permission) {
  return (req, res, next) => {
    const role = req.ctx?.userRole || "analyst";
    const rolePermissions = permissions[role] || [];
    const allowed = rolePermissions.includes("*") || rolePermissions.includes(permission);
    if (!allowed) {
      return res.status(403).json({ error: "Forbidden", permission, role });
    }
    next();
  };
}
