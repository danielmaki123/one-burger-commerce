import { describe, expect, it } from "vitest";

import {
  derivePosPaymentMethod,
  listPosPaymentMethodOptions,
  type PosPaymentMethodOption,
} from "@/modules/pos/domain/pos-payment-methods";
import type { PaymentMethodConfigRecord } from "@/modules/payments/domain/payment-method-availability";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §37, §38, §39, §40) — **los medios que el POS ofrece**.
 *
 * La divergencia que esto cierra: `A-85` quedó marcado `cerrado` porque el **backend** ya resolvía el medio
 * configurado (`resolveConfiguredPaymentMethod` dentro de `buildSalePaymentSnapshots`), pero la UI seguía
 * armando las opciones con la constante `POS_PAYMENT_METHODS = ["cash","card","transfer","other"]` y
 * decidía la referencia con `payment.method === "transfer"`. El POS visible **no** consumía
 * `PaymentMethodConfig`: el dueño podía configurar «Tarjeta BAC», «Zelle» o «Transferencia Banpro» y el
 * cajero seguía viendo cuatro botones genéricos.
 *
 * Estas funciones son la lista que la pantalla dibuja: el medio **configurado**, habilitado para **ese**
 * local, con su `requiresReference` y sus monedas. Nada se decide por el nombre ni por el `kind`.
 */

function method(overrides: Partial<PaymentMethodConfigRecord> = {}): PaymentMethodConfigRecord {
  return {
    id: "pm_1",
    name: "Efectivo",
    kind: "cash",
    entityId: null,
    currencyCodes: [],
    requiresReference: false,
    isActive: true,
    locations: [],
    ...overrides,
  };
}

describe("pos-payment-methods · la lista sale del catálogo configurado", () => {
  it("ofrece los medios configurados y habilitados para el local, en el orden del catálogo", () => {
    const options = listPosPaymentMethodOptions({
      locationId: "loc_centro",
      catalog: [
        method({ id: "pm_cash", name: "Efectivo", kind: "cash" }),
        method({ id: "pm_bac", name: "Tarjeta BAC", kind: "card", entityId: "bank_bac" }),
        method({ id: "pm_lafise", name: "Tarjeta Lafise", kind: "card", entityId: "bank_lafise" }),
        method({
          id: "pm_banpro",
          name: "Transferencia Banpro",
          kind: "bank_transfer",
          requiresReference: true,
        }),
        method({ id: "pm_zelle", name: "Zelle", kind: "wallet", requiresReference: true }),
      ],
    });

    expect(options.map((option) => option.id)).toEqual([
      "pm_cash",
      "pm_bac",
      "pm_lafise",
      "pm_banpro",
      "pm_zelle",
    ]);
    expect(options.map((option) => option.label)).toEqual([
      "Efectivo",
      "Tarjeta BAC",
      "Tarjeta Lafise",
      "Transferencia Banpro",
      "Zelle",
    ]);
  });

  it("un medio apagado en Finanzas no se ofrece", () => {
    const options = listPosPaymentMethodOptions({
      locationId: "loc_centro",
      catalog: [
        method({ id: "pm_cash", name: "Efectivo" }),
        method({ id: "pm_viejo", name: "Tarjeta vieja", isActive: false }),
      ],
    });

    expect(options.map((option) => option.id)).toEqual(["pm_cash"]);
  });

  it("un medio que no se ofrece en esta sucursal no se ofrece", () => {
    const options = listPosPaymentMethodOptions({
      locationId: "loc_centro",
      catalog: [
        method({ id: "pm_cash", name: "Efectivo" }),
        method({
          id: "pm_solo_norte",
          name: "Zelle",
          kind: "wallet",
          locations: [{ locationId: "loc_norte", isActive: true }],
        }),
        method({
          id: "pm_apagado_aqui",
          name: "Transferencia",
          kind: "bank_transfer",
          locations: [
            { locationId: "loc_centro", isActive: false },
            { locationId: "loc_norte", isActive: true },
          ],
        }),
      ],
    });

    expect(options.map((option) => option.id)).toEqual(["pm_cash"]);
  });

  it("un medio con monedas declaradas dice cuáles admite; sin monedas admite todas", () => {
    const options = listPosPaymentMethodOptions({
      locationId: "loc_centro",
      catalog: [
        method({ id: "pm_cash", name: "Efectivo", currencyCodes: [] }),
        method({ id: "pm_zelle", name: "Zelle", kind: "wallet", currencyCodes: ["USD"] }),
      ],
    });

    // `[]` significa «todas»: es el default de la configuración y la pantalla no tiene que inventar nada.
    expect(options[0].currencyCodes).toEqual([]);
    expect(options[1].currencyCodes).toEqual(["USD"]);
  });

  it("`requiresReference` viaja con la opción: la UI no lo deduce del `kind`", () => {
    const options = listPosPaymentMethodOptions({
      locationId: "loc_centro",
      catalog: [
        // Zelle es `wallet` y **pide** referencia.
        method({ id: "pm_zelle", name: "Zelle", kind: "wallet", requiresReference: true }),
        // Una transferencia puede **no** pedirla: la regla es del medio, no del tipo.
        method({ id: "pm_libre", name: "Transferencia libre", kind: "bank_transfer" }),
      ],
    });

    expect(options.find((option) => option.id === "pm_zelle")?.requiresReference).toBe(true);
    expect(options.find((option) => option.id === "pm_libre")?.requiresReference).toBe(false);
  });

  it("sin catálogo configurado no hay opciones (la pantalla lo dice, no inventa medios)", () => {
    expect(listPosPaymentMethodOptions({ locationId: "loc_centro", catalog: [] })).toEqual([]);
  });
});

describe("pos-payment-methods · el enum histórico se deriva del `kind`", () => {
  it("cada tipo canónico tiene su equivalente histórico", () => {
    // El servidor resuelve el `kind` desde el `paymentMethodId`; la pantalla sólo necesita un valor para el
    // contrato del payload, y este es el mismo mapeo que ya aplica `paymentMethodKindFor` al revés.
    expect(derivePosPaymentMethod("cash")).toBe("cash");
    expect(derivePosPaymentMethod("card")).toBe("card");
    expect(derivePosPaymentMethod("bank_transfer")).toBe("transfer");
    expect(derivePosPaymentMethod("wallet")).toBe("other");
    expect(derivePosPaymentMethod("other")).toBe("other");
  });
});

describe("pos-payment-methods · una opción es lo que la pantalla necesita", () => {
  it("la opción lleva id, label, tipo, referencia y monedas, y nada más", () => {
    const options: PosPaymentMethodOption[] = listPosPaymentMethodOptions({
      locationId: "loc_centro",
      catalog: [method({ id: "pm_bac", name: "Tarjeta BAC", kind: "card", entityId: "bank_bac" })],
    });

    expect(Object.keys(options[0]).sort()).toEqual(
      ["currencyCodes", "id", "kind", "label", "method", "requiresReference"].sort(),
    );
  });
});
