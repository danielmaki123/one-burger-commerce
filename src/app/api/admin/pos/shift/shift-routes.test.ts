import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";
import {
  createInMemoryLocation,
  InMemoryLocationRepository,
} from "@/modules/locations/adapters/in-memory-location-repository";
import { InMemoryPaymentRepository } from "@/modules/orders/adapters/in-memory-payment-repository";
import { InMemoryShiftRepository } from "@/modules/orders/adapters/in-memory-shift-repository";

/**
 * TASK-305b — las rutas de la caja del POS.
 *
 * Lo que se prueba: cocina no entra, sin local no hay caja, el **fondo y el conteo salen de los
 * billetes** (no de un total que mande la pantalla), un billete que no existe se rechaza con su
 * campo, y cerrar sin caja abierta es 409 con motivo. Las tres rutas comparten el mismo archivo
 * porque comparten las dependencias y el ciclo (abrir → consultar → cerrar).
 */

const requireAdminSessionMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

const shiftRepository = new InMemoryShiftRepository();
const paymentRepository = new InMemoryPaymentRepository();
const locationRepository = new InMemoryLocationRepository([
  createInMemoryLocation({ id: "loc_norte", name: "Norte" }),
  createInMemoryLocation({ id: "loc_apagado", name: "Apagado", posEnabled: false }),
]);

vi.mock("@/modules/pos/adapters/production-pos-shift", () => ({
  createProductionPosShiftDependencies: async () => ({
    shiftRepository,
    locationRepository,
    paymentRepository,
    businessCurrencyCode: "NIO",
    usdExchangeRate: 36.5,
  }),
}));

// TASK-308: la caja también pregunta si el POS está prendido en ese local.
vi.mock("@/modules/pos/adapters/production-pos-location", () => ({
  createProductionPosLocationDependencies: () => ({ repository: locationRepository }),
}));

const conteo = [
  { currency: "NIO", denomination: 100, quantity: 10 },
  { currency: "USD", denomination: 20, quantity: 2 },
];

async function callGet(query: string) {
  const { GET } = await import("./route");

  return GET(new Request(`http://localhost/api/admin/pos/shift${query}`));
}

async function callOpen(body: unknown) {
  const { POST } = await import("./open/route");

  return POST(
    new Request("http://localhost/api/admin/pos/shift/open", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

async function callClose(body: unknown) {
  const { POST } = await import("./close/route");

  return POST(
    new Request("http://localhost/api/admin/pos/shift/close", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

describe("rutas de la caja del POS", () => {
  beforeEach(() => {
    shiftRepository.shifts.length = 0;
    paymentRepository.payments.length = 0;
    vi.clearAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "admin_1", role: "manager", locationIds: [] },
    });
  });

  it("cocina no entra: 403", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "admin_2", role: "kitchen", locationIds: [] },
    });

    expect((await callGet("?locationId=loc_norte")).status).toBe(403);
    expect((await callOpen({ locationId: "loc_norte", counts: conteo })).status).toBe(403);
    expect((await callClose({ locationId: "loc_norte", counts: conteo })).status).toBe(403);
  });

  it("sin local pedido responde 400", async () => {
    const response = await callGet("");

    expect(response.status).toBe(400);
  });

  // TASK-308: con el POS apagado en el local no hay caja, ni para consultar ni para abrir.
  it("un local con el punto de venta apagado responde 403", async () => {
    const response = await callGet("?locationId=loc_apagado");
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect((await callOpen({ locationId: "loc_apagado", counts: conteo })).status).toBe(403);
    expect(shiftRepository.shifts).toHaveLength(0);
  });

  it("sin caja abierta devuelve null", async () => {
    const response = await callGet("?locationId=loc_norte");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toBeNull();
  });

  it("abre la caja con el conteo y deriva el fondo de los billetes", async () => {
    const response = await callOpen({ locationId: "loc_norte", counts: conteo });
    const body = await response.json();

    expect(response.status).toBe(201);
    // 10 × C$100 + 2 × US$20 × 36.5 = 1000 + 1460.
    expect(body.data.openingAmount).toBe(2460);
    expect(body.data.cashCounts).toHaveLength(2);
    expect(body.data.userId).toBe("admin_1");
  });

  it("un billete que no existe se rechaza con su campo", async () => {
    const response = await callOpen({
      locationId: "loc_norte",
      counts: [{ currency: "NIO", denomination: 25, quantity: 1 }],
    });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.fields["counts.0.denomination"]).toBeTruthy();
  });

  it("cerrar sin caja abierta es un conflicto con motivo", async () => {
    const response = await callClose({ locationId: "loc_norte", counts: conteo });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.message).toContain("No hay una caja abierta");
  });

  it("abre, se consulta y cierra con el conteo: el total y la diferencia salen del servidor", async () => {
    await callOpen({ locationId: "loc_norte", counts: [{ currency: "NIO", denomination: 100, quantity: 5 }] });

    const current = await (await callGet("?locationId=loc_norte")).json();
    expect(current.data.status).toBe("open");
    expect(current.data.openingAmount).toBe(500);

    const closed = await callClose({
      locationId: "loc_norte",
      counts: [{ currency: "NIO", denomination: 100, quantity: 4 }],
      notes: "Faltó un billete",
    });
    const body = await closed.json();

    expect(closed.status).toBe(200);
    expect(body.data.closingAmount).toBe(400);
    // Sin ventas en el turno, el esperado es el fondo: la diferencia es lo que falta.
    expect(body.data.expectedAmount).toBe(500);
    expect(body.data.difference).toBe(-100);
    expect(body.meta.expectedByCurrency).toEqual({ NIO: 500 });
    expect(body.data.notes).toBe("Faltó un billete");
  });

  it("sin sesión responde 401", async () => {
    requireAdminSessionMock.mockRejectedValue(new AuthError(401, "UNAUTHORIZED", "No session"));

    expect((await callGet("?locationId=loc_norte")).status).toBe(401);
  });

  /**
   * A-45 del backlog (2026-09-23): el arqueo ciego es una regla de **servidor**. Abre y cierra un manager
   * (dueño del flujo) y después lee lo mismo como cajero: queda su conteo, no el esperado.
   */
  it("al cajero el cierre le deja su conteo y le esconde el esperado y la diferencia", async () => {
    await callOpen({ locationId: "loc_norte", counts: [{ currency: "NIO", denomination: 100, quantity: 5 }] });

    requireAdminSessionMock.mockResolvedValue({
      user: { id: "admin_2", role: "cashier", locationIds: [] },
    });

    const closed = await callClose({
      locationId: "loc_norte",
      counts: [{ currency: "NIO", denomination: 100, quantity: 4 }],
      notes: "Faltó un billete",
    });
    const body = await closed.json();

    expect(closed.status).toBe(200);
    // Su conteo sí: es lo que declaró.
    expect(body.data.closingAmount).toBe(400);
    expect(body.data.notes).toBe("Faltó un billete");
    // Y la comparación no: ni en `data` ni en `meta`.
    expect("expectedAmount" in body.data).toBe(false);
    expect("expectedByCurrency" in body.data).toBe(false);
    expect("difference" in body.data).toBe(false);
    expect("expectedByCurrency" in body.meta).toBe(false);
    expect("bankDifferenceAmount" in body.meta).toBe(false);
  });

  it("el dueño cierra y ve el arqueo completo", async () => {
    await callOpen({ locationId: "loc_norte", counts: [{ currency: "NIO", denomination: 100, quantity: 5 }] });

    requireAdminSessionMock.mockResolvedValue({
      user: { id: "admin_3", role: "owner", locationIds: [] },
    });

    const body = await (
      await callClose({
        locationId: "loc_norte",
        counts: [{ currency: "NIO", denomination: 100, quantity: 4 }],
      })
    ).json();

    expect(body.data.expectedAmount).toBe(500);
    expect(body.data.difference).toBe(-100);
  });
});
