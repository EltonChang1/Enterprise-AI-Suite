# Enterprise AI Suite

Multi-tenant platform combining CRM, analytics, autonomous agents, workflow automation, billing, and governance in a single architecture.

This version includes enterprise-grade capabilities:

- Postgres persistence for CRM domain data
- Knex migrations for schema versioning
- Redis cache and BullMQ queueing
- Queue worker service for asynchronous task execution
- JWT + OIDC authentication modes
- Stripe checkout and webhook billing integration
- OpenTelemetry distributed tracing support
- Docker Compose for local infrastructure
- Kubernetes deployment manifests

## Modules

- **CRM**: contacts and accounts per tenant
- **Analytics**: live KPI aggregation by tenant
- **Autonomous Agents**: task planning/execution with confidence and approval gates
- **Workflow Automation**: workflow definitions, triggers, and executions
- **Billing**: subscriptions, usage records, and invoice simulation
- **Governance**: policy engine, approvals, RBAC hooks, and immutable audit log stream

## Architecture

- `apps/api`: Node.js API (Express), multi-tenant core and business modules
- `apps/web`: React admin shell for tenant operations
- `apps/worker`: BullMQ queue consumer for async jobs
- `packages/shared`: shared constants, utility helpers

## Quick Start

```bash
cd Enterprise-AI-Suite
npm install
npm run dev:api
npm run dev:worker
# new terminal
npm run dev:web
```

API default: `http://localhost:4100`

## Infrastructure-backed Local Dev

```bash
docker compose up -d postgres redis otel
npm run dev:api
npm run dev:worker
npm run dev:web
```

Observability UI: `http://localhost:16686`

## Tenant Usage

Send headers with each request:

- `x-tenant-id`: tenant slug (example: `acme-corp`)
- `x-user-id`: user ID (example: `u_admin`)
- `x-user-role`: `admin | analyst | operator | approver`

## Key Endpoints

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/oidc/exchange`
- `GET/POST /api/tenants`
- `GET/POST /api/crm/contacts`
- `GET /api/analytics/dashboard`
- `GET/POST /api/agents/tasks`
- `GET/POST /api/workflows`
- `GET /api/workflows/runs`
- `POST /api/workflows/:id/execute`
- `GET/POST /api/billing/usage`
- `GET /api/billing/invoice`
- `POST /api/billing/checkout`
- `POST /api/billing/webhook`
- `GET/POST /api/governance/policies`
- `GET /api/governance/policies/:id/versions` - with pagination & filtering
- `GET /api/governance/audit`
- `POST /api/governance/approvals/:id/approve`

## Environment

Use the template in `apps/api/.env.example`.

Key enterprise variables:

- `DATABASE_URL`, `REDIS_URL`
- `RUN_MIGRATIONS_ON_START`
- `AUTH_MODE`, `JWT_SECRET`, `OIDC_ISSUER_URL`, `OIDC_AUDIENCE`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `OTEL_ENABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT`

## Migrations

Run migrations manually:

```bash
npm run migrate:latest -w apps/api
```

Rollback last migration batch:

```bash
npm run migrate:rollback -w apps/api
```

With `RUN_MIGRATIONS_ON_START=true`, the API automatically applies pending migrations during startup.

Current migrations:

- `202603220001_initial_enterprise_schema.js`
- `202603220002_agent_tasks_billing_usage_events.js`
- `202603220003_governance_approvals_audit_logs.js`
- `202603220004_governance_policies.js`
- `202603220005_governance_policy_versions.js`

Durable tables now include:

- `agent_tasks`
- `billing_usage_events`
- `workflow_definitions`
- `workflow_runs`
- `crm_contacts`
- `governance_approvals`
- `governance_audit_logs`
- `governance_policies`
- `governance_policy_versions`

### Policy Versions Endpoint

The `GET /api/governance/policies/:id/versions` endpoint supports pagination and filtering for efficient audit query at scale:

**Query Parameters:**

- `limit` (integer, default: 50, max: 500) - Number of versions per page
- `offset` (integer, default: 0) - Pagination offset
- `changedBy` (string, optional) - Filter by actor email (e.g., `admin@acme.com`)
- `startDate` (ISO 8601 string, optional) - Filter versions changed on/after this date
- `endDate` (ISO 8601 string, optional) - Filter versions changed on/before this date

**Examples:**

```bash
# Get latest 20 versions
GET /api/governance/policies/policy-retention/versions?limit=20

# Get second page (offset-based pagination)
GET /api/governance/policies/policy-retention/versions?limit=50&offset=50

# Filter by actor
GET /api/governance/policies/policy-retention/versions?changedBy=admin@acme.com&limit=100

# Filter by date range
GET /api/governance/policies/policy-retention/versions?startDate=2026-03-01T00:00:00Z&endDate=2026-03-22T23:59:59Z

# Combined filters
GET /api/governance/policies/policy-retention/versions?limit=25&offset=0&changedBy=admin@acme.com&startDate=2026-03-01T00:00:00Z
```

**Response:**

```json
{
  "data": [
    {
      "policyId": "policy-retention",
      "versionNo": 3,
      "name": "Data Retention",
      "enabled": true,
      "when": "eventAgeDays > 400",
      "action": "archive",
      "changedBy": "admin@acme.com",
      "changeReason": "updated retention threshold",
      "changedAt": "2026-03-22T04:37:19.461Z"
    },
    ...
  ],
  "pagination": {
    "total": 25,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

**Notes:**

- Pagination uses offset-based cursor approach; `hasMore` indicates whether additional pages exist
- Both DB and in-memory fallback support all filters
- Invalid dates return 400 error with descriptive message
- Date parameters must be in ISO 8601 format

## Kubernetes

Base manifests are in `deploy/k8s`:

- `namespace.yaml`
- `configmap.yaml`
- `secret.example.yaml`
- `api.yaml`
- `worker.yaml`
- `web.yaml`

Apply with:

```bash
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s/configmap.yaml
kubectl apply -f deploy/k8s/secret.example.yaml
kubectl apply -f deploy/k8s/api.yaml
kubectl apply -f deploy/k8s/worker.yaml
kubectl apply -f deploy/k8s/web.yaml
```

## CI/CD Pipeline

- CI workflow: `.github/workflows/ci.yml`
	- install, web build, API/worker syntax validation
- Deploy workflow: `.github/workflows/deploy.yml`
	- build/push API, worker, web images to GHCR
	- apply manifests and roll out on Kubernetes when `KUBE_CONFIG_DATA` secret is set

Required GitHub repository secrets for deployment:

- `KUBE_CONFIG_DATA` (base64 kubeconfig)

## Notes

- CRM contacts are persisted in Postgres when `DATABASE_URL` is set; fallback is in-memory for no-infra local dev.
- Analytics dashboard uses Redis caching when available.
- Agent/workflow jobs are enqueued to BullMQ when Redis is available.
