import { randomBytes } from "node:crypto";

/**
 * CSP del sitio, con un nonce por respuesta.
 *
 * El proyecto no tenía ninguna: solo HSTS, `nosniff`, `X-Frame-Options` y compañía.
 * Esos headers no dicen **qué scripts pueden ejecutarse**, así que un `<script>`
 * inyectado corría igual. Con `script-src 'nonce-…'` un inyectado no corre salvo que
 * adivine el nonce de esa respuesta.
 *
 * El nonce viaja al render en un header del **request** (`x-nonce` y el propio
 * `Content-Security-Policy`): así Next lo pone en sus propios `<script>` sin que
 * ninguna página tenga que pasarlo a mano. Por eso todas las pantallas del producto
 * son dinámicas (`force-dynamic`), que ya lo eran.
 */
export const CONTENT_SECURITY_POLICY_HEADER = "Content-Security-Policy";
export const CSP_NONCE_REQUEST_HEADER = "x-nonce";

/** 16 bytes en base64: 24 caracteres, sin nada que rompa el header. */
export function createCspNonce(): string {
  return randomBytes(16).toString("base64");
}

export function buildContentSecurityPolicy(nonce: string): string {
  const directives = [
    "default-src 'self'",
    // `strict-dynamic` deja que el bundle cargue sus propios chunks; `'self'` queda
    // como respaldo para navegadores viejos que lo ignoran.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Tailwind y las tipografías del build son archivos propios, pero React y Next
    // escriben estilos en línea: sin `unsafe-inline` la app queda sin estilos.
    // (El riesgo real es inyectar scripts, y eso lo cubre el nonce.)
    "style-src 'self' 'unsafe-inline'",
    // El owner carga fotos por URL desde el admin: pueden vivir en cualquier host https.
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // La app solo habla con su propia API.
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ];

  // Sin `upgrade-insecure-requests` a propósito: reescribe los subrecursos a https y
  // contra un servidor local en http (el arnés E2E, `next start -p 3210`) dejaría la
  // página sin CSS ni JS. El upgrade a https lo hace HSTS, que ya está configurado.
  return directives.join("; ");
}
