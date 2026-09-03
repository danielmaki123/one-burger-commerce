import { PrismaClientInitializationError } from "@prisma/client/runtime/library";
import { describe, expect, it } from "vitest";

import { createErrorResponse } from "@/shared/lib/http/error-response";

describe("createErrorResponse", () => {
  it("returns 503 for Prisma initialization failures", async () => {
    const response = createErrorResponse(
      new PrismaClientInitializationError("db unavailable", "0.0.0"),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
  });
});
