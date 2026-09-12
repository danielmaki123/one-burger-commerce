import { describe, expect, it } from "vitest";

import type { BusinessHours } from "@/modules/business-settings/domain/business-settings.types";
import {
  pickDefaultLocation,
  resolveLocation,
  type LocationRecord,
} from "@/modules/locations/domain/location-rules";

/**
 * T8 fase 1 — qué local atiende un pedido.
 *
 * Regla del brief: si el cliente (o el admin) no eligió local, se usa el **primario**:
 * el primero activo por orden. Un local inactivo o inexistente se rechaza; el servidor
 * nunca cae en "el primero que haya" si el que pidieron no sirve.
 */
const HOURS: BusinessHours = {
  mon: { open: "12:00", close: "22:00", closed: false },
  tue: { open: "12:00", close: "22:00", closed: false },
  wed: { open: "12:00", close: "22:00", closed: false },
  thu: { open: "12:00", close: "22:00", closed: false },
  fri: { open: "12:00", close: "22:00", closed: false },
  sat: { open: "12:00", close: "22:00", closed: false },
  sun: { open: "12:00", close: "22:00", closed: false },
};

function location(overrides: Partial<LocationRecord> & { id: string; name: string }): LocationRecord {
  return {
    slug: overrides.id,
    isActive: true,
    sortOrder: 0,
    addressLine: null,
    city: null,
    addressReference: null,
    mapsUrl: null,
    latitude: null,
    longitude: null,
    phone: null,
    whatsapp: null,
    businessHours: HOURS,
    pickupLeadMinutes: 25,
    pickupMaxMinutes: null,
    isAcceptingOrders: true,
    closedMessage: null,
    createdAt: "2026-09-12T00:00:00.000Z",
    updatedAt: "2026-09-12T00:00:00.000Z",
    ...overrides,
  };
}

const principal = location({ id: "loc_principal", name: "Principal", sortOrder: 0 });
const segunda = location({ id: "loc_segunda", name: "Segunda", sortOrder: 1 });

describe("pickDefaultLocation", () => {
  it("sin locales devuelve null", () => {
    expect(pickDefaultLocation([])).toBeNull();
  });

  it("elige el primero por orden, no el primero de la lista", () => {
    expect(pickDefaultLocation([segunda, principal])?.id).toBe("loc_principal");
  });

  it("saltea los inactivos", () => {
    const apagado = location({ id: "loc_apagado", name: "Apagado", sortOrder: 0, isActive: false });

    expect(pickDefaultLocation([apagado, segunda])?.id).toBe("loc_segunda");
  });

  it("con el mismo orden desempata por nombre, para que no dependa del azar de la base", () => {
    const b = location({ id: "loc_b", name: "Bravo", sortOrder: 0 });
    const a = location({ id: "loc_a", name: "Alfa", sortOrder: 0 });

    expect(pickDefaultLocation([b, a])?.id).toBe("loc_a");
  });

  it("si todos están apagados no hay local por defecto", () => {
    expect(
      pickDefaultLocation([
        location({ id: "loc_1", name: "Uno", isActive: false }),
        location({ id: "loc_2", name: "Dos", isActive: false }),
      ]),
    ).toBeNull();
  });
});

describe("resolveLocation", () => {
  it("sin local pedido usa el primario", () => {
    const result = resolveLocation({ requestedLocationId: null, locations: [segunda, principal] });

    expect(result).toEqual({ ok: true, location: principal });
  });

  it("con local pedido lo usa, aunque no sea el primario", () => {
    const result = resolveLocation({
      requestedLocationId: "loc_segunda",
      locations: [principal, segunda],
    });

    expect(result).toEqual({ ok: true, location: segunda });
  });

  it("un local inexistente se rechaza en vez de caer al primario", () => {
    const result = resolveLocation({
      requestedLocationId: "loc_fantasma",
      locations: [principal, segunda],
    });

    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it("un local inactivo se rechaza con su motivo", () => {
    const apagado = location({ id: "loc_apagado", name: "Apagado", isActive: false });

    const result = resolveLocation({
      requestedLocationId: "loc_apagado",
      locations: [principal, apagado],
    });

    expect(result).toEqual({ ok: false, reason: "inactive" });
  });

  it("sin ningún local activo no se puede pedir", () => {
    const result = resolveLocation({
      requestedLocationId: null,
      locations: [location({ id: "loc_1", name: "Uno", isActive: false })],
    });

    expect(result).toEqual({ ok: false, reason: "none-active" });
  });

  it("un id vacío o con espacios cuenta como 'no eligió'", () => {
    expect(resolveLocation({ requestedLocationId: "", locations: [principal] })).toEqual({
      ok: true,
      location: principal,
    });
    expect(resolveLocation({ requestedLocationId: "   ", locations: [principal] })).toEqual({
      ok: true,
      location: principal,
    });
  });
});
