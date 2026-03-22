import { v4 as uuidv4 } from "uuid";

const now = () => new Date().toISOString();

const baseTenantState = () => ({
  crm: {
    contacts: [],
    accounts: []
  },
  agents: {
    tasks: []
  },
  workflows: {
    definitions: [],
    runs: []
  },
  billing: {
    subscription: { plan: "enterprise", seats: 25, pricePerSeat: 129 },
    usageEvents: []
  },
  governance: {
    policies: [
      {
        id: "policy-human-approval-high-risk",
        name: "Human approval for high-risk agent tasks",
        enabled: true,
        when: "riskScore >= 0.7",
        action: "require_approval"
      }
    ],
    approvals: [],
    auditLog: []
  }
});

const state = {
  tenants: {},
  tenantDirectory: {}
};

export function getTenantState(tenantId) {
  if (!state.tenantDirectory[tenantId]) {
    state.tenantDirectory[tenantId] = {
      tenantId,
      name: tenantId,
      createdAt: now(),
      status: "active"
    };
  }
  if (!state.tenants[tenantId]) {
    state.tenants[tenantId] = baseTenantState();
  }
  return state.tenants[tenantId];
}

export function upsertTenant(tenantId, input = {}) {
  const existing = state.tenantDirectory[tenantId];
  const record = {
    tenantId,
    name: input.name || existing?.name || tenantId,
    status: input.status || existing?.status || "active",
    createdAt: existing?.createdAt || now(),
    updatedAt: now()
  };
  state.tenantDirectory[tenantId] = record;
  if (!state.tenants[tenantId]) {
    state.tenants[tenantId] = baseTenantState();
  }
  return record;
}

export function listTenantMetadata() {
  return Object.values(state.tenantDirectory);
}

export function addAuditEntry(tenantId, { actorId, actorRole, action, module, resourceId, payload }) {
  const tenant = getTenantState(tenantId);
  tenant.governance.auditLog.unshift({
    id: uuidv4(),
    at: now(),
    actorId,
    actorRole,
    action,
    module,
    resourceId,
    payload
  });
}

export function listTenants() {
  return Object.keys(state.tenants);
}
