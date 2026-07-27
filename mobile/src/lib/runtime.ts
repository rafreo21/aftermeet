import Constants from 'expo-constants';

export function isExpoGo() {
  return Constants.appOwnership === 'expo';
}

export function isDevBuild() {
  return !isExpoGo();
}
