import { router, usePathname } from 'expo-router';
import { Microphone, Pause, Play, Stop } from 'phosphor-react-native';
import { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  getActiveCaptureController,
  subscribeToActiveCapture,
} from '@/features/encounters/active-capture-controller';
import { formatDuration } from '@/features/encounters/local-recordings';
import { useAppInsets } from '@/lib/safe-area';
import { colors, radius, spacing } from '@/theme/tokens';

export function ActiveCaptureBanner() {
  const pathname = usePathname();
  const insets = useAppInsets();
  const active = useSyncExternalStore(
    subscribeToActiveCapture,
    getActiveCaptureController,
    getActiveCaptureController,
  );

  // Capture owns its recorder controls inline. The global mini-recorder is for
  // every other destination, so it must never duplicate those controls here.
  if (!active || pathname.startsWith('/capture')) return null;

  const { snapshot } = active;
  const isProcessing = snapshot.status === 'processing';
  const isPaused = snapshot.status === 'paused';
  const statusLabel = isProcessing ? 'Preparing review' : isPaused ? 'Recording paused' : 'Recording';

  function openCapture() {
    router.navigate({
      pathname: '/capture/new',
      params: { draftId: snapshot.encounterId },
    });
  }

  return (
    <View pointerEvents="box-none" style={[styles.layer, { bottom: Math.max(insets.bottom, 12) + 66 }]}>
      <View style={styles.banner} accessibilityRole="summary">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Return to active capture. ${statusLabel}.`}
          onPress={openCapture}
          style={({ pressed }) => [styles.summary, pressed && styles.pressed]}>
          <View style={[styles.icon, isPaused && styles.pausedIcon]}>
            <Microphone size={20} color={colors.ink} weight="fill" />
          </View>
          <View style={styles.copy}>
            <Text style={styles.label}>{statusLabel}</Text>
            <Text style={styles.duration}>{formatDuration(snapshot.seconds)}</Text>
          </View>
        </Pressable>

        {!isProcessing ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPaused ? 'Resume recording' : 'Pause recording'}
            onPress={() => void active.pauseOrResume()}
            style={({ pressed }) => [styles.control, pressed && styles.pressed]}>
            {isPaused
              ? <Play size={19} color={colors.white} weight="fill" />
              : <Pause size={19} color={colors.white} weight="fill" />}
          </Pressable>
        ) : null}

        {!isProcessing ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Finish recording"
            onPress={() => void active.finish()}
            style={({ pressed }) => [styles.finish, pressed && styles.pressed]}>
            <Stop size={17} color={colors.ink} weight="fill" />
            <Text style={styles.finishText}>Finish</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: spacing.x4,
    right: spacing.x4,
    zIndex: 100,
    elevation: 12,
  },
  banner: {
    minHeight: 64,
    padding: spacing.x2,
    borderRadius: radius.medium,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  summary: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    paddingVertical: spacing.x1,
    paddingHorizontal: spacing.x1,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.small,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pausedIcon: { backgroundColor: colors.surfaceMuted },
  copy: { minWidth: 0, flex: 1 },
  label: { color: colors.white, fontSize: 14, fontWeight: '800' },
  duration: { color: '#CFE1C8', fontSize: 12, fontWeight: '700', marginTop: 2 },
  control: {
    width: 44,
    height: 44,
    borderRadius: radius.small,
    borderWidth: 1,
    borderColor: '#47633B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finish: {
    height: 44,
    borderRadius: radius.small,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.x3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.x2,
  },
  finishText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.72 },
});
