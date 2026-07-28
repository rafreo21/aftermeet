import { Linking, Platform } from 'react-native';

export type EmailComposeInput = {
  to: string;
  subject: string;
  body: string;
};

export function gmailComposeUrl({ to, subject, body }: EmailComposeInput) {
  const params = new URLSearchParams({ view: 'cm', fs: '1' });
  if (to.trim()) params.set('to', to.trim());
  if (subject.trim()) params.set('su', subject.trim());
  if (body.trim()) params.set('body', body.trim());
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export function gmailAppComposeUrl({ to, subject, body }: EmailComposeInput) {
  const params = new URLSearchParams();
  if (to.trim()) params.set('to', to.trim());
  if (subject.trim()) params.set('subject', subject.trim());
  if (body.trim()) params.set('body', body.trim());
  const query = params.toString();
  return query ? `googlegmail:///co?${query}` : 'googlegmail:///co';
}

export function mailtoComposeUrl({ to, subject, body }: EmailComposeInput) {
  const params = new URLSearchParams();
  if (subject.trim()) params.set('subject', subject.trim());
  if (body.trim()) params.set('body', body.trim());
  const query = params.toString();
  return to.trim()
    ? `mailto:${encodeURIComponent(to.trim())}${query ? `?${query}` : ''}`
    : `mailto:${query ? `?${query}` : ''}`;
}

/** Opens a compose screen with To, subject, and body pre-filled. User taps Send. */
export async function openEmailCompose(input: EmailComposeInput, preferGmail = true) {
  const candidates = preferGmail
    ? Platform.OS === 'ios'
      ? [gmailAppComposeUrl(input), gmailComposeUrl(input), mailtoComposeUrl(input)]
      : [gmailComposeUrl(input), mailtoComposeUrl(input)]
    : [mailtoComposeUrl(input), gmailComposeUrl(input)];

  for (const url of candidates) {
    const canOpen = await Linking.canOpenURL(url).catch(() => false);
    if (canOpen) {
      await Linking.openURL(url);
      return;
    }
  }

  await Linking.openURL(mailtoComposeUrl(input));
}
