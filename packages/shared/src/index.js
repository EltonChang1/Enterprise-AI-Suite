export const SUITE_MODULES = ["crm", "analytics", "agents", "workflows", "billing", "governance"];

export function withTenantPath(tenantId, path) {
  return `/tenant/${tenantId}${path.startsWith("/") ? path : `/${path}`}`;
}
