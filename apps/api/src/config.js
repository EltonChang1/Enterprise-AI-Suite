export const config = {
  port: Number(process.env.PORT || 4100),
  environment: process.env.NODE_ENV || "development",
  defaultTenant: process.env.DEFAULT_TENANT || "demo-enterprise",
  auth: {
    mode: process.env.AUTH_MODE || "hybrid",
    jwtSecret: process.env.JWT_SECRET || "local-dev-secret",
    jwtIssuer: process.env.JWT_ISSUER || "enterprise-ai-suite",
    jwtAudience: process.env.JWT_AUDIENCE || "enterprise-api",
    tokenTtl: process.env.JWT_TTL || "8h",
    oidcIssuerUrl: process.env.OIDC_ISSUER_URL || "",
    oidcAudience: process.env.OIDC_AUDIENCE || ""
  },
  postgres: {
    connectionString: process.env.DATABASE_URL || "",
    ssl: process.env.PG_SSL === "true",
    runMigrationsOnStart: process.env.RUN_MIGRATIONS_ON_START === "true"
  },
  redis: {
    url: process.env.REDIS_URL || ""
  },
  queue: {
    name: process.env.JOBS_QUEUE_NAME || "enterprise-jobs"
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    successUrl: process.env.STRIPE_SUCCESS_URL || "http://localhost:5178/billing/success",
    cancelUrl: process.env.STRIPE_CANCEL_URL || "http://localhost:5178/billing/cancel"
  },
  telemetry: {
    enabled: process.env.OTEL_ENABLED !== "false",
    serviceName: process.env.OTEL_SERVICE_NAME || "enterprise-ai-suite-api",
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318/v1/traces"
  }
};
