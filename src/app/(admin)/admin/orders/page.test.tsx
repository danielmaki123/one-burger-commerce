// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminOrdersPage from "./page";

/**
 * El módulo de sonido se observa desde el test: lo que importa acá es **cuándo** se pide el aviso.
 *
 * `playNewOrderAlert` respeta el mismo contrato que el módulo real —decide él si suena y devuelve si
 * sonó—, así que el doble solo registra la llamada cuando el aviso está activado. Si registrara todo
 * lo que se le pide, el test de «no suena si está apagado» pasaría por el motivo equivocado.
 */
const sound = vi.hoisted(() => ({ enabled: false, play: vi.fn(), set: vi.fn() }));

vi.mock("./admin-alert-sound", () => ({
  isAlertSoundEnabled: () => sound.enabled,
  setAlertSoundEnabled: (enabled: boolean) => {
    sound.enabled = enabled;
    sound.set(enabled);
  },
  playNewOrderAlert: () => {
    if (!sound.enabled) return false;

    sound.play();
    return true;
  },
}));

/**
 * La bandeja hace **dos** lecturas: la del turno (con `dateFrom` y `dateTo`) y la de días anteriores
 * en segundo plano (`dateTo` solo, para el aviso). Los stubs las separan para que el conteo de
 * llamadas sea el de la lista principal y no el de las dos.
 */
function isOlderOpenCall(url: string) {
  return url.includes("dateTo=") && !url.includes("dateFrom=");
}

/**
 * La bandeja de órdenes tiene que decir **para cuándo es cada retiro** y qué tan
 * atrasado va contra esa hora. Antes no mostraba la hora en absoluto, y el rojo se
 * disparaba por antigüedad del pedido: uno programado para las 21:00 aparecía en rojo
 * a las 19:20.
 */

const NOW = new Date("2026-09-11T20:10:00-06:00");

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: "ord_1",
    orderNumber: "OB-1",
    type: "pickup",
    status: "preparing",
    customerName: "Ana",
    customerWhatsapp: "+50588887777",
    total: 380,
    createdAt: "2026-09-12T01:40:00.000Z",
    ...overrides,
  };
}

/**
 * El chip del semáforo, por su token de color. Se busca por substring porque la clase
 * lleva opacidad (`bg-pickup-late/15`) y el `/` no matchea en un selector de clase.
 */
function timingChip(container: HTMLElement, tone: "on-time" | "past" | "late") {
  return container.querySelector(`[class*="bg-pickup-${tone}"]`);
}

async function renderWith(orders: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: orders }),
    }),
  );

  const view = render(<AdminOrdersPage />);
  await waitFor(() => expect(screen.getByText("OB-1")).toBeTruthy());

  return view;
}

/**
 * Render con locales cargados (T8): el filtro por local solo aparece cuando hay más de uno.
 */
async function renderWithLocations(
  orders: unknown[],
  locations: Array<{ id: string; name: string; isActive?: boolean }>,
) {
  const fetchMock = vi.fn((url: string) =>
    Promise.resolve({
      ok: true,
      json: async () => ({ data: String(url).includes("/api/admin/locations") ? locations : orders }),
    }),
  );
  vi.stubGlobal("fetch", fetchMock);

  const view = render(<AdminOrdersPage />);
  await waitFor(() => expect(screen.getByText("OB-1")).toBeTruthy());

  return { ...view, fetchMock };
}

describe("bandeja de órdenes: hora de retiro y semáforo", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("muestra la hora del retiro programado", async () => {
    await renderWith([
      order({ pickupTime: "2026-09-12T02:30:00.000Z", pickupScheduled: true }),
    ]);

    expect(screen.getByText("Retiro 8:30 p. m. · Programado")).toBeTruthy();
  });

  it("distingue un pedido sin programar de uno programado", async () => {
    await renderWith([
      order({ pickupTime: "2026-09-12T02:35:00.000Z", pickupScheduled: false }),
    ]);

    expect(screen.getByText("Retiro ~8:35 p. m. · Lo antes posible")).toBeTruthy();
  });

  it("pinta en verde mientras falta para la hora prometida", async () => {
    const { container } = await renderWith([
      order({ pickupTime: "2026-09-12T02:40:00.000Z", pickupScheduled: true }),
    ]);

    expect(timingChip(container, "on-time")?.textContent).toBe("en 30 min");
  });

  it("pasa a naranja cuando se cumplió la hora", async () => {
    const { container } = await renderWith([
      order({ pickupTime: "2026-09-12T02:05:00.000Z", pickupScheduled: true }),
    ]);

    expect(timingChip(container, "past")?.textContent).toBe("hace 5 min");
  });

  it("pasa a rojo cuando ya es muy tarde", async () => {
    const { container } = await renderWith([
      order({ pickupTime: "2026-09-12T01:50:00.000Z", pickupScheduled: true }),
    ]);

    expect(timingChip(container, "late")?.textContent).toBe("hace 20 min");
  });

  it("un pedido programado para más tarde no alarma, por viejo que sea", async () => {
    // Es el bug que esto arregla: antes el color salía de la antigüedad del pedido, así
    // que uno creado hace 70 minutos ya estaba en rojo con 50 minutos de margen.
    const { container } = await renderWith([
      order({
        createdAt: "2026-09-12T01:00:00.000Z",
        pickupTime: "2026-09-12T03:00:00.000Z",
        pickupScheduled: true,
      }),
    ]);

    expect(timingChip(container, "on-time")?.textContent).toBe("en 50 min");
    expect(timingChip(container, "past")).toBeNull();
    expect(timingChip(container, "late")).toBeNull();
  });

  it("un pedido cerrado no alarma", async () => {
    const { container } = await renderWith([
      order({
        status: "closed",
        pickupTime: "2026-09-12T01:00:00.000Z",
        pickupScheduled: true,
      }),
    ]);

    expect(timingChip(container, "past")).toBeNull();
    expect(timingChip(container, "late")).toBeNull();
    expect(timingChip(container, "on-time")).toBeNull();
  });

  it("no inventa una hora si el pedido no la tiene", async () => {
    const { container } = await renderWith([order({ pickupTime: null })]);

    // Sin hora cae al dato que sí existe: cuándo entró el pedido.
    expect(screen.queryByText(/^Retiro ~?\d/)).toBeNull();
    expect(screen.getByText(/^Recibida /)).toBeTruthy();
    expect(timingChip(container, "late")).toBeNull();
  });

  it("con un solo local no dibuja el filtro por local (T8)", async () => {
    const user = userEvent.setup();
    await renderWithLocations([order()], [{ id: "loc_principal", name: "Principal", isActive: true }]);

    // El panel de filtros se abre a propósito: si no, la ausencia no probaría nada.
    await user.click(screen.getByRole("button", { name: "Mostrar filtros" }));

    expect(screen.queryByLabelText("Local")).toBeNull();
  });

  it("con varios locales deja filtrar y muestra de qué local es cada pedido (T8)", async () => {
    const user = userEvent.setup();
    const { fetchMock } = await renderWithLocations(
      [order({ locationName: "Norte" })],
      [
        { id: "loc_principal", name: "Principal", isActive: true },
        { id: "loc_norte", name: "Norte", isActive: true },
      ],
    );

    // El pedido dice de qué local es.
    expect(screen.getByText(/· Norte/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Mostrar filtros" }));
    await user.selectOptions(screen.getByLabelText("Local"), "loc_norte");

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("locationId=loc_norte")),
    );
  });
});

/**
 * A — el alcance por sucursal en la bandeja.
 *
 * La pantalla refleja **lo que el servidor aplicó** (`meta.locationIds`): no reimplementa la regla
 * ni ofrece sucursales que el usuario no puede ver. Y publica `aria-busy` mientras carga, que es lo
 * que permite al E2E esperar a que el refetch termine en vez de pasar por una carrera.
 */
describe("bandeja de órdenes: alcance por sucursal (A)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function stubWithScope(locationIds: string[] | null | undefined) {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve({
        ok: true,
        json: async () =>
          String(url).includes("/api/admin/locations")
            ? {
                data: [
                  { id: "loc_principal", name: "Principal", isActive: true },
                  { id: "loc_norte", name: "Norte", isActive: true },
                  { id: "loc_sur", name: "Sur", isActive: true },
                ],
              }
            : { data: [order()], meta: { count: 1, locationScope: locationIds } },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    return fetchMock;
  }

  it("solo ofrece las sucursales del alcance del usuario", async () => {
    const user = userEvent.setup();
    stubWithScope(["loc_norte", "loc_sur"]);
    render(<AdminOrdersPage />);

    await screen.findByText("OB-1");
    await user.click(screen.getByRole("button", { name: "Mostrar filtros" }));

    const select = screen.getByLabelText("Local");
    const options = within(select)
      .getAllByRole("option")
      .map((option) => option.textContent);

    expect(options).toEqual(["Mis sucursales", "Norte", "Sur"]);
  });

  it("el filtro sigue ofreciendo el alcance después de elegir una sucursal", async () => {
    // Bug real que esto fija: la pantalla usaba el **filtro aplicado** como si fuera el alcance,
    // así que al elegir una sucursal se quedaba con una sola opción y el control desaparecía.
    const user = userEvent.setup();
    let listCalls = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (String(url).includes("/api/admin/locations")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              data: [
                { id: "loc_norte", name: "Norte", isActive: true },
                { id: "loc_sur", name: "Sur", isActive: true },
              ],
            }),
          });
        }

        listCalls += 1;
        const first = listCalls === 1;

        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [order()],
            meta: {
              count: 1,
              // Primera lectura: sin filtro pedido. Segunda: se pidió Norte.
              locationIds: first ? undefined : ["loc_norte"],
              locationScope: ["loc_norte", "loc_sur"],
            },
          }),
        });
      }),
    );

    render(<AdminOrdersPage />);
    await screen.findByText("OB-1");
    await user.click(screen.getByRole("button", { name: "Mostrar filtros" }));
    await user.selectOptions(screen.getByLabelText("Local"), "loc_norte");

    await waitFor(() => expect(listCalls).toBeGreaterThan(1));

    // El control sigue ahí, con las dos sucursales del alcance.
    const options = within(screen.getByLabelText("Local"))
      .getAllByRole("option")
      .map((option) => option.textContent);

    expect(options).toEqual(["Mis sucursales", "Norte", "Sur"]);
  });

  it("sin alcance (dueño o sin asignar) ofrece todos los locales", async () => {
    const user = userEvent.setup();
    stubWithScope(undefined);
    render(<AdminOrdersPage />);

    await screen.findByText("OB-1");
    await user.click(screen.getByRole("button", { name: "Mostrar filtros" }));

    const select = screen.getByLabelText("Local");
    const options = within(select)
      .getAllByRole("option")
      .map((option) => option.textContent);

    expect(options).toEqual(["Todas las sucursales", "Principal", "Norte", "Sur"]);
  });

  it("con una sola sucursal en el alcance no dibuja el filtro", async () => {
    const user = userEvent.setup();
    stubWithScope(["loc_norte"]);
    render(<AdminOrdersPage />);

    await screen.findByText("OB-1");
    await user.click(screen.getByRole("button", { name: "Mostrar filtros" }));

    expect(screen.queryByLabelText("Local")).toBeNull();
  });

  it("publica aria-busy mientras carga la lista", async () => {
    let release: () => void = () => {};
    const pending = new Promise((resolve) => {
      release = () =>
        resolve({ ok: true, json: async () => ({ data: [order()], meta: { count: 1 } }) });
    });

    vi.stubGlobal("fetch", vi.fn(() => pending));
    render(<AdminOrdersPage />);

    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();

    release();

    await waitFor(() => {
      expect(document.querySelector('[aria-busy="true"]')).toBeNull();
    });
  });
});

/**
 * B0 — la bandeja no se vacía cuando falla la red.
 *
 * En una cocina un hipo de wifi no puede dejar la pantalla sin pedidos: se conserva la última lista,
 * se dice que está vieja y se ofrece reintentar. Antes los tres caminos de error hacían
 * `setOrders([])`, así que el turno se quedaba a ciegas justo cuando más importa.
 */
describe("bandeja de órdenes: sin red (B0)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function stubFetchFailingAfterFirstLoad() {
    let ordersCalls = 0;
    const fetchMock = vi.fn((url: string) => {
      const href = String(url);
      if (href.includes("/api/admin/locations")) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      }
      if (isOlderOpenCall(href)) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      }

      ordersCalls += 1;
      if (ordersCalls === 1) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [order()], meta: { count: 1 } }),
        });
      }

      return Promise.reject(new Error("sin red"));
    });

    vi.stubGlobal("fetch", fetchMock);

    return fetchMock;
  }

  it("conserva los pedidos, avisa que no se pudo actualizar y deja reintentar", async () => {
    const user = userEvent.setup();
    stubFetchFailingAfterFirstLoad();
    render(<AdminOrdersPage />);

    await screen.findByText("OB-1");

    // Cambiar un filtro dispara otra lectura, que ahora falla.
    await user.click(screen.getByRole("button", { name: /Preparando/ }));

    expect(await screen.findByText(/No se pudo actualizar la bandeja/)).toBeTruthy();
    expect(screen.getByText(/Última actualización/)).toBeTruthy();
    // Lo importante: el pedido sigue a la vista.
    expect(screen.getByText("OB-1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
  });

  it("sin nada en pantalla, el error se explica y se puede reintentar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        String(url).includes("/api/admin/locations")
          ? Promise.resolve({ ok: true, json: async () => ({ data: [] }) })
          : Promise.reject(new Error("sin red")),
      ),
    );

    render(<AdminOrdersPage />);

    expect(await screen.findByText("No se pudieron cargar las órdenes.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
  });

  it("reintentar vuelve a pedir la lista", async () => {
    const user = userEvent.setup();
    let ordersCalls = 0;
    const fetchMock = vi.fn((url: string) => {
      const href = String(url);
      if (href.includes("/api/admin/locations")) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      }
      if (isOlderOpenCall(href)) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      }

      ordersCalls += 1;
      if (ordersCalls === 1) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [order()], meta: { count: 1 } }),
        });
      }
      if (ordersCalls === 2) return Promise.reject(new Error("sin red"));

      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [order(), order({ id: "ord_2", orderNumber: "OB-2" })], meta: { count: 2 } }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminOrdersPage />);
    await screen.findByText("OB-1");
    await user.click(screen.getByRole("button", { name: /Preparando/ }));
    await screen.findByText(/No se pudo actualizar la bandeja/);

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("OB-2")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText(/No se pudo actualizar la bandeja/)).toBeNull();
    });
  });
});

/**
 * B1 — que los pedidos caigan solos.
 *
 * El poll va cada 15 s y **solo con la pestaña visible** (una cocina con la tablet encendida no puede
 * estar pidiendo datos toda la noche): al volver a la pestaña se refresca al instante. Lo que aparece
 * se anuncia con un aviso, y el sonido suena una sola vez por pedido nuevo y solo si está activado.
 */
describe("bandeja de órdenes: auto-refresh y avisos (B1)", () => {
  beforeEach(() => {
    // Se falsean el reloj y los intervalos; `setTimeout` queda real para que `waitFor` funcione.
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(NOW);
    sound.enabled = false;
    sound.play.mockClear();
    sound.set.mockClear();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function setVisibility(state: "visible" | "hidden") {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => state,
    });
  }

  /** Primer pedido, y a partir de la segunda lectura el que llega nuevo. */
  function stubFetchWithNewOrder() {
    let ordersCalls = 0;
    const fetchMock = vi.fn((url: string) => {
      const href = String(url);
      if (href.includes("/api/admin/locations")) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      }
      if (isOlderOpenCall(href)) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      }

      ordersCalls += 1;
      const data =
        ordersCalls === 1
          ? [order()]
          : [order(), order({ id: "ord_2", orderNumber: "OB-2" })];

      return Promise.resolve({ ok: true, json: async () => ({ data, meta: { count: data.length } }) });
    });
    vi.stubGlobal("fetch", fetchMock);

    return fetchMock;
  }

  async function advance(ms: number) {
    await act(async () => {
      vi.advanceTimersByTime(ms);
    });
  }

  /**
   * Deja correr las microtareas del fetch y del render.
   *
   * En este describe **no** se usan `findBy`/`waitFor`: falseamos `setInterval` para poder adelantar el
   * poll, y las utilidades asíncronas de testing-library eligen su estrategia según los timers que
   * detectan. Con `act` + `getBy` el test es determinista y no depende de esa detección.
   */
  async function flush(times = 12) {
    await act(async () => {
      for (let index = 0; index < times; index += 1) {
        await Promise.resolve();
      }
    });
  }

  async function renderLoaded() {
    render(<AdminOrdersPage />);
    await flush();
  }

  it("refresca sola a los 15 s y avisa el pedido nuevo", async () => {
    const fetchMock = stubFetchWithNewOrder();
    await renderLoaded();

    // Sin novedades todavía: nada de avisos.
    expect(screen.queryByText(/pedido nuevo/)).toBeNull();
    const callsAfterLoad = fetchMock.mock.calls.length;

    await advance(15000);
    await flush();

    expect(
      fetchMock.mock.calls.length,
      `llamadas: ${fetchMock.mock.calls.map((call) => String(call[0]).slice(-45)).join(" | ")}`,
    ).toBeGreaterThan(callsAfterLoad);
    expect(
      screen.queryByText("OB-2"),
      `body: ${(document.body.textContent ?? "").slice(0, 500)}`,
    ).toBeTruthy();
    expect(screen.getByText(/1 pedido nuevo/)).toBeTruthy();
  });

  it("con la pestaña oculta no pide nada", async () => {
    const fetchMock = stubFetchWithNewOrder();
    await renderLoaded();
    const callsAfterLoad = fetchMock.mock.calls.length;

    setVisibility("hidden");
    await advance(15000);
    await advance(15000);
    await flush();

    expect(fetchMock.mock.calls.length).toBe(callsAfterLoad);
  });

  it("al volver a la pestaña refresca al instante", async () => {
    const fetchMock = stubFetchWithNewOrder();
    await renderLoaded();

    setVisibility("hidden");
    await advance(15000);
    const callsWhileHidden = fetchMock.mock.calls.length;

    setVisibility("visible");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await flush();

    expect(screen.getByText("OB-2")).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsWhileHidden);
  });

  it("el aviso se puede cerrar y la lista queda", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    stubFetchWithNewOrder();
    await renderLoaded();
    await advance(15000);
    await flush();
    expect(screen.getByText(/1 pedido nuevo/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Ver nuevos/ }));

    expect(screen.queryByText(/pedido nuevo/)).toBeNull();
    expect(screen.getByText("OB-2")).toBeTruthy();
  });

  it("no suena si el aviso sonoro está apagado", async () => {
    stubFetchWithNewOrder();
    await renderLoaded();

    await advance(15000);
    await flush();

    expect(screen.getByText(/1 pedido nuevo/)).toBeTruthy();
    expect(sound.play).not.toHaveBeenCalled();
  });

  it("suena una vez cuando hay un pedido nuevo y el sonido está activado", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    stubFetchWithNewOrder();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: "Aviso sonoro" }));
    expect(sound.set).toHaveBeenCalledWith(true);
    expect(screen.getByRole("button", { name: "Aviso sonoro" }).getAttribute("aria-pressed")).toBe(
      "true",
    );

    await advance(15000);
    await flush();

    expect(screen.getByText(/1 pedido nuevo/)).toBeTruthy();
    expect(sound.play).toHaveBeenCalledTimes(1);
  });

  it("muestra hace cuánto se actualizó y deja actualizar a mano", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    stubFetchWithNewOrder();
    await renderLoaded();

    expect(screen.getByText(/Actualizado ahora/)).toBeTruthy();

    // Con la pestaña oculta no hay poll, así el paso del tiempo se mide sin que se refresque sola.
    setVisibility("hidden");
    await advance(20000);
    expect(screen.getByText(/Actualizado hace 20 s/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Actualizar" }));
    await flush();
    expect(screen.getByText(/Actualizado ahora/)).toBeTruthy();
  });
});

/**
 * B2 — aceptar y rechazar sin salir de la bandeja.
 *
 * Ir al detalle para aceptar un pedido es un viaje de ida y vuelta en el peor momento: el pedido
 * nuevo se está enfriando mientras se navega. Lo que se prueba acá es el contrato de la pantalla con
 * la API de estados: qué manda, qué hace cuando el pedido ya cambió y qué pasa sin conexión.
 */
describe("bandeja de órdenes: aceptar y rechazar desde la fila (B2)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(NOW);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  /** La lista, más un espía para el `PATCH` de estados. */
  function stubFetchWithActions({
    orders,
    patchStatus = 200,
    ordersFailFrom,
  }: {
    orders: unknown[];
    patchStatus?: number;
    /** A partir de esta lectura (1-based) la lista falla: sirve para simular que se cayó la red. */
    ordersFailFrom?: number;
  }) {
    let ordersCalls = 0;
    const fetchMock = vi.fn((url: string) => {
      const href = String(url);

      if (href.includes("/api/admin/locations")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ data: [] }) });
      }
      if (isOlderOpenCall(href)) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ data: [] }) });
      }
      if (href.includes("/status")) {
        return Promise.resolve({
          ok: patchStatus < 400,
          status: patchStatus,
          json: async () => ({}),
        });
      }

      ordersCalls += 1;
      if (ordersFailFrom && ordersCalls >= ordersFailFrom) {
        return Promise.reject(new Error("sin red"));
      }

      const data = ordersCalls === 1 ? orders : [...orders, order({ id: "ord_2", orderNumber: "OB-2" })];
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ data, meta: { count: data.length } }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    return fetchMock;
  }

  function statusCalls(fetchMock: ReturnType<typeof vi.fn>) {
    return fetchMock.mock.calls.filter(([url]) => String(url).includes("/status"));
  }

  async function flush(times = 12) {
    await act(async () => {
      for (let index = 0; index < times; index += 1) {
        await Promise.resolve();
      }
    });
  }

  async function renderWithActions(options: Parameters<typeof stubFetchWithActions>[0]) {
    const fetchMock = stubFetchWithActions(options);
    render(<AdminOrdersPage />);
    await flush();

    return fetchMock;
  }

  it("acepta el pedido desde la fila, sin abrir el detalle", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchMock = await renderWithActions({ orders: [order({ status: "new" })] });

    await user.click(screen.getByRole("button", { name: "Aceptar" }));
    await flush();

    const [url, init] = statusCalls(fetchMock)[0];
    expect(String(url)).toBe("/api/admin/orders/ord_1/status");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({ status: "confirmed", note: null });
  });

  it("refresca la lista después de cambiar el estado", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchMock = await renderWithActions({ orders: [order({ status: "new" })] });
    const callsBefore = fetchMock.mock.calls.length;

    await user.click(screen.getByRole("button", { name: "Aceptar" }));
    await flush();

    expect(screen.getByText("OB-2")).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it("el rechazo manda el motivo y avisa que se canceló", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchMock = await renderWithActions({ orders: [order({ status: "new" })] });

    await user.click(screen.getByRole("button", { name: "Rechazar" }));
    await user.type(screen.getByLabelText(/motivo del rechazo/i), "  Se quedó sin pan  ");
    await user.click(screen.getByRole("button", { name: "Confirmar rechazo" }));
    await flush();

    expect(JSON.parse(String(statusCalls(fetchMock)[0][1]?.body))).toEqual({
      status: "cancelled",
      note: "Se quedó sin pan",
    });
    expect(screen.getByTestId("orders-action-notice").textContent).toMatch(/cancelada/i);
  });

  it("si el pedido ya cambió de estado, lo dice y vuelve a leer la lista", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchMock = await renderWithActions({
      orders: [order({ status: "new" })],
      patchStatus: 409,
    });
    const callsBefore = fetchMock.mock.calls.length;

    await user.click(screen.getByRole("button", { name: "Aceptar" }));
    await flush();

    expect(screen.getByRole("alert").textContent).toMatch(/ya cambió de estado/i);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it("sin conexión las acciones se apagan y dicen por qué", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderWithActions({ orders: [order({ status: "new" })], ordersFailFrom: 2 });

    await user.click(screen.getByRole("button", { name: "Actualizar" }));
    await flush();

    // La lista se conserva (B0) y las acciones quedan deshabilitadas con el motivo a la vista.
    expect(screen.getByText("OB-1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aceptar" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getAllByText(/sin conexión/i).length).toBeGreaterThan(0);
  });
});
