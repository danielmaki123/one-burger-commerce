// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

afterEach(cleanup);

function renderTabs({
  activeValue = "hoy",
  onClick = vi.fn(),
}: { activeValue?: string; onClick?: (value: string) => void } = {}) {
  render(
    <Tabs>
      <TabsList>
        <TabsTrigger value="hoy" activeValue={activeValue} onClick={onClick}>
          Hoy
        </TabsTrigger>
        <TabsTrigger value="7d" activeValue={activeValue} onClick={onClick}>
          7 días
        </TabsTrigger>
      </TabsList>
      <TabsContent value="hoy" activeValue={activeValue}>
        Contenido de hoy
      </TabsContent>
    </Tabs>,
  );

  return onClick;
}

describe("Tabs", () => {
  it("marca el disparador activo con aria-pressed y los demás apagados", () => {
    renderTabs({ activeValue: "7d" });

    expect(screen.getByRole("button", { name: "7 días" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Hoy" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("es un botón de verdad: type=button y sin submit del formulario", () => {
    renderTabs();

    const trigger = screen.getByRole("button", { name: "Hoy" });
    expect(trigger.getAttribute("type")).toBe("button");
    // 44 px: es un control táctil del panel.
    expect(trigger.className).toContain("min-h-11");
    // El borde del control y el foco son del sistema.
    expect(trigger.className).toContain("focus-visible:ring-2");
  });

  it("avisa el valor elegido al hacer clic y respeta el estado deshabilitado", async () => {
    const user = userEvent.setup();
    const onClick = renderTabs();

    await user.click(screen.getByRole("button", { name: "7 días" }));

    expect(onClick).toHaveBeenCalledWith("7d");
  });

  it("acepta una etiqueta accesible propia para el grupo", () => {
    render(
      <TabsList className="grid-cols-2" ariaLabel="Período de rendimiento">
        <TabsTrigger value="hoy" activeValue="hoy" onClick={() => {}} ariaLabel="Período hoy">
          Hoy
        </TabsTrigger>
      </TabsList>,
    );

    expect(screen.getByRole("group", { name: "Período de rendimiento" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Período hoy" })).toBeTruthy();
  });
});
