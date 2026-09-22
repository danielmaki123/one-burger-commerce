import { describe, expect, it } from "vitest";

import { InMemoryBankRepository } from "@/modules/banks/adapters/in-memory-bank-repository";
import type { BankRecord, LocationBankRecord } from "@/modules/banks/domain/bank.types";

import { saveBankCatalog } from "./save-bank-catalog";

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

describe("saveBankCatalog", () => {
  it("guarda un banco nuevo, le da id, lo normaliza y lo asigna a su sucursal", async () => {
    const repository = new InMemoryBankRepository();

    const { banks } = await saveBankCatalog(
      {
        banks: [
          {
            id: "",
            name: "  BAC Credomatic ",
            code: " bac ",
            isActive: true,
            sortOrder: 0,
            locationIds: ["loc_principal", " loc_principal "],
          },
        ],
      },
      { repository },
    );

    expect(banks).toHaveLength(1);
    expect(banks[0]?.id).toMatch(/^bank_/);
    expect(banks[0]?.name).toBe("BAC Credomatic");
    expect(banks[0]?.code).toBe("BAC");
    expect(banks[0]?.locationIds).toEqual(["loc_principal"]);
  });

  it("rechaza dos bancos con el mismo nombre antes de tocar la base", async () => {
    const repository = new InMemoryBankRepository();

    await expect(
      saveBankCatalog(
        {
          banks: [
            { id: "", name: "BAC", code: null, isActive: true, sortOrder: 0, locationIds: [] },
            { id: "", name: "bac", code: null, isActive: true, sortOrder: 1, locationIds: [] },
          ],
        },
        { repository },
      ),
    ).rejects.toThrow(/Revisá el catálogo/);
  });

  it("el error trae la fila y el campo, para poder señalarlos en el formulario", async () => {
    const repository = new InMemoryBankRepository();

    await expect(
      saveBankCatalog(
        {
          banks: [
            { id: "", name: "  ", code: null, isActive: true, sortOrder: 0, locationIds: [] },
          ],
        },
        { repository },
      ),
    ).rejects.toMatchObject({ fields: { "banks.0.name": "Escribí el nombre del banco." } });
  });

  it("quitar un banco del catálogo lo apaga y le quita la sucursal (no lo borra)", async () => {
    const repository = new InMemoryBankRepository({ banks: [bankBac, bankBanpro], assignments });

    const { banks } = await saveBankCatalog(
      {
        banks: [
          {
            id: "bank_banpro",
            name: "Banpro",
            code: null,
            isActive: true,
            sortOrder: 0,
            locationIds: ["loc_principal"],
          },
        ],
      },
      { repository },
    );

    const bac = banks.find((bank) => bank.id === "bank_bac");

    expect(bac?.isActive).toBe(false);
    expect(bac?.locationIds).toEqual([]);
    expect(banks.find((bank) => bank.id === "bank_banpro")?.locationIds).toEqual(["loc_principal"]);
  });

  it("deja el catálogo vacío si el owner borra todo (la base no se queda con bancos fantasma)", async () => {
    const repository = new InMemoryBankRepository({ banks: [bankBac], assignments });

    const { banks } = await saveBankCatalog({ banks: [] }, { repository });

    expect(banks.find((bank) => bank.id === "bank_bac")?.isActive).toBe(false);
  });
});
