if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  const { useAzureMonitor: initializeAzureMonitor } = await import(
    "@azure/monitor-opentelemetry"
  );
  initializeAzureMonitor({
    azureMonitorExporterOptions: {
      connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
    },
  });
}

await import("./worker");

export {};