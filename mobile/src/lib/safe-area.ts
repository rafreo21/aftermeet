import { Platform, StatusBar as RNStatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useAppInsets() {
  const insets = useSafeAreaInsets();
  const androidStatusBar = Platform.OS === 'android' ? RNStatusBar.currentHeight ?? 0 : 0;

  return {
    top: Math.max(insets.top, androidStatusBar),
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
  };
}

export function useTabBarHeight() {
  const insets = useAppInsets();
  return 56 + Math.max(insets.bottom, 12);
}
