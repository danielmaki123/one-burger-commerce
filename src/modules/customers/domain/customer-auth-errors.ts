export class CustomerAuthError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404 | 409 | 429 | 503,
    public readonly code:
      | "BAD_REQUEST"
      | "UNAUTHORIZED"
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "CONFLICT"
      | "TOO_MANY_REQUESTS"
      | "PROVIDER_NOT_CONFIGURED",
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "CustomerAuthError";
  }
}
