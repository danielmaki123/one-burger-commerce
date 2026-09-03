import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_KEY_LENGTH = 64;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString("hex");

  return `${salt}:${digest}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, expectedDigest] = storedHash.split(":");

  if (!salt || !expectedDigest) {
    return false;
  }

  const passwordDigest = scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  const storedDigest = Buffer.from(expectedDigest, "hex");

  return (
    storedDigest.length === passwordDigest.length &&
    timingSafeEqual(storedDigest, passwordDigest)
  );
}

