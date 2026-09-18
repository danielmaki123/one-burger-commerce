/**
 * Factura simple (2026-09-18) — los errores del documento.
 *
 * Tipados por módulo, como los del resto del repo: el mapeo HTTP vive en
 * `src/shared/lib/http/error-response.ts` y el caso de uso no conoce `NextResponse`.
 */
export class InvoiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "InvoiceError";
  }
}
