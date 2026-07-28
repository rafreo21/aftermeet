export type ContactMethodLike = {
  type: string;
  value: string;
};

function phoneNumber(value: string) {
  const normalized = value.trim().replace(/[^\d+]/g, '');
  return normalized.startsWith('+')
    ? `+${normalized.slice(1).replace(/\+/g, '')}`
    : normalized.replace(/\+/g, '');
}

export function contactMethodHref(method: ContactMethodLike): string | null {
  const value = method.value.trim();
  if (!value) return null;

  switch (method.type) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? `mailto:${value}` : null;
    case 'phone': {
      const phone = phoneNumber(value);
      return phone.length >= 5 ? `tel:${phone}` : null;
    }
    case 'linkedin': {
      if (/^https?:\/\//i.test(value)) return value;
      const handle = value.trim().replace(/^@/, '').replace(/^\/+|\/+$/g, '');
      return handle ? `https://linkedin.com/in/${handle}` : null;
    }
    case 'whatsapp': {
      if (/^https?:\/\//i.test(value)) return value;
      const phone = phoneNumber(value).replace(/^\+/, '');
      return phone.length >= 5 ? `https://wa.me/${phone}` : null;
    }
    default:
      return /^https?:\/\//i.test(value) ? value : null;
  }
}
