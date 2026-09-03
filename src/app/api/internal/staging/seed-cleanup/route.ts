import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { runStagingSeedCleanup } from "../../../../../../scripts/staging-seed-core";

function tokenMatches(expected: string, provided: string) {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function assertEndpointGuards(request: Request) {
  if (process.env.APP_ENV !== "staging") {
    throw new Error("STAGING_ONLY_ENDPOINT");
  }

  const expectedToken = process.env.STAGING_SEED_RUN_TOKEN;
  const provided = request.headers.get("x-staging-seed-token");
  if (!expectedToken || !provided || !tokenMatches(expectedToken, provided)) {
    throw new Error("STAGING_SEED_AUTH_INVALID");
  }
}

function mapError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "STAGING_ONLY_ENDPOINT") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Staging only endpoint" } },
        { status: 403 },
      );
    }
    if (error.message === "STAGING_SEED_AUTH_INVALID") {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 },
      );
    }
  }

  console.error(
    "[internal-endpoint] Unhandled error:",
    error instanceof Error ? error.message : String(error),
  );
  return NextResponse.json(
    { error: { code: "INTERNAL_SERVER_ERROR", message: "Unexpected error" } },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  try {
    assertEndpointGuards(request);
    const result = await runStagingSeedCleanup({ source: "internal_api" });
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    return mapError(error);
  }
}
