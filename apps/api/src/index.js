import "./telemetry.js";
import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { authenticateRequest } from "./middleware/auth.js";
import { withRequestContext } from "./middleware/context.js";
import { authRouter } from "./routes/auth.js";
import { crmRouter } from "./routes/crm.js";
import { analyticsRouter } from "./routes/analytics.js";
import { agentsRouter } from "./routes/agents.js";
import { workflowsRouter } from "./routes/workflows.js";
import { billingRouter } from "./routes/billing.js";
import { governanceRouter } from "./routes/governance.js";
import { tenantsRouter } from "./routes/tenants.js";
import { listTenants } from "./store.js";
import { initPostgres } from "./lib/postgres.js";
import { initRedis } from "./lib/redis.js";
import { initQueue } from "./lib/queue.js";
import { runMigrations } from "./lib/migrations.js";

const app = express();

app.use(cors());
app.use(authenticateRequest);
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "1mb" }));
app.use(withRequestContext);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "enterprise-ai-suite-api",
    environment: config.environment,
    tenants: listTenants()
  });
});

app.use("/api/auth", authRouter);
app.use("/api/crm", crmRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/workflows", workflowsRouter);
app.use("/api/billing", billingRouter);
app.use("/api/governance", governanceRouter);
app.use("/api/tenants", tenantsRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

async function bootstrap() {
  try {
    if (config.postgres.runMigrationsOnStart) {
      const migrationResult = await runMigrations();
      if (migrationResult.ran) {
        console.log(`[bootstrap] migrations applied batch=${migrationResult.batchNo} files=${migrationResult.log.length}`);
      } else {
        console.log(`[bootstrap] migrations skipped: ${migrationResult.reason}`);
      }
    }

    await initPostgres();
  } catch (error) {
    console.warn("[bootstrap] postgres unavailable, falling back to in-memory store", error.message);
  }

  try {
    initRedis();
    initQueue();
  } catch (error) {
    console.warn("[bootstrap] redis/queue unavailable, async jobs disabled", error.message);
  }

  app.listen(config.port, () => {
    console.log(`Enterprise AI Suite API running on http://localhost:${config.port}`);
  });
}

bootstrap();
