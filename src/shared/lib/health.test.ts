import { describe, expect, it } from "vitest";

import { APP_METADATA } from "@/shared/config/app-metadata";
import { buildHealthPayload } from "@/shared/lib/health";

describe("buildHealthPayload", () => {
  it("returns the documented health shape", () => {
    const payload = buildHealthPayload();

    expect(payload.status).toBe("ok");
    expect(payload.service).toBe("one-burger-commerce");
    expect(payload.version).toBe(APP_METADATA.version);
    expect(Number.isNaN(Date.parse(payload.timestamp))).toBe(false);
  });
});

