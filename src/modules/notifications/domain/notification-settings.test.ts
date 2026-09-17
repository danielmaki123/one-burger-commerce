import { describe, expect, it } from "vitest";

import {
  DEFAULT_NOTIFICATION_SETTINGS,
  isValidTelegramChatId,
  resolveTelegramStatus,
  shouldSendTelegramAlert,
  type NotificationSettingsRecord,
} from "./notification-settings";
import { normalizeTelegramEvents } from "./telegram-events";

/**
 * Parte 3 del brief (alertas Telegram) — la configuración del negocio.
 *
 * Dos cosas se prueban acá, y son las que evitan mandar de más o de menos: **cuándo corresponde enviar**
 * (activado + chat + evento elegido) y **cómo se lee el estado** en la pantalla, que tiene que distinguir
 * «sin configurar» de «configurado pero desactivado» y de «falló el último envío»: son tres problemas
 * distintos y el owner arregla cada uno de otra manera.
 */

const configured: NotificationSettingsRecord = {
  ...DEFAULT_NOTIFICATION_SETTINGS,
  chatId: "-1001234567890",
  enabled: true,
  eventsEnabled: ["refund_over_threshold"],
};

describe("shouldSendTelegramAlert", () => {
  it("manda solo lo que está activado, tiene chat y está en la lista de eventos", () => {
    expect(shouldSendTelegramAlert({ ...configured }, "refund_over_threshold")).toBe(true);
    // El evento existe pero el owner no lo eligió: se registra igual, no se manda.
    expect(shouldSendTelegramAlert({ ...configured }, "shift_open_over_24h")).toBe(false);
  });

  it("sin chat o desactivado no manda nada", () => {
    expect(
      shouldSendTelegramAlert({ ...configured, chatId: null }, "refund_over_threshold"),
    ).toBe(false);
    expect(
      shouldSendTelegramAlert({ ...configured, enabled: false }, "refund_over_threshold"),
    ).toBe(false);
  });
});

describe("resolveTelegramStatus", () => {
  it("sin chat no está configurado, aunque esté activado", () => {
    expect(resolveTelegramStatus({ ...DEFAULT_NOTIFICATION_SETTINGS }, { tokenConfigured: true })).toBe(
      "sin-configurar",
    );
  });

  it("con chat pero desactivado queda desconectado", () => {
    expect(
      resolveTelegramStatus({ ...configured, enabled: false }, { tokenConfigured: true }),
    ).toBe("desconectado");
  });

  it("el último error manda sobre todo lo demás: está desconectado hasta que se pruebe", () => {
    expect(
      resolveTelegramStatus({ ...configured, lastError: "chat not found" }, { tokenConfigured: true }),
    ).toBe("desconectado");
  });

  it("activo, con chat y sin error está conectado", () => {
    expect(
      resolveTelegramStatus({ ...configured }, { tokenConfigured: true }),
    ).toBe("conectado");
  });

  it("sin token del bot en el servidor no se puede conectar ni probar", () => {
    expect(resolveTelegramStatus({ ...configured }, { tokenConfigured: false })).toBe("sin-token");
  });
});

describe("isValidTelegramChatId", () => {
  it("acepta ids numéricos (incluido el de grupo, negativo) y @canal", () => {
    expect(isValidTelegramChatId("-1001234567890")).toBe(true);
    expect(isValidTelegramChatId("123456789")).toBe(true);
    expect(isValidTelegramChatId("@one_burger_avisos")).toBe(true);
  });

  it("rechaza lo que Telegram no va a resolver", () => {
    expect(isValidTelegramChatId("")).toBe(false);
    expect(isValidTelegramChatId("   ")).toBe(false);
    expect(isValidTelegramChatId("mi grupo")).toBe(false);
    expect(isValidTelegramChatId("@")).toBe(false);
    expect(isValidTelegramChatId("abc123")).toBe(false);
  });
});

describe("normalizeTelegramEvents", () => {
  it("deja solo los eventos conocidos, sin repetir", () => {
    expect(
      normalizeTelegramEvents([
        "refund_over_threshold",
        "refund_over_threshold",
        "inventado",
        "day_close_summary",
      ]),
    ).toEqual(["refund_over_threshold", "day_close_summary"]);
  });

  it("lo que no es una lista devuelve vacío (no rompe la pantalla)", () => {
    expect(normalizeTelegramEvents(null)).toEqual([]);
    expect(normalizeTelegramEvents("refund_over_threshold")).toEqual([]);
    expect(normalizeTelegramEvents({})).toEqual([]);
  });
});
