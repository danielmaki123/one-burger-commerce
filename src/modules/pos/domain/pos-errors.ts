export class PosError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409 | 422,
    public readonly code:
      | "BAD_REQUEST"
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "CONFLICT"
      | "VALIDATION_ERROR",
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "PosError";
  }
}
