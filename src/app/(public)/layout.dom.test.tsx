// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDefaultBusinessSettingsRecord } from "@/modules/business-settings/domain/business-settings-defaults";
import type { BusinessHours } from "@/modules/business-settings/domain/business-settings.types";
import type { PublicLocation } from "@/modules/locations/features/list-public-locations/list-public-locations";
import {
  BusinessSettingsProvider,
  type BusinessSettingsValue,
} from "@/shared/lib/business-settings";

import PublicLayout from "./layout";

/** No hay router en jsdom: el layout solo necesita saber en qué ruta está. */
vi.mock("next/navigation", () => ({
  usePathname: () => "/menu",
}));

/** Horario del **negocio**: tiene que dejar de aparecer en el footer (A-07). */
const BUSINESS_HOURS: BusinessHours = {
  mon: { open: "07:00", close: "15:00", closed: false },
  tue: { open: "07:00", close: "15:00", closed: false },
  wed: { open: "07:00", close: "15:00", closed: false },
  thu: { open: "07:00", close: "15:00", closed: false },
  fri: { open: "07:00", close: "15:00", closed: false },
  sat: { open: "07:00", close: "15:00", closed: false },
  sun: { open: "07:00", close: "15:00", closed: false },
};

/** Horario de **cada local** (distinto del del negocio, a propósito). */
const LOCATION_HOURS: BusinessHours = {
  mon: { open: "09:00", close: "18:00", closed: false },
  tue: { open: "09:00", close: "18:00", closed: false },
  wed: { open: "09:00", close: "18:00", closed: false },
  thu: { open: "09:00", close: "18:00", closed: false },
  fri: { open: "09:00", close: "18:00", closed: false },
  sat: { open: "09:00", close: "18:00", closed: false },
  sun: { open: "09:00", close: "18:00", closed: false },
};

const BUSINESS_CITY = "Ciudad Configurada";

function location(overrides: Partial<PublicLocation> = {}): PublicLocation {
  return {
    id: "loc_norte",
    name: "Sucursal Norte",
    addressLine: "Frente al parque",
    city: "Jinotepe",
    addressReference: null,
    mapsUrl: null,
    businessHours: LOCATION_HOURS,
    pickupLeadMinutes: 25,
    pickupMaxMinutes: null,
    isAcceptingOrders: true,
    closedMessage: null,
    ...overrides,
  };
}

function settingsValue(overrides: Partial<BusinessSettingsValue> = {}): BusinessSettingsValue {
  const record = createDefaultBusinessSettingsRecord();

  return {
    ...record,
    updatedAt: record.updatedAt.toISOString(),
    businessHours: BUSINESS_HOURS,
    city: BUSINESS_CITY,
    ...overrides,
  };
}

function renderLayout(locations: PublicLocation[], settings = settingsValue()) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      const body = url.includes("/api/locations") ? { data: locations } : {};

      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
    }),
  );

  return render(
    <BusinessSettingsProvider settings={settings}>
      <PublicLayout>
        <p>contenido</p>
      </PublicLayout>
    </BusinessSettingsProvider>,
  );
}

function getFooter(): HTMLElement {
  const footer = document.querySelector("footer");
  if (!footer) throw new Error("el layout público tendría que dibujar el footer");

  return footer;
}

/**
 * A-07 — la información que el footer muestra de las sucursales.
 *
 * El footer es de escritorio (`hidden … md:block`), así que la verificación de ancho la hace el
 * E2E; lo que se fija acá es **la fuente de los datos**: cada local sale de `/api/locations` y el
 * horario y la ciudad de la **configuración del negocio** dejan de dibujarse (con más de un local
 * no corresponden a ninguno). jsdom es el lugar correcto para esto porque el bloque viejo estaba
 * oculto por CSS y en el navegador no se hubiera podido ver.
 */
describe("footer público (A-07)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("lista cada sucursal con su dirección y no el horario ni la ciudad del negocio", async () => {
    renderLayout([
      location(),
      location({
        id: "loc_masaya",
        name: "Carretera Masaya",
        addressLine: "Km 8 carretera",
        city: "Managua",
      }),
    ]);

    const footer = getFooter();

    // Cada sucursal, con la dirección de **ese** local.
    expect(await within(footer).findByText("Sucursal Norte")).toBeTruthy();
    expect(within(footer).getByText("Carretera Masaya")).toBeTruthy();
    expect(within(footer).getByText("Frente al parque, Jinotepe")).toBeTruthy();
    expect(within(footer).getByText("Km 8 carretera, Managua")).toBeTruthy();

    // El horario que manda es el de cada local, no el de la configuración.
    expect(within(footer).getAllByText(/09:00 - 18:00/)).toHaveLength(2);
    expect(within(footer).queryAllByText(/07:00 - 15:00/)).toHaveLength(0);
    expect(within(footer).queryAllByText(BUSINESS_CITY)).toHaveLength(0);
  });

  it("sin sucursales cargadas no muestra el horario del negocio", async () => {
    renderLayout([]);

    const footer = getFooter();

    expect(within(footer).queryAllByText(/07:00 - 15:00/)).toHaveLength(0);
    expect(within(footer).queryAllByText(BUSINESS_CITY)).toHaveLength(0);
  });

  it("sin sucursales tampoco dibuja el encabezado de sucursales", async () => {
    renderLayout([]);

    expect(screen.queryByRole("heading", { name: "Sucursales" })).toBeNull();
  });
});
