import { NextResponse } from "next/server";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import { buildHealthPayload } from "@/shared/lib/health";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const startedAt = Date.now();

  try {
    await getPrismaClient().$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        ...buildHealthPayload(),
        status: "ready",
        checks: {
          database: {
            status: "ok",
            latencyMs: Date.now() - startedAt,
          },
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        ...buildHealthPayload(),
        status: "unavailable",
        checks: {
          database: {
            status: "error",
          },
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
        status: 503,
      },
    );
  }
}
