import type { ContactMethod, ContactMethodType } from '@/features/card/types';

export const METHOD_CATEGORIES = ['General', 'Social', 'Messaging', 'Business', 'Payment'] as const;

type MethodMeta = {
  category: typeof METHOD_CATEGORIES[number];
  name: string;
  placeholder: string;
  label: string;
};

export const METHOD_META: Record<ContactMethodType, MethodMeta> = {
  email: { category: 'General', name: 'Email', placeholder: 'you@example.com', label: 'Work' },
  phone: { category: 'General', name: 'Phone', placeholder: '+44 7700 900000', label: 'Mobile' },
  website: { category: 'General', name: 'Company URL', placeholder: 'https://yourcompany.com', label: 'Visit our website' },
  link: { category: 'General', name: 'Link', placeholder: 'https://example.com', label: 'Open link' },
  address: { category: 'General', name: 'Address', placeholder: 'Street, city, postcode', label: 'Office' },
  x: { category: 'Social', name: 'X', placeholder: '@username or profile URL', label: 'Follow me on X' },
  instagram: { category: 'Social', name: 'Instagram', placeholder: '@username or profile URL', label: 'Follow on Instagram' },
  threads: { category: 'Social', name: 'Threads', placeholder: '@username or profile URL', label: 'Follow on Threads' },
  linkedin: { category: 'Social', name: 'LinkedIn', placeholder: 'Profile URL or username', label: 'Connect on LinkedIn' },
  facebook: { category: 'Social', name: 'Facebook', placeholder: 'Profile or page URL', label: 'Find us on Facebook' },
  youtube: { category: 'Social', name: 'YouTube', placeholder: 'Channel URL or handle', label: 'Watch on YouTube' },
  snapchat: { category: 'Social', name: 'Snapchat', placeholder: 'Username or profile URL', label: 'Add on Snapchat' },
  tiktok: { category: 'Social', name: 'TikTok', placeholder: '@username or profile URL', label: 'Follow on TikTok' },
  twitch: { category: 'Social', name: 'Twitch', placeholder: 'Channel URL or username', label: 'Watch on Twitch' },
  yelp: { category: 'Social', name: 'Yelp', placeholder: 'Business page URL', label: 'Review us on Yelp' },
  whatsapp: { category: 'Messaging', name: 'WhatsApp', placeholder: 'Number or wa.me link', label: 'Message on WhatsApp' },
  signal: { category: 'Messaging', name: 'Signal', placeholder: 'Username or phone number', label: 'Message on Signal' },
  discord: { category: 'Messaging', name: 'Discord', placeholder: 'Username or invite URL', label: 'Connect on Discord' },
  skype: { category: 'Messaging', name: 'Skype', placeholder: 'Skype username', label: 'Call on Skype' },
  telegram: { category: 'Messaging', name: 'Telegram', placeholder: '@username or t.me link', label: 'Message on Telegram' },
  github: { category: 'Business', name: 'GitHub', placeholder: 'Username or profile URL', label: 'View my GitHub' },
  calendly: { category: 'Business', name: 'Calendly', placeholder: 'https://calendly.com/you', label: 'Book a meeting' },
  paypal: { category: 'Payment', name: 'PayPal', placeholder: 'PayPal.me URL or username', label: 'Pay with PayPal' },
  venmo: { category: 'Payment', name: 'Venmo', placeholder: 'Venmo username or URL', label: 'Pay with Venmo' },
  cashapp: { category: 'Payment', name: 'Cash App', placeholder: '$cashtag or URL', label: 'Pay with Cash App' },
};

export function methodsForCategory(category: typeof METHOD_CATEGORIES[number]) {
  return (Object.keys(METHOD_META) as ContactMethodType[]).filter((type) => METHOD_META[type].category === category);
}

export function fieldLabel(type: ContactMethodType) {
  if (type === 'email') return 'Email address';
  if (type === 'phone') return 'Phone number';
  if (type === 'website') return 'Company website URL';
  if (type === 'link') return 'Destination URL';
  if (type === 'address') return 'Street address';
  if (type === 'calendly') return 'Booking page URL';
  if (['whatsapp', 'signal', 'discord', 'skype', 'telegram'].includes(type)) {
    return `${METHOD_META[type].name} username or link`;
  }
  if (['paypal', 'venmo', 'cashapp'].includes(type)) {
    return `${METHOD_META[type].name} username or link`;
  }
  return 'Profile URL or username';
}

export function labelSuggestions(type: ContactMethodType) {
  if (type === 'phone') return ['Mobile', 'Work', 'Home', 'Office'];
  if (type === 'email') return ['Work', 'Personal', 'Bookings', 'Press'];
  if (type === 'address') return ['Office', 'Studio', 'Shop', 'Meet me here'];
  if (['website', 'link'].includes(type)) return ['Visit our website', 'View my work', 'Learn more'];
  if (type === 'calendly') return ['Book a meeting', 'Schedule a call', 'Check availability'];
  if (['paypal', 'venmo', 'cashapp'].includes(type)) return ['Send a payment', 'Pay me', 'Tip me'];
  if (['whatsapp', 'signal', 'discord', 'skype', 'telegram'].includes(type)) {
    return [`Message on ${METHOD_META[type].name}`, 'Chat with me', 'Get in touch'];
  }
  return [`Connect on ${METHOD_META[type].name}`, `Follow on ${METHOD_META[type].name}`, 'View profile'];
}

export function validateMethod(method: ContactMethod) {
  const value = method.value.trim();
  if (!value) return 'Enter a value before saving.';
  if (method.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return 'Enter a valid email address.';
  }
  if ((method.type === 'phone' || method.type === 'whatsapp') && value.replace(/\D/g, '').length < 8) {
    return 'Enter a valid phone number with country code.';
  }
  if (['website', 'link', 'calendly'].includes(method.type)) {
    try {
      new URL(value);
    } catch {
      return 'Include the full address, beginning with https://';
    }
  }
  return '';
}
