export const whatsAppUrl = (phone: string, message: string): string => {
  const digits = phone.replace(/\D/g, '');
  const normalizedPhone = digits.length === 8 ? `503${digits}` : digits;
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
};