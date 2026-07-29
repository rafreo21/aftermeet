import {
  CheckCircle,
  Microphone,
} from 'phosphor-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { CollapsibleTranscriptSection } from '@/components/collapsible-transcript-section';
import { RecordingPlayback } from '@/components/recording-playback';
import { Body, Button } from '@/components/ui';
import type { CaptureRecorder } from '@/features/encounters/use-capture-recorder';
import { colors, radius, spacing } from '@/theme/tokens';

type CaptureRecordStepProps = {
  consent: boolean;
  consentMethod: 'verbal' | 'written';
  onConsentChange: (value: boolean) => void;
  onConsentMethodChange: (value: 'verbal' | 'written') => void;
  recorder: CaptureRecorder;
  signedIn: boolean;
  hasRecording?: boolean;
  hasTranscript?: boolean;
};

export function CaptureRecordStep({
  consent,
  consentMethod,
  onConsentChange,
  onConsentMethodChange,
  recorder,
  signedIn,
  hasRecording = false,
  hasTranscript = false,
}: CaptureRecordStepProps) {
  const [consentSheetOpen, setConsentSheetOpen] = useState(false);

  const showTranscript =
    recorder.recordingState !== 'idle'
    || recorder.recordingComplete
    || hasRecording
    || hasTranscript
    || recorder.transcriptStatus === 'transcribing';

  const methodLabel = consentMethod === 'verbal' ? 'Verbal consent' : 'Written consent';

  return (
    <View style={styles.stack}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setConsentSheetOpen(true)}
        style={[styles.card, consent && styles.cardConfirmed]}>
        <View style={styles.consentCollapsed}>
          {consent ? (
            <CheckCircle size={20} color={colors.ink} weight="fill" />
          ) : (
            <Microphone size={20} color={colors.ink} weight="bold" />
          )}
          <View style={styles.consentCollapsedCopy}>
            <Text style={styles.consentCollapsedTitle}>
              {consent ? `${methodLabel} confirmed` : 'Confirm recording consent'}
            </Text>
            <Text style={styles.consentCollapsedHint}>
              {consent ? 'Tap to review or change consent' : 'Tap before you start recording'}
            </Text>
          </View>
          <Text style={styles.changeLink}>{consent ? 'Change' : 'Open'}</Text>
        </View>
      </Pressable>

      <BottomSheet
        visible={consentSheetOpen}
        title="Recording consent"
        onClose={() => setConsentSheetOpen(false)}
        footer={
          <Button onPress={() => setConsentSheetOpen(false)}>
            {consent ? 'Done' : 'Close'}
          </Button>
        }>
        <View style={styles.sheetIcon}>
          {consent ? (
            <CheckCircle size={32} color={colors.ink} weight="fill" />
          ) : (
            <Microphone size={32} color={colors.ink} weight="bold" />
          )}
        </View>
        <Text style={styles.sheetHeading}>Confirm recording consent</Text>
        <Body style={styles.sheetCopy}>
          Ask clearly: “Is everyone comfortable with me recording this conversation so I can remember the agreed next steps?”
        </Body>
        <View style={styles.consentRow}>
          <Text style={styles.consentLabel}>Everyone agreed</Text>
          <Switch
            value={consent}
            onValueChange={onConsentChange}
            trackColor={{ false: colors.line, true: colors.accent }}
            thumbColor={colors.white}
          />
        </View>
        <Text style={styles.methodHeading}>How was consent given?</Text>
        <View style={styles.methodRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onConsentMethodChange('verbal')}
            style={[styles.methodChip, consentMethod === 'verbal' && styles.methodChipActive]}>
            <Text style={[styles.methodText, consentMethod === 'verbal' && styles.methodTextActive]}>
              Verbal
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => onConsentMethodChange('written')}
            style={[styles.methodChip, consentMethod === 'written' && styles.methodChipActive]}>
            <Text style={[styles.methodText, consentMethod === 'written' && styles.methodTextActive]}>
              Written
            </Text>
          </Pressable>
        </View>
        <Body style={styles.sheetNote}>
          Recording stays on your device until you save the encounter. You can skip recording and add notes manually on the next step.
        </Body>
      </BottomSheet>

      {consent ? (
        <>
          {!signedIn ? (
            <View style={styles.infoBanner}>
              <Text style={styles.infoBannerText}>
                Sign in before recording so AfterMeet can transcribe on finish and sync your capture with web.
              </Text>
            </View>
          ) : null}

          <View style={[styles.card, styles.recorderCard, recorder.recordingState === 'recording' && styles.recorderCardActive]}>
          <View style={styles.recorderHero}>
            <View style={[styles.micOrb, recorder.recordingState === 'recording' && styles.micOrbActive]}>
              <Microphone
                size={28}
                color={recorder.recordingState === 'recording' ? colors.white : colors.ink}
                weight="fill"
              />
            </View>
            <View style={styles.recorderMeta}>
              <Text style={styles.recorderTitle}>
                {recorder.transcriptStatus === 'transcribing'
                  ? 'Generating transcript'
                  : recorder.recordingState === 'recording'
                    ? 'Recording'
                    : recorder.recordingState === 'paused'
                      ? 'Paused'
                      : recorder.recordingState === 'stopped'
                        ? 'Recording complete'
                        : 'Ready to record'}
              </Text>
              <Text style={styles.recorderHint}>
                Microphone is {recorder.recordingState === 'recording' ? 'on' : 'off'}
              </Text>
            </View>
            <Text style={styles.recorderTime}>{recorder.formattedDuration}</Text>
          </View>

          {(recorder.recordingState === 'recording' || recorder.recordingState === 'paused') ? (
            <View style={styles.audioFeedback}>
              <View style={styles.audioMeter}>
                {Array.from({ length: 16 }, (_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.audioBar,
                      {
                        height: Math.max(6, recorder.audioLevel * (12 + ((index * 5) % 20))),
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.audioFeedbackText}>
                {recorder.recordingState === 'paused'
                  ? 'Recording paused'
                  : recorder.audioLevel > 0.08
                    ? 'Voice detected'
                    : 'Listening for speech…'}
              </Text>
            </View>
          ) : null}

          <View style={styles.actionColumn}>
            {recorder.recordingState === 'idle' ? (
              <>
                <Button onPress={() => void recorder.startRecording(consent)}>
                  Start recording
                </Button>
                <Button variant="secondary" onPress={() => void recorder.importRecording(consent)}>
                  Import recording
                </Button>
              </>
            ) : null}

            {(recorder.recordingState === 'recording' || recorder.recordingState === 'paused') ? (
              <>
                <Button variant="secondary" onPress={() => void recorder.pauseOrResume()}>
                  {recorder.recordingState === 'paused' ? 'Resume' : 'Pause'}
                </Button>
                <Button onPress={() => void recorder.stopRecording()}>Finish</Button>
              </>
            ) : null}

            {recorder.recordingState === 'stopped' ? (
              <Button variant="secondary" onPress={() => void recorder.resetRecording()}>
                Record again
              </Button>
            ) : null}

            {recorder.playbackReady && recorder.recordingUri ? (
              <RecordingPlayback uri={recorder.recordingUri} durationSeconds={recorder.seconds} />
            ) : null}
          </View>

          {showTranscript ? (
            <CollapsibleTranscriptSection
              title="Live transcript"
              hint={recorder.transcriptStatusLabel}
              value={recorder.displayTranscript}
              onChangeText={recorder.updateTranscriptFromUser}
              open={recorder.transcriptOpen}
              onOpenChange={recorder.setTranscriptOpen}
              showWhenEmpty
              placeholder={
                recorder.transcriptSupported
                  ? 'Your transcript will appear here while you record…'
                  : recorder.usesServerTranscription
                    ? 'Words appear here after you tap Finish (same pipeline as web).'
                    : 'Live transcription is unavailable here. Paste or type the transcript.'
              }>
              {recorder.transcriptStatus === 'transcribing' ? (
                <View style={styles.transcribingRow}>
                  <ActivityIndicator color={colors.ink} />
                  <Text style={styles.transcribingText}>Transcribing recording…</Text>
                </View>
              ) : null}
              {!recorder.transcriptSupported ? (
                <Text style={styles.transcriptFallback}>
                  {recorder.usesServerTranscription
                    ? 'Expo Go transcribes when you tap Finish (sign in required). For live words while recording, install a dev build: npx expo run:android'
                    : 'Live speech-to-text needs microphone and speech permissions in Settings.'}
                </Text>
              ) : null}
            </CollapsibleTranscriptSection>
          ) : null}

          <Text style={styles.recordingNote}>
            {recorder.recordingUri
              ? `This ${recorder.recordingSource === 'imported' ? 'imported recording' : 'recording'} will be stored in your app folder when you save the encounter.`
              : 'Record here or import audio from Voice Memos, Files, or your device recorder.'}
          </Text>
        </View>
        </>
      ) : null}

      {recorder.recordingComplete ? (
        <View style={styles.successBanner}>
          <CheckCircle size={22} color={colors.ink} weight="fill" />
          <View style={styles.successCopy}>
            <Text style={styles.successTitle}>Recording ready</Text>
            <Text style={styles.successBody}>
              {recorder.displayTranscript.trim()
                ? 'Tap Finish to gather meeting context. Recording has no time limit.'
                : 'Continue to gather context, or paste a transcript on the next step.'}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.x6 },
  infoBanner: {
    padding: spacing.x5,
    borderRadius: radius.large,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceMuted,
  },
  infoBannerText: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    padding: spacing.x6,
    borderRadius: radius.large,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    gap: spacing.x5,
  },
  cardConfirmed: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.line,
  },
  consentCollapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
  },
  consentCollapsedCopy: { flex: 1, gap: 2 },
  consentCollapsedTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  consentCollapsedHint: { color: colors.muted, fontSize: 12 },
  changeLink: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  sheetIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
    alignSelf: 'flex-start',
  },
  sheetHeading: { color: colors.ink, fontSize: 20, fontWeight: '800', lineHeight: 24 },
  sheetCopy: { lineHeight: 22 },
  sheetNote: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  methodHeading: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.x3,
    paddingVertical: spacing.x2,
  },
  consentLabel: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  methodRow: { flexDirection: 'row', gap: spacing.x2 },
  methodChip: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.x4,
    paddingVertical: spacing.x3,
    borderRadius: radius.round,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
  },
  methodChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  methodText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  methodTextActive: { fontWeight: '900' },
  recorderCard: { gap: spacing.x5 },
  recorderCardActive: {
    borderColor: colors.ink,
  },
  recorderHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x4,
  },
  micOrb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
  },
  micOrbActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  recorderMeta: { flex: 1, gap: 4 },
  recorderTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  recorderHint: { color: colors.muted, fontSize: 13 },
  recorderTime: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  audioFeedback: {
    gap: spacing.x3,
    padding: spacing.x4,
    borderRadius: radius.medium,
    backgroundColor: colors.canvas,
  },
  audioMeter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
    minHeight: 32,
  },
  audioBar: {
    flex: 1,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  audioFeedbackText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  actionColumn: { gap: spacing.x3 },
  transcriptSection: {
    gap: spacing.x3,
    paddingTop: spacing.x2,
  },
  transcriptToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
  },
  transcriptToggleCopy: { flex: 1, gap: 2 },
  transcriptTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  transcriptHint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  input: {
    minHeight: 48,
    paddingHorizontal: spacing.x4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.medium,
    backgroundColor: colors.canvas,
    color: colors.ink,
    fontSize: 15,
  },
  textarea: { height: 220, maxHeight: 220, paddingTop: spacing.x4, textAlignVertical: 'top' },
  transcriptField: { height: 220, maxHeight: 220, paddingTop: spacing.x4, textAlignVertical: 'top' },
  transcriptFallback: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  transcribingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    paddingVertical: spacing.x2,
  },
  transcribingText: { color: colors.ink, fontSize: 14 },
  draftNote: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  uncertain: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  recordingNote: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  successBanner: {
    flexDirection: 'row',
    gap: spacing.x3,
    padding: spacing.x5,
    borderRadius: radius.medium,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.line,
  },
  successCopy: { flex: 1, gap: 4 },
  successTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  successBody: { color: colors.muted, fontSize: 13, lineHeight: 20 },
});
