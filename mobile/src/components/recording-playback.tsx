import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pause, Play } from 'phosphor-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDuration } from '@/features/encounters/local-recordings';
import { colors, radius, spacing } from '@/theme/tokens';

type RecordingPlaybackProps = {
  uri: string;
  durationSeconds?: number;
};

export function RecordingPlayback({ uri, durationSeconds = 0 }: RecordingPlaybackProps) {
  const player = useAudioPlayer(uri || null);
  const status = useAudioPlayerStatus(player);
  const [playbackError, setPlaybackError] = useState('');

  useEffect(() => {
    void setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!uri) return;
    setPlaybackError('');
    try {
      player.replace(uri);
    } catch {
      setPlaybackError('Could not load this recording.');
    }
  }, [player, uri]);

  const togglePlayback = useCallback(() => {
    if (!uri) return;
    setPlaybackError('');
    try {
      if (status.playing) {
        player.pause();
        return;
      }
      player.replace(uri);
      player.play();
    } catch {
      setPlaybackError('Could not play this recording on your device.');
    }
  }, [player, status.playing, uri]);

  const elapsed = Math.max(0, Math.round(status.currentTime || 0));
  const total = Math.max(durationSeconds, Math.round(status.duration || 0), elapsed);
  const progress = total > 0 ? Math.min(1, elapsed / total) : 0;

  const statusLabel = useMemo(() => {
    if (playbackError) return playbackError;
    if (!uri) return 'No recording available';
    if (status.playing) return 'Playing…';
    if (status.isLoaded && elapsed > 0 && elapsed < total) return 'Paused';
    return 'Ready to play';
  }, [elapsed, playbackError, status.isLoaded, status.playing, total, uri]);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.label}>Voice recording</Text>
        <Text style={[styles.status, status.playing && styles.statusActive]}>{statusLabel}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause recording' : 'Play recording'}
        onPress={togglePlayback}
        style={({ pressed }) => [styles.playButton, pressed && styles.playButtonPressed]}>
        {status.playing ? (
          <Pause size={22} color={colors.ink} weight="fill" />
        ) : (
          <Play size={22} color={colors.ink} weight="fill" />
        )}
        <Text style={styles.playLabel}>{status.playing ? 'Pause' : 'Play recording'}</Text>
      </Pressable>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
      <Text style={styles.duration}>
        {formatDuration(elapsed)} / {formatDuration(total)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.x3,
    padding: spacing.x4,
    borderRadius: radius.medium,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.line,
  },
  head: { gap: 4 },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  status: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  statusActive: { color: colors.ink, fontWeight: '700' },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.x2,
    minHeight: 48,
    borderRadius: radius.small,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  playButtonPressed: { opacity: 0.86 },
  playLabel: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  progressTrack: {
    height: 6,
    borderRadius: radius.round,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.round,
    backgroundColor: colors.accent,
  },
  duration: { color: colors.ink, fontSize: 13, fontWeight: '700' },
});
