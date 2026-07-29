import { Linking } from 'react-native';

function usesSystemHandler(url: string) {
  return /^(mailto:|tel:|sms:|geo:|maps:)/i.test(url);
}

function isAndroidIntentUrl(url: string) {
  return url.startsWith('intent:');
}

function hasCustomAppScheme(url: string) {
  return /^[a-z][a-z0-9+.-]*:/i.test(url) && !/^https?:/i.test(url) && !usesSystemHandler(url);
}

/** Try each URL in order; skip custom app schemes when the app is not installed. */
export async function openUrlCandidates(candidates: string[]) {
  for (const raw of candidates) {
    const url = raw.trim();
    if (!url) continue;

    if (hasCustomAppScheme(url) && !isAndroidIntentUrl(url)) {
      const canOpen = await Linking.canOpenURL(url).catch(() => false);
      if (!canOpen) continue;
    }

    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // Try the next candidate.
    }
  }
  return false;
}
