"use client";

import * as React from "react";

import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";

import { createFinanceApi, type FinanceConfig } from "./finance-client-helpers";
import FinanceCurrenciesView from "./finance-currencies-view";
import FinanceEntitiesView from "./finance-entities-view";
import FinanceMethodsView from "./finance-methods-view";
import type { FinanceRunner } from "./finance-view-types";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` — **Finanzas**, la superficie de configuración financiera del dueño.
 *
 * La composición es la de la referencia aprobada y está **congelada**:
 *
 * ```text
 * Cabecera:  Finanzas · Configuración financiera   [ KPIs: base · N monedas · N medios · N entidades ]   estado
 * Tabs:      Medios de pago | Monedas y tasas | Entidades de cobro
 * Vista:     título + una línea de propósito                        [ acción primaria ]
 *            buscador (medios y entidades)
 *            tabla: identidad · tipo · entidad/monedas/uso · estado · acciones
 * ```
 *
 * Reglas que no se negocian:
 *
 * 1. **La autorización es del servidor.** Este componente no decide quién puede: pide a
 *    `/api/admin/finance`, que aplica `canManageFinanceConfig` en cada request. Si la respuesta es 403, la
 *    pantalla muestra el error del servidor en vez de dibujar controles que no van a funcionar.
 * 2. **Ninguna regla de dinero en React**: acá no se convierte, no se redondea y no se decide «pagado».
 * 3. **Los KPIs cuentan lo que hay** (`D-011`, métricas defendibles): moneda base vigente y cuántas
 *    monedas, medios y entidades están **activos**. No hay proyecciones ni números inventados.
 * 4. **Los números van en `font-mono` con `tabular-nums`**.
 */
export default function FinanceClient() {
  const api = React.useMemo(() => createFinanceApi(), []);
  const [config, setConfig] = React.useState<FinanceConfig | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [view, setView] = React.useState("methods");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    const result = await api.read();

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setError(null);
    setConfig(result.data);
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const run: FinanceRunner = React.useCallback(
    async (work, done) => {
      setNotice(null);
      setError(null);
      setSaving(true);

      const result = await work();

      if (!result.ok) {
        setError(result.message);
        setSaving(false);
        return false;
      }

      setNotice(done);
      await load();
      setSaving(false);

      return true;
    },
    [load],
  );

  if (error && !config) {
    return (
      <Card className="space-y-3">
        <p role="alert" className="text-st-body font-medium text-status-sla-text">
          {error}
        </p>
        <Button type="button" className="min-h-11" onClick={() => void load()}>
          Reintentar
        </Button>
      </Card>
    );
  }

  if (!config) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const activeCurrencies = config.settings.currencies.filter((currency) => currency.isActive).length;
  const activeMethods = config.paymentMethods.filter((method) => method.isActive).length;
  const activeEntities = config.entities.filter((entity) => entity.isActive).length;

  return (
    <div className="space-y-4">
      <Tabs>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList
            ariaLabel="Vistas de Finanzas"
            className="flex-wrap gap-1.5 bg-transparent p-0"
          >
            {/*
             * `flex-none`: un rótulo con contador no se estruja ni se recorta; si no entra, baja entero a la
             * fila siguiente. Es lo que evita el scroll horizontal a 375 px (medido: 380 > 375 con los tres
             * en una sola fila).
             */}
            <TabsTrigger value="methods" activeValue={view} onClick={setView} className="flex-none">
              Medios de pago
            </TabsTrigger>
            <TabsTrigger value="currencies" activeValue={view} onClick={setView} className="flex-none">
              Monedas y tasas
            </TabsTrigger>
            <TabsTrigger value="entities" activeValue={view} onClick={setView} className="flex-none">
              Entidades de cobro
            </TabsTrigger>
          </TabsList>

          <p className="text-st-caption text-ink-muted">
            {saving ? "Guardando…" : "Sin cambios pendientes"}
          </p>
        </div>

        {/* Los KPIs: el estado actual del sistema, en números que salen de la configuración real. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-st-caption text-ink-secondary">
          <span className="font-mono tabular-nums font-semibold text-ink">
            {config.settings.baseCurrencyCode}
          </span>
          <span>base</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums font-semibold text-ink">{activeCurrencies}</span>
          <span>monedas</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums font-semibold text-ink">{activeMethods}</span>
          <span>medios</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums font-semibold text-ink">{activeEntities}</span>
          <span>entidades</span>
        </div>

        {notice ? (
          <p role="status" className="text-st-body font-medium text-status-ready-text">
            {notice}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-st-body font-medium text-status-sla-text">
            {error}
          </p>
        ) : null}

        <TabsContent value="methods" activeValue={view}>
          <FinanceMethodsView config={config} api={api} run={run} />
        </TabsContent>
        <TabsContent value="currencies" activeValue={view}>
          <FinanceCurrenciesView config={config} api={api} run={run} />
        </TabsContent>
        <TabsContent value="entities" activeValue={view}>
          <FinanceEntitiesView config={config} api={api} run={run} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

