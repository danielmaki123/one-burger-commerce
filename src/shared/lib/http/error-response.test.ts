import { PrismaClientInitializationError } from "@prisma/client/runtime/library";
import { describe, expect, it } from "vitest";

import { LocationError } from "@/modules/locations/domain/location-errors";
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

  it("un error de dominio de locales llega con su estado y sus campos (T8)", async () => {
    // Sin este mapeo, un LocationError saldría como 500 "Unexpected server error" y el
    // formulario del admin no podría marcar el campo que falló.
    const response = createErrorResponse(
      new LocationError(422, "VALIDATION_ERROR", "Invalid payload", {
        slug: "Ya hay un local con el identificador norte",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fields.slug).toContain("norte");
  });
});
