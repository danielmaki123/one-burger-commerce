import { defaultLocationCashConfig } from "@/modules/cash-config/domain/cash-count-config";
import type {
  CashConfigPatch,
  CashDenominationRecord,
  LocationCashConfigRecord,
  PosTerminalRecord,
} from "@/modules/cash-config/domain/cash-config.types";
import type {
  CashConfigRepository,
  UpdateCashConfigMeta,
} from "@/modules/cash-config/ports/cash-config-repository";

/**
 * Fase 2 del rediseño de Caja (2026-09-22) — el doble de test: mismo contrato que el adaptador de Prisma,
 * sin base de datos.
 *
 * Mantiene la regla que hace que la config no borre historia: **una denominación que sale de la lista se
 * desactiva, no se borra**. Es la parte del contrato que la pantalla no puede garantizar sola, así que se
 * prueba acá y en el adaptador de Prisma.
 */
export class InMemoryCashConfigRepository implements CashConfigRepository {
  locationConfigs = new Map<string, LocationCashConfigRecord>();
  denominations: CashDenominationRecord[] = [];
  posTerminals: PosTerminalRecord[] = [];

  async getLocationConfig(locationId: string): Promise<LocationCashConfigRecord | null> {
    return this.locationConfigs.get(locationId) ?? null;
  }

  async saveLocationConfig(
    locationId: string,
    patch: Pick<CashConfigPatch, "usdEnabled" | "blindCount">,
    meta: UpdateCashConfigMeta = {},
  ): Promise<LocationCashConfigRecord> {
    const base = this.locationConfigs.get(locationId) ?? defaultLocationCashConfig(locationId);

    const next: LocationCashConfigRecord = {
      ...base,
      ...(patch.usdEnabled !== undefined ? { usdEnabled: patch.usdEnabled } : {}),
      ...(patch.blindCount !== undefined ? { blindCount: patch.blindCount } : {}),
      updatedAt: new Date().toISOString(),
      updatedByUserId: meta.updatedByUserId ?? base.updatedByUserId ?? null,
    };

    this.locationConfigs.set(locationId, next);
    return next;
  }

  async listDenominations(): Promise<CashDenominationRecord[]> {
    return [...this.denominations].sort(
      (a, b) => a.currency.localeCompare(b.currency) || b.value - a.value,
    );
  }

  async replaceDenominations(rows: CashDenominationRecord[]): Promise<CashDenominationRecord[]> {
    const incoming = new Map(rows.map((row) => [`${row.currency}-${row.value}`, row]));

    // Lo que estaba y no vino queda **inactivo** (no se borra): un cierre viejo sigue diciendo con qué
    // billetes se contó.
    for (const existing of this.denominations) {
      const key = `${existing.currency}-${existing.value}`;
      if (!incoming.has(key)) existing.isActive = false;
    }

    for (const row of rows) {
      const key = `${row.currency}-${row.value}`;
      const existing = this.denominations.find(
        (candidate) => `${candidate.currency}-${candidate.value}` === key,
      );

      if (existing) {
        existing.isActive = row.isActive;
        existing.sortOrder = row.sortOrder;
      } else {
        this.denominations.push({ ...row });
      }
    }

    return this.listDenominations();
  }

  async listPosTerminals(locationIds: readonly string[]): Promise<PosTerminalRecord[]> {
    const wanted = new Set(locationIds);

    return this.posTerminals
      .filter((terminal) => wanted.has(terminal.locationId))
      .sort((a, b) => a.locationId.localeCompare(b.locationId) || a.sortOrder - b.sortOrder)
      .map((terminal) => ({ ...terminal }));
  }

  async replacePosTerminals(
    locationId: string,
    rows: readonly PosTerminalRecord[],
  ): Promise<PosTerminalRecord[]> {
    const incoming = new Map(rows.map((row) => [row.id, row]));

    // Lo que estaba en esa sucursal y no vino queda **apagado** (no se borra): un turno viejo sigue
    // diciendo en qué terminal se abrió.
    for (const existing of this.posTerminals) {
      if (existing.locationId !== locationId) continue;
      if (!incoming.has(existing.id)) existing.isActive = false;
    }

    rows.forEach((row, index) => {
      const existing = this.posTerminals.find((terminal) => terminal.id === row.id);
      const next: PosTerminalRecord = {
        id: row.id,
        locationId,
        label: row.label,
        isActive: row.isActive,
        sortOrder: Number.isInteger(row.sortOrder) ? row.sortOrder : index,
      };

      if (existing) Object.assign(existing, next);
      else this.posTerminals.push(next);
    });

    return this.listPosTerminals([locationId]);
  }
}
