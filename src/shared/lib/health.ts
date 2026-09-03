import { APP_METADATA } from "@/shared/config/app-metadata";

export function buildHealthPayload() {
  return {
    status: "ok" as const,
    service: APP_METADATA.serviceName,
    timestamp: new Date().toISOString(),
    version: APP_METADATA.version,
  };
}

