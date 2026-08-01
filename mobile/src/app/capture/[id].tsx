import { router, useLocalSearchParams } from 'expo-router';
import { CaretDown, CaretUp, CheckCircle, CloudArrowUp, EnvelopeSimple, LockKey, PencilSimple, Plus, ShareNetwork, Trash } from 'phosphor-react-native';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { CollapsibleTranscriptSection } from '@/components/collapsible-transcript-section';
import { SpeakerIdentityEditor } from '@/components/speaker-identity-editor';
import { renameSpeakerAssignees } from '@/features/encounters/speaker-labels';
import { FollowUpDuePicker } from '@/components/follow-up-due-picker';
import { OutcomeErrorSheet } from '@/components/outcome-error-sheet';
import { OutcomeSuccessSheet } from '@/components/outcome-success-sheet';
import { RecordingPlayback } from '@/components/recording-playback';
import { ConnectionDetailSkeleton } from '@/components/skeleton';
import { Body, Button, PageHeader, Panel, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import {
  resolveEncounterRecordingUri,
  updateLocalRecordingSharedUrl,
} from '@/features/encounters/local-recordings';
import {
  getEncounter,
  saveEncounter,
  uploadEncounterRecording,
  type EncounterPayload,
} from '@/features/encounters/encounter-api';
import {
  FOLLOW_UP_CHANNELS,
  type FollowUpChannel,
} from '@/features/follow-ups/follow-up-channels';
import { FOLLOW_UP_TEMPLATES } from '@/features/follow-ups/follow-up-templates';
import { formatDueLabel } from '@/lib/due-date';
import { openEmailCompose } from '@/lib/email-compose';
import { readEnv } from '@/lib/env';
import { buildRecordingShareEmail, formatMeetingEmailDate } from '@/lib/recording-email';
import {
  CLOUD_RECORDING_RETENTION_DAYS,
  formatCloudAvailableUntil,
  isCloudRecordingExpired,
} from '@/lib/recording-metadata';
import { colors, radius, spacing } from '@/theme/tokens';

type UploadStatus = 'idle' | 'uploading' | 'uploaded' | 'failed' | 'none';

export default function CaptureDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [encounter, setEncounter] = useState<EncounterPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadError, setUploadError] = useState('');
  const [uploadRetryable, setUploadRetryable] = useState(true);
  const [approveHint, setApproveHint] = useState('');
  const [errorSheetOpen, setErrorSheetOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successSheetOpen, setSuccessSheetOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingLoading, setRecordingLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [actionComposerOpen, setActionComposerOpen] = useState(false);
  const [editingActionId, setEditingActionId] = useState('');
  const [newActionTitle, setNewActionTitle] = useState('');
  const [newActionChannel, setNewActionChannel] = useState<FollowUpChannel>('email');
  const [newActionDueAt, setNewActionDueAt] = useState('');
  const [newActionOwner, setNewActionOwner] = useState('me');
  const [newActionParticipantId, setNewActionParticipantId] = useState('');

  const guestUrl = encounter && readEnv()
    ? `${readEnv()!.publicCardBaseUrl}/e/${encounter.shareToken}`
    : '';

  const isShared = encounter?.status === 'shared';
  const cloudReady = Boolean(
    uploadStatus === 'uploaded'
    || encounter?.recording?.sharedAudioUrl
    || encounter?.recording?.storagePath,
  );
  const cloudAvailableUntil = formatCloudAvailableUntil(encounter?.recording?.cloudExpiresAt);
  const cloudExpired = isCloudRecordingExpired(encounter?.recording?.cloudExpiresAt);

  async function syncUpload(
    accessToken: string,
    encounterId: string,
    localUri: string,
    mimeType?: string,
  ) {
    setUploadStatus('uploading');
    setUploadError('');
    try {
      const uploaded = await uploadEncounterRecording(accessToken, encounterId, localUri);
      await updateLocalRecordingSharedUrl(encounterId, uploaded.sharedAudioUrl ?? '', uploaded);
      setEncounter((current) => current ? {
        ...current,
        recording: {
          ...(current.recording ?? {
            id: current.id,
            durationSeconds: current.durationSeconds,
            fileSize: 0,
            mimeType: mimeType || 'audio/mp4',
            source: 'recorded',
            retention: '7_days',
            expiresAt: null,
            createdAt: current.startedAt,
            localUri,
          }),
          ...uploaded,
          localUri,
          audioLocation: 'server',
        },
      } : current);
      setUploadStatus('uploaded');
      return uploaded;
    } catch (caught) {
      setUploadStatus('failed');
      setUploadRetryable((caught as Error & { retryable?: boolean })?.retryable !== false);
      setUploadError(caught instanceof Error ? caught.message : 'Could not upload recording for guests.');
      return null;
    }
  }

  useEffect(() => {
    if (!session?.access_token || !id) {
      void Promise.resolve().then(() => {
        setLoading(false);
        setRecordingLoading(false);
      });
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const nextEncounter = await getEncounter(session.access_token!, id);
        if (cancelled) return;
        setEncounter(nextEncounter);

        const uri = await resolveEncounterRecordingUri(id, nextEncounter.recording);
        if (cancelled) return;
        setRecordingUri(uri);
        setRecordingLoading(false);

        if (nextEncounter.recording?.sharedAudioUrl || nextEncounter.recording?.storagePath) {
          setUploadStatus('uploaded');
        } else if (uri?.startsWith('file')) {
          void syncUpload(session.access_token!, nextEncounter.id, uri, nextEncounter.recording?.mimeType);
        } else if (nextEncounter.durationSeconds > 0 || nextEncounter.recording) {
          setUploadStatus('none');
        } else {
          setUploadStatus('none');
        }
      } catch (caught) {
        if (cancelled) return;
        setErrorMessage(caught instanceof Error ? caught.message : 'Could not load this meeting.');
        setErrorSheetOpen(true);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRecordingLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, session?.access_token]);

  const recordingDuration = useMemo(
    () => encounter?.durationSeconds || encounter?.recording?.durationSeconds || 0,
    [encounter?.durationSeconds, encounter?.recording?.durationSeconds],
  );

  const expectsAudio = Boolean(
    recordingUri
    || encounter?.recording?.storagePath
    || encounter?.recording?.sharedAudioUrl
    || encounter?.recording?.localUri
    || (encounter?.durationSeconds ?? 0) > 0
    || Boolean(encounter?.recording),
  );
  const hasTranscript = Boolean(encounter?.transcript.trim());

  const needsUpload = Boolean(
    recordingUri?.startsWith('file')
    && !cloudReady
    && uploadStatus !== 'uploaded',
  );
  const canApprove = uploadStatus !== 'uploading';

  function toggleGuestSharing(next: boolean) {
    setApproveHint('');

    if (next) {
      if (needsUpload && recordingUri && session?.access_token && encounter) {
        void syncUpload(session.access_token, encounter.id, recordingUri, encounter.recording?.mimeType);
      }
      return;
    }

    if (isShared && encounter && session?.access_token) {
      const reverted = { ...encounter, status: 'reviewed' as const };
      setApproving(true);
      saveEncounter(session.access_token, reverted)
        .then(() => setEncounter(reverted))
        .catch((caught) => {
          setErrorMessage(caught instanceof Error ? caught.message : 'Could not turn off guest sharing.');
          setErrorSheetOpen(true);
        })
        .finally(() => setApproving(false));
    }
  }

  async function persist(next: EncounterPayload) {
    if (!session?.access_token) return;
    setSaving(true);
    setApproveHint('');
    try {
      await saveEncounter(session.access_token, next);
      setEncounter(next);
      setSuccessMessage('Changes saved.');
      setSuccessSheetOpen(true);
    } catch (caught) {
      setErrorMessage(caught instanceof Error ? caught.message : 'Could not save changes.');
      setErrorSheetOpen(true);
    } finally {
      setSaving(false);
    }
  }

  function addAction() {
    if (!encounter || !newActionTitle.trim()) return;
    const ownerParticipant = encounter.participants.find((person) => person.id === newActionOwner);
    const participant = ownerParticipant
      ?? encounter.participants.find((person) => person.id === newActionParticipantId)
      ?? encounter.participants[0];
    setEncounter({
      ...encounter,
      actions: [...encounter.actions, {
        id: `action-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title: newActionTitle.trim(),
        channel: newActionChannel,
        owner: ownerParticipant ? 'guest' : 'me',
        dueAt: newActionDueAt,
        status: 'open',
        participantId: participant?.id,
        assigneeName: participant?.name,
        assigneeEmail: participant?.email,
      }],
    });
    setNewActionTitle('');
    setNewActionDueAt('');
    setNewActionParticipantId('');
    setActionComposerOpen(false);
  }

  function toggleAction(actionId: string) {
    if (!encounter) return;
    setEncounter({
      ...encounter,
      actions: encounter.actions.map((action) => action.id === actionId
        ? action.status === 'completed'
          ? { ...action, status: 'open', completedAt: undefined }
          : { ...action, status: 'completed', completedAt: new Date().toISOString() }
        : action),
    });
  }

  function removeAction(actionId: string) {
    if (!encounter) return;
    setEncounter({ ...encounter, actions: encounter.actions.filter((action) => action.id !== actionId) });
  }

  function updateAction(actionId: string, update: Partial<EncounterPayload['actions'][number]>) {
    if (!encounter) return;
    setEncounter({
      ...encounter,
      actions: encounter.actions.map((action) => action.id === actionId ? { ...action, ...update } : action),
    });
  }

  async function approveAndShare() {
    if (!encounter || !session?.access_token) return;
    setApproveHint('');

    if (!encounter.sharedSummary.trim()) {
      setApproveHint('Add a short share summary below, then approve.');
      return;
    }

    if (uploadStatus === 'uploading') {
      setApproveHint('Recording is still uploading. Approve unlocks once it finishes.');
      return;
    }

    if (needsUpload && recordingUri) {
      const uploaded = await syncUpload(
        session.access_token,
        encounter.id,
        recordingUri,
        encounter.recording?.mimeType,
      );
      if (!uploaded) {
        setApproveHint('The recording could not be prepared for sharing. Retry the upload below.');
        return;
      }
    }

    const next = { ...encounter, status: 'shared' as const };
    setApproving(true);
    try {
      await saveEncounter(session.access_token, next);
      setEncounter(next);
      setApproveHint('');
      setSuccessMessage('Guest view approved.');
      setSuccessSheetOpen(true);
    } catch (caught) {
      setErrorMessage(caught instanceof Error ? caught.message : 'Could not approve the guest view.');
      setErrorSheetOpen(true);
    } finally {
      setApproving(false);
    }
  }

  async function shareGuestLink() {
    if (!guestUrl || !encounter || !isShared) return;
    await Share.share({
      title: `${encounter.personName || encounter.title} · AfterMeet`,
      message: guestUrl,
      url: guestUrl,
    });
  }

  async function emailRecordingWithDetails() {
    if (!encounter || !guestUrl) return;
    const email = buildRecordingShareEmail({
      title: encounter.title,
      personName: encounter.personName,
      personEmail: encounter.personEmail,
      guestUrl,
      sharedSummary: encounter.sharedSummary,
      meetingDate: formatMeetingEmailDate(encounter.startedAt),
      cloudExpired: isCloudRecordingExpired(encounter.recording?.cloudExpiresAt),
    });
    await openEmailCompose(email);
  }

  async function shareRecordingFile() {
    if (!recordingUri || !encounter) return;
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(recordingUri, {
        mimeType: encounter.recording?.mimeType || 'audio/mp4',
        dialogTitle: Platform.OS === 'ios' ? 'Save recording to Files or iCloud Drive' : 'Send meeting recording',
      });
      return;
    }
    await Share.share({
      title: `${encounter.title} recording`,
      message: encounter.sharedSummary || encounter.title,
      url: recordingUri,
    });
  }

  if (loading) {
    return (
      <Screen edges={['top', 'bottom']} reserveTabBar={false}>
        <PageHeader eyebrow="Previous capture" title="Loading capture" titleStyle={styles.title} />
        <ConnectionDetailSkeleton />
      </Screen>
    );
  }

  if (!session || !encounter) {
    return (
      <Screen edges={['top', 'bottom']} reserveTabBar={false}>
        <PageHeader eyebrow="Previous" title="Meeting not available" titleStyle={styles.title} />
        <Body>{errorMessage || 'Sign in to view this meeting.'}</Body>
        {!session ? <Button onPress={() => router.push('/auth')}>Sign in</Button> : null}
        <Button variant="secondary" onPress={() => router.back()}>Go back</Button>
        <OutcomeErrorSheet
          visible={errorSheetOpen}
          message={errorMessage}
          onClose={() => {
            setErrorSheetOpen(false);
            setErrorMessage('');
          }}
        />
      </Screen>
    );
  }

  const showEmailRecording = Boolean(
    recordingUri
    && (cloudExpired || uploadStatus === 'failed' || !encounter.recording?.sharedAudioUrl),
  );
  const openActions = encounter.actions.filter((action) => action.status !== 'completed');
  const peopleCount = encounter.participants.length || (encounter.personName ? 1 : 0);

  return (
    <Screen edges={['top', 'bottom']} reserveTabBar={false}>
      <PageHeader
        eyebrow="Ready to review"
        title={encounter.personName || encounter.title}
        titleStyle={styles.title}
      />
      <Body>Confirm the recap and follow-ups, then choose whether to share.</Body>

      <View style={styles.reviewStatusLine} accessibilityLabel={`${peopleCount} ${peopleCount === 1 ? 'person' : 'people'}, ${openActions.length} open follow-ups, ${isShared ? 'guest view shared' : 'private draft'}`}>
        <Text style={styles.reviewStatusText}>{peopleCount} {peopleCount === 1 ? 'person' : 'people'}</Text>
        <View style={styles.reviewStatusDot} />
        <Text style={styles.reviewStatusText}>{openActions.length} open follow-up{openActions.length === 1 ? '' : 's'}</Text>
        <View style={styles.reviewStatusDot} />
        <Text style={styles.reviewStatusText}>{isShared ? 'Guest view shared' : 'Private draft'}</Text>
      </View>

      <Panel style={styles.section}>
        <Text style={styles.sectionTitle}>Meeting recap</Text>
        <Text style={styles.helperCopy}>This is what participants will see after you approve the guest view.</Text>
        <TextInput
          value={encounter.sharedSummary}
          onChangeText={(value) => {
            setApproveHint('');
            setEncounter({ ...encounter, sharedSummary: value });
          }}
          multiline
          scrollEnabled
          placeholder="What you discussed, decided, and who owns what next…"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.notesField]}
        />
      </Panel>

      <Panel style={styles.section}>
        <Text style={styles.sectionTitle}>Follow-ups</Text>
        <Text style={styles.label}>Commitments</Text>
        {encounter.actions.length ? (
          <View style={styles.actionList}>
            {encounter.actions.map((action) => {
              const participant = encounter.participants.find((person) => person.id === action.participantId);
              const channelLabel = FOLLOW_UP_CHANNELS.find((channel) => channel.id === action.channel)?.label || action.channel;
              return (
                <View key={action.id} style={styles.actionItem}>
                  <View style={styles.actionRow}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: action.status === 'completed' }}
                    accessibilityLabel={`${action.status === 'completed' ? 'Reopen' : 'Complete'} ${action.title}`}
                    onPress={() => toggleAction(action.id)}>
                    <CheckCircle size={22} color={action.status === 'completed' ? colors.accent : colors.muted} weight={action.status === 'completed' ? 'fill' : 'regular'} />
                  </Pressable>
                  <View style={styles.actionCopy}>
                    <Text style={[styles.actionTitle, action.status === 'completed' && styles.actionTitleDone]}>{action.title}</Text>
                    <Text style={styles.helperCopy}>{action.owner === 'me' ? participant?.name ? `You → ${participant.name}` : 'You' : participant?.name || action.assigneeName || 'Guest'} · {channelLabel}{action.dueAt ? ` · ${formatDueLabel(action.dueAt)}` : ''}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit owner and due date for ${action.title}`}
                    accessibilityState={{ expanded: editingActionId === action.id }}
                    onPress={() => setEditingActionId((current) => current === action.id ? '' : action.id)}
                    hitSlop={8}>
                    <PencilSimple size={19} color={colors.ink} weight="bold" />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${action.title}`} onPress={() => removeAction(action.id)} hitSlop={8}>
                    <Trash size={19} color={colors.muted} />
                  </Pressable>
                  </View>
                  {editingActionId === action.id ? (
                    <View style={styles.actionEditor}>
                      <Text style={styles.label}>Owner</Text>
                      <View style={styles.choiceRow}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected: action.owner === 'me' }}
                          onPress={() => updateAction(action.id, { owner: 'me' })}
                          style={[styles.choiceChip, action.owner === 'me' && styles.choiceChipActive]}>
                          <Text style={[styles.choiceChipText, action.owner === 'me' && styles.choiceChipTextActive]}>Me</Text>
                        </Pressable>
                        {encounter.participants.length ? encounter.participants.map((person) => {
                          const selected = action.owner === 'guest' && action.participantId === person.id;
                          return (
                            <Pressable
                              key={person.id}
                              accessibilityRole="button"
                              accessibilityState={{ selected }}
                              onPress={() => updateAction(action.id, {
                                owner: 'guest',
                                participantId: person.id,
                                assigneeName: person.name,
                                assigneeEmail: person.email,
                              })}
                              style={[styles.choiceChip, selected && styles.choiceChipActive]}>
                              <Text style={[styles.choiceChipText, selected && styles.choiceChipTextActive]}>{person.name || 'Guest'}</Text>
                            </Pressable>
                          );
                        }) : (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ selected: action.owner === 'guest' }}
                            onPress={() => updateAction(action.id, { owner: 'guest', assigneeName: encounter.personName || 'Guest' })}
                            style={[styles.choiceChip, action.owner === 'guest' && styles.choiceChipActive]}>
                            <Text style={[styles.choiceChipText, action.owner === 'guest' && styles.choiceChipTextActive]}>{encounter.personName || 'Guest'}</Text>
                          </Pressable>
                        )}
                      </View>
                      {action.owner === 'me' && encounter.participants.length ? (
                        <>
                          <Text style={styles.label}>For person</Text>
                          <View style={styles.choiceRow}>
                            {encounter.participants.map((person) => {
                              const selected = (action.participantId || encounter.participants[0]?.id) === person.id;
                              return (
                                <Pressable
                                  key={person.id}
                                  accessibilityRole="button"
                                  accessibilityState={{ selected }}
                                  onPress={() => updateAction(action.id, {
                                    participantId: person.id,
                                    assigneeName: person.name,
                                    assigneeEmail: person.email,
                                  })}
                                  style={[styles.choiceChip, selected && styles.choiceChipActive]}>
                                  <Text style={[styles.choiceChipText, selected && styles.choiceChipTextActive]}>{person.name || 'Guest'}</Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </>
                      ) : null}
                      <FollowUpDuePicker dueAt={action.dueAt || ''} onChange={(dueAt) => updateAction(action.id, { dueAt })} />
                      <Button variant="secondary" onPress={() => setEditingActionId('')}>Done</Button>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : <Text style={styles.helperCopy}>No next actions yet.</Text>}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: actionComposerOpen }}
          onPress={() => setActionComposerOpen((value) => !value)}
          style={styles.actionComposerToggle}>
          <View style={styles.actionComposerToggleCopy}>
            <Plus size={17} color={colors.ink} weight="bold" />
            <Text style={styles.actionComposerToggleText}>Add another follow-up</Text>
          </View>
          {actionComposerOpen ? <CaretUp size={17} color={colors.ink} weight="bold" /> : <CaretDown size={17} color={colors.ink} weight="bold" />}
        </Pressable>
        {actionComposerOpen ? <View style={styles.actionComposer}>
          <Text style={styles.label}>Start with a template</Text>
          <Text style={styles.helperCopy}>Choose a common next step, then adjust the owner or date.</Text>
          <View style={styles.choiceRow}>
            {FOLLOW_UP_TEMPLATES.map((template) => {
              const personName = encounter.participants.map((person) => person.name).filter(Boolean).join(', ') || encounter.personName;
              const title = template.buildTitle(personName);
              const selected = newActionTitle === title && newActionChannel === template.channel;
              return (
                <Pressable
                  key={template.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setNewActionTitle(title);
                    setNewActionChannel(template.channel);
                    setNewActionDueAt(template.dueAt());
                  }}
                  style={[styles.choiceChip, selected && styles.choiceChipActive]}>
                  <Text style={[styles.choiceChipText, selected && styles.choiceChipTextActive]}>{template.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={newActionTitle}
            onChangeText={setNewActionTitle}
            placeholder="e.g. Send the product draft"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Text style={styles.label}>Owner</Text>
          <View style={styles.choiceRow}>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: newActionOwner === 'me' }} onPress={() => setNewActionOwner('me')} style={[styles.choiceChip, newActionOwner === 'me' && styles.choiceChipActive]}>
              <Text style={[styles.choiceChipText, newActionOwner === 'me' && styles.choiceChipTextActive]}>Me</Text>
            </Pressable>
            {encounter.participants.map((person) => (
              <Pressable key={person.id} accessibilityRole="button" accessibilityState={{ selected: newActionOwner === person.id }} onPress={() => setNewActionOwner(person.id)} style={[styles.choiceChip, newActionOwner === person.id && styles.choiceChipActive]}>
                <Text style={[styles.choiceChipText, newActionOwner === person.id && styles.choiceChipTextActive]}>{person.name || 'Guest'}</Text>
              </Pressable>
            ))}
          </View>
          {newActionOwner === 'me' && encounter.participants.length ? (
            <>
              <Text style={styles.label}>For person</Text>
              <View style={styles.choiceRow}>
                {encounter.participants.map((person) => {
                  const selected = (newActionParticipantId || encounter.participants[0]?.id) === person.id;
                  return (
                    <Pressable
                      key={person.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setNewActionParticipantId(person.id)}
                      style={[styles.choiceChip, selected && styles.choiceChipActive]}>
                      <Text style={[styles.choiceChipText, selected && styles.choiceChipTextActive]}>{person.name || 'Guest'}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
          <Text style={styles.label}>Channel</Text>
          <View style={styles.choiceRow}>
            {FOLLOW_UP_CHANNELS.map((channel) => (
              <Pressable key={channel.id} accessibilityRole="button" accessibilityState={{ selected: newActionChannel === channel.id }} onPress={() => setNewActionChannel(channel.id)} style={[styles.choiceChip, newActionChannel === channel.id && styles.choiceChipActive]}>
                <Text style={[styles.choiceChipText, newActionChannel === channel.id && styles.choiceChipTextActive]}>{channel.label}</Text>
              </Pressable>
            ))}
          </View>
          <FollowUpDuePicker dueAt={newActionDueAt} onChange={setNewActionDueAt} />
          <Button variant="secondary" disabled={!newActionTitle.trim()} onPress={addAction}>
            <Plus size={18} color={colors.ink} weight="bold" />
            Add action
          </Button>
        </View> : null}
        {encounter.guestFollowUp?.committedAt ? (
          <View style={styles.statusRow}>
            <CheckCircle size={18} color={colors.accent} weight="fill" />
            <Text style={styles.summaryCopy}>
              Your guest said they&apos;ll follow up too{encounter.guestFollowUp.note ? `: "${encounter.guestFollowUp.note}"` : '.'}{encounter.guestFollowUp.channel ? ` · ${encounter.guestFollowUp.channel}` : ''}{encounter.guestFollowUp.dueAt ? ` · due ${encounter.guestFollowUp.dueAt}` : ''}
            </Text>
          </View>
        ) : null}
      </Panel>

      <View style={styles.detailsCard}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: detailsOpen }}
          onPress={() => setDetailsOpen((value) => !value)}
          style={styles.detailsToggle}>
          <View style={styles.detailsIcon}><LockKey size={20} color={colors.ink} weight="bold" /></View>
          <View style={styles.detailsCopy}>
            <Text style={styles.detailsTitle}>Meeting details</Text>
            <Text style={styles.helperCopy}>Recording, transcript, speaker names, and private notes</Text>
          </View>
          {detailsOpen ? <CaretUp size={18} color={colors.ink} weight="bold" /> : <CaretDown size={18} color={colors.ink} weight="bold" />}
        </Pressable>
        {detailsOpen ? (
          <View style={styles.detailsContent}>
            {expectsAudio ? (
              recordingLoading ? (
                <View style={styles.recordingLoading}>
                  <ActivityIndicator color={colors.ink} />
                  <Text style={styles.recordingMissing}>Loading recording…</Text>
                </View>
              ) : recordingUri ? (
                <RecordingPlayback uri={recordingUri} durationSeconds={recordingDuration} variant="compact" />
              ) : (
                <Text style={styles.recordingMissing}>Audio is not available on this device.</Text>
              )
            ) : null}
            {hasTranscript ? (
              <>
                <SpeakerIdentityEditor
                  key={encounter.transcript}
                  transcript={encounter.transcript}
                  attendeeNames={[encounter.personName, ...encounter.participants.map((person) => person.name)]}
                  onApply={(value, names) => setEncounter({
                    ...encounter,
                    transcript: value,
                    actions: renameSpeakerAssignees(encounter.actions, names, encounter.participants),
                  })}
                />
                <CollapsibleTranscriptSection
                  title="Full transcript"
                  hint="Expand to edit the full transcript"
                  value={encounter.transcript}
                  onChangeText={(value) => setEncounter({ ...encounter, transcript: value })}
                  defaultOpen={false}
                />
              </>
            ) : <Text style={styles.helperCopy}>No transcript saved for this meeting.</Text>}
            <Text style={styles.label}>Private notes</Text>
            <TextInput
              value={encounter.privateNotes}
              onChangeText={(value) => setEncounter({ ...encounter, privateNotes: value })}
              multiline
              scrollEnabled
              placeholder="Anything only you need to remember…"
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.privateNotesField]}
            />
          </View>
        ) : null}
      </View>

      <Panel style={styles.section}>
        <Text style={styles.label}>{isShared ? 'Ready to share' : 'Private by default'}</Text>
        <Text style={styles.sectionTitle}>{isShared ? 'The guest view is ready' : 'Share with participants'}</Text>
        <Text style={styles.summaryCopy}>
          {isShared
            ? 'Send the secure link yourself. Nothing is sent automatically.'
            : 'Approve the recap to create a secure guest view. Leave it as a draft to keep everything private.'}
        </Text>
        <View style={styles.statusRow}>
          {isShared ? <CheckCircle size={18} color={colors.accent} weight="fill" /> : null}
          <Text style={styles.summaryCopy}>
            {isShared
              ? 'Approved. Guests can open the shared summary and recording.'
              : 'Still a draft. Approve when the summary looks right.'}
          </Text>
        </View>
        {cloudReady && cloudAvailableUntil && !cloudExpired ? (
          <Text style={styles.helperCopy}>
            Cloud recording available until {cloudAvailableUntil} ({CLOUD_RECORDING_RETENTION_DAYS} days).
          </Text>
        ) : null}
        {cloudExpired ? (
          <Text style={styles.helperCopy}>
            The cloud recording expired. Guests still see the shared summary. You can play it locally on this phone.
          </Text>
        ) : null}
        {uploadStatus === 'uploading' ? (
          <View style={styles.statusRow}>
            <ActivityIndicator color={colors.ink} size="small" />
            <Text style={styles.helperCopy}>Uploading recording for guest sharing…</Text>
          </View>
        ) : null}
        {uploadStatus === 'failed' ? (
          <View style={styles.uploadFailed}>
            <Text style={styles.uploadFailedText}>{uploadError || 'Upload failed.'}</Text>
            {recordingUri && uploadRetryable ? (
              <Button
                variant="secondary"
                onPress={() => void syncUpload(
                  session.access_token!,
                  encounter.id,
                  recordingUri,
                  encounter.recording?.mimeType,
                )}>
                <CloudArrowUp size={18} color={colors.ink} />
                Retry upload
              </Button>
            ) : null}
          </View>
        ) : null}
        {approveHint ? <Text style={styles.approveHint}>{approveHint}</Text> : null}
        {!isShared ? (
          <>
            <Button loading={approving} disabled={!canApprove} onPress={() => void approveAndShare()}>
              Approve and create link
            </Button>
            {!canApprove ? (
              <Text style={styles.helperCopy}>
                Approve unlocks once the recording finishes uploading.
              </Text>
            ) : null}
          </>
        ) : guestUrl ? (
          <Button variant="secondary" onPress={() => void shareGuestLink()}>
            <ShareNetwork size={18} color={colors.ink} />
            Share guest link
          </Button>
        ) : null}
        {isShared ? (
          <Button variant="ghost" onPress={() => toggleGuestSharing(false)}>Make private again</Button>
        ) : null}
        {showEmailRecording ? (
          <>
            <Text style={[styles.label, styles.guestShareLabel]}>Or share the recording another way</Text>
            <View style={styles.secondaryActionsRow}>
              <Button variant="ghost" style={styles.secondaryActionsRowItem} onPress={() => void emailRecordingWithDetails()}>
                <EnvelopeSimple size={18} color={colors.ink} />
                Email
              </Button>
              <Button variant="ghost" style={styles.secondaryActionsRowItem} onPress={() => void shareRecordingFile()}>
                <ShareNetwork size={18} color={colors.ink} />
                {Platform.OS === 'ios' ? 'Save to Files / iCloud' : 'Send file'}
              </Button>
            </View>
          </>
        ) : null}
      </Panel>

      <View style={styles.actions}>
        <Button loading={saving} onPress={() => void persist(encounter)}>Save changes</Button>
        <Button variant="ghost" onPress={() => router.replace('/capture')}>Done</Button>
      </View>

      <OutcomeErrorSheet
        visible={errorSheetOpen}
        message={errorMessage}
        onClose={() => {
          setErrorSheetOpen(false);
          setErrorMessage('');
        }}
      />

      <OutcomeSuccessSheet
        visible={successSheetOpen}
        message={successMessage}
        onClose={() => {
          setSuccessSheetOpen(false);
          setSuccessMessage('');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 30, lineHeight: 32 },
  reviewStatusLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.x2 },
  reviewStatusText: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  reviewStatusDot: { width: 3, height: 3, borderRadius: radius.round, backgroundColor: colors.muted },
  recorderCard: {
    gap: spacing.x5,
    padding: spacing.x6,
    borderRadius: radius.large,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  recordingLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
  },
  recordingMissing: { color: colors.muted, fontSize: 13, lineHeight: 20, flex: 1 },
  detailsCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.large,
    backgroundColor: colors.surface,
  },
  detailsToggle: { minHeight: 72, padding: spacing.x4, flexDirection: 'row', alignItems: 'center', gap: spacing.x3 },
  detailsIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.medium, backgroundColor: colors.canvas },
  detailsCopy: { minWidth: 0, flex: 1, gap: 2 },
  detailsTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  detailsContent: { gap: spacing.x4, padding: spacing.x4, borderTopWidth: 1, borderTopColor: colors.line },
  section: { gap: spacing.x3 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  label: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  guestShareLabel: { marginTop: spacing.x4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2 },
  helperCopy: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  approveHint: { color: colors.danger, fontSize: 13, lineHeight: 20 },
  uploadFailed: { gap: spacing.x2 },
  uploadFailedText: { color: colors.danger, fontSize: 13, lineHeight: 20 },
  secondaryActionsRow: { flexDirection: 'row', gap: spacing.x2 },
  secondaryActionsRowItem: { flex: 1 },
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
  notesField: { height: 140, maxHeight: 140, paddingTop: spacing.x3, textAlignVertical: 'top' },
  privateNotesField: { height: 110, maxHeight: 110, paddingTop: spacing.x3, textAlignVertical: 'top' },
  summaryCopy: { color: colors.ink, fontSize: 15, lineHeight: 22, flex: 1 },
  actionList: { gap: spacing.x2 },
  actionItem: { overflow: 'hidden', borderRadius: radius.medium, backgroundColor: colors.canvas },
  actionRow: { minHeight: 54, padding: spacing.x3, flexDirection: 'row', alignItems: 'center', gap: spacing.x3, borderRadius: radius.medium, backgroundColor: colors.canvas },
  actionEditor: { padding: spacing.x3, paddingTop: 0, gap: spacing.x3, borderTopWidth: 1, borderTopColor: colors.line },
  actionCopy: { flex: 1, gap: 2 },
  actionTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  actionTitleDone: { color: colors.muted, textDecorationLine: 'line-through' },
  actionComposerToggle: {
    minHeight: 46,
    paddingHorizontal: spacing.x4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.x3,
    borderRadius: radius.medium,
    backgroundColor: colors.canvas,
  },
  actionComposerToggleCopy: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2 },
  actionComposerToggleText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  actionComposer: { marginTop: spacing.x2, paddingTop: spacing.x4, gap: spacing.x3, borderTopWidth: 1, borderTopColor: colors.line },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.x2 },
  choiceChip: { minHeight: 36, paddingHorizontal: spacing.x3, justifyContent: 'center', borderRadius: radius.medium, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  choiceChipActive: { borderColor: colors.ink, backgroundColor: colors.ink },
  choiceChipText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  choiceChipTextActive: { color: colors.white },
  actions: { gap: spacing.x2 },
});
