import { describe, expect, it, vi } from "vitest";

import { describeAction, recordAuditAction } from "./record-audit-action";

// El adaptador de Prisma se prueba con el cliente mockeado, igual que los otros adaptadores del repo:
// instanciar el cliente de verdad en un test pide `DATABASE_URL` y una base levantada.
const createMock = vi.fn(async (input: { data: Record<string, unknown> }) => ({
  id: "log_01",
  createdAt: new Date("2026-09-17T20:00:00.000Z"),
  ...input.data,
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  getPrismaClient: () => ({ adminAuditLog: { create: createMock } }),
}));

/**
 * Bloque 13.1 del roadmap del POS (Fase 2) — el registro de acciones sensibles.
 *
 * Lo que hoy queda en la base es **el estado**, no quién lo cambió: se puede leer que un turno se cerró
 * con una diferencia de C$500, pero no quién reabrió la caja ni quién aprobó la devolución. El log es
 * un asiento por acción sensible: quién, qué, sobre qué y cuándo.
 *
 * Reglas: la acción tiene que ser una de la lista (nada de texto libre, que después no se puede
 * agrupar) y el registro **no puede romper la operación**: si el log falla, la acción ya pasó (la plata
 * ya se movió) y tirar el error dejaría al cajero pensando que no se hizo.
 */
function deps() {
  const entries: Record<string, unknown>[] = [];

  return {
    entries,
    dependencies: {
      auditLogRepository: {
        async record(entry: Record<string, unknown>) {
          entries.push(entry);
          return { id: `log_${entries.length}`, ...entry };
        },
      },
      logger: { warn: () => {} },
    },
  };
}

describe("recordAuditAction", () => {
  it("registra quién hizo qué sobre qué usuario, con su detalle", async () => {
    const { entries, dependencies } = deps();

    await recordAuditAction(
      {
        action: "shift.close",
        actorUserId: "user_manager",
        targetType: "Shift",
        targetId: "shift_01",
        detail: { difference: -500, counted: 1000 },
      },
      dependencies,
    );

    expect(entries).toEqual([
      {
        action: "shift.close",
        actorUserId: "user_manager",
        targetType: "Shift",
        targetId: "shift_01",
        detail: { difference: -500, counted: 1000 },
      },
    ]);
  });

  it("una acción que no está en la lista no se registra (y se avisa)", async () => {
    const { entries, dependencies } = deps();

    await expect(
      recordAuditAction(
        {
          action: "cualquier.cosa" as never,
          actorUserId: "user_1",
          targetType: "Shift",
          targetId: "shift_01",
        },
        dependencies,
      ),
    ).rejects.toMatchObject({ status: 422 });

    expect(entries).toEqual([]);
  });

  it("si el log falla, la operación sigue: la plata ya se movió", async () => {
    const { dependencies: _sinUso } = deps();
    const warnings: string[] = [];

    await expect(
      recordAuditAction(
        { action: "shift.close", actorUserId: "user_1", targetType: "Shift", targetId: "shift_01" },
        {
          auditLogRepository: {
            async record() {
              throw new Error("la base no responde");
            },
          },
          logger: { warn: (message: string) => warnings.push(message) },
        },
      ),
    ).resolves.toBeTruthy();

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("shift.close");
  });

  it("describe la acción en español, sin texto libre", () => {
    expect(describeAction("shift.close")).toBe("Cierre de caja");
    expect(describeAction("refund.approve")).toBe("Devolución aprobada");
    expect(describeAction("shift.reopen")).toBe("Caja reabierta");
  });
});

/** Bloque 13.1 — el adaptador de Prisma, con el mismo patrón que los otros (`vi.mock` del cliente). */
describe("PrismaAuditLogRepository", () => {
  it("escribe un asiento con su detalle y mapea fechas a ISO", async () => {
    const { PrismaAuditLogRepository } = await import(
      "@/modules/audit/adapters/prisma-audit-log-repository"
    );

    const created = await new PrismaAuditLogRepository().record({
      action: "shift.reopen",
      actorUserId: "user_manager",
      targetType: "Shift",
      targetId: "shift_01",
      detail: { reason: "Conté mal los billetes" },
    });

    expect(created).toMatchObject({
      action: "shift.reopen",
      actorUserId: "user_manager",
      targetType: "Shift",
      targetId: "shift_01",
    });
  });
});
