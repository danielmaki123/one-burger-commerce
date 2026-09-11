import { formatSlotLabel } from "@/modules/business-settings/domain/pickup-slots";

/**
 * Hora del día en la zona del negocio, en el mismo formato que usa el checkout
 * (`8:00 p. m.`).
 *
 * Se formatea con la zona configurada y no con la del equipo que la ejecuta: el ticket
 * de cocina y el admin tienen que mostrar la hora del local, no la del navegador de
 * quien mira. Una fecha inválida devuelve `""` para no tumbar la pantalla ni el envío.
 */
export function formatTimeInTimeZone(dateIso: string, timeZone: string): string {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return "";

  const parts = safeFormatParts(date, timeZone);
  if (!parts) return formatSlotLabel(fallbackTimeOfDay(date));

  return formatSlotLabel(parts);
}

function safeFormatParts(date: Date, timeZone: string): string | null {
  try {
    const formatted = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);

    const hours = formatted.find((part) => part.type === "hour")?.value;
    const minutes = formatted.find((part) => part.type === "minute")?.value;

    if (hours && minutes) return `${hours}:${minutes}`;
  } catch {
    // Zona horaria inválida: se sigue con UTC.
  }

  return null;
}

function fallbackTimeOfDay(date: Date): string {
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}
