import { CalendarBlankIcon } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { ChatCircleDotsIcon } from "@phosphor-icons/react/dist/csr/ChatCircleDots";
import { CurrencyDollarIcon } from "@phosphor-icons/react/dist/csr/CurrencyDollar";
import { DiscordLogoIcon } from "@phosphor-icons/react/dist/csr/DiscordLogo";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { FacebookLogoIcon } from "@phosphor-icons/react/dist/csr/FacebookLogo";
import { GithubLogoIcon } from "@phosphor-icons/react/dist/csr/GithubLogo";
import { GlobeIcon } from "@phosphor-icons/react/dist/csr/Globe";
import { InstagramLogoIcon } from "@phosphor-icons/react/dist/csr/InstagramLogo";
import { LinkSimpleIcon } from "@phosphor-icons/react/dist/csr/LinkSimple";
import { LinkedinLogoIcon } from "@phosphor-icons/react/dist/csr/LinkedinLogo";
import { MapPinIcon } from "@phosphor-icons/react/dist/csr/MapPin";
import { PaypalLogoIcon } from "@phosphor-icons/react/dist/csr/PaypalLogo";
import { PhoneIcon } from "@phosphor-icons/react/dist/csr/Phone";
import { SkypeLogoIcon } from "@phosphor-icons/react/dist/csr/SkypeLogo";
import { SnapchatLogoIcon } from "@phosphor-icons/react/dist/csr/SnapchatLogo";
import { StarIcon } from "@phosphor-icons/react/dist/csr/Star";
import { TelegramLogoIcon } from "@phosphor-icons/react/dist/csr/TelegramLogo";
import { ThreadsLogoIcon } from "@phosphor-icons/react/dist/csr/ThreadsLogo";
import { TiktokLogoIcon } from "@phosphor-icons/react/dist/csr/TiktokLogo";
import { TwitchLogoIcon } from "@phosphor-icons/react/dist/csr/TwitchLogo";
import { WhatsappLogoIcon } from "@phosphor-icons/react/dist/csr/WhatsappLogo";
import { XLogoIcon } from "@phosphor-icons/react/dist/csr/XLogo";
import { YoutubeLogoIcon } from "@phosphor-icons/react/dist/csr/YoutubeLogo";
import type { IconProps } from "@phosphor-icons/react";
import type { ComponentType } from "react";

const METHOD_ICONS: Record<string, ComponentType<IconProps>> = {
  email: EnvelopeSimpleIcon,
  phone: PhoneIcon,
  website: GlobeIcon,
  link: LinkSimpleIcon,
  address: MapPinIcon,
  x: XLogoIcon,
  instagram: InstagramLogoIcon,
  threads: ThreadsLogoIcon,
  linkedin: LinkedinLogoIcon,
  facebook: FacebookLogoIcon,
  youtube: YoutubeLogoIcon,
  snapchat: SnapchatLogoIcon,
  tiktok: TiktokLogoIcon,
  twitch: TwitchLogoIcon,
  yelp: StarIcon,
  whatsapp: WhatsappLogoIcon,
  signal: ChatCircleDotsIcon,
  discord: DiscordLogoIcon,
  skype: SkypeLogoIcon,
  telegram: TelegramLogoIcon,
  github: GithubLogoIcon,
  calendly: CalendarBlankIcon,
  paypal: PaypalLogoIcon,
  venmo: CurrencyDollarIcon,
  cashapp: CurrencyDollarIcon,
};

export function ContactMethodIcon({ type, size = 21 }: { type: string; size?: number }) {
  const Icon = METHOD_ICONS[type] || LinkSimpleIcon;
  return <Icon aria-hidden size={size} weight="bold" />;
}
