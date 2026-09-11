// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PickupSlot } from "@/modules/business-settings/domain/pickup-slots";

import { PickupScheduleField } from "./pickup-schedule-field";

const options: PickupSlot[] = [
  { value: "12:00", label: "12:00 p. m.", isSoonest: true },
  { value: "12:30", label: "12:30 p. m.", isSoonest: false },
  { value: "13:00", label: "1:00 p. m.", isSoonest: false },
];

function renderField(overrides: Partial<Parameters<typeof PickupScheduleField>[0]> = {}) {
  const onSelect = vi.fn();

  render(
    <PickupScheduleField
      scheduledTime=""
      asapValue="11:35"
      options={options}
      todayHours="hoy de 12:00 a 22:00"
      onSelect={onSelect}
      {...overrides}
    />,
  );

  return { onSelect };
}

function checked(element: HTMLElement) {
  return (element as HTMLInputElement).checked;
}

describe("PickupScheduleField", () => {
  afterEach(cleanup);

  it("arranca sin programar y con el estado a la vista", () => {
    renderField();

    expect(screen.getByText("Retiro")).toBeTruthy();
    expect(screen.getByText("Lo antes posible · listo ~11:35 a. m.")).toBeTruthy();
    // Los turnos no se muestran hasta que el cliente abre el control.
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("se despliega y ofrece lo antes posible más los turnos del local", async () => {
    const user = userEvent.setup();
    renderField();

    await user.click(screen.getByRole("button", { expanded: false }));

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
    expect(checked(screen.getByRole("radio", { name: /Lo antes posible/ }))).toBe(true);
    expect(checked(screen.getByRole("radio", { name: /12:30 p\. m\./ }))).toBe(false);
  });

  it("al elegir una hora avisa y vuelve a colapsar", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderField();

    await user.click(screen.getByRole("button", { expanded: false }));
    await user.click(screen.getByRole("radio", { name: /12:30 p\. m\./ }));

    expect(onSelect).toHaveBeenCalledWith("12:30");
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("con una hora programada muestra la hora y marca su opción", async () => {
    const user = userEvent.setup();
    renderField({ scheduledTime: "13:00" });

    expect(screen.getByText("Retiro programado")).toBeTruthy();
    expect(screen.getByText("1:00 p. m.")).toBeTruthy();

    await user.click(screen.getByRole("button", { expanded: false }));
    expect(checked(screen.getByRole("radio", { name: /1:00 p\. m\./ }))).toBe(true);
  });

  it("si no hay turnos disponibles igual se puede pedir sin programar", async () => {
    const user = userEvent.setup();
    renderField({ options: [] });

    await user.click(screen.getByRole("button", { expanded: false }));

    expect(screen.getAllByRole("radio")).toHaveLength(1);
    expect(checked(screen.getByRole("radio", { name: /Lo antes posible/ }))).toBe(true);
  });

  it("con rango configurado promete una franja en vez de un instante (T5)", async () => {
    const user = userEvent.setup();
    renderField({ pickupLeadMinutes: 15, pickupMaxMinutes: 35 });

    expect(
      screen.getByText("Lo antes posible · listo entre 11:35 a. m. y 11:55 a. m."),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText("listo entre 11:35 a. m. y 11:55 a. m.")).toBeTruthy();
  });
});
