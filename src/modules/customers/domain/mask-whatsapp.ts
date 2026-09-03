export function maskWhatsapp(whatsappNormalized: string) {
  const digits = whatsappNormalized.replace(/\D/g, "");

  if (digits.length < 4) {
    return "****";
  }

  const tail = digits.slice(-4);
  const country = digits.length > 8 ? `+${digits.slice(0, digits.length - 8)}` : "+";

  return `${country}****${tail}`;
}
