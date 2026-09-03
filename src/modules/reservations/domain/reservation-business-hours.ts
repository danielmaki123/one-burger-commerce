export const RESERVATION_OPEN_HOUR = 12; // 12:00
export const RESERVATION_LAST_ALLOWED_HOUR = 20; // 20:00

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidReservationBusinessHour(time: string): boolean {
  const match = TIME_REGEX.exec(time);
  if (!match) return false;

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  const totalMinutes = hour * 60 + minute;

  const minMinutes = RESERVATION_OPEN_HOUR * 60;
  const maxMinutes = RESERVATION_LAST_ALLOWED_HOUR * 60;

  return totalMinutes >= minMinutes && totalMinutes <= maxMinutes;
}
