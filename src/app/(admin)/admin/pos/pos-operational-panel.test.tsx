// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  PosOperationalFinancialState,
  PosOperationalOrder,
} from "@/modules/orders/domain/pos-operational-orders";

import { PosOperationalPanel } from "./pos-operational-panel";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §21, §22, §23, §56) — **el panel operacional reutilizable**.
 *
 * Es la superficie donde el cajero decide, así que el contrato que se fija acá es el de la fila:
 *
 * 1. **Una fila por pedido** (`data-testid="pos-operational-row"`) con número, cliente, canal y los dos
 *    estados —producción y financiero— que son ejes independientes. El canal sin valor **no** se dibuja:
 *    adivinarlo sería inventar un dato (`D-015`).
 * 2. **El financiero distingue el parcial que hay que revisar**: `partial` con `unresolvedAmount > 0` es
 *    `REVISAR`, no `PARCIAL`, porque esa plata no se cobra con el checkout normal (brief §32).
 * 3. **La búsqueda es la del mostrador** —número o nombre— y sin coincidencias dice el vacío en español.
 * 4. **Una sola capa**: el panel se monta cuando está abierto y no deja un segundo `<dialog>` en el DOM
 *    (la deuda `A-92` era exactamente dos diálogos donde el que recibía el toque no era el del spec).
 * 5. **La hora prometida es la del negocio**, no la del equipo: se afirma con literales calculados a mano
 *    desde el offset de cada zona y un instante fijo, nunca con la zona de la máquina.
 */

afterEach(cleanup);

const MANAGUA = "America/Managua";
/** Tokio es UTC+9: sirve para probar que la zona la decide la prop y no el reloj del equipo. */
const TOKIO = "Asia/Tokyo";

/** Un instante fijo: en Managua (UTC−6) es el 13 a las 19:30; en Tokio (UTC+9), el 14 a las 10:30. */
const RETIRO_PROGRAMADO = "2026-03-14T01:30:00.000Z";

function financialState(
  overrides: Partial<PosOperationalFinancialState> = {},
): PosOperationalFinancialState {
  return {
    status: "pending",
    paidAmount: 0,
    outstandingAmount: 350,
    unresolvedAmount: 0,
    baseCurrencyCode: "NIO",
    ...overrides,
  };
}

function operationalOrder(overrides: Partial<PosOperationalOrder> = {}): PosOperationalOrder {
  return {
    id: "ord_1",
    orderNumber: "P-1001",
    source: null,
    customerName: "Cliente",
    locationId: "loc_centro",
    locationName: "Camino de Oriente",
    status: "preparing",
    pickupTime: null,
    pickupScheduled: false,
    currencyCode: "NIO",
    total: 350,
    financialState: financialState(),
    ...overrides,
  };
}

/** Dos pedidos en proceso, uno de cada canal: los dos entran en el modo `process`. */
function muestraEnProceso(): PosOperationalOrder[] {
  return [
    operationalOrder({
      id: "ord_1",
      orderNumber: "P-1001",
      source: "menu",
      customerName: "María López",
      status: "preparing",
      financialState: financialState({ status: "pending" }),
    }),
    operationalOrder({
      id: "ord_2",
      orderNumber: "P-1002",
      source: "pos",
      customerName: "Carlos Ruiz",
      status: "confirmed",
      financialState: financialState({ status: "paid", paidAmount: 350, outstandingAmount: 0 }),
    }),
  ];
}

function renderPanel(overrides: Partial<Parameters<typeof PosOperationalPanel>[0]> = {}) {
  const onClose = vi.fn();
  const onOpenOrder = vi.fn();

  const props: Parameters<typeof PosOperationalPanel>[0] = {
    mode: "process",
    orders: [],
    timeZone: MANAGUA,
    onClose,
    onOpenOrder,
    ...overrides,
  };

  const view = render(<PosOperationalPanel {...props} />);

  return { ...view, onClose, onOpenOrder };
}

describe("PosOperationalPanel", () => {
  it("dibuja una fila por pedido con número, cliente, canal y los dos estados", () => {
    renderPanel({ orders: muestraEnProceso() });

    const filas = screen.getAllByTestId("pos-operational-row");
    expect(filas).toHaveLength(2);

    const primera = filas[0];
    expect(within(primera).getByText("P-1001")).toBeTruthy();
    expect(within(primera).getByText("María López")).toBeTruthy();
    expect(within(primera).getByText("MENÚ")).toBeTruthy();
    expect(within(primera).getByText("PREPARANDO")).toBeTruthy();
    expect(within(primera).getByText("POR COBRAR")).toBeTruthy();

    const segunda = filas[1];
    expect(within(segunda).getByText("P-1002")).toBeTruthy();
    expect(within(segunda).getByText("Carlos Ruiz")).toBeTruthy();
    expect(within(segunda).getByText("POS")).toBeTruthy();
    expect(within(segunda).getByText("CONFIRMADO")).toBeTruthy();
    expect(within(segunda).getByText("PAGADO")).toBeTruthy();
  });

  it("rotula LISTO el pedido listo para retirar", () => {
    renderPanel({
      mode: "ready",
      orders: [
        operationalOrder({
          id: "ord_1",
          status: "ready_for_pickup",
          financialState: financialState({ status: "paid", paidAmount: 350, outstandingAmount: 0 }),
        }),
      ],
    });

    const fila = screen.getByTestId("pos-operational-row");
    expect(within(fila).getByText("LISTO")).toBeTruthy();
    expect(within(fila).getByText("PAGADO")).toBeTruthy();
  });

  it("sin canal declarado no dibuja etiqueta de canal", () => {
    renderPanel({
      orders: [operationalOrder({ id: "ord_1", source: null, status: "preparing" })],
    });

    const fila = screen.getByTestId("pos-operational-row");
    expect(within(fila).queryByText("MENÚ")).toBeNull();
    expect(within(fila).queryByText("POS")).toBeNull();
  });

  it("un parcial con plata sin demostrar pide REVISAR, no PARCIAL", () => {
    renderPanel({
      orders: [
        operationalOrder({
          id: "ord_1",
          status: "preparing",
          financialState: financialState({
            status: "partial",
            paidAmount: 100,
            outstandingAmount: 250,
            unresolvedAmount: 40,
          }),
        }),
      ],
    });

    const fila = screen.getByTestId("pos-operational-row");
    expect(within(fila).getByText("REVISAR")).toBeTruthy();
    expect(within(fila).queryByText("PARCIAL")).toBeNull();
    expect(within(fila).queryByText("PAGADO")).toBeNull();
  });

  it("un parcial sin plata sin demostrar no pide revisión", () => {
    renderPanel({
      orders: [
        operationalOrder({
          id: "ord_1",
          status: "preparing",
          financialState: financialState({
            status: "partial",
            paidAmount: 100,
            outstandingAmount: 250,
            unresolvedAmount: 0,
          }),
        }),
      ],
    });

    const fila = screen.getByTestId("pos-operational-row");
    expect(within(fila).getByText("PARCIAL")).toBeTruthy();
    expect(within(fila).queryByText("REVISAR")).toBeNull();
  });

  it("busca por número de pedido", async () => {
    const user = userEvent.setup();
    renderPanel({ orders: muestraEnProceso() });

    await user.type(screen.getByLabelText("Buscar pedido"), "1002");

    const filas = screen.getAllByTestId("pos-operational-row");
    expect(filas).toHaveLength(1);
    expect(within(filas[0]).getByText("P-1002")).toBeTruthy();
    expect(screen.queryByText("P-1001")).toBeNull();
  });

  it("busca por nombre del cliente, sin importar mayúsculas", async () => {
    const user = userEvent.setup();
    renderPanel({ orders: muestraEnProceso() });

    await user.type(screen.getByLabelText("Buscar pedido"), "maría");

    const filas = screen.getAllByTestId("pos-operational-row");
    expect(filas).toHaveLength(1);
    expect(within(filas[0]).getByText("María López")).toBeTruthy();
    expect(screen.queryByText("Carlos Ruiz")).toBeNull();
  });

  it("sin coincidencias muestra el vacío de la búsqueda en español", async () => {
    const user = userEvent.setup();
    renderPanel({ orders: muestraEnProceso() });

    await user.type(screen.getByLabelText("Buscar pedido"), "zzz-no-existe");

    expect(screen.getByText("Ningún pedido coincide con la búsqueda.")).toBeTruthy();
    expect(screen.queryAllByTestId("pos-operational-row")).toHaveLength(0);
  });

  it("una lista vacía se distingue de una búsqueda sin coincidencias", () => {
    renderPanel({ mode: "scheduled", orders: [] });

    expect(screen.getByText("No hay pedidos en esta lista.")).toBeTruthy();
    expect(screen.queryByText("Ningún pedido coincide con la búsqueda.")).toBeNull();
  });

  it("dibuja un solo panel operacional, no dos capas montadas", () => {
    renderPanel({ orders: muestraEnProceso() });

    expect(screen.getAllByTestId("pos-operational-panel")).toHaveLength(1);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("cerrar llama a onClose", async () => {
    const user = userEvent.setup();
    const { onClose } = renderPanel({ orders: muestraEnProceso() });

    await user.click(screen.getByRole("button", { name: "Cerrar panel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape también cierra el panel", async () => {
    const user = userEvent.setup();
    const { onClose } = renderPanel({ orders: muestraEnProceso() });

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("abrir una fila llama a onOpenOrder con el id de ese pedido", async () => {
    const user = userEvent.setup();
    const { onOpenOrder } = renderPanel({ orders: muestraEnProceso() });

    await user.click(screen.getAllByTestId("pos-operational-row")[1]);

    expect(onOpenOrder).toHaveBeenCalledTimes(1);
    expect(onOpenOrder).toHaveBeenCalledWith("ord_2");
  });

  it("muestra la hora prometida formateada en la zona del negocio, no en la del equipo", () => {
    const programado = operationalOrder({
      id: "ord_1",
      orderNumber: "P-1003",
      status: "confirmed",
      pickupScheduled: true,
      pickupTime: RETIRO_PROGRAMADO,
    });

    const { unmount } = renderPanel({
      mode: "scheduled",
      orders: [programado],
      timeZone: MANAGUA,
    });

    // 01:30Z del 14 son las 19:30 del 13 en Managua (UTC−6): día y hora locales del negocio.
    expect(
      within(screen.getByTestId("pos-operational-row")).getByText("13/3, 07:30 p. m."),
    ).toBeTruthy();

    unmount();

    // La misma hora con el negocio en Tokio (UTC+9) es el 14 a las 10:30. Si el panel usara el reloj
    // del equipo, los dos renders darían el mismo texto y este aserto falla.
    renderPanel({ mode: "scheduled", orders: [programado], timeZone: TOKIO });

    expect(
      within(screen.getByTestId("pos-operational-row")).getByText("14/3, 10:30 a. m."),
    ).toBeTruthy();
  });
});
