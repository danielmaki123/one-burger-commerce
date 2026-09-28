"use client";

import * as React from "react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { Select } from "@/shared/ui/select";
import { Toggle } from "@/shared/ui/toggle";

import { AdminEmptyState } from "../_components/admin-operational-ui";
import { AdminTable, AdminTableCell, AdminTableRow } from "./finance-table";
import type { FinanceViewProps } from "./finance-view-types";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-019`, `D-020`) — la vista **Entidades de cobro**.
 *
 * Columnas congeladas: **nombre** (con su código) · **tipo** · **utilizada por** · **estado** · **acciones**.
 *
 * El catálogo **es** `banks`, el que ya existía: no hay uno paralelo, y por eso lo que se edita acá es lo
 * mismo que la caja usa para cuadrar el lote de la terminal. El **tipo no se infiere del nombre**: una
 * entidad cargada antes de esta pantalla queda en «Otro» hasta que alguien la clasifique (`D-020`).
 *
 * «Utilizada por N medios de pago» sale de la configuración real (cuántos medios apuntan a esta entidad), y
 * es el dato que evita apagar una entidad que todavía se usa.
 */

const ENTITY_TYPE_OPTIONS = [
  { value: "bank", label: "Banco" },
  { value: "acquirer", label: "Adquirente" },
  { value: "digital_provider", label: "Proveedor digital" },
  { value: "other", label: "Otro" },
];

type EntityDraft = {
  id?: string;
  name: string;
  code: string | null;
  entityType: string;
  isActive: boolean;
};

export default function FinanceEntitiesView({ config, api, run }: FinanceViewProps) {
  const [search, setSearch] = React.useState("");
  const [draft, setDraft] = React.useState<EntityDraft | null>(null);

  const typeLabel = (value: string) =>
    ENTITY_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? "Otro";

  const usedBy = (entityId: string) =>
    config.paymentMethods.filter((method) => method.entityId === entityId).length;

  const query = search.trim().toLowerCase();
  const rows = config.entities.filter((entity) =>
    `${entity.name} ${entity.code ?? ""} ${typeLabel(entity.entityType ?? "other")}`
      .toLowerCase()
      .includes(query),
  );

  return (
    <div className="space-y-4 rounded-stitch-lg border border-line-subtle bg-surface-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-st-h2 text-ink">Entidades de cobro</h2>
          <p className="text-st-body text-ink-secondary">
            Contra qué se concilia cada medio: bancos, adquirentes y proveedores digitales.
          </p>
        </div>
        <Button
          type="button"
          className="min-h-11"
          onClick={() => setDraft({ name: "", code: null, entityType: "other", isActive: true })}
        >
          + Nueva entidad
        </Button>
      </div>

      <Input
        label="Buscar entidad"
        placeholder="Buscar entidad..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {config.entities.length === 0 ? (
        <AdminEmptyState
          title="Todavía no hay entidades de cobro cargadas"
          description="Sin entidades, el cierre de banco no ofrece ningún bloque."
        />
      ) : (
        <AdminTable
          label="Entidades de cobro"
          columns={["Nombre", "Tipo", "Utilizada por", "Estado", ""]}
          gridClassName="md:grid-cols-[minmax(160px,1.2fr)_minmax(140px,1fr)_minmax(150px,1fr)_100px_34px]"
          isEmpty={rows.length === 0}
          emptyLabel="Ninguna entidad coincide con la búsqueda."
        >
          {rows.map((entity) => (
            <AdminTableRow
              key={entity.id}
              gridClassName="md:grid-cols-[minmax(160px,1.2fr)_minmax(140px,1fr)_minmax(150px,1fr)_100px_34px]"
            >
              <AdminTableCell label="Nombre">
                <strong className="block text-st-body font-semibold">{entity.name}</strong>
                {entity.code ? (
                  <span className="mt-1 block font-mono text-st-caption tabular-nums text-ink-muted">
                    {entity.code}
                  </span>
                ) : null}
              </AdminTableCell>

              <AdminTableCell label="Tipo">{typeLabel(entity.entityType ?? "other")}</AdminTableCell>

              <AdminTableCell label="Utilizada por">
                {usedBy(entity.id)} {usedBy(entity.id) === 1 ? "medio de pago" : "medios de pago"}
              </AdminTableCell>

              <AdminTableCell label="Estado">
                <Toggle
                  label={`${entity.name}: ${entity.isActive ? "activa" : "apagada"}`}
                  checked={entity.isActive}
                  onChange={(next) =>
                    void run(
                      () =>
                        api.saveEntity({
                          id: entity.id,
                          name: entity.name,
                          code: entity.code,
                          entityType: entity.entityType ?? "other",
                          isActive: next,
                        }),
                      `${entity.name}: ${next ? "activa" : "apagada"}.`,
                    )
                  }
                />
              </AdminTableCell>

              <AdminTableCell label="Acciones">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 md:min-h-9 md:px-2"
                  aria-label={`Editar ${entity.name}`}
                  onClick={() =>
                    setDraft({
                      id: entity.id,
                      name: entity.name,
                      code: entity.code,
                      entityType: entity.entityType ?? "other",
                      isActive: entity.isActive,
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

      <p className="text-st-caption text-ink-muted">
        Este nivel no almacena credenciales, números de cuenta ni secretos de procesadores.
      </p>

      <Modal
        open={draft !== null}
        title={draft?.id ? "Editar entidad" : "Nueva entidad"}
        onClose={() => setDraft(null)}
      >
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

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                className="min-h-11"
                onClick={() =>
                  void run(() => api.saveEntity(draft), "Entidad guardada.").then((ok) => {
                    if (ok) setDraft(null);
                  })
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

    </div>
  );
}
