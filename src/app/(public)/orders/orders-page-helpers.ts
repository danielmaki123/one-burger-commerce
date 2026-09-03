const publicOrderDateFormatter = new Intl.DateTimeFormat("es-NI", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Managua",
});

export function formatPublicOrderUpdatedAt(value: string): string {
  return publicOrderDateFormatter.format(new Date(value));
}
