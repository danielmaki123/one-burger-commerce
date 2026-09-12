import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Hash de contraseñas del admin.
 *
 * El formato viejo era `salt:digest` con los parámetros por defecto de Node
 * (N=2^14, r=8, p=1). Dos problemas: el costo quedó corto y **los parámetros no
 * estaban guardados**, así que subirlos habría dejado afuera a todas las cuentas
 * existentes en el próximo login.
 *
 * Formato actual: `scrypt$N$r$p$salt$digest`. Autodescriptivo, entonces:
 *  - los hashes viejos se siguen verificando (y se **actualizan solos** en el login,
 *    ver `passwordNeedsRehash` y `login-admin`);
 *  - los parámetros se pueden volver a subir sin migración ni pantalla de "cambiá tu
 *    contraseña".
 *
 * Parámetros elegidos (N=2^16, r=8, p=2, 64 MiB de memoria, ~270 ms por hash medidos
 * en la máquina de desarrollo): es una de las combinaciones que recomienda OWASP para
 * scrypt. El login del admin está limitado a 10 intentos por minuto y por IP, así que
 * ese costo lo paga un atacante, no el equipo.
 */
export const SCRYPT_PARAMS = {
  N: 65536,
  r: 8,
  p: 2,
  keylen: 64,
} as const;

/**
 * `maxmem` hay que pasarlo explícito: scrypt necesita 128·N·r bytes (64 MiB acá) y el
 * tope por defecto de Node es 32 MiB.
 */
const SCRYPT_MAXMEM = 128 * 1024 * 1024;

const CURRENT_PREFIX = "scrypt";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(password, salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
    maxmem: SCRYPT_MAXMEM,
  }).toString("hex");

  return `${CURRENT_PREFIX}$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt}$${digest}`;
}

type StoredHash = {
  N: number;
  r: number;
  p: number;
  keylen: number;
  salt: string;
  digest: Buffer;
  /** `true` cuando el hash no guarda parámetros: es del formato viejo. */
  legacy: boolean;
};

/**
 * Lee un hash guardado. Devuelve `null` si no se puede verificar (formato desconocido,
 * números raros): quien llama trata eso como "no coincide", nunca como error.
 */
function parseStoredHash(storedHash: string): StoredHash | null {
  if (storedHash.startsWith(`${CURRENT_PREFIX}$`)) {
    const parts = storedHash.split("$");
    if (parts.length !== 6) return null;

    const [, rawN, rawR, rawP, salt, rawDigest] = parts;
    const N = Number(rawN);
    const r = Number(rawR);
    const p = Number(rawP);

    if (!salt || !rawDigest) return null;
    if (!Number.isSafeInteger(N) || N < 2 || !Number.isSafeInteger(r) || r < 1) return null;
    if (!Number.isSafeInteger(p) || p < 1) return null;

    const digest = Buffer.from(rawDigest, "hex");
    // `Buffer.from(..., "hex")` corta en el primer carácter inválido: con longitud
    // impar o basura, el digest no puede ser el que se escribió.
    if (digest.length * 2 !== rawDigest.length || digest.length === 0) return null;

    return { N, r, p, keylen: digest.length, salt, digest, legacy: false };
  }

  const [salt, rawDigest] = storedHash.split(":");
  if (!salt || !rawDigest) return null;

  const digest = Buffer.from(rawDigest, "hex");
  if (digest.length * 2 !== rawDigest.length || digest.length === 0) return null;

  // Defaults de Node con los que se escribieron los hashes viejos.
  return { N: 16384, r: 8, p: 1, keylen: digest.length, salt, digest, legacy: true };
}

export function verifyPassword(password: string, storedHash: string) {
  const stored = parseStoredHash(storedHash);
  if (!stored) return false;

  let passwordDigest: Buffer;

  try {
    passwordDigest = scryptSync(password, stored.salt, stored.keylen, {
      N: stored.N,
      r: stored.r,
      p: stored.p,
      maxmem: SCRYPT_MAXMEM,
    });
  } catch {
    // Parámetros imposibles (por ejemplo un N que no entra en memoria): no es un
    // error del login, es un hash que no se puede verificar.
    return false;
  }

  return (
    stored.digest.length === passwordDigest.length &&
    timingSafeEqual(stored.digest, passwordDigest)
  );
}

/**
 * ¿Conviene volver a hashear esta contraseña cuando el usuario acaba de entrar?
 *
 * Se llama **después** de verificar: es el momento en que el servidor tiene la
 * contraseña en claro y puede guardar la versión fuerte sin pedirle nada al usuario.
 * Nunca debilita: un hash con parámetros más altos que los de hoy se deja como está.
 */
export function passwordNeedsRehash(storedHash: string): boolean {
  const stored = parseStoredHash(storedHash);
  if (!stored) return true;

  return (
    stored.legacy ||
    stored.N < SCRYPT_PARAMS.N ||
    stored.r < SCRYPT_PARAMS.r ||
    stored.p < SCRYPT_PARAMS.p ||
    stored.keylen < SCRYPT_PARAMS.keylen
  );
}
