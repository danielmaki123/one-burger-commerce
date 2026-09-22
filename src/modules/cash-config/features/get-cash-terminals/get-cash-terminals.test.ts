import { describe, expect, it } from "vitest";

import { InMemoryCashConfigRepository } from "@/modules/cash-config/adapters/in-memory-cash-config-repository";
import type { PosTerminalRecord } from "@/modules/cash-config/domain/cash-config.types";

import { getCashTerminals } from "./get-cash-terminals";

/**
 * Fase 6 del rediseño de Caja (2026-09-23) — las **terminales del POS** de cada sucursal.
 */

const terminal = (overrides: Partial<PosTerminalRecord> = {}): PosTerminalRecord => ({
  id: "term_caja_1",
  locationId: "loc_principal",
  label: "Caja 1",
  isActive: true,
  sortOrder: 0,
  ...overrides,
});

describe("getCashTerminals", () => {
  it("devuelve las terminales de las sucursales pedidas, apagadas incluidas y en orden", async () => {
    const repository = new InMemoryCashConfigRepository();
    repository.posTerminals = [
      terminal(),
      terminal({ id: "term_barra", label: "Barra", sortOrder: 1 }),
      terminal({ id: "term_vieja", label: "Caja 2", isActive: false, sortOrder: 2 }),
      terminal({ id: "term_otra", locationId: "loc_masaya", label: "Caja 1" }),
    ];

    const { terminals } = await getCashTerminals({ locationIds: ["loc_principal"] }, { repository });

    expect(terminals.map((row) => row.id)).toEqual(["term_caja_1", "term_barra", "term_vieja"]);
  });

  it("una sucursal sin terminales devuelve la lista vacía (no inventa una «Caja 1»)", async () => {
    const repository = new InMemoryCashConfigRepository();

    const { terminals } = await getCashTerminals({ locationIds: ["loc_norte"] }, { repository });

    expect(terminals).toEqual([]);
  });
});
