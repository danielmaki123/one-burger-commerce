"use client";

import * as React from "react";

import { useBusinessSettings } from "@/shared/lib/business-settings";
import { Select } from "@/shared/ui/select";

import CashError from "./cash-error";
import CashOpenSection from "./cash-open-section";
import CashSkeleton from "./cash-skeleton";
import CashTurnSection from "./cash-turn-section";
import { useCashShift } from "./use-cash-shift";

/**
 * Fase 1a del rediseño de Caja (2026-09-19) — **la pantalla, con un solo sujeto**: el ciclo del turno
 * (apertura → operación → cierre).
 *
 * Acá se decide **cuál de los cuatro estados** se ve, y nada más:
 *
 * | Estado | Qué se dibuja |
 * |---|---|
 * | *cargando* | `CashSkeleton` |
 * | *error* | `CashError` con el mensaje del servidor y «Reintentar» |
 * | *sin turno* | `CashOpenSection` (conteo de apertura + «Abrir caja») |
 * | *turno abierto* | `CashTurnSection` (estado de la caja + conteo + «Cerrar caja») |
 *
 * El estado de servidor vive en `useCashShift`; acá solo queda la sucursal elegida. El selector se dibuja
 * **también** durante la carga y el error: cambiar de local es la salida natural cuando el local elegido
 * no responde.
 */
export default function CashView({
  locations,
  canSeeShiftDetail,
  canSeeCloseDetail,
  actorName,
}: {
  locations: { id: string; name: string }[];
  /** `true` = puede abrir el detalle de un turno (`canViewCashHistory`). */
  canSeeShiftDetail: boolean;
  /** `true` = ve el arqueo completo del cierre recién hecho. */
  canSeeCloseDetail: boolean;
  /** Nombre de la sesión, para el papel del traspaso. */
  actorName: string | null;
}) {
  const settings = useBusinessSettings();
  const [locationId, setLocationId] = React.useState(() => locations[0]?.id ?? "");
  const { status, shift, closedShift, error, actionError, busy, refresh, openShift, closeShift } =
    useCashShift(locationId);

  const cashCurrencies = React.useMemo(
    () => [settings.currencyCode, ...(settings.usdExchangeRate !== null ? ["USD"] : [])],
    [settings.currencyCode, settings.usdExchangeRate],
  );

  const locationName = locations.find((location) => location.id === locationId)?.name ?? "";

  return (
    <div className="space-y-3">
      {locations.length > 1 ? (
        <Select
          label="Local"
          value={locationId}
          onChange={(event) => setLocationId(event.target.value)}
          options={locations.map((location) => ({ value: location.id, label: location.name }))}
        />
      ) : null}

      {status === "loading" ? <CashSkeleton /> : null}

      {status === "error" ? (
        <CashError
          message={error ?? "No se pudo leer el estado de la caja."}
          onRetry={refresh}
        />
      ) : null}

      {status === "ready" && shift ? (
        <CashTurnSection
          locationId={locationId}
          locationName={locationName}
          actorName={actorName}
          cashCurrencies={cashCurrencies}
          busy={busy}
          shift={shift}
          actionError={actionError}
          canSeeShiftDetail={canSeeShiftDetail}
          onClose={(counts) => void closeShift(counts)}
        />
      ) : null}

      {status === "ready" && !shift ? (
        <CashOpenSection
          cashCurrencies={cashCurrencies}
          busy={busy}
          closedShift={closedShift}
          actionError={actionError}
          canSeeCloseDetail={canSeeCloseDetail}
          onOpen={(counts) => void openShift(counts)}
        />
      ) : null}
    </div>
  );
}
