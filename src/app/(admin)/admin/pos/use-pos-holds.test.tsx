// @vitest-environment jsdom

import { StrictMode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  MAX_POS_HELDS,
  posHoldTitle,
  serializePosHolds,
  type PosHeldSale,
} from "@/modules/pos/domain/pos-holds";

import { POS_HOLDS_STORAGE_PREFIX, usePosHolds } from "./use-pos-holds";

/**
 * Tareas 9.4 y 9.5 del roadmap del POS (Fase 2) — las ventas en espera del dispositivo.
 *
 * El hook guarda y lee las esperas de **este** local en `localStorage`, igual que el borrador (Bloque
 * 12.3) y con el mismo cuidado: la lectura va en un efecto (el POS también se renderiza en el servidor), el
 * guardado no corre hasta que la lectura terminó —si corriera antes, el estado vacío inicial pisaría lo
 * guardado— y una lista vacía **borra** el guardado, para que una espera descartada no reaparezca.
 */

const attemptKey = "ce9b1f5e-1a2b-4c3d-8e4f-5a6b7c8d9e0f";

function heldSale(overrides: Partial<PosHeldSale> = {}): PosHeldSale {
  return {
    id: "hold_1",
    savedAt: "2026-09-18T15:04:00.000Z",
    lines: [{ productId: "seed-prod-01", name: "Taco de Birria", unitPrice: 35, quantity: 2 }],
    customer: { name: "Ana", whatsapp: "+50588888888", email: "" },
    payments: [{ method: "cash", currency: "NIO", amount: "100" }],
    attemptKey,
    ...overrides,
  };
}

const key = (locationId = "loc_centro", currencyCode = "NIO") =>
  `${POS_HOLDS_STORAGE_PREFIX}:${locationId}:${currencyCode}`;

function Probe({
  locationId = "loc_centro",
  currencyCode = "NIO",
}: {
  locationId?: string;
  currencyCode?: string;
}) {
  const { holds, hold, discard, full } = usePosHolds(locationId, currencyCode);

  return (
    <div>
      <p data-testid="esperas">{holds.length}</p>
      <p data-testid="titulos">{holds.map(posHoldTitle).join("|")}</p>
      <p data-testid="lleno">{full ? "sí" : "no"}</p>
      <button
        type="button"
        onClick={() =>
          hold({
            lines: [{ productId: "seed-prod-02", name: "Taco de Asada", unitPrice: 30, quantity: 1 }],
            customer: { name: "Beto", whatsapp: "+50587777777", email: "" },
            payments: [{ method: "cash", currency: currencyCode, amount: "30" }],
            attemptKey,
          })
        }
      >
        Guardar en espera
      </button>
      <button type="button" onClick={() => holds[0] && discard(holds[0].id)}>
        Descartar la primera
      </button>
    </div>
  );
}

function renderProbe(props: { locationId?: string; currencyCode?: string } = {}) {
  return render(
    <StrictMode>
      <Probe {...props} />
    </StrictMode>,
  );
}

describe("usePosHolds", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("recupera las esperas que quedaron guardadas en este dispositivo", async () => {
    localStorage.setItem(
      key(),
      serializePosHolds("loc_centro", [heldSale(), heldSale({ id: "hold_2", customer: { name: "Beto", whatsapp: "+50587777777", email: "" } })]),
    );

    renderProbe();

    await waitFor(() => expect(screen.getByTestId("esperas").textContent).toBe("2"));
    // El guardado no se pisó antes de leerlo: las dos esperas siguen ahí.
    expect(localStorage.getItem(key())).toContain("hold_2");
  });

  it("sin nada guardado no hay esperas", async () => {
    renderProbe();

    await waitFor(() => expect(screen.getByTestId("lleno").textContent).toBe("no"));
    expect(screen.getByTestId("esperas").textContent).toBe("0");
  });

  it("un guardado corrupto no rompe el mostrador", async () => {
    localStorage.setItem(key(), "no-es-json");

    renderProbe();

    await waitFor(() => expect(screen.getByTestId("esperas").textContent).toBe("0"));
  });

  it("guardar la venta la deja en la lista y en el dispositivo", async () => {
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByRole("button", { name: "Guardar en espera" }));

    await waitFor(() => expect(screen.getByTestId("titulos").textContent).toBe("Beto"));
    expect(localStorage.getItem(key())).toContain("seed-prod-02");
    // La espera lleva su propia clave de intento y su fecha.
    expect(localStorage.getItem(key())).toContain(attemptKey);
  });

  it("descartar la espera la saca de la lista y borra lo guardado", async () => {
    const user = userEvent.setup();
    localStorage.setItem(key(), serializePosHolds("loc_centro", [heldSale()]));

    renderProbe();
    await waitFor(() => expect(screen.getByTestId("esperas").textContent).toBe("1"));

    await user.click(screen.getByRole("button", { name: "Descartar la primera" }));

    await waitFor(() => expect(screen.getByTestId("esperas").textContent).toBe("0"));
    expect(localStorage.getItem(key())).toBeNull();
  });

  it("las esperas son de un local: la de otra sucursal no aparece ni se borra", async () => {
    localStorage.setItem(key("loc_masaya"), serializePosHolds("loc_masaya", [heldSale()]));

    renderProbe({ locationId: "loc_centro" });

    await waitFor(() => expect(screen.getByTestId("esperas").textContent).toBe("0"));
    expect(localStorage.getItem(key("loc_masaya"))).toContain("hold_1");
  });

  it("con el tope de esperas la pantalla lo sabe (para bloquear el botón)", async () => {
    const full = Array.from({ length: MAX_POS_HELDS }, (_, index) =>
      heldSale({ id: `hold_${index + 1}` }),
    );
    localStorage.setItem(key(), serializePosHolds("loc_centro", full));

    renderProbe();

    await waitFor(() => expect(screen.getByTestId("lleno").textContent).toBe("sí"));
    expect(screen.getByTestId("esperas").textContent).toBe(String(MAX_POS_HELDS));
  });
});
