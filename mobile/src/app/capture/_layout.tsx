import { Stack } from 'expo-router';

import { CaptureErrorBoundary } from '@/components/capture-error-boundary';

export default function CaptureLayout() {
  return (
    <CaptureErrorBoundary>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="[id]" />
      </Stack>
    </CaptureErrorBoundary>
  );
}
