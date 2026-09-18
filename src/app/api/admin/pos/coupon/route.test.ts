import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";
import {
  createInMemoryLocation,
  InMemoryLocationRepository,
} from "@/modules/locations/adapters/in-memory-location-repository";
import { PosError } from "@/modules/pos/domain/pos-errors";

/**
 * Tarea 9.6 del roadmap del POS (Fase 2) — la ruta que cotiza un cupón.
 *
 * Lo que se prueba es la composición: cocina no cotiza, un local fuera del alcance no se cotiza, el payload
 * se valida con el campo señalado y una cotización válida devuelve el descuento. El caso de uso corre de
 * verdad (`quotePosCoupon`), con sus dependencias simuladas: lo que se prueba es la ruta.
 */

const requireAdminSessionMock = vi.fn();
const canUsePOSMock = vi.fn();
const findCouponByCodeMock = vi.fn();
const getProductMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canUsePOS: canUsePOSMock,
}));

vi.mock("@/modules/pos/adapters/production-pos-coupon", () => ({
  createProductionPosCouponDependencies: () => ({
    findCouponByCode: findCouponByCodeMock,
    getProduct: getProductMock,
  }),
}));

const locationRepository = new InMemoryLocationRepository([
  createInMemoryLocation({ id: "loc_norte", name: "Norte" }),
  createInMemoryLocation({ id: "loc_apagado", name: "Apagado", posEnabled: false }),
]);

vi.mock("@/modules/pos/adapters/production-pos-location", () => ({
  createProductionPosLocationDependencies: () => ({ repository: locationRepository }),
}));

const body = {
  locationId: "loc_norte",
  code: "BIENVENIDA10",
  lines: [{ productId: "prod_taco", quantity: 2 }],
};

async function callRoute(payload: unknown) {
  const { POST } = await import("./route");

  return POST(
    new Request("http://localhost/api/admin/pos/coupon", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
}

describe("admin pos coupon route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "admin_1", role: "cashier", locationIds: [] },
    });
    canUsePOSMock.mockReturnValue(true);
    findCouponByCodeMock.mockResolvedValue({
      id: "coupon_10",
      code: "BIENVENIDA10",
      type: "percentage",
      value: 10,
      isActive: true,
      usageLimit: 100,
      usedCount: 0,
      expiresAt: null,
    });
    getProductMock.mockResolvedValue({
      id: "prod_taco",
      name: "Taco de birria",
      basePrice: 35,
      categoryId: "cat_tacos",
      subcategoryId: null,
      isActive: true,
      isAvailable: true,
    });
  });

  it("sin sesión responde 401", async () => {
    requireAdminSessionMock.mockRejectedValue(new AuthError(401, "UNAUTHORIZED", "No session"));

    const response = await callRoute(body);

    expect(response.status).toBe(401);
    expect(findCouponByCodeMock).not.toHaveBeenCalled();
  });

  it("cocina no cotiza: 403", async () => {
    canUsePOSMock.mockReturnValue(false);

    const response = await callRoute(body);

    expect(response.status).toBe(403);
    expect(findCouponByCodeMock).not.toHaveBeenCalled();
  });

  it("un local fuera del alcance del staff responde 403", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "admin_2", role: "cashier", locationIds: ["loc_sur"] },
    });

    const response = await callRoute(body);
    const parsed = await response.json();

    expect(response.status).toBe(403);
    expect(parsed.error.fields.locationId).toContain("acceso");
  });

  it("un payload sin líneas se rechaza con el campo señalado", async () => {
    const response = await callRoute({ ...body, lines: [] });
    const parsed = await response.json();

    expect(response.status).toBe(422);
    expect(parsed.error.fields.lines).toContain("al menos un producto");
    expect(findCouponByCodeMock).not.toHaveBeenCalled();
  });

  it("cotiza el cupón del local y devuelve el descuento", async () => {
    const response = await callRoute(body);
    const parsed = await response.json();

    expect(response.status).toBe(200);
    expect(parsed.data).toMatchObject({
      subtotal: 70,
      discount: 7,
      coupon: { code: "BIENVENIDA10", type: "percentage", value: 10 },
    });
    expect(findCouponByCodeMock).toHaveBeenCalledWith("BIENVENIDA10");
  });

  it("un cupón rechazado por el dominio sale con su motivo en el campo del cupón", async () => {
    findCouponByCodeMock.mockResolvedValue(null);

    const response = await callRoute(body);
    const parsed = await response.json();

    expect(response.status).toBe(404);
    expect(parsed.error.fields.coupon).toContain("no existe");
  });

  it("un error del caso de uso no se convierte en un 500", async () => {
    getProductMock.mockRejectedValue(new PosError(409, "CONFLICT", "algo"));

    const response = await callRoute(body);

    expect(response.status).toBe(409);
  });
});
