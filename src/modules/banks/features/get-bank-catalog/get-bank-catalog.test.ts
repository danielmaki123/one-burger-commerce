import { describe, expect, it } from "vitest";

import { InMemoryBankRepository } from "@/modules/banks/adapters/in-memory-bank-repository";
import type { BankRecord, LocationBankRecord } from "@/modules/banks/domain/bank.types";

import { getBankCatalog } from "./get-bank-catalog";

const bankBac: BankRecord = {
  id: "bank_bac",
  name: "BAC Credomatic",
  code: "BAC",
  isActive: true,
  sortOrder: 0,
};
const bankBanpro: BankRecord = {
  id: "bank_banpro",
  name: "Banpro",
  code: null,
  isActive: true,
  sortOrder: 1,
};
const assignments: LocationBankRecord[] = [
  { locationId: "loc_principal", bankId: "bank_bac", isActive: true, sortOrder: 0 },
  { locationId: "loc_masaya", bankId: "bank_bac", isActive: true, sortOrder: 0 },
];

describe("getBankCatalog", () => {
  it("devuelve los bancos con las sucursales donde liquidan", async () => {
    const repository = new InMemoryBankRepository({ banks: [bankBac, bankBanpro], assignments });

    const { banks } = await getBankCatalog({ repository });

    expect(banks).toEqual([
      { ...bankBac, locationIds: ["loc_principal", "loc_masaya"] },
      { ...bankBanpro, locationIds: [] },
    ]);
  });

  it("sin catálogo cargado devuelve la lista vacía (el cierre no inventa bancos)", async () => {
    const { banks } = await getBankCatalog({ repository: new InMemoryBankRepository() });

    expect(banks).toEqual([]);
  });
});
