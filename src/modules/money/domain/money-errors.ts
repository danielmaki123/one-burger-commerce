/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` — el error de la configuración financiera.
 *
 * Misma forma que `BankError` y `OrderError` (`status` + `code` + `fields`) porque la ruta que lo reciba
 * lo mapea igual que a los demás: el `status` es la respuesta HTTP y `fields` el detalle por campo que el
 * formulario muestra al lado del input. Sin esa forma, la pantalla de Finanzas tendría que adivinar qué
 * hacer con un `Error` genérico.
 */
export class MoneyError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404 | 409 | 422,
    public readonly code:
      | "BAD_REQUEST"
      | "UNAUTHORIZED"
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "CONFLICT"
      | "VALIDATION_ERROR",
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "MoneyError";
  }
}
