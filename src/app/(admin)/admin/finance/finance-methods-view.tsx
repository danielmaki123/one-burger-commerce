"use client";

import * as React from "react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { Select } from "@/shared/ui/select";
import { Toggle } from "@/shared/ui/toggle";

import { AdminEmptyState } from "../_components/admin-operational-ui";
import { PAYMENT_METHOD_KIND_LABELS, type PaymentMethodKind } from "./finance-client-helpers";
import { AdminTable, AdminTableCell, AdminTableRow } from "./finance-table";
import type { FinanceViewProps } from "./finance-view-types";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-017`) — la vista **Medios de pago**.
 *
 * Columnas congeladas por la referencia: **medio** (nombre + si pide referencia) · **tipo** (el tipo
 * canónico) · **entidad** · **monedas** · **estado** (interruptor, guardado inmediato) · **acciones** (`···`).
 *
 * Dos reglas del producto que la vista hace visibles:
 *
 * 1. **«Mixto» no se ofrece** como tipo: el sistema lo **deriva** cuando una venta usa más de un cobro
 *    (`D-017`). Por eso no está en la lista de tipos del modal.
 * 2. **El tipo es la semántica contable y el nombre es el medio comercial**: «Tarjeta BAC» es un nombre; su
 *    tipo es `card`. Confundirlos ataría el hecho a una marca.
 */

const KIND_OPTIONS = (Object.keys(PAYMENT_METHOD_KIND_LABELS) as PaymentMethodKind[]).map((kind) => ({
  value: kind,
  label: PAYMENT_METHOD_KIND_LABELS[kind],
}));

type MethodDraft = {
  id?: string;
  name: string;
  kind: PaymentMethodKind;
  entityId: string | null;
  currencyCodes: string[];
  requiresReference: boolean;
  isActive: boolean;
  /**
   * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-86`) — **la disponibilidad por sucursal**.
   *
   * Lista vacía = **todos los locales** (es el default de `PaymentMethodLocation`). Con locales marcados, el
   * medio se ofrece sólo ahí: es la «Disponibilidad: Todos los locales / Locales seleccionados» de la
   * referencia congelada, que el runtime leía pero no podía escribir.
   */
  locationIds: string[];
};

export default function FinanceMethodsView({ config, api, run }: FinanceViewProps) {
  const [search, setSearch] = React.useState("");
  const [draft, setDraft] = React.useState<MethodDraft | null>(null);

  const entityName = (entityId: string | null) =>
    config.entities.find((entity) => entity.id === entityId)?.name ?? "—";

  const query = search.trim().toLowerCase();
  const rows = config.paymentMethods.filter((method) =>
    `${method.name} ${PAYMENT_METHOD_KIND_LABELS[method.kind]} ${entityName(method.entityId)}`
      .toLowerCase()
      .includes(query),
  );

  return (
    <div className="space-y-4 rounded-stitch-lg border border-line-subtle bg-surface-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-st-h2 text-ink">Medios de pago</h2>
          <p className="text-st-body text-ink-secondary">
            Cómo puede pagar un cliente y cómo debe tratarlo el sistema.
          </p>
        </div>
        <Button type="button" className="min-h-11" onClick={() => setDraft(emptyMethod())}>
          + Nuevo medio
        </Button>
      </div>

      <Input
        label="Buscar medio de pago"
        placeholder="Buscar medio de pago..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <p className="text-st-caption text-ink-muted">
        «Mixto» no es un medio: el sistema lo deriva cuando una venta usa más de un cobro.
      </p>

      {config.paymentMethods.length === 0 ? (
        <AdminEmptyState
          title="Todavía no hay medios de pago cargados"
          description="Sin medios, el POS no puede ofrecer una forma de cobro."
        />
      ) : (
        <AdminTable
          label="Medios de pago"
          columns={["Medio", "Tipo", "Entidad", "Monedas", "Estado", ""]}
          gridClassName="md:grid-cols-[minmax(150px,1.15fr)_110px_130px_minmax(140px,1fr)_100px_34px]"
          isEmpty={rows.length === 0}
          emptyLabel="Ningún medio coincide con la búsqueda."
        >
          {rows.map((method) => (
            <AdminTableRow
              key={method.id}
              gridClassName="md:grid-cols-[minmax(150px,1.15fr)_110px_130px_minmax(140px,1fr)_100px_34px]"
            >
              <AdminTableCell label="Medio">
                <strong className="block text-st-body font-semibold">{method.name}</strong>
                <span className="mt-1 block text-st-caption text-ink-muted">
                  {method.requiresReference ? "Referencia requerida" : "Sin referencia obligatoria"}
                </span>
              </AdminTableCell>

              <AdminTableCell label="Tipo">
                <Badge variant="default">{PAYMENT_METHOD_KIND_LABELS[method.kind]}</Badge>
              </AdminTableCell>

              <AdminTableCell label="Entidad">{entityName(method.entityId)}</AdminTableCell>

              <AdminTableCell label="Monedas" mono>
                {method.currencyCodes.length > 0 ? method.currencyCodes.join(" · ") : "Todas"}
              </AdminTableCell>

              <AdminTableCell label="Estado">
                <Toggle
                  label={`${method.name}: ${method.isActive ? "activo" : "apagado"}`}
                  checked={method.isActive}
                  onChange={(next) =>
                    void run(
                      () =>
                        api.savePaymentMethod({
                          id: method.id,
                          name: method.name,
                          kind: method.kind,
                          entityId: method.entityId,
                          currencyCodes: method.currencyCodes,
                          requiresReference: method.requiresReference,
                          isActive: next,
                        }),
                      `${method.name}: ${next ? "activo" : "apagado"}.`,
                    )
                  }
                />
              </AdminTableCell>

              <AdminTableCell label="Acciones">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 md:min-h-9 md:px-2"
                  aria-label={`Editar ${method.name}`}
                  onClick={() =>
                    setDraft({
                      id: method.id,
                      name: method.name,
                      kind: method.kind,
                      entityId: method.entityId,
                      currencyCodes: method.currencyCodes,
                      requiresReference: method.requiresReference,
                      isActive: method.isActive,
                      locationIds: method.locationIds,
                    })
                  }
                >
                  ···
                </Button>
              </AdminTableCell>
            </AdminTableRow>
          ))}
        </AdminTable>
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
                ...config.entities
                  .filter((entity) => entity.isActive)
                  .map((entity) => ({ value: entity.id, label: entity.name })),
              ]}
              onChange={(event) => setDraft({ ...draft, entityId: event.target.value || null })}
            />

            <fieldset className="space-y-2">
              <legend className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
                Monedas admitidas
              </legend>
              <p className="text-st-caption text-ink-muted">
                Sin ninguna marcada, el medio acepta todas las monedas activas.
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {config.settings.currencies
                  .filter((currency) => currency.isActive)
                  .map((currency) => (
                    <Checkbox
                      key={currency.code}
                      label={currency.code}
                      checked={draft.currencyCodes.includes(currency.code)}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          currencyCodes: event.target.checked
                            ? [...new Set([...draft.currencyCodes, currency.code])]
                            : draft.currencyCodes.filter((code) => code !== currency.code),
                        })
                      }
                    />
                  ))}
              </div>
            </fieldset>

            <Checkbox
              label="Pide referencia externa (voucher o id de transferencia)"
              checked={draft.requiresReference}
              onChange={(event) => setDraft({ ...draft, requiresReference: event.target.checked })}
            />

            {/*
              `A-86` — **Disponibilidad**: la capacidad que la referencia congelada pide y que el runtime leía
              sin poder escribirla. Sin ningún local marcado el medio se ofrece en **todos** (el default de la
              tabla), y eso se dice en la ayuda para que nadie crea que quedó apagado.
            */}
            <fieldset className="space-y-2">
              <legend className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
                Disponibilidad
              </legend>
              <p className="text-st-caption text-ink-muted">
                {draft.locationIds.length === 0
                  ? "Todos los locales. Marcá uno o más para ofrecerlo sólo ahí."
                  : `Sólo en ${draft.locationIds.length} local${draft.locationIds.length === 1 ? "" : "es"}.`}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {config.locations.map((location) => (
                  <Checkbox
                    key={location.id}
                    label={location.name}
                    checked={draft.locationIds.includes(location.id)}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        locationIds: event.target.checked
                          ? [...new Set([...draft.locationIds, location.id])]
                          : draft.locationIds.filter((id) => id !== location.id),
                      })
                    }
                  />
                ))}
              </div>
            </fieldset>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                className="min-h-11"
                onClick={() =>
                  void run(() => api.savePaymentMethod(draft), "Medio de pago guardado.").then((ok) => {
                    if (ok) setDraft(null);
                  })
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
    </div>
  );
}

function emptyMethod(): MethodDraft {
  return {
    name: "",
    kind: "cash",
    entityId: null,
    currencyCodes: [],
    requiresReference: false,
    isActive: true,
    // Sin locales marcados el medio se ofrece en todos (el default de la tabla).
    locationIds: [],
  };
}
