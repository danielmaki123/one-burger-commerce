export class BusinessSettingsError extends Error {
  constructor(
    public readonly status: 422,
    public readonly code: "VALIDATION_ERROR",
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "BusinessSettingsError";
  }
}
