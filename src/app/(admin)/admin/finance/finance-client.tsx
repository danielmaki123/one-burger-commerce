"use client";

import * as React from "react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { Select } from "@/shared/ui/select";
import { Skeleton } from "@/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";

import { AdminEmptyState } from "../_components/admin-operational-ui";
import {
  PAYMENT_METHOD_KIND_LABELS,
  createFinanceApi,
  type FinanceConfig,
  type PaymentMethodKind,
} from "./finance-client-helpers";
import FinanceRateCard from "./finance-rate-card";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` — **Finanzas**, la pantalla de configuración financiera del dueño.
 *
 * Tres vistas conmutadas por tabs, como la referencia aprobada:
 *
 * - **Medios de pago**: qué medios se aceptan y con qué **tipo canónico** (`D-017`). «Mixto» no es un medio:
 *   el sistema lo **deriva** cuando una venta usa más de un cobro, y por eso no aparece como opción.
 * - **Monedas y tasas**: la moneda base, el formato regional y el catálogo con su tasa vigente. Registrar
 *   una tasa **crea historia**: no reescribe cobros anteriores.
 * - **Entidades de cobro**: el catálogo `banks` con su **tipo de entidad** (`D-019`). No hay un catálogo
 *   paralelo: es el mismo que usa el cierre de caja.
 *
 * Reglas de la pantalla que no se negocian:
 *
 * 1. **La autorización es del servidor.** Este componente no decide quién puede: pide a `/api/admin/finance`,
 *    que aplica `canManageFinanceConfig` en cada request. Si la respuesta es 403, la pantalla muestra el
 *    error del servidor en vez de dibujar controles que no van a funcionar.
 * 2. **Ninguna regla de dinero en React**: acá no se convierte, no se redondea y no se decide «pagado». Los
 *    montos y las tasas se muestran como los devuelve el servidor.
 * 3. **Cambiar la moneda base es una operación explícita** con su confirmación y su alcance informado: la
 *    pantalla dice qué **no** se toca (los hechos históricos conservan su moneda, su tasa y su equivalente).
 */
export default function FinanceClient() {
  const api = React.useMemo(() => createFinanceApi(), []);
  const [config, setConfig] = React.useState<FinanceConfig | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [view, setView] = React.useState("methods");

  const load = React.useCallback(async () => {
    setError(null);

    const result = await api.read();

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setConfig(result.data);
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function run(work: () => Promise<{ ok: true } | { ok: false; message: string }>, done: string) {
    setNotice(null);
    setError(null);

    const result = await work();

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setNotice(done);
    await load();
  }

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

  return (
    <div className="space-y-4">
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

      <Tabs>
        <TabsList ariaLabel="Vistas de Finanzas">
          <TabsTrigger value="methods" activeValue={view} onClick={setView}>
            {`Medios de pago (${config.paymentMethods.length})`}
          </TabsTrigger>
          <TabsTrigger value="currencies" activeValue={view} onClick={setView}>
            {`Monedas y tasas (${config.settings.currencies.length})`}
          </TabsTrigger>
          <TabsTrigger value="entities" activeValue={view} onClick={setView}>
            {`Entidades de cobro (${config.entities.length})`}
          </TabsTrigger>
        </TabsList>

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

type Runner = (
  work: () => Promise<{ ok: true } | { ok: false; message: string }>,
  done: string,
) => Promise<void>;

/** La vista se arma con los tres bloques comunes: encabezado, tabla y modal de edición. */
type ViewProps = {
  config: FinanceConfig;
  api: ReturnType<typeof createFinanceApi>;
  run: Runner;
};

const KIND_OPTIONS = (Object.keys(PAYMENT_METHOD_KIND_LABELS) as PaymentMethodKind[]).map((kind) => ({
  value: kind,
  label: PAYMENT_METHOD_KIND_LABELS[kind],
}));

const ENTITY_TYPE_OPTIONS = [
  { value: "bank", label: "Banco" },
  { value: "acquirer", label: "Adquirente" },
  { value: "digital_provider", label: "Proveedor digital" },
  { value: "other", label: "Otro" },
];

/** Medios de pago: identidad, tipo, entidad, monedas y estado. */
function FinanceMethodsView({ config, api, run }: ViewProps) {
  const [draft, setDraft] = React.useState<null | {
    id?: string;
    name: string;
    kind: PaymentMethodKind;
    entityId: string | null;
    currencyCodes: string[];
    requiresReference: boolean;
    isActive: boolean;
  }>(null);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-st-h2 text-ink">Medios de pago</h2>
        <Button type="button" className="min-h-11" onClick={() => setDraft(emptyMethod())}>
          + Nuevo medio
        </Button>
      </div>

      <p className="text-st-body text-ink-secondary">
        «Mixto» no es un medio. El sistema lo deriva cuando una venta usa más de un cobro. El tipo es la
        semántica contable; el nombre, el medio comercial con el que el negocio lo conoce.
      </p>

      {config.paymentMethods.length === 0 ? (
        <AdminEmptyState
          title="Todavía no hay medios de pago cargados"
          description="Sin medios, el POS no puede ofrecer una forma de cobro."
        />
      ) : (
        <ul className="space-y-2">
          {config.paymentMethods.map((method) => (
            <li
              key={method.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-stitch-md border border-line-subtle p-3"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-st-body font-semibold text-ink">{method.name}</p>
                <p className="text-st-caption text-ink-muted">
                  {PAYMENT_METHOD_KIND_LABELS[method.kind]}
                  {method.requiresReference ? " · pide referencia" : ""}
                  {method.currencyCodes.length > 0 ? ` · ${method.currencyCodes.join(", ")}` : " · todas las monedas"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={method.isActive ? "success" : "secondary"}>
                  {method.isActive ? "Activo" : "Apagado"}
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() =>
                    setDraft({
                      id: method.id,
                      name: method.name,
                      kind: method.kind,
                      entityId: method.entityId,
                      currencyCodes: method.currencyCodes,
                      requiresReference: method.requiresReference,
                      isActive: method.isActive,
                    })
                  }
                >
                  Editar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={draft !== null}
        title={draft?.id ? "Editar medio de pago" : "Nuevo medio de pago"}
        onClose={() => setDraft(null)}
      >
        {draft ? (
          <div className="space-y-3">
            <Input
              label="Nombre comercial"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
            <Select
              label="Tipo"
              value={draft.kind}
              options={KIND_OPTIONS}
              onChange={(event) => setDraft({ ...draft, kind: event.target.value as PaymentMethodKind })}
            />
            <Select
              label="Entidad de cobro"
              value={draft.entityId ?? ""}
              options={[
                { value: "", label: "Sin entidad (efectivo)" },
                ...config.entities.map((entity) => ({ value: entity.id, label: entity.name })),
              ]}
              onChange={(event) => setDraft({ ...draft, entityId: event.target.value || null })}
            />
            <Checkbox
              label="Pide referencia externa (voucher o id de transferencia)"
              checked={draft.requiresReference}
              onChange={(event) => setDraft({ ...draft, requiresReference: event.target.checked })}
            />
            <Checkbox
              label="Activo"
              checked={draft.isActive}
              onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                className="min-h-11"
                onClick={() =>
                  void run(() => api.savePaymentMethod(draft), "Medio de pago guardado.").then(() =>
                    setDraft(null),
                  )
                }
              >
                Guardar medio
              </Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setDraft(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}

function emptyMethod() {
  return {
    name: "",
    kind: "cash" as PaymentMethodKind,
    entityId: null,
    currencyCodes: [] as string[],
    requiresReference: false,
    isActive: true,
  };
}

/** Monedas y tasas: la tarjeta de la base, la del formato y la tabla del catálogo. */
function FinanceCurrenciesView({ config, api, run }: ViewProps) {
  return (
    <div className="space-y-4">
      <FinanceRateCard config={config} api={api} run={run} />
    </div>
  );
}

/** Entidades de cobro: el catálogo `banks` con su tipo. */
function FinanceEntitiesView({ config, api, run }: ViewProps) {
  const [draft, setDraft] = React.useState<null | {
    id?: string;
    name: string;
    code: string | null;
    entityType: string;
    isActive: boolean;
  }>(null);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-st-h2 text-ink">Entidades de cobro</h2>
        <Button
          type="button"
          className="min-h-11"
          onClick={() => setDraft({ name: "", code: null, entityType: "other", isActive: true })}
        >
          + Nueva entidad
        </Button>
      </div>

      <p className="text-st-body text-ink-secondary">
        Es el mismo catálogo con el que la caja cuadra el lote de la terminal. El tipo no se infiere del
        nombre: un banco que se cargó antes de esta pantalla queda en «Otro».
      </p>

      {config.entities.length === 0 ? (
        <AdminEmptyState
          title="Todavía no hay entidades de cobro cargadas"
          description="Sin entidades, el cierre de banco no ofrece ningún bloque."
        />
      ) : (
        <ul className="space-y-2">
          {config.entities.map((entity) => (
            <li
              key={entity.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-stitch-md border border-line-subtle p-3"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-st-body font-semibold text-ink">{entity.name}</p>
                <p className="text-st-caption text-ink-muted">
                  {ENTITY_TYPE_OPTIONS.find((option) => option.value === entity.entityType)?.label ?? "Otro"}
                  {entity.code ? ` · ${entity.code}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={entity.isActive ? "success" : "secondary"}>
                  {entity.isActive ? "Activa" : "Apagada"}
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() =>
                    setDraft({
                      id: entity.id,
                      name: entity.name,
                      code: entity.code ?? null,
                      entityType: entity.entityType ?? "other",
                      isActive: entity.isActive,
                    })
                  }
                >
                  Editar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={draft !== null} title={draft?.id ? "Editar entidad" : "Nueva entidad"} onClose={() => setDraft(null)}>
        {draft ? (
          <div className="space-y-3">
            <Input
              label="Nombre"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
            <Input
              label="Código (opcional)"
              value={draft.code ?? ""}
              onChange={(event) => setDraft({ ...draft, code: event.target.value || null })}
            />
            <Select
              label="Tipo de entidad"
              value={draft.entityType}
              options={ENTITY_TYPE_OPTIONS}
              onChange={(event) => setDraft({ ...draft, entityType: event.target.value })}
            />
            <Checkbox
              label="Activa"
              checked={draft.isActive}
              onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                className="min-h-11"
                onClick={() =>
                  void run(() => api.saveEntity(draft), "Entidad guardada.").then(() => setDraft(null))
                }
              >
                Guardar entidad
              </Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setDraft(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}
