import {
  CalendarBlank,
  ChatCircleDots,
  CurrencyDollar,
  DiscordLogo,
  EnvelopeSimple,
  FacebookLogo,
  GithubLogo,
  Globe,
  InstagramLogo,
  LinkSimple,
  LinkedinLogo,
  MapPin,
  PaypalLogo,
  Phone,
  SkypeLogo,
  SnapchatLogo,
  Star,
  TelegramLogo,
  ThreadsLogo,
  TiktokLogo,
  TwitchLogo,
  WhatsappLogo,
  XLogo,
  YoutubeLogo,
} from 'phosphor-react-native';
import type { IconProps } from 'phosphor-react-native';
import type { ComponentType } from 'react';

import type { ContactMethodType } from '@/features/card/types';

const METHOD_ICONS: Partial<Record<ContactMethodType | string, ComponentType<IconProps>>> = {
  email: EnvelopeSimple,
  phone: Phone,
  website: Globe,
  link: LinkSimple,
  address: MapPin,
  x: XLogo,
  instagram: InstagramLogo,
  threads: ThreadsLogo,
  linkedin: LinkedinLogo,
  facebook: FacebookLogo,
  youtube: YoutubeLogo,
  snapchat: SnapchatLogo,
  tiktok: TiktokLogo,
  twitch: TwitchLogo,
  yelp: Star,
  whatsapp: WhatsappLogo,
  signal: ChatCircleDots,
  discord: DiscordLogo,
  skype: SkypeLogo,
  telegram: TelegramLogo,
  github: GithubLogo,
  calendly: CalendarBlank,
  paypal: PaypalLogo,
  venmo: CurrencyDollar,
  cashapp: CurrencyDollar,
};

export function ContactMethodIcon({
  type,
  size = 18,
  color,
  weight = 'bold',
}: {
  type: string;
  size?: number;
  color: string;
  weight?: IconProps['weight'];
}) {
  const Icon = METHOD_ICONS[type] || LinkSimple;
  return <Icon size={size} color={color} weight={weight} />;
}
