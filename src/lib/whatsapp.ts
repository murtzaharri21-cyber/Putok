export function normalizeWhatsAppNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("92") && digits.length === 12) return `0${digits.slice(2)}`;
  return digits;
}

export function isValidWhatsAppNumber(value: string) {
  return /^03\d{9}$/.test(normalizeWhatsAppNumber(value));
}

export function whatsappUrl(value: string) {
  return `https://wa.me/92${normalizeWhatsAppNumber(value).slice(1)}`;
}
