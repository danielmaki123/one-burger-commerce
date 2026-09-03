import { NextResponse } from "next/server";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import { sortTablesNaturally } from "@/modules/tables/lib/casa-antigua-table-bootstrap";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const prisma = getPrismaClient();
    const tables = await prisma.table.findMany({
      where: { isActive: true },
      select: { id: true, label: true, capacity: true, locationId: true },
      orderBy: [{ label: "asc" }],
    });

    return NextResponse.json(
      {
        data: sortTablesNaturally(tables),
        meta: { total: tables.length },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}

