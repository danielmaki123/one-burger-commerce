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
    // B3: la comanda mide su urgencia con esto y dibuja lo que hay que cocinar.
    stageChangedAt: "2026-09-12T01:40:00.000Z",
    items: [
      {
        id: "item_1",
        productName: "Hamburguesa Doble",
        quantity: 1,
        notes: null,
        modifiers: [],
      },
    ],
    ...overrides,
  };
}

/**
 * B3 — la vista del turno es el **tablero de comandas**; la lista con sus chips, su resumen y la barra
 * de filtros quedó en el historial. Los casos que prueban esa lista (el semáforo del retiro y los
 * filtros) entran al historial a propósito.
 */
async function goToHistory() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Historial" }));
  await screen.findByRole("button", { name: "Mostrar filtros" });
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
  // Se espera a la barra de comandas y no a un pedido: hay casos con pedidos que el tablero **no**
  // muestra (uno cerrado, por ejemplo) y ahí esperar por el número sería esperar para siempre.
  await waitFor(() => expect(screen.getByTestId("comandas-topbar")).toBeTruthy());

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
    await goToHistory();

    expect(timingChip(container, "on-time")?.textContent).toBe("en 30 min");
  });

  it("pasa a naranja cuando se cumplió la hora", async () => {
    const { container } = await renderWith([
      order({ pickupTime: "2026-09-12T02:05:00.000Z", pickupScheduled: true }),
    ]);
    await goToHistory();

    expect(timingChip(container, "past")?.textContent).toBe("hace 5 min");
  });

  it("pasa a rojo cuando ya es muy tarde", async () => {
    const { container } = await renderWith([
      order({ pickupTime: "2026-09-12T01:50:00.000Z", pickupScheduled: true }),
    ]);
    await goToHistory();

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
    await goToHistory();

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
    await goToHistory();

    expect(timingChip(container, "past")).toBeNull();
    expect(timingChip(container, "late")).toBeNull();
    expect(timingChip(container, "on-time")).toBeNull();
  });

  it("no inventa una hora si el pedido no la tiene", async () => {
    const { container } = await renderWith([order({ pickupTime: null })]);

    // Sin hora prometida no se inventa una cuenta regresiva; queda el dato que sí existe: cuándo entró.
    expect(screen.queryByText(/^Retiro ~?\d/)).toBeNull();
    expect(screen.getByText(/^Entró /)).toBeTruthy();
    expect(timingChip(container, "late")).toBeNull();
  });

  it("con un solo local no dibuja el filtro por local (T8)", async () => {
    const user = userEvent.setup();
    await renderWithLocations([order()], [{ id: "loc_principal", name: "Principal", isActive: true }]);

    // El panel de filtros se abre a propósito: si no, la ausencia no probaría nada.
    await goToHistory();
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

    await goToHistory();
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
    await goToHistory();
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
    await goToHistory();
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
    await goToHistory();
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
    await goToHistory();
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

    // El boton del turno dispara otra lectura, que ahora falla.
    await user.click(screen.getByRole("button", { name: "Actualizar" }));

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

    // Bug de producción (2026-09-18): el cartel dice **qué** pasó, no un genérico.
    expect(await screen.findByText(/No se pudo hablar con el servidor/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
  });

  it("reintentar vuelve a pedir la lista", async () => {
    const user = userEvent.setup();
    let ordersCalls = 0;
    let caida = true;
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
      // La caída es sostenida mientras «caida» siga prendida: un bache de un solo intento ya no llega a la
      // pantalla (se reintenta solo). Cuando la red vuelve, el botón trae la lista nueva.
      if (caida) return Promise.reject(new Error("sin red"));

      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [order(), order({ id: "ord_2", orderNumber: "OB-2" })], meta: { count: 2 } }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminOrdersPage />);
    await screen.findByText("OB-1");
    await user.click(screen.getByRole("button", { name: "Actualizar" }));
    await screen.findByText(/No se pudo actualizar la bandeja/);

    // La red vuelve y el botón trae la lista nueva.
    caida = false;
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
    // `setTimeout` no está falseado en este bloque: los reintentos de la lectura (bug de producción
    // 2026-09-18) esperan de verdad antes de darse por vencidos.
    await new Promise((resolve) => setTimeout(resolve, 1_600));
    await flush();

    // La lista se conserva (B0) y las acciones quedan deshabilitadas con el motivo a la vista.
    expect(screen.getByText("OB-1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aceptar" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getAllByText(/sin conexión/i).length).toBeGreaterThan(0);
  });
});

/**
 * B3 — el turno como tablero de comandas.
 *
 * La lista del historial sigue existiendo, pero el día se mira en tres carriles. Lo que se prueba acá
 * es lo que la pantalla aporta por encima del tablero aislado: los contadores de la barra, el carril
 * de celular, el aviso por lector de pantalla de lo que se atrasa y que el tablero vacío no mienta.
 */
describe("bandeja de órdenes: tablero de comandas (B3)", () => {
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

  async function flush(times = 12) {
    await act(async () => {
      for (let index = 0; index < times; index += 1) {
        await Promise.resolve();
      }
    });
  }

  async function renderBoardWith(orders: unknown[]) {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ data: String(url).includes("/api/admin/locations") ? [] : orders }),
        }),
      ),
    );

    render(<AdminOrdersPage />);
    await flush();
  }

  it("reparte el turno en los tres carriles y cuenta lo que hay en cada uno", async () => {
    await renderBoardWith([
      order({ id: "ord_1", status: "new" }),
      order({ id: "ord_2", orderNumber: "OB-2", status: "preparing" }),
      order({ id: "ord_3", orderNumber: "OB-3", status: "ready_for_pickup" }),
      order({ id: "ord_4", orderNumber: "OB-4", status: "closed" }),
    ]);

    expect(screen.getByRole("heading", { name: /Por aceptar \(1\)/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /En preparación \(1\)/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Listas \(1\)/ })).toBeTruthy();
    // Lo cerrado no está en el tablero del turno.
    expect(screen.queryByText("OB-4")).toBeNull();

    const topbar = screen.getByTestId("comandas-topbar");
    expect(topbar.textContent).toMatch(/Nuevas: 1/);
    expect(topbar.textContent).toMatch(/Preparando: 1/);
    expect(topbar.textContent).toMatch(/Listas: 1/);
  });

  /**
   * B6 — la vuelta al panel está en la barra del turno.
   *
   * El bug lo encontró el owner en producción: el tablero se abre sin la barra lateral del panel y no
   * había manera de recuperarla. El control dice «Ver el panel» y la devuelve (sin cerrar sesión: la
   * sesión y la navegación viven en esa barra).
   */
  it("la barra del turno deja volver al panel (B6)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderBoardWith([order({ status: "new" })]);

    // El tablero arranca a pantalla completa: sin la barra lateral del panel.
    expect(document.documentElement.classList.contains("comandas-view")).toBe(true);

    const toggle = screen.getByRole("button", { name: "Ver el panel" });
    expect(within(screen.getByTestId("comandas-topbar")).getByRole("button", { name: "Ver el panel" })).toBe(toggle);

    await user.click(toggle);

    // Al volver, la barra lateral del panel queda accesible otra vez y el control invita a lo contrario.
    expect(document.documentElement.classList.contains("comandas-view")).toBe(false);
    expect(screen.getByRole("button", { name: "Pantalla completa" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull();
  });

  it("el conmutador de celular ofrece un carril por vez, con su cuenta", async () => {
    await renderBoardWith([
      order({ id: "ord_1", status: "new" }),
      order({ id: "ord_2", orderNumber: "OB-2", status: "ready_for_pickup" }),
    ]);

    expect(screen.getByRole("button", { name: "Por aceptar 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Listas 1" })).toBeTruthy();
  });

  it("sin comandas el tablero enseña qué va a aparecer en cada carril", async () => {
    await renderBoardWith([]);

    expect(screen.getAllByText(/No hay comandas nuevas\./).length).toBeGreaterThan(0);
    expect(screen.queryByText("No se pudieron cargar las órdenes.")).toBeNull();
  });

  it("avisa por lector de pantalla cuando una comanda se pasa de tiempo, una sola vez", async () => {
    await renderBoardWith([
      order({
        id: "ord_1",
        status: "preparing",
        // 20 minutos en la etapa: ya está atrasada (el umbral es 15).
        stageChangedAt: new Date(NOW.getTime() - 20 * 60_000).toISOString(),
      }),
    ]);

    const announcement = screen.getByTestId("comandas-late-announcement");
    expect(announcement.textContent).toMatch(/OB-1.*más de 15 minutos/);

    // Otro tick del reloj no lo repite: sería ruido cada cinco segundos.
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    await flush();
    expect(screen.getByTestId("comandas-late-announcement").textContent).toMatch(
      /OB-1.*más de 15 minutos/,
    );
  });

  /**
   * La separación de la fase 4 del checkout, que el tablero tiene que respetar igual que la lista: un
   * pedido programado para **otro día** no puede caer en «Por aceptar» —la cocina lo empezaría hoy— ni
   * contarse en los contadores del turno.
   */
  it("un pedido programado para otro día no entra en los carriles", async () => {
    await renderBoardWith([
      order({ id: "ord_1", status: "new" }),
      order({
        id: "ord_2",
        orderNumber: "OB-2",
        status: "new",
        pickupTime: "2026-09-14T18:00:00.000Z",
        pickupScheduled: true,
      }),
    ]);

    const pending = screen.getByRole("region", { name: "Por aceptar" });
    expect(within(pending).getByText("OB-1")).toBeTruthy();
    expect(within(pending).queryByText("OB-2")).toBeNull();

    // Y se anuncia aparte, con la salida al listado donde tiene su grupo.
    expect(screen.getByTestId("comandas-scheduled-notice").textContent).toMatch(
      /1 comanda programada para otro día/,
    );
    expect(screen.getByRole("button", { name: "Ver en el listado" })).toBeTruthy();
  });

  it("el historial conserva la lista con sus filtros, sin el tablero", async () => {    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderBoardWith([order({ status: "new" })]);

    await user.click(screen.getByRole("button", { name: "Historial" }));
    await flush();

    expect(screen.queryByTestId("comandas-topbar")).toBeNull();
    expect(screen.getByRole("button", { name: "Mostrar filtros" })).toBeTruthy();
    expect(screen.getByText("OB-1")).toBeTruthy();
  });
});

/**
 * B5 — los umbrales con los que avisa el tablero.
 *
 * Son **del local**: la sucursal del centro no cocina al ritmo de la de la carretera. Se usan los del
 * local que se está mirando. Con varias sucursales a la vista y sin filtro no hay un ritmo único que
 * valga, así que rigen los valores por defecto del negocio (10 sin aceptar, 15 en cocina).
 */
describe("bandeja de órdenes: umbrales por local (B5)", () => {
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

  async function flush(times = 12) {
    await act(async () => {
      for (let index = 0; index < times; index += 1) {
        await Promise.resolve();
      }
    });
  }

  async function renderWithThresholds({
    locations,
    locationScope = null,
  }: {
    locations: Array<Record<string, unknown>>;
    locationScope?: string[] | null;
  }) {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () =>
            String(url).includes("/api/admin/locations")
              ? { data: locations }
              : {
                  data: [
                    order({
                      id: "ord_1",
                      status: "new",
                      // Siete minutos sin que nadie lo acepte.
                      stageChangedAt: new Date(NOW.getTime() - 7 * 60_000).toISOString(),
                    }),
                  ],
                  meta: { count: 1, locationScope },
                },
        }),
      ),
    );

    const view = render(<AdminOrdersPage />);
    await flush();

    return view;
  }

  function urgency(container: HTMLElement) {
    return container.querySelector("[data-urgency]")?.getAttribute("data-urgency");
  }

  it("con un solo local usa su umbral: avisa a los 5 minutos, no a los 10", async () => {
    const { container } = await renderWithThresholds({
      locations: [
        {
          id: "loc_centro",
          name: "Centro",
          isActive: true,
          acceptAlertMinutes: 5,
          prepAlertMinutes: 20,
        },
      ],
      locationScope: ["loc_centro"],
    });

    expect(urgency(container)).toBe("warning");
    expect(screen.getByText("hace 7 min")).toBeTruthy();
  });

  it("con varias sucursales a la vista rigen los valores por defecto del negocio", async () => {
    const { container } = await renderWithThresholds({
      locations: [
        { id: "loc_centro", name: "Centro", isActive: true, acceptAlertMinutes: 5 },
        { id: "loc_carretera", name: "Carretera", isActive: true, acceptAlertMinutes: 30 },
      ],
    });

    // A los 10 minutos avisa y a los 15 está atrasado: con 7 todavía no.
    expect(urgency(container)).toBe("normal");
  });
});

/**
 * B5 — el ritmo de la cocina hoy.
 *
 * El promedio lo resuelve el servidor con los sellos de todos los pedidos (los que ya quedaron listos);
 * la pantalla lo muestra tal cual. Un promedio nulo dice "sin datos todavía" en vez de "0 min", que se
 * leería como una cocina instantánea.
 */
describe("bandeja de órdenes: promedio de preparación (B5)", () => {
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

  async function renderWithPrep(averagePrepMinutes: number | null) {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () =>
            String(url).includes("/api/admin/locations")
              ? { data: [] }
              : { data: [order({ status: "new" })], meta: { count: 1, averagePrepMinutes } },
        }),
      ),
    );

    render(<AdminOrdersPage />);
    await act(async () => {
      for (let index = 0; index < 12; index += 1) await Promise.resolve();
    });
  }

  it("muestra cuánto tarda la cocina hoy", async () => {
    await renderWithPrep(14);

    expect(screen.getByTestId("orders-average-prep").textContent).toBe(
      "Preparación promedio hoy: 14 min",
    );
  });

  it("sin pedidos listos lo dice, en vez de mostrar cero", async () => {
    await renderWithPrep(null);

    expect(screen.getByTestId("orders-average-prep").textContent).toBe(
      "Preparación promedio: sin datos todavía",
    );
  });
});

/**
 * B4 — buscar y acotar el turno.
 *
 * El caso real: entra un pedido, el cliente llama preguntando por él, y quien atiende tiene el número,
 * el nombre o el WhatsApp a mano. La búsqueda va al servidor (la lista del día puede ser larga y el
 * celular de la cocina no la baja entera para filtrarla) y los filtros quedan en la URL para poder
 * mandarle el enlace a la cocina o recargar sin perder lo que se estaba mirando.
 */
describe("bandeja de órdenes: buscar y filtrar (B4)", () => {
  beforeEach(() => {
    // Acá `setTimeout` queda real: el buscador tiene una demora propia que se espera con `waitFor`.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    // La URL es del entorno, no del test: se limpia para que un caso no arrastre los filtros del otro.
    window.history.replaceState(null, "", "/admin/orders");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function stubFetchWith(orders: unknown[]) {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ data: String(url).includes("/api/admin/locations") ? [] : orders }),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    return fetchMock;
  }

  function listCalls(fetchMock: ReturnType<typeof vi.fn>) {
    return fetchMock.mock.calls
      .map(([url]) => String(url))
      .filter((url) => !url.includes("/api/admin/locations"));
  }

  it("busca en el servidor cuando la persona termina de escribir", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetchWith([order({ status: "new" })]);
    render(<AdminOrdersPage />);
    await screen.findByText("OB-1");

    await user.type(screen.getByLabelText("Buscar comanda"), "ana");

    await waitFor(() => {
      expect(listCalls(fetchMock).some((url) => url.includes("search=ana"))).toBe(true);
    });
  });

  it("lo que no coincide lo dice el carril, no una pantalla vacía", async () => {
    const user = userEvent.setup();
    stubFetchWith([]);
    render(<AdminOrdersPage />);
    await waitFor(() => expect(screen.getByTestId("comandas-topbar")).toBeTruthy());

    await user.type(screen.getByLabelText("Buscar comanda"), "zzz");

    expect(
      await screen.findAllByText(/Ninguna comanda de este carril coincide con «zzz»\./),
    ).not.toHaveLength(0);
  });

  it("el filtro de atrasados deja solo lo que pasó el umbral", async () => {
    const user = userEvent.setup();
    stubFetchWith([
      order({
        id: "ord_1",
        orderNumber: "OB-1",
        status: "preparing",
        customerName: "Atrasada",
        stageChangedAt: new Date(NOW.getTime() - 20 * 60_000).toISOString(),
      }),
      order({
        id: "ord_2",
        orderNumber: "OB-2",
        status: "preparing",
        customerName: "Al día",
        stageChangedAt: new Date(NOW.getTime() - 2 * 60_000).toISOString(),
      }),
    ]);
    render(<AdminOrdersPage />);
    await screen.findByText("Atrasada");

    await user.click(screen.getByRole("button", { name: "Atrasados" }));

    expect(screen.getByText("Atrasada")).toBeTruthy();
    expect(screen.queryByText("Al día")).toBeNull();
    // El filtro es de la vista: queda en la URL.
    expect(window.location.search).toContain("late=1");
  });

  it("los filtros quedan en la URL y se pueden limpiar", async () => {
    const user = userEvent.setup();
    stubFetchWith([order({ status: "new" })]);
    render(<AdminOrdersPage />);
    await screen.findByText("OB-1");

    await user.type(screen.getByLabelText("Buscar comanda"), "ana");
    await user.selectOptions(screen.getByLabelText("Forma de pago"), "cash");

    await waitFor(() => {
      expect(window.location.search).toContain("search=ana");
      expect(window.location.search).toContain("paymentMethod=cash");
    });

    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));

    await waitFor(() => {
      expect(window.location.search).not.toContain("search=ana");
      expect(window.location.search).not.toContain("paymentMethod=cash");
    });
    expect(screen.getByLabelText("Buscar comanda")).toHaveProperty("value", "");
  });

  it("abre con los filtros que trae el enlace", async () => {
    const fetchMock = stubFetchWith([order({ status: "new" })]);
    window.history.replaceState(null, "", "/admin/orders?search=ana&paymentMethod=card");

    render(<AdminOrdersPage />);
    await screen.findByText("OB-1");

    expect(screen.getByLabelText("Buscar comanda")).toHaveProperty("value", "ana");
    await waitFor(() => {
      expect(listCalls(fetchMock).some((url) => url.includes("search=ana"))).toBe(true);
      expect(listCalls(fetchMock).some((url) => url.includes("paymentMethod=card"))).toBe(true);
    });
  });
});



