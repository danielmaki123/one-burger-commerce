import { describe, expect, it } from "vitest";

import { InMemoryCashConfigRepository } from "@/modules/cash-config/adapters/in-memory-cash-config-repository";
import type { PosTerminalRecord } from "@/modules/cash-config/domain/cash-config.types";

import { saveCashTerminals } from "./save-cash-terminals";

/**
 * Fase 6 del rediseño de Caja (2026-09-23) — guardar las terminales de una sucursal.
 *
 * Lo que fijan estos casos: la etiqueta es única dentro de la sucursal (dos «Caja 1» no se distinguen), no
 * se acepta una terminal sin nombre, y una terminal que sale de la lista queda **apagada** (no borrada): un
 * turno viejo la referencia.
 */

const terminal = (overrides: Partial<PosTerminalRecord> = {}): PosTerminalRecord => ({
  id: "term_caja_1",
  locationId: "loc_principal",
  label: "Caja 1",
  isActive: true,
  sortOrder: 0,
  ...overrides,
});

describe("saveCashTerminals", () => {
  it("guarda las terminales de la sucursal con su etiqueta normalizada y su estado", async () => {
    const repository = new InMemoryCashConfigRepository();

    const { terminals } = await saveCashTerminals(
      {
        locationId: "loc_principal",
        terminals: [
          { id: "term_caja_1", label: "  Caja 1  ", isActive: true, sortOrder: 0 },
          { id: "term_barra", label: "Barra", isActive: true, sortOrder: 1 },
        ],
      },
      { repository },
    );

    expect(terminals).toEqual([
      terminal(),
      terminal({ id: "term_barra", label: "Barra", sortOrder: 1 }),
    ]);
  });

  it("rechaza dos terminales con la misma etiqueta en la sucursal", async () => {
    // El índice único de la base lo rechazaría con un error de servidor; acá se dice con palabras.
    const repository = new InMemoryCashConfigRepository();

    await expect(
      saveCashTerminals(
        {
          locationId: "loc_principal",
          terminals: [
            { id: "term_a", label: "Caja 1", isActive: true, sortOrder: 0 },
            { id: "term_b", label: "caja 1", isActive: true, sortOrder: 1 },
          ],
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      fields: { "terminals.1.label": "Ya hay una terminal con ese nombre." },
    });
  });

  it("rechaza una etiqueta vacía: una terminal sin nombre no se puede elegir", async () => {
    const repository = new InMemoryCashConfigRepository();

    await expect(
      saveCashTerminals(
        {
          locationId: "loc_principal",
          terminals: [{ id: "term_a", label: "   ", isActive: true, sortOrder: 0 }],
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      fields: { "terminals.0.label": "Escribí el nombre de la terminal." },
    });
  });

  it("una terminal que sale de la lista queda apagada, no borrada", async () => {
    const repository = new InMemoryCashConfigRepository();
    repository.posTerminals = [
      terminal(),
      terminal({ id: "term_barra", label: "Barra", sortOrder: 1 }),
    ];

    const { terminals } = await saveCashTerminals(
      {
        locationId: "loc_principal",
        terminals: [{ id: "term_caja_1", label: "Caja 1", isActive: true, sortOrder: 0 }],
      },
      { repository },
    );

    expect(terminals.find((row) => row.id === "term_barra")?.isActive).toBe(false);
    // Y sigue estando: el historial de turnos la referencia.
    expect(terminals).toHaveLength(2);
  });
});
