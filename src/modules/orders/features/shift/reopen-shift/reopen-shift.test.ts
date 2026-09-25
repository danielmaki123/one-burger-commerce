import { describe, expect, it } from "vitest";

import {
  createInMemoryLocation,
  InMemoryLocationRepository,
} from "@/modules/locations/adapters/in-memory-location-repository";
import { InMemoryPaymentRepository } from "@/modules/orders/adapters/in-memory-payment-repository";
import { InMemoryShiftRepository } from "@/modules/orders/adapters/in-memory-shift-repository";
import { runInMemoryShiftTransaction } from "@/shared/testing/in-memory-shift-transaction";

import { closeShift } from "../close-shift";
import { openShift } from "../open-shift";
import { reopenShift } from "./reopen-shift";

/**
 * Bloque 1.10 del roadmap del POS (Fase 2) — reabrir un turno cerrado.
 *
 * El cierre no se pisa a propósito (dos terminales no pueden firmar dos arqueos del mismo turno),
 * pero eso dejaba sin salida el caso real: se cerró con el conteo mal y hay que volver a contar. La
 * reapertura **firma** quién, cuándo y por qué, y no borra la promesa anterior: el próximo cierre
 * vuelve a calcular el esperado y reemplaza el conteo.
 */
function buildDeps() {
  const shiftRepository = new InMemoryShiftRepository();
  const paymentRepository = new InMemoryPaymentRepository();

  return {
    shiftRepository,
    paymentRepository,
    locationRepository: new InMemoryLocationRepository([
      createInMemoryLocation({ id: "loc_principal", name: "Principal" }),
    ]),
    businessCurrencyCode: "NIO",
    usdExchangeRate: 36.5,
    // TASK-AUD-005: el cierre (que la reapertura usa para dejar un turno cerrado) corre en su unidad de
    // trabajo; el doble la resuelve en memoria.
    runInShiftTransaction: runInMemoryShiftTransaction({ shiftRepository, paymentRepository }),
  };
}

async function openAndClose(deps: ReturnType<typeof buildDeps>) {
  const opened = await openShift(
    { locationId: "loc_principal", userId: "user_01", openingAmount: 500 },
    deps,
  );
  await closeShift({ shiftId: opened.data.id, closingAmount: 500 }, deps);

  return opened.data.id;
}

describe("reopenShift", () => {
  it("reabre un turno cerrado firmando quién, cuándo y por qué", async () => {
    const deps = buildDeps();
    const shiftId = await openAndClose(deps);

    const result = await reopenShift(
      { shiftId, userId: "user_manager", reason: "Conté mal los billetes de C$500." },
      deps,
    );

    expect(result.data?.status).toBe("open");
    expect(result.data?.closedAt).toBeNull();
    expect(result.data?.reopenedByUserId).toBe("user_manager");
    expect(result.data?.reopenReason).toBe("Conté mal los billetes de C$500.");
    expect(result.data?.reopenedAt).toBeTruthy();

    // Y queda abierto de verdad: se puede volver a cerrar.
    const reclosed = await closeShift({ shiftId, closingAmount: 640 }, deps);
    expect(reclosed.data?.status).toBe("closed");
    expect(reclosed.data?.closingAmount).toBe(640);
  });

  it("exige el motivo: una reapertura sin razón escrita no se puede auditar", async () => {
    const deps = buildDeps();
    const shiftId = await openAndClose(deps);

    await expect(
      reopenShift({ shiftId, userId: "user_manager", reason: "   " }, deps),
    ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("no reabre un turno que ya está abierto ni uno que no existe", async () => {
    const deps = buildDeps();
    const opened = await openShift({ locationId: "loc_principal", userId: "user_01" }, deps);

    expect(
      (
        await reopenShift(
          { shiftId: opened.data.id, userId: "user_manager", reason: "motivo" },
          deps,
        )
      ).data,
    ).toBeNull();
    expect(
      (
        await reopenShift(
          { shiftId: "no-existe", userId: "user_manager", reason: "motivo" },
          deps,
        )
      ).data,
    ).toBeNull();
  });

  it("no se puede reabrir si otra caja del local ya está abierta", async () => {
    const deps = buildDeps();
    const shiftId = await openAndClose(deps);
    // Otra terminal abrió la caja del mismo local: reabrir dejaría dos turnos abiertos.
    await openShift({ locationId: "loc_principal", userId: "user_02" }, deps);

    await expect(
      reopenShift({ shiftId, userId: "user_manager", reason: "motivo" }, deps),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });
});
