import { describe, expect, it } from "vitest";

import {
  isPaymentMethodAvailableAt,
  resolveConfiguredPaymentMethod,
  type PaymentMethodConfigRecord,
} from "./payment-method-availability";

/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-85`, `A-86`, `D-017`) — **la disponibilidad de un medio
 * de pago**.
 *
 * La referencia aprobada de Finanzas tiene «Disponibilidad: Todos los locales / Locales seleccionados», y la
 * tabla `PaymentMethodLocation` la modela. El servidor tiene que aplicar **esa** regla y no confiar en lo que
 * mande React: un `paymentMethodId` de un medio apagado, o de uno que no se ofrece en la sucursal, **no** se
 * puede cobrar aunque el payload lo traiga.
 *
 * Cuatro reglas, y ninguna se negocia:
 *
 * 1. un medio **apagado** (`isActive: false`) no se cobra en ninguna sucursal;
 * 2. **sin filas** de disponibilidad el medio se ofrece en **todas** (es el default de la tabla);
 * 3. **con** filas, sólo donde la fila está activa;
 * 4. las **monedas admitidas** del medio se respetan: una vacía lista significa «todas».
 */
describe("disponibilidad de un medio de pago en una sucursal", () => {
  function method(over: Partial<PaymentMethodConfigRecord> = {}): PaymentMethodConfigRecord {
    return {
      id: "pm_bac",
      name: "Tarjeta BAC",
      kind: "card",
      entityId: "bank_bac",
      currencyCodes: [],
      requiresReference: false,
      isActive: true,
      locations: [],
      ...over,
    };
  }

  it("sin filas de disponibilidad el medio se ofrece en todas las sucursales", () => {
    expect(isPaymentMethodAvailableAt(method(), "loc_norte")).toBe(true);
    expect(isPaymentMethodAvailableAt(method(), "loc_sur")).toBe(true);
  });

  it("con filas, sólo donde la fila está activa", () => {
    const configured = method({
      locations: [
        { locationId: "loc_norte", isActive: true },
        { locationId: "loc_sur", isActive: false },
      ],
    });

    expect(isPaymentMethodAvailableAt(configured, "loc_norte")).toBe(true);
    expect(isPaymentMethodAvailableAt(configured, "loc_sur")).toBe(false);
  });

  it("una sucursal sin fila propia queda afuera cuando el medio tiene disponibilidad declarada", () => {
    // La lista dice **dónde sí**; un local que no está en la lista no lo ofrece.
    const configured = method({ locations: [{ locationId: "loc_norte", isActive: true }] });

    expect(isPaymentMethodAvailableAt(configured, "loc_centro")).toBe(false);
  });

  it("un medio apagado no se ofrece en ninguna sucursal, ni con fila activa", () => {
    const off = method({
      isActive: false,
      locations: [{ locationId: "loc_norte", isActive: true }],
    });

    expect(isPaymentMethodAvailableAt(off, "loc_norte")).toBe(false);
  });
});

/**
 * `A-85` — **la resolución del medio que llega del cliente**.
 *
 * El servidor es el que decide el tipo canónico, la entidad y si pide referencia: el payload sólo nombra el
 * medio. Confiar en un `kind` o un `entityId` mandados por React dejaría que la pantalla elija la semántica
 * contable del hecho.
 */
describe("resolución del medio configurado", () => {
  const catalog: PaymentMethodConfigRecord[] = [
    {
      id: "pm_bac",
      name: "Tarjeta BAC",
      kind: "card",
      entityId: "bank_bac",
      currencyCodes: ["NIO", "USD"],
      requiresReference: false,
      isActive: true,
      locations: [{ locationId: "loc_norte", isActive: true }],
    },
    {
      id: "pm_zelle",
      name: "Zelle",
      kind: "wallet",
      entityId: null,
      currencyCodes: ["USD"],
      requiresReference: true,
      isActive: true,
      locations: [],
    },
    {
      id: "pm_viejo",
      name: "Medio apagado",
      kind: "other",
      entityId: null,
      currencyCodes: [],
      requiresReference: false,
      isActive: false,
      locations: [],
    },
  ];

  it("resuelve el medio configurado con su tipo canónico, su entidad y su referencia", () => {
    const resolved = resolveConfiguredPaymentMethod(
      { paymentMethodId: "pm_zelle", currency: "USD", locationId: "loc_norte" },
      catalog,
    );

    expect(resolved).toMatchObject({
      id: "pm_zelle",
      kind: "wallet",
      entityId: null,
      requiresReference: true,
    });
  });

  it("rechaza un medio que no se ofrece en la sucursal", () => {
    // `pm_bac` está declarado sólo para `loc_norte`.
    expect(
      resolveConfiguredPaymentMethod(
        { paymentMethodId: "pm_bac", currency: "NIO", locationId: "loc_centro" },
        catalog,
      ),
    ).toBeNull();
  });

  it("rechaza un medio apagado", () => {
    expect(
      resolveConfiguredPaymentMethod(
        { paymentMethodId: "pm_viejo", currency: "NIO", locationId: "loc_norte" },
        catalog,
      ),
    ).toBeNull();
  });

  it("rechaza una moneda que el medio no admite", () => {
    // Zelle admite sólo USD.
    expect(
      resolveConfiguredPaymentMethod(
        { paymentMethodId: "pm_zelle", currency: "NIO", locationId: "loc_norte" },
        catalog,
      ),
    ).toBeNull();
  });

  it("un medio con la lista de monedas vacía admite todas", () => {
    const anyCurrency = resolveConfiguredPaymentMethod(
      { paymentMethodId: "pm_viejo", currency: "EUR", locationId: "loc_norte" },
      [{ ...catalog[2], isActive: true }],
    );

    expect(anyCurrency?.id).toBe("pm_viejo");
  });

  it("un identificador que no está en el catálogo no resuelve", () => {
    expect(
      resolveConfiguredPaymentMethod(
        { paymentMethodId: "pm_fantasma", currency: "NIO", locationId: "loc_norte" },
        catalog,
      ),
    ).toBeNull();
  });
});
