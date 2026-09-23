"use client";

import * as React from "react";

import { toCashCountConfig } from "@/modules/cash-config/domain/cash-count-config";
import type { CashViewConfig } from "@/modules/cash-config/domain/cash-config.types";
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
  cashCountConfigs,
  banksByLocation,
  cashTerminalsByLocation,
  canSeeShiftDetail,
  canSeeCloseDetail,
  canPrintDocuments,
  actorName,
}: {
  locations: { id: string; name: string }[];
  /**
   * Fase 2 del rediseño de Caja (2026-09-22) — la config del conteo **de cada sucursal del alcance**,
   * resuelta en el servidor. Cambiar de local cambia la grilla sin pedir nada a la API (que además es del
   * dueño: el cajero no tiene por qué poder leerla). Incluye el **arqueo ciego** (Fase 4).
   */
  cashCountConfigs: Record<string, CashViewConfig>;
  /**
   * Fase 3 del rediseño de Caja (2026-09-23) — los bancos que liquida **cada sucursal**, resueltos en el
   * servidor. El cierre dibuja un bloque por banco: sin esto la pantalla no sabría contra quién se cuadra
   * el lote (la API del catálogo es del dueño).
   */
  banksByLocation: Record<string, { id: string; name: string; code: string | null }[]>;
  /**
   * Fase 6 del rediseño de Caja (2026-09-23) — las **terminales activas** de cada sucursal, resueltas en el
   * servidor. Con una sola no se dibuja selector; con dos o más, el cajero elige en qué POS está.
   */
  cashTerminalsByLocation: Record<string, { id: string; label: string }[]>;
  /** `true` = puede abrir el detalle de un turno (`canViewCashHistory`). */
  canSeeShiftDetail: boolean;
  /** `true` = ve el arqueo completo del cierre recién hecho. */
  canSeeCloseDetail: boolean;
  /** Fase 4 — `canPrintCashDocuments`: el papel del arqueo lo saca el dueño (§8.e). */
  canPrintDocuments: boolean;
  /** Nombre de la sesión, para el papel del traspaso. */
  actorName: string | null;
}) {
  const settings = useBusinessSettings();
  const [locationId, setLocationId] = React.useState(() => locations[0]?.id ?? "");
  /**
   * Fase 6 del rediseño de Caja (2026-09-23) — la **terminal** elegida en este local. Nace en la primera
   * terminal activa (una sucursal con una sola caja no muestra selector) y se reincia al cambiar de
   * sucursal: la terminal de un local no existe en otro.
   */
  const terminals = React.useMemo(
    () => cashTerminalsByLocation[locationId] ?? [],
    [cashTerminalsByLocation, locationId],
  );
  const [terminalId, setTerminalId] = React.useState<string | null>(
    // Nace en la primera terminal del local inicial: así la **primera** lectura ya es la caja correcta (si
    // arrancara en `null`, pediría la caja sin terminal y el cajero vería un estado que no es el suyo).
    () => cashTerminalsByLocation[locations[0]?.id ?? ""]?.[0]?.id ?? null,
  );

  React.useEffect(() => {
    setTerminalId(terminals[0]?.id ?? null);
  }, [terminals]);

  const terminalLabel = terminals.find((terminal) => terminal.id === terminalId)?.label ?? null;
  const { status, shift, closedShift, error, actionError, busy, refresh, openShift, closeShift } =
    useCashShift(locationId, terminalId);

  /**
   * La config del local elegido. Si por lo que fuera no viniera (una sucursal sin fila), se arma con los
   * defaults de la moneda del negocio: la Caja **nunca** se queda sin grilla para contar.
   */
  const countConfig = React.useMemo(
    () =>
      cashCountConfigs[locationId] ?? {
        ...toCashCountConfig({
          businessCurrencyCode: settings.currencyCode,
          usdEnabled: false,
          denominations: [],
        }),
        // Sin fila de config, el ciego queda prendido: el error cae del lado de no mostrar plata.
        blindCount: true,
      },
    [cashCountConfigs, locationId, settings.currencyCode],
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

      {/*
        Fase 6 del rediseño de Caja (2026-09-23) — con más de una terminal en el local, el cajero elige en
        qué POS está: cada una tiene su caja, su conteo y su cierre. Con una sola no se dibuja el selector (no
        hay nada que elegir) y sin terminales cargadas tampoco: ahí la caja es una sola por local.
      */}
      {terminals.length > 1 ? (
        <Select
          label="Terminal"
          value={terminalId ?? ""}
          onChange={(event) => setTerminalId(event.target.value)}
          options={terminals.map((terminal) => ({ value: terminal.id, label: terminal.label }))}
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
          countConfig={countConfig}
          terminalLabel={terminalLabel}
          banks={banksByLocation[locationId] ?? []}
          busy={busy}
          shift={shift}
          actionError={actionError}
          canSeeShiftDetail={canSeeShiftDetail}
          canSeeCloseDetail={canSeeCloseDetail}
          blindCount={countConfig.blindCount ?? true}
          canPrint={canPrintDocuments}
          onClose={(counts, bankCloses) => void closeShift(counts, bankCloses)}
        />
      ) : null}

      {status === "ready" && !shift ? (
        <CashOpenSection
          countConfig={countConfig}
          busy={busy}
          closedShift={closedShift}
          actionError={actionError}
          canSeeCloseDetail={canSeeCloseDetail}
          blindCount={countConfig.blindCount ?? true}
          onOpen={(counts) => void openShift(counts)}
        />
      ) : null}
    </div>
  );
}
