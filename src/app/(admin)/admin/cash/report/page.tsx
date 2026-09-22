import Link from "next/link";
import { redirect } from "next/navigation";

import { requireCashScope } from "@/app/api/admin/cash/cash-route-helpers";
import { canViewCashHistory } from "@/modules/auth/domain/admin-permissions";
import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import { PrismaShiftRepository } from "@/modules/orders/adapters/prisma-shift-repository";
import {
  groupDayCloseByLocation,
  summarizeDayClose,
  type DayCloseShift,
} from "@/modules/orders/domain/day-close";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { businessDate, businessDayRange, isBusinessDay } from "@/shared/lib/business-days";
import { loadBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";

import { AdminPageHeader } from "../../_components/admin-operational-ui";
import CashDayReportPanel from "./cash-day-report-panel";

/**
 * Tarea 1.5 del roadmap + decisión del owner (2026-09-17) — el **reporte diario de caja**, con fecha.
 *
 * El resumen del día que había (`/admin`) es de **órdenes**; la caja del día se veía solo para hoy y sin
 * desglose por medio. Esta pantalla responde la pregunta del dueño para **cualquier día**: cuánto se cobró,
 * por dónde entró y cómo quedó cada caja.
 *
 * El **día** es el del negocio (no el del servidor) y llega por la URL; si viene mal escrita se usa hoy, en
 * vez de mostrar el historial entero como si fuera un día. La puerta es la de auditar la caja.
 */
export default async function AdminCashDayReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await requireAdminSession();

  if (!canViewCashHistory(session.user.role)) {
    redirect("/admin/orders");
  }

  const locations = await requireCashScope({
    role: session.user.role,
    assignedLocationIds: session.user.locationIds,
  });
  const settings = await loadBusinessSettings({
    repository: new PrismaBusinessSettingsRepository(),
  });

  const hoy = businessDate(new Date(), settings.timezone);
  const { date: pedido } = await searchParams;
  const date = isBusinessDay(pedido) ? pedido : hoy;
  const range = businessDayRange(date, settings.timezone);
  const repository = new PrismaShiftRepository();

  const shiftsByLocation = await Promise.all(
    locations.map(async (location) => (await repository.listShifts(location.id)) as DayCloseShift[]),
  );
  const dayShifts = shiftsByLocation
    .flat()
    .filter((shift) => (range.from && range.to ? shift.openedAt >= range.from && shift.openedAt <= range.to : true));

  return (
    <div className="space-y-4">
      <AdminPageHeader
        label="Caja"
        title="Reporte del día"
        description="Lo que se cobró, por dónde entró y cómo quedó cada caja."
        actions={
          <Link
            href="/admin/cash"
            className="inline-flex min-h-11 items-center text-st-body font-semibold text-brand-primary underline"
          >
            Volver a Caja
          </Link>
        }
      />

      <CashDayReportPanel
        date={date}
        today={hoy}
        groups={groupDayCloseByLocation(dayShifts, locations)}
        totals={summarizeDayClose(dayShifts)}
        currency={{ symbol: settings.currencySymbol, locale: settings.locale }}
      />
    </div>
  );
}
