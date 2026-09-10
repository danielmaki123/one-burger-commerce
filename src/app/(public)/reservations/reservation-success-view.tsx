"use client";

import { useState } from "react";

import { resolveBrandImageUrl } from "@/modules/business-settings/domain/brand-assets";
import { useBusinessSettings } from "@/shared/lib/business-settings";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";

export type ReservationSuccessData = {
  status: string;
  reservationNumber?: string;
  date: string;
  time: string;
  partySize: number;
  tableLabel?: string;
  customerName?: string;
};

function formatReservationDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("es-NI", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parsed);
}

function formatReservationTime(value: string) {
  const [hours, minutes] = value.split(":");
  const parsed = new Date();
  parsed.setHours(Number(hours ?? "0"), Number(minutes ?? "0"), 0, 0);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("es-NI", {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function getReservationStatusLabel(status: string) {
  switch (status) {
    case "requested":
      return "Confirmada";
    case "approved":
      return "Confirmada";
    case "rejected":
      return "Rechazada";
    case "seated":
      return "En mesa";
    case "cancelled":
      return "Cancelada";
    case "no_show":
      return "No show";
    default:
      return status;
  }
}

type ReservationSuccessViewProps = {
  reservation: ReservationSuccessData;
  onViewActivity?: () => void;
};

export default function ReservationSuccessView({
  reservation,
  onViewActivity,
}: ReservationSuccessViewProps) {
  const [hideMascot, setHideMascot] = useState(false);
  const settings = useBusinessSettings();
  const statusLabel = getReservationStatusLabel(reservation.status);
  const reservationCode = reservation.reservationNumber ?? "Pendiente de código";
  const areaLabel = reservation.tableLabel ?? "Mesa por confirmar";

  return (
    <div className="min-h-dvh brand-canvas text-foreground">
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pb-36 pt-4 sm:max-w-2xl sm:px-8 sm:pb-16 sm:pt-10">
        <section className="text-center">
          <div className="mx-auto flex max-w-md flex-col items-center">
            {!hideMascot ? (
              <div className="relative flex w-full items-end justify-center pt-1">
                <div className="absolute bottom-0 h-16 w-40 rounded-t-full bg-brand/10 sm:h-28 sm:w-72" />
                <img
                  src={resolveBrandImageUrl(settings, "full") ?? undefined}
                  alt=""
                  aria-hidden="true"
                  data-mascot="mascota-reserva"
                  className="relative z-10 h-auto w-[112px] object-contain brand-drop-shadow sm:w-[220px]"
                  onError={() => setHideMascot(true)}
                />
              </div>
            ) : null}

            <span
              aria-hidden="true"
              className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#8aa060] text-base font-semibold text-white shadow-[0_8px_18px_-12px_rgba(41,37,36,0.65)] sm:h-9 sm:w-9 sm:text-xl"
            >
              ✓
            </span>

            <h1
              className="mt-2 text-center text-3xl font-semibold leading-tight text-foreground sm:mt-4 sm:text-5xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              ¡Reserva confirmada!
            </h1>
            <p className="mt-2 max-w-sm text-center text-base leading-6 text-muted-foreground sm:mt-3 sm:text-lg">
              Te esperamos en {settings.name}.
            </p>

            <Badge
              variant="success"
              className="mt-3 border border-brand/25 bg-brand/10 px-4 py-2 text-sm font-semibold text-brand sm:mt-5"
            >
              <span
                aria-hidden="true"
                className="mr-2 h-2 w-2 rounded-full bg-brand"
              />
              {statusLabel}
            </Badge>
          </div>
        </section>

        <div className="mt-4 sm:mt-7">
          <Button
            className="h-14 w-full rounded-2xl bg-brand text-base font-semibold text-brand-foreground brand-shadow-cta hover:bg-brand-strong"
            onClick={onViewActivity}
          >
            Ver mis reservas
          </Button>
        </div>

        <section className="mt-4 rounded-3xl bg-card/92 p-3 shadow-[0_18px_38px_-30px_rgba(60,40,20,0.55)] ring-1 ring-border sm:mt-7 sm:p-6">
          <h2 className="text-lg font-semibold text-foreground sm:text-xl">
            Resumen de tu reserva
          </h2>
          <div className="mt-3 space-y-2.5 sm:mt-5 sm:space-y-4">
            <SummaryRow
              label="Fecha"
              value={formatReservationDate(reservation.date)}
            />
            <SummaryRow
              label="Hora"
              value={formatReservationTime(reservation.time)}
            />
            <SummaryRow
              label="Personas"
              value={`${reservation.partySize} personas`}
            />
            <SummaryRow label="Área / Mesa" value={areaLabel} />
            <div className="flex items-end justify-between gap-4 border-t border-border pt-3 sm:pt-4">
              <span className="text-sm font-medium text-muted-foreground">
                Código de reserva
              </span>
              <span className="text-right text-lg font-semibold tabular-nums text-foreground sm:text-xl">
                {reservationCode}
              </span>
            </div>
          </div>
        </section>

        <div className="mx-auto mt-6 max-w-sm space-y-1 text-center text-sm leading-6 text-muted-foreground sm:mt-7">
          <p>Te enviaremos un recordatorio antes de tu reserva.</p>
          <p>Gracias por elegir {settings.name}.</p>
        </div>
      </main>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-semibold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}
