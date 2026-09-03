export type WhatsappPrefixOption = {
  value: string;
  label: string;
  placeholder: string;
  minDigits: number;
  maxDigits: number;
};

export const WHATSAPP_PREFIX_OPTIONS: WhatsappPrefixOption[] = [
  { value: "+505", label: "+505", placeholder: "86791327", minDigits: 8, maxDigits: 8 },
  { value: "+1", label: "+1", placeholder: "5551234567", minDigits: 10, maxDigits: 10 },
  { value: "+506", label: "+506", placeholder: "88887777", minDigits: 8, maxDigits: 8 },
  { value: "+502", label: "+502", placeholder: "55551234", minDigits: 8, maxDigits: 8 },
  { value: "+503", label: "+503", placeholder: "77771234", minDigits: 8, maxDigits: 8 },
  { value: "+504", label: "+504", placeholder: "99991234", minDigits: 8, maxDigits: 8 },
  { value: "+507", label: "+507", placeholder: "66661234", minDigits: 8, maxDigits: 8 },
  { value: "+52", label: "+52", placeholder: "5512345678", minDigits: 10, maxDigits: 10 },
];

export const WHATSAPP_DEFAULT_PREFIX = "+505";
export const WHATSAPP_OTHER_PREFIX_VALUE = "OTHER";

export function sanitizeWhatsappDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 15);
}

export function sanitizeWhatsappPrefix(raw: string): string {
  const digits = sanitizeWhatsappDigits(raw).slice(0, 4);
  return digits ? `+${digits}` : "+";
}

export function findWhatsappPrefixOption(prefix: string): WhatsappPrefixOption | undefined {
  return WHATSAPP_PREFIX_OPTIONS.find((option) => option.value === prefix);
}

export function isValidWhatsappPrefix(prefix: string): boolean {
  return /^\+\d{1,4}$/.test(prefix);
}

export function buildWhatsappValue(prefix: string, localNumber: string): string {
  const rawPrefixDigits = prefix.replace(/\D/g, "");
  if (rawPrefixDigits.length > 4) return "";

  const cleanPrefix = sanitizeWhatsappPrefix(prefix);
  const localDigits = sanitizeWhatsappDigits(localNumber);
  const fullDigits = `${cleanPrefix.replace(/\D/g, "")}${localDigits}`;
  const option = findWhatsappPrefixOption(cleanPrefix);

  if (!isValidWhatsappPrefix(cleanPrefix) || !localDigits) return "";
  if (option && (localDigits.length < option.minDigits || localDigits.length > option.maxDigits)) {
    return "";
  }
  if (fullDigits.length < 8 || fullDigits.length > 15) return "";

  return `+${fullDigits}`;
}

export function isCompleteWhatsappInput(prefix: string, localNumber: string): boolean {
  const rawPrefixDigits = prefix.replace(/\D/g, "");
  if (rawPrefixDigits.length > 4) return false;

  const cleanPrefix = sanitizeWhatsappPrefix(prefix);
  const localDigits = sanitizeWhatsappDigits(localNumber);
  const option = findWhatsappPrefixOption(cleanPrefix);

  if (!isValidWhatsappPrefix(cleanPrefix) || !localDigits) return false;

  if (option) {
    return localDigits.length >= option.minDigits && localDigits.length <= option.maxDigits;
  }

  const fullDigits = `${cleanPrefix.replace(/\D/g, "")}${localDigits}`;
  return fullDigits.length >= 8 && fullDigits.length <= 15;
}

export function parseWhatsappValue(value: string): {
  prefix: string;
  localNumber: string;
  isOtherPrefix: boolean;
} {
  const trimmed = value.trim();
  const digits = sanitizeWhatsappDigits(trimmed);

  if (!digits) {
    return { prefix: WHATSAPP_DEFAULT_PREFIX, localNumber: "", isOtherPrefix: false };
  }

  const knownPrefix = [...WHATSAPP_PREFIX_OPTIONS]
    .sort((a, b) => b.value.length - a.value.length)
    .find((option) => digits.startsWith(option.value.replace(/\D/g, "")));

  if (knownPrefix) {
    return {
      prefix: knownPrefix.value,
      localNumber: digits.slice(knownPrefix.value.replace(/\D/g, "").length),
      isOtherPrefix: false,
    };
  }

  const inferredPrefixDigits = digits.slice(0, Math.min(3, Math.max(1, digits.length - 7)));
  return {
    prefix: `+${inferredPrefixDigits}`,
    localNumber: digits.slice(inferredPrefixDigits.length),
    isOtherPrefix: true,
  };
}
