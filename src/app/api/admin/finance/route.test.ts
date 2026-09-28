import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-016`, `D-018`, `security-change`) — `GET`/`POST /api/admin/finance`.
 *
 * La pantalla de Finanzas administra **cómo entra la plata**: monedas, tasas, moneda base, medios de pago y
 * entidades de cobro. Cambiar cualquiera de esas cosas cambia el número que el sistema espera, así que la
 * puerta es del **dueño** (`canManageFinanceConfig`) y se aplica **en el servidor**.
 *
 * Este archivo fija lo que la UI no puede garantizar: que un `manager` o un `cashier` **no** puedan escribir
 * la configuración financiera aunque conozcan la URL (regla dura de `AGENTS.md`: una UI nunca es por sí sola
 * una frontera de autorización).
 */

const requireAdminSessionMock = vi.fn();

const readFinanceConfigMock = vi.fn();
const saveCurrencyForRouteMock = vi.fn();
const registerRateForRouteMock = vi.fn();
const changeBaseCurrencyForRouteMock = vi.fn();
const savePaymentMethodForRouteMock = vi.fn();
const saveEntityForRouteMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: () => requireAdminSessionMock(),
}));

/**
 * Las **acciones** se mockean: lo que se prueba acá es la **puerta**, el enrutado del comando y la forma de
 * la respuesta. Las reglas de dinero viven en los casos de uso de `money`, con sus propios tests.
 *
 * La composición **no** se mockea a propósito: `requireFinanceOwner` es la frontera de autorización de la
 * ruta y el test tiene que ejercitarla de verdad (si se mockeara, el 403 se probaría contra un doble y no
 * contra la puerta que corre en producción).
 */
vi.mock("./finance-actions", () => ({
  readFinanceConfig: () => readFinanceConfigMock(),
  saveCurrencyForRoute: (payload: unknown) => saveCurrencyForRouteMock(payload),
  registerRateForRoute: (payload: unknown) => registerRateForRouteMock(payload),
  changeBaseCurrencyForRoute: (payload: unknown) => changeBaseCurrencyForRouteMock(payload),
  savePaymentMethodForRoute: (payload: unknown) => savePaymentMethodForRouteMock(payload),
  saveEntityForRoute: (payload: unknown) => saveEntityForRouteMock(payload),
}));

/**
 * La forma **real** de lo que la API devuelve, y eso importa más de lo que parece.
 *
 * `activeRates` es el **mapa** `moneda → tasa` de la conversión (`{ USD: 36.5 }`), no una lista: la vista
 * de Monedas y tasas lo trataba como un arreglo y se caía con `activeRates.find is not a function` apenas
 * hubiera una tasa —lo encontró la QA en navegador real—. Acá va con una entrada, que es el caso que
 * rompía; el contrato de la fila que la tabla dibuja es `rateHistory`.
 */
const config = {
  settings: {
    baseCurrencyCode: "NIO",
    locale: "es-NI",
    currencies: [
      { code: "NIO", name: "Córdoba nicaragüense", symbol: "C$", decimals: 2, isKnown: true, isActive: true, sortOrder: 0 },
      { code: "USD", name: "Dólar estadounidense", symbol: "US$", decimals: 2, isKnown: true, isActive: true, sortOrder: 1 },
    ],
    activeRates: { USD: 36.5 },
    rateHistory: [
      {
        fromCurrencyCode: "USD",
        toCurrencyCode: "NIO",
        rate: 36.5,
        effectiveFrom: "2026-09-01T00:00:00.000Z",
      },
    ],
  },
  knownCurrencies: [{ code: "NIO", name: "Córdoba nicaragüense", symbol: "C$", decimals: 2 }],
  knownLocales: [{ value: "es-NI", label: "Español (Nicaragua)" }],
  entities: [],
  paymentMethods: [],
};

function post(body: unknown) {
  return new Request("http://localhost/api/admin/finance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function callGet() {
  const { GET } = await import("./route");

  return GET();
}

async function callPost(body: unknown) {
  const { POST } = await import("./route");

  return POST(post(body));
}

describe("/api/admin/finance", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_owner", role: "owner", locationIds: [] },
    });
    readFinanceConfigMock.mockResolvedValue(config);
  });

  it("el dueño lee la configuración financiera", async () => {
    const response = await callGet();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.settings.baseCurrencyCode).toBe("NIO");
    // Una configuración que se acaba de guardar no puede venir de un caché.
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("enruta cada comando con nombre a su acción", async () => {
    saveCurrencyForRouteMock.mockResolvedValue({ code: "USD" });
    registerRateForRouteMock.mockResolvedValue({ data: { fromCurrencyCode: "USD", rate: 36.5 } });
    changeBaseCurrencyForRouteMock.mockResolvedValue({ data: { baseCurrencyCode: "USD" } });
    savePaymentMethodForRouteMock.mockResolvedValue({ id: "pmc_1" });
    saveEntityForRouteMock.mockResolvedValue({ id: "bank_1" });

    for (const action of [
      "save-currency",
      "register-rate",
      "change-base-currency",
      "save-payment-method",
      "save-entity",
    ]) {
      const response = await callPost({ action, payload: { code: "USD" } });

      expect(response.status, `la acción ${action} tendría que responder 200`).toBe(200);
    }

    expect(saveCurrencyForRouteMock).toHaveBeenCalledTimes(1);
    expect(registerRateForRouteMock).toHaveBeenCalledTimes(1);
    expect(changeBaseCurrencyForRouteMock).toHaveBeenCalledTimes(1);
    expect(savePaymentMethodForRouteMock).toHaveBeenCalledTimes(1);
    expect(saveEntityForRouteMock).toHaveBeenCalledTimes(1);
  });

  it("una acción desconocida es 422 y no toca ninguna configuración", async () => {
    const response = await callPost({ action: "borrar-todo", payload: {} });

    expect(response.status).toBe(422);
    expect(saveCurrencyForRouteMock).not.toHaveBeenCalled();
  });

  /**
   * `security-change` § *Pruebas negativas* — **sin permiso, 403**, y la acción no corre. El `manager`
   * administra la caja pero no la configuración financiera; el `cashier` cobra y no configura.
   */
  it.each([["manager"], ["cashier"], ["kitchen"]])(
    "el rol %s no administra finanzas: 403 y ninguna acción corre",
    async (role) => {
      requireAdminSessionMock.mockResolvedValue({ user: { id: "user_x", role, locationIds: [] } });

      const getResponse = await callGet();
      const postResponse = await callPost({ action: "register-rate", payload: { rate: 36.5 } });

      expect(getResponse.status).toBe(403);
      expect(postResponse.status).toBe(403);
      expect(registerRateForRouteMock).not.toHaveBeenCalled();
    },
  );

  it("sin sesión, la ruta responde 401 (no un 500 ni una lista vacía)", async () => {
    const { AuthError } = await import("@/modules/auth/domain/auth-errors");
    requireAdminSessionMock.mockRejectedValue(new AuthError(401, "UNAUTHORIZED", "No session"));

    const response = await callGet();

    expect(response.status).toBe(401);
  });
});
