import { makeRedirectUri } from 'expo-auth-session';

export function createAuthRedirectUri() {
  return makeRedirectUri({
    path: 'auth/callback',
  });
}

export function buildMobileEmailRedirectUri(appBaseUrl: string, nativeCallbackUri: string) {
  const url = new URL('/auth/mobile-return', appBaseUrl.replace(/\/+$/, ''));
  url.searchParams.set('return_to', nativeCallbackUri);
  return url.toString();
}

export function buildAppCallbackUrl(returnTo: string, code: string) {
  const target = new URL(returnTo);
  target.searchParams.set('code', code);
  return target.toString();
}
