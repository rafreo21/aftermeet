import Constants from 'expo-constants';

type BuildExtra = {
  buildStamp?: string;
  buildNumber?: number;
};

const extra = (Constants.expoConfig?.extra ?? {}) as BuildExtra;

export const APP_BUILD_STAMP = extra.buildStamp ?? 'dev';
export const APP_BUILD_NUMBER = extra.buildNumber ?? 0;

export function formatBuildLabel() {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  if (!APP_BUILD_NUMBER) return `v${version}`;
  return `v${version} (${APP_BUILD_NUMBER}) · ${APP_BUILD_STAMP}`;
}
