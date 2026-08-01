import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import logo from '../../assets/images/splash-icon.png';

type BrandMarkProps = {
  size?: number;
};

export function BrandMark({ size = 36 }: BrandMarkProps) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Image source={logo} style={{ width: size, height: size }} contentFit="contain" accessibilityLabel="AfterMeet" alt="AfterMeet" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
});
