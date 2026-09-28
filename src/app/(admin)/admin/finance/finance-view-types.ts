import type { createFinanceApi, FinanceConfig } from "./finance-client-helpers";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` — los tipos compartidos por las tres vistas de Finanzas.
 *
 * Vive aparte del componente para que las vistas no importen entre sí: las tres reciben lo mismo (la
 * configuración, el cliente de la API y el ejecutor que informa el resultado) y devuelven lo mismo (nada).
 */

export type FinanceApi = ReturnType<typeof createFinanceApi>;

/**
 * Ejecuta un comando y deja la pantalla en un estado consistente: recarga la configuración, avisa el
 * resultado y devuelve si salió bien —para que el modal sepa si puede cerrarse—.
 */
export type FinanceRunner = (
  work: () => Promise<{ ok: true } | { ok: false; message: string }>,
  done: string,
) => Promise<boolean>;

export type FinanceViewProps = {
  config: FinanceConfig;
  api: FinanceApi;
  run: FinanceRunner;
};
