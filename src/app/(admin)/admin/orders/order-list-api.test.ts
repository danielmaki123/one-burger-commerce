import { describe, expect, it, vi } from "vitest";

import { readAdminOrders, sanitizeOrderQuery } from "./order-list-api";

/**
 * Bug de producción (2026-09-18) — la lectura de la lista de órdenes.
 *
 * Los dos casos que se midieron contra producción y que este módulo tiene que cubrir:
 *
 * 1. `?dateFrom=basura` y `?status=no-existe` devuelven **400** con los campos que fallaron. La pantalla
 *    mostraba «No se pudieron cargar las órdenes» y no decía nada más.
 * 2. Un fallo transitorio (reinicio del contenedor en un deploy) dejaba el mismo cartel, sin reintentar.
 */

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe("sanitizeOrderQuery", () => {
  it("arma la consulta con lo válido", () => {
    const params = sanitizeOrderQuery({
      status: "preparing",
      locationId: "loc_1",
      search: " ana ",
      dateFrom: "2026-09-18T06:00:00.000Z",
      lateOnly: true,
      limit: 50,
    });

    expect(params.toString()).toBe(
      "status=preparing&locationId=loc_1&search=ana&dateFrom=2026-09-18T06%3A00%3A00.000Z&lateOnly=1&limit=50",
    );
  });

  it("descarta un filtro con un valor que la API rechaza (y no rompe el resto)", () => {
    const params = sanitizeOrderQuery({
      status: "no-existe",
      type: "volador",
      paymentMethod: "bitcoin",
      dateFrom: "basura",
      dateTo: "",
      locationId: "   ",
      search: "   ",
    });

    expect(params.toString()).toBe("");
  });

  it("acepta los estados y los medios que existen de verdad", () => {
    for (const status of ["new", "preparing", "ready", "closed", "cancelled"]) {
      expect(sanitizeOrderQuery({ status }).get("status")).toBe(status);
    }
    expect(sanitizeOrderQuery({ paymentMethod: "card" }).get("paymentMethod")).toBe("card");
    expect(sanitizeOrderQuery({ lateOnly: false }).get("lateOnly")).toBeNull();
  });

  /**
   * Bug encontrado en el arnés local el 2026-09-18, al verificar el Punto 3: el control de sucursal usa
   * `"all"` como valor de «todas», y ese centinela viajaba como si fuera un id de local. La API lo
   * aplicaba literal (`locationIds: ["all"]`), no encontraba esa sucursal y devolvía **0 pedidos**: el
   * tablero quedaba vacío y las pruebas que buscan una comanda recién creada fallaban sin que hubiera
   * nada roto en el producto.
   */
  it("«todas las sucursales» no es una sucursal: el centinela no viaja", () => {
    const params = sanitizeOrderQuery({ locationId: "all", dateFrom: "2026-09-18T06:00:00.000Z" });

    expect(params.get("locationId")).toBeNull();
    expect(params.toString()).toBe("dateFrom=2026-09-18T06%3A00%3A00.000Z");
  });
});

describe("readAdminOrders", () => {
  it("devuelve las órdenes cuando la API responde bien", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ data: [{ id: "ord_1" }], meta: { count: 1 } }),
    );

    const result = await readAdminOrders({ queryString: "", fetchImpl: fetchImpl as never });

    expect(result).toEqual({ ok: true, orders: [{ id: "ord_1" }], meta: { count: 1 } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("un 400 se explica con los filtros que la API señaló, y no se reintenta", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        { error: { message: "Invalid query params", fields: { status: "Invalid enum value" } } },
        400,
      ),
    );

    const result = await readAdminOrders({ queryString: "status=x", fetchImpl: fetchImpl as never });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure).toMatchObject({ kind: "filters", fields: ["status"] });
    expect(result.failure.kind === "filters" && result.failure.message).toContain("«status»");
    // Un filtro mal formado no mejora reintentando: una sola llamada.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("un fallo de red se reintenta y, si sigue, se dice que no hubo respuesta", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    });
    const sleep = vi.fn(async () => {});

    const result = await readAdminOrders({
      queryString: "",
      fetchImpl: fetchImpl as never,
      retries: 2,
      sleep,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.kind).toBe("network");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("el reintento salva un bache transitorio (el cartel no aparece)", async () => {
    let intentos = 0;
    const fetchImpl = vi.fn(async () => {
      intentos += 1;
      if (intentos === 1) throw new Error("reinicio del contenedor");

      return jsonResponse({ data: [{ id: "ord_1" }], meta: {} });
    });

    const result = await readAdminOrders({
      queryString: "",
      fetchImpl: fetchImpl as never,
      sleep: async () => {},
    });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("un 5xx se reintenta y se informa el estado", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: { message: "boom" } }, 500));

    const result = await readAdminOrders({
      queryString: "",
      fetchImpl: fetchImpl as never,
      retries: 1,
      sleep: async () => {},
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure).toMatchObject({ kind: "server", status: 500 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("sin sesión no se reintenta: hay que volver a entrar", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: { message: "Unauthorized" } }, 401));

    const result = await readAdminOrders({ queryString: "", fetchImpl: fetchImpl as never });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.kind).toBe("auth");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
