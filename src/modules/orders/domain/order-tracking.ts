import { createHash, randomBytes } from "node:crypto";

export function generateOrderLookupToken() {
  return randomBytes(24).toString("hex");
}

export function hashOrderLookupToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
