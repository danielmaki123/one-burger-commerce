export class AuthError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404,
    public readonly code:
      | "BAD_REQUEST"
      | "UNAUTHORIZED"
      | "FORBIDDEN"
      | "NOT_FOUND",
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

