import { useAzureMonitor as initializeAzureMonitor } from "@azure/monitor-opentelemetry";

export function registerAzureMonitor() {
  initializeAzureMonitor({
    azureMonitorExporterOptions: {
      connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
    },
  });
}