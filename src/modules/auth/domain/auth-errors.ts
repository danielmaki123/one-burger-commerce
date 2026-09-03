export class AuthError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403,
    public readonly code: "BAD_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN",
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

