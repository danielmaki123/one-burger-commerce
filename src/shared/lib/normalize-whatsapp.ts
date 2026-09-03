export function normalizeWhatsapp(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";

  // Nicaragua defaults: local 8 digits => +505########
  if (digits.length === 8) {
    return `+505${digits}`;
  }

  // Nicaragua with country code without plus: 505########
  if (digits.length === 11 && digits.startsWith("505")) {
    return `+${digits}`;
  }

  // Generic international compatibility when caller already includes country code.
  if (digits.length >= 8 && digits.length <= 15 && (hasPlus || digits.length > 8)) {
    return `+${digits}`;
  }

  return "";
}
