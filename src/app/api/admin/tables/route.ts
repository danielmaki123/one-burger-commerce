import { NextResponse } from "next/server";
import { z } from "zod";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import { canManageCriticalConfig } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { sortTablesNaturally } from "@/modules/tables/lib/casa-antigua-table-bootstrap";
import { createErrorResponse } from "@/shared/lib/http/error-response";

const createTableSchema = z.object({
  label: z.string().trim().min(1).max(80),
  capacity: z.number().int().min(1).max(100),
  locationId: z.string().trim().min(1).max(80).optional(),
  isActive: z.boolean().optional(),
});

function toQrToken(label: string): string {
  const base = label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "table"}-${suffix}`;
}

export async function GET() {
  try {
    await requireAdminSession();

    const prisma = getPrismaClient();
    const tables = await prisma.table.findMany({
      orderBy: [{ label: "asc" }],
      select: {
        id: true,
        label: true,
        isActive: true,
        capacity: true,
        locationId: true,
        qrToken: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      data: sortTablesNaturally(tables),
      meta: { total: tables.length },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    if (!canManageCriticalConfig(session.user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 },
      );
    }

    const payload = await request.json().catch(() => ({}));
    const parsed = createTableSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Invalid payload",
            fields: Object.fromEntries(
              Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [
                k,
                Array.isArray(v) ? v[0] : String(v),
              ]),
            ),
          },
        },
        { status: 400 },
      );
    }

    const prisma = getPrismaClient();

    // Retry a few times in case qrToken collides on unique index.
    let lastError: unknown = null;
    for (let i = 0; i < 5; i += 1) {
      try {
        const created = await prisma.table.create({
          data: {
            label: parsed.data.label,
            capacity: parsed.data.capacity,
            locationId: parsed.data.locationId ?? "main",
            isActive: parsed.data.isActive ?? true,
            qrToken: toQrToken(parsed.data.label),
          },
          select: {
            id: true,
            label: true,
            isActive: true,
            capacity: true,
            locationId: true,
            qrToken: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return NextResponse.json({ data: created }, { status: 201 });
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Failed to create table");
  } catch (error) {
    return createErrorResponse(error);
  }
}

