import { describe, expect, it } from "vitest";

import {
  MAX_POS_HELDS,
  addPosHold,
  createPosHoldId,
  parsePosHolds,
  posHoldTitle,
  posHoldUnits,
  posHoldsFull,
  removePosHold,
  serializePosHolds,
  type PosHeldSale,
} from "./pos-holds";

/**
 * Tareas 9.4 y 9.5 del roadmap del POS (Fase 2) — la venta **en espera**.
 *
 * El mostrador tiene un caso que no es el borrador ni el pedido: el cliente todavía no está listo (fue a
 * buscar la billetera, se olvidó algo, vuelve en diez minutos) y el cajero **no puede** dejar la pantalla
 * ocupada: atrás hay otra gente. «Guardar en espera» deja esa venta a un lado y libera el mostrador para
 * el próximo cliente; «Retomar» la trae de vuelta completa (productos, cliente y el cobro que se había
 * armado).
 *
 * Es el mismo dispositivo y el mismo motivo que el borrador (Bloque 12.3): todavía **no es un pedido**, no
 * hay nada que el servidor tenga que auditar, y la venta en espera no puede depender de la red. Por eso el
 * texto guardado se lee **defensivamente**: un guardado viejo, incompleto o escrito a mano se descarta sin
 * romper el mostrador y sin llevarse las otras esperas.
 *
 * La **clave del intento de cobro viaja con la espera** (tarea 11): si el cajero dejó la venta en espera
 * después de un cobro que quedó a medias, retomarla y cobrar tiene que ser el **mismo** intento para el
 * servidor, no uno nuevo.
 */

const attemptKey = "ce9b1f5e-1a2b-4c3d-8e4f-5a6b7c8d9e0f";

const hold: PosHeldSale = {
  id: "hold_1",
  savedAt: "2026-09-18T15:04:00.000Z",
  lines: [
    { productId: "seed-prod-01", name: "Taco de Birria", unitPrice: 35, quantity: 2 },
    {
      productId: "seed-prod-03",
      name: "Agua de Jamaica",
      unitPrice: 25,
      packagingUnitAmount: 5,
      quantity: 1,
      notes: "Sin hielo",
    },
  ],
  customer: { name: "Ana", whatsapp: "+50588888888", email: "ana@example.com" },
  payments: [{ method: "cash", currency: "NIO", amount: "500" }],
  attemptKey,
};

function secondHold(overrides: Partial<PosHeldSale> = {}): PosHeldSale {
  return {
    ...hold,
    id: "hold_2",
    savedAt: "2026-09-18T15:09:00.000Z",
    customer: { name: "Beto", whatsapp: "+50587777777", email: "" },
    ...overrides,
  };
}

describe("serializePosHolds / parsePosHolds", () => {
  it("la espera vuelve completa: productos, cliente, cobro y la clave del intento", () => {
    expect(parsePosHolds(serializePosHolds("loc_centro", [hold]), "loc_centro")).toEqual([hold]);
  });

  it("varias esperas vuelven en el orden en que se guardaron", () => {
    const raw = serializePosHolds("loc_centro", [secondHold(), hold]);

    expect(parsePosHolds(raw, "loc_centro").map((sale) => sale.id)).toEqual(["hold_2", "hold_1"]);
  });

  it("sin nada guardado no hay esperas", () => {
    expect(parsePosHolds(null, "loc_centro")).toEqual([]);
    expect(parsePosHolds("", "loc_centro")).toEqual([]);
  });

  it("lo que no es una lista de esperas no rompe el mostrador", () => {
    expect(parsePosHolds("no-es-json", "loc_centro")).toEqual([]);
    expect(parsePosHolds("{}", "loc_centro")).toEqual([]);
    expect(parsePosHolds('{"locationId":"loc_centro","holds":"dos"}', "loc_centro")).toEqual([]);
    expect(parsePosHolds('{"locationId":"loc_centro","holds":[null,7,"x"]}', "loc_centro")).toEqual(
      [],
    );
  });

  it("la espera es de un local: cambiar de sucursal no ofrece la venta de la otra", () => {
    expect(parsePosHolds(serializePosHolds("loc_centro", [hold]), "loc_masaya")).toEqual([]);
  });

  it("una espera sin líneas no se ofrece (no hay venta que retomar)", () => {
    const raw = JSON.stringify({
      locationId: "loc_centro",
      holds: [{ ...hold, id: "hold_vacia", lines: [] }, secondHold()],
    });

    expect(parsePosHolds(raw, "loc_centro").map((sale) => sale.id)).toEqual(["hold_2"]);
  });

  it("una línea con basura se descarta sin llevarse la espera ni las otras líneas", () => {
    const raw = JSON.stringify({
      locationId: "loc_centro",
      holds: [
        {
          ...hold,
          lines: [
            { productId: "seed-prod-01", name: "Taco de Birria", unitPrice: 35, quantity: 2 },
            { productId: "", name: "Fantasma", unitPrice: 10, quantity: 1 },
            { productId: "seed-prod-09", name: "Precio malo", unitPrice: "gratis", quantity: 1 },
          ],
        },
      ],
    });

    const [sale] = parsePosHolds(raw, "loc_centro");

    expect(sale?.lines).toEqual([
      { productId: "seed-prod-01", name: "Taco de Birria", unitPrice: 35, quantity: 2 },
    ]);
  });

  it("las líneas de la espera llevan su nota y su empaque (el cobro no cambia al retomar)", () => {
    const [sale] = parsePosHolds(serializePosHolds("loc_centro", [hold]), "loc_centro");

    expect(sale?.lines[1]).toEqual({
      productId: "seed-prod-03",
      name: "Agua de Jamaica",
      unitPrice: 25,
      packagingUnitAmount: 5,
      quantity: 1,
      notes: "Sin hielo",
    });
  });

  it("un cobro con basura se descarta sin llevarse la espera", () => {
    const raw = JSON.stringify({
      locationId: "loc_centro",
      holds: [
        {
          ...hold,
          payments: [
            { method: "cash", currency: "NIO", amount: "500" },
            { method: "bitcoin", currency: "NIO", amount: "10" },
            { method: "mixed", currency: "NIO", amount: "5" },
            { method: "card", currency: "NIO", amount: 20 },
            { method: "transfer", currency: "USD", amount: "10", reference: "voucher-9" },
          ],
        },
      ],
    });

    const [sale] = parsePosHolds(raw, "loc_centro");

    expect(sale?.payments).toEqual([
      { method: "cash", currency: "NIO", amount: "500" },
      { method: "transfer", currency: "USD", amount: "10", reference: "voucher-9" },
    ]);
  });

  it("un monto que no es texto se descarta: el cobro se rearma, no se adivina", () => {
    const raw = JSON.stringify({
      locationId: "loc_centro",
      holds: [{ ...hold, payments: [{ method: "cash", currency: "NIO", amount: 500 }] }],
    });

    const [sale] = parsePosHolds(raw, "loc_centro");

    expect(sale?.payments).toEqual([]);
  });

  it("una clave de intento corrupta se descarta (se genera una nueva al retomar)", () => {
    const raw = JSON.stringify({
      locationId: "loc_centro",
      holds: [{ ...hold, attemptKey: "a".repeat(200) }],
    });

    const [sale] = parsePosHolds(raw, "loc_centro");

    expect(sale?.attemptKey).toBeNull();
    expect(sale?.lines).toHaveLength(2);
  });

  it("un nombre de cliente vacío no borra la espera: se muestra como sin nombre", () => {
    const raw = JSON.stringify({
      locationId: "loc_centro",
      holds: [
        { ...hold, customer: { name: "  ", whatsapp: 7, email: null } },
        { ...secondHold(), customer: undefined },
      ],
    });

    const sales = parsePosHolds(raw, "loc_centro");

    expect(sales).toHaveLength(2);
    expect(sales[0]?.customer).toEqual({ name: "", whatsapp: "", email: "" });
    expect(posHoldTitle(sales[1] as PosHeldSale)).toBe("Sin nombre");
  });

  it("una fecha de guardado ilegible no se inventa: queda sin fecha", () => {
    const raw = JSON.stringify({ locationId: "loc_centro", holds: [{ ...hold, savedAt: 12345 }] });

    expect(parsePosHolds(raw, "loc_centro")[0]?.savedAt).toBe("");
  });

  it("una espera sin id no se ofrece: no se podría retomar ni descartar", () => {
    const raw = JSON.stringify({ locationId: "loc_centro", holds: [{ ...hold, id: "  " }] });

    expect(parsePosHolds(raw, "loc_centro")).toEqual([]);
  });

  it("más esperas que el tope: se conservan las primeras (las más nuevas)", () => {
    const holds = Array.from({ length: MAX_POS_HELDS + 3 }, (_, index) =>
      secondHold({ id: `hold_${index + 1}` }),
    );
    const raw = serializePosHolds("loc_centro", holds);

    const parsed = parsePosHolds(raw, "loc_centro");

    expect(parsed).toHaveLength(MAX_POS_HELDS);
    expect(parsed.map((sale) => sale.id)).toEqual(
      Array.from({ length: MAX_POS_HELDS }, (_, index) => `hold_${index + 1}`),
    );
  });
});

describe("addPosHold / removePosHold", () => {
  it("la espera nueva va primero: es la que el cajero acaba de dejar", () => {
    const holds = addPosHold([hold], secondHold());

    expect(holds.map((sale) => sale.id)).toEqual(["hold_2", "hold_1"]);
  });

  it("con la lista llena no crece: entra la nueva y sale la más vieja", () => {
    const full = Array.from({ length: MAX_POS_HELDS }, (_, index) =>
      secondHold({ id: `hold_${index + 1}` }),
    );

    const holds = addPosHold(full, secondHold({ id: "hold_nueva" }));

    expect(holds).toHaveLength(MAX_POS_HELDS);
    expect(holds[0]?.id).toBe("hold_nueva");
    // La que se cae es la última de la lista, que es la más vieja.
    expect(holds.some((sale) => sale.id === `hold_${MAX_POS_HELDS}`)).toBe(false);
  });

  it("retomar o descartar saca solo esa espera", () => {
    const holds = removePosHold([secondHold(), hold], "hold_1");

    expect(holds.map((sale) => sale.id)).toEqual(["hold_2"]);
  });

  it("sacar una espera que ya no está no toca las demás", () => {
    expect(removePosHold([hold], "hold_9")).toEqual([hold]);
  });

  it("el tope se avisa antes de guardar (la pantalla bloquea el botón)", () => {
    const full = Array.from({ length: MAX_POS_HELDS }, (_, index) =>
      secondHold({ id: `hold_${index + 1}` }),
    );

    expect(posHoldsFull(full)).toBe(true);
    expect(posHoldsFull(removePosHold(full, "hold_1"))).toBe(false);
  });
});

describe("posHoldTitle / posHoldUnits", () => {
  it("la espera se nombra con el cliente", () => {
    expect(posHoldTitle(hold)).toBe("Ana");
  });

  it("sin nombre de cliente la espera se muestra igual", () => {
    expect(posHoldTitle(secondHold({ customer: { name: "   ", whatsapp: "", email: "" } }))).toBe(
      "Sin nombre",
    );
  });

  it("las unidades suman las cantidades, no las líneas", () => {
    expect(posHoldUnits(hold)).toBe(3);
  });
});

describe("createPosHoldId", () => {
  it("cada espera lleva su id, generado en el dispositivo", () => {
    const first = createPosHoldId();

    expect(first.trim()).not.toBe("");
    expect(createPosHoldId()).not.toBe(first);
  });
});
