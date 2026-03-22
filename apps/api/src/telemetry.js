import { config } from "./config.js";

if (config.telemetry.enabled) {
  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  const { getNodeAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-node");
  const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");

  const sdk = new NodeSDK({
    serviceName: config.telemetry.serviceName,
    traceExporter: new OTLPTraceExporter({
      url: config.telemetry.endpoint
    }),
    instrumentations: [getNodeAutoInstrumentations()]
  });

  sdk.start();

  process.on("SIGTERM", async () => {
    await sdk.shutdown();
  });
}
