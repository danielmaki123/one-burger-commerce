import { createHash, randomBytes } from "node:crypto";

const RESERVATION_NUMBER_PREFIX = "RSV";
const RESERVATION_NUMBER_LENGTH = 6;

export function generateReservationNumber() {
  const suffix = randomBytes(4)
    .toString("hex")
    .slice(0, RESERVATION_NUMBER_LENGTH)
    .toUpperCase();
  return `${RESERVATION_NUMBER_PREFIX}-${suffix}`;
}

export function generateReservationLookupToken() {
  return randomBytes(24).toString("hex");
}

export function hashReservationLookupToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
