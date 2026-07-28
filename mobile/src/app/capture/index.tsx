import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ArrowRight,
  ClockCounterClockwise,
  Microphone,
  Notebook,
  Trash,
  UserCircle,
} from 'phosphor-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Body, Button, PageHeader, ScreenFrame } from '@/components/ui';
import { GreenHeroCard } from '@/components/green-hero-card';
import { CaptureDeleteSheet } from '@/components/capture-delete-sheet';
import { OutcomeErrorSheet } from '@/components/outcome-error-sheet';
import { CaptureListSkeleton } from '@/components/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import {
  createFreshCaptureDraft,
  deleteCaptureDraft,
  listCaptureDrafts,
  writeCaptureDraft,
  type CaptureDraftSummary,
} from '@/features/encounters/capture-draft';
import { deleteEncounter, fetchEncounters, type EncounterSummary } from '@/features/encounters/encounter-api';
import { deleteLocalRecording } from '@/features/encounters/local-recordings';
import { formatBuildLabel } from '@/lib/build-info';
import { colors, radius, spacing } from '@/theme/tokens';

type HomeTab = 'drafts' | 'previous';

function formatWhen(iso: string) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function formatRelative(iso: string) {
  if (!iso) return '';
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return formatWhen(iso);
  } catch {
    return '';
  }
}

function snippet(text: string, max = 140) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function stepLabel(step: number) {
  switch (step) {
    case 0: return 'Recording';
    case 1: return 'Gathering';
    case 2: return 'Context';
    case 3: return 'Follow-up';
    default: return 'In progress';
  }
}

function draftTitle(draft: CaptureDraftSummary) {
  if (draft.personName.trim()) return draft.personName.trim();
  if (draft.title.trim()) return draft.title.trim();
  if (draft.transcriptPreview.trim()) return snippet(draft.transcriptPreview, 48);
  return 'Untitled capture';
}

export default function CaptureHomeScreen() {
  const params = useLocalSearchParams<{ exchange?: string; slug?: string }>();
  const { session } = useAuth();
  const [tab, setTab] = useState<HomeTab>('drafts');
  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [drafts, setDrafts] = useState<CaptureDraftSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorSheetOpen, setErrorSheetOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<EncounterSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (params.exchange || params.slug) {
      router.replace({
        pathname: '/capture/new',
        params: {
          ...(params.exchange ? { exchange: String(params.exchange) } : {}),
          ...(params.slug ? { slug: String(params.slug) } : {}),
        },
      });
    }
  }, [params.exchange, params.slug]);

  const loadHome = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorSheetOpen(false);
    setErrorMessage('');

    try {
      const draftList = await listCaptureDrafts();
      setDrafts(draftList);

      if (session?.access_token) {
        const rows = await fetchEncounters(session.access_token);
        setEncounters(rows);
      } else {
        setEncounters([]);
      }
    } catch (caught) {
      setErrorMessage(caught instanceof Error ? caught.message : 'Could not load captures.');
      setErrorSheetOpen(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.access_token]);

  useFocusEffect(
    useCallback(() => {
      if (params.exchange || params.slug) return;
      void loadHome();
    }, [loadHome, params.exchange, params.slug]),
  );

  async function beginFreshCapture() {
    const draft = createFreshCaptureDraft();
    await writeCaptureDraft(draft);
    router.navigate({
      pathname: '/capture/new',
      params: { draftId: draft.encounterId },
    });
  }

  function continueCapture(encounterId: string) {
    router.navigate({
      pathname: '/capture/new',
      params: { draftId: encounterId },
    });
  }

  async function discardDraft(encounterId: string) {
    await deleteCaptureDraft(encounterId);
    setDrafts((current) => current.filter((item) => item.encounterId !== encounterId));
  }

  async function confirmDeleteEncounter() {
    if (!deleteTarget || !session?.access_token) return;
    setDeleting(true);
    setErrorSheetOpen(false);
    setErrorMessage('');
    try {
      await deleteEncounter(session.access_token, deleteTarget.id);
      await deleteLocalRecording(deleteTarget.id);
      setEncounters((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (caught) {
      setErrorMessage(caught instanceof Error ? caught.message : 'Could not delete this capture.');
      setErrorSheetOpen(true);
    } finally {
      setDeleting(false);
    }
  }

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }

  return (
    <ScreenFrame edges={['top']} paddingHorizontal={0}>
      <View style={styles.page}>
        <View style={styles.header}>
          <PageHeader
            eyebrow="Capture"
            title="Context & follow-ups"
            titleStyle={styles.title}
            onBack={goBack}
          />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void loadHome(true)} tintColor={colors.ink} />
          }>
          <GreenHeroCard
            icon={<Microphone size={28} color={colors.white} weight="fill" />}
            title="Capture while it is fresh"
            copy="Record the meeting, pull out private notes and a shared summary, then add a follow-up before you forget."
            primaryLabel="Begin capture"
            onPrimary={() => void beginFreshCapture()}
            secondaryLabel={session ? undefined : 'Sign in to sync'}
            onSecondary={session ? undefined : () => router.push('/auth')}
          />

          {!session && drafts.length ? (
            <Text style={styles.localNote}>Saved on this device only · Sign in to sync across devices</Text>
          ) : null}

          <View style={styles.tabs}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setTab('drafts')}
              style={[styles.tab, tab === 'drafts' && styles.tabActive]}>
              <Text style={[styles.tabLabel, tab === 'drafts' && styles.tabLabelActive]}>
                Drafts{drafts.length ? ` (${drafts.length})` : ''}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setTab('previous')}
              style={[styles.tab, tab === 'previous' && styles.tabActive]}>
              <Text style={[styles.tabLabel, tab === 'previous' && styles.tabLabelActive]}>
                Previous{encounters.length ? ` (${encounters.length})` : ''}
              </Text>
            </Pressable>
          </View>

          {loading ? <CaptureListSkeleton count={4} /> : null}

          {tab === 'drafts' ? (
            <>
              {!loading && drafts.length === 0 ? (
                <View style={styles.emptyCard}>
                  <ClockCounterClockwise size={28} color={colors.muted} weight="bold" />
                  <Text style={styles.emptyTitle}>No drafts yet</Text>
                  <Body style={styles.emptyCopy}>
                    In-progress captures stay here until you save them. Start a new capture or continue where you left off.
                  </Body>
                </View>
              ) : null}

              {drafts.map((draft) => (
                <Pressable
                  key={draft.encounterId}
                  accessibilityRole="button"
                  onPress={() => continueCapture(draft.encounterId)}
                  style={({ pressed }) => [styles.draftCard, pressed && styles.captureCardPressed]}>
                  <View style={styles.captureTop}>
                    <View style={styles.personRow}>
                      <ClockCounterClockwise size={18} color={colors.ink} weight="bold" />
                      <Text style={styles.personName}>{draftTitle(draft)}</Text>
                    </View>
                    <Text style={styles.when}>{formatRelative(draft.updatedAt)}</Text>
                  </View>
                  <Text style={styles.draftMeta}>{stepLabel(draft.step)}</Text>
                  <View style={styles.cardFooter}>
                    <Text style={styles.statusChip}>Draft</Text>
                    <View style={styles.draftActions}>
                      <Pressable
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={(event) => {
                          event.stopPropagation();
                          void discardDraft(draft.encounterId);
                        }}
                        style={styles.discardButton}>
                        <Trash size={14} color={colors.danger} weight="bold" />
                        <Text style={styles.discardText}>Discard</Text>
                      </Pressable>
                      <View style={styles.openRow}>
                        <Text style={styles.openText}>Continue</Text>
                        <ArrowRight size={14} color={colors.ink} weight="bold" />
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))}
            </>
          ) : (
            <>
              {!loading && encounters.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Notebook size={28} color={colors.muted} weight="bold" />
                  <Text style={styles.emptyTitle}>No captures yet</Text>
                  <Body style={styles.emptyCopy}>
                    Your saved meeting contexts and follow-ups will appear here after you complete a capture.
                  </Body>
                </View>
              ) : null}

              {encounters.map((encounter) => (
                <Pressable
                  key={encounter.id}
                  accessibilityRole="button"
                  onPress={() => router.navigate(`/capture/${encounter.id}`)}
                  style={({ pressed }) => [styles.captureCard, pressed && styles.captureCardPressed]}>
                  <View style={styles.captureTop}>
                    <View style={styles.personRow}>
                      <UserCircle size={18} color={colors.ink} weight="fill" />
                      <Text style={styles.personName}>{encounter.personName || 'Someone new'}</Text>
                    </View>
                    <Text style={styles.when}>{formatWhen(encounter.startedAt || encounter.endedAt)}</Text>
                  </View>

                  <Text style={styles.captureTitle}>{encounter.title || `Meeting with ${encounter.personName || 'someone'}`}</Text>

                  <View style={styles.cardFooter}>
                    <Text style={styles.statusChip}>{encounter.status}</Text>
                    <View style={styles.draftActions}>
                      <Pressable
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={(event) => {
                          event.stopPropagation();
                          setDeleteTarget(encounter);
                        }}
                        style={styles.discardButton}>
                        <Trash size={14} color={colors.danger} weight="bold" />
                        <Text style={styles.discardText}>Delete</Text>
                      </Pressable>
                      <View style={styles.openRow}>
                        <Text style={styles.openText}>Open</Text>
                        <ArrowRight size={14} color={colors.ink} weight="bold" />
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))}
            </>
          )}

          <Text style={styles.buildLabel}>{formatBuildLabel()}</Text>
        </ScrollView>
      </View>

      <CaptureDeleteSheet
        visible={Boolean(deleteTarget)}
        title={deleteTarget?.title || deleteTarget?.personName || 'this capture'}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteEncounter()}
      />

      <OutcomeErrorSheet
        visible={errorSheetOpen}
        message={errorMessage}
        onClose={() => {
          setErrorSheetOpen(false);
          setErrorMessage('');
        }}
      />
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: spacing.x5, marginBottom: spacing.x2 },
  title: { fontSize: 30, lineHeight: 32 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.x5,
    paddingBottom: spacing.x6,
    paddingTop: spacing.x2,
    gap: spacing.x3,
  },
  localNote: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.x2,
    padding: 4,
    borderRadius: radius.large,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.x3,
    borderRadius: radius.medium,
  },
  tabActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabLabel: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  tabLabelActive: { color: colors.ink },
  emptyCard: {
    alignItems: 'flex-start',
    gap: spacing.x3,
    padding: spacing.x6,
    borderRadius: radius.large,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  emptyCopy: { lineHeight: 20 },
  draftCard: {
    gap: spacing.x2,
    padding: spacing.x4,
    borderRadius: radius.large,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.line,
  },
  captureCard: {
    gap: spacing.x2,
    padding: spacing.x4,
    borderRadius: radius.large,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  captureCardPressed: { opacity: 0.94 },
  captureTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.x3 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2, flex: 1 },
  personName: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  when: { color: colors.muted, fontSize: 12 },
  draftMeta: { color: colors.muted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  captureTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', lineHeight: 24 },
  summaryBlock: {
    gap: 4,
    padding: spacing.x4,
    borderRadius: radius.medium,
    backgroundColor: colors.canvas,
  },
  notesBlock: {
    gap: 4,
    padding: spacing.x4,
    borderRadius: radius.medium,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.line,
  },
  blockLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  blockCopy: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  blockCopyMuted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  followUpRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2 },
  followUpText: { flex: 1, color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.x1,
  },
  statusChip: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  draftActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.x4 },
  discardButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  discardText: { color: colors.danger, fontSize: 12, fontWeight: '800' },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  openText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  buildLabel: {
    marginTop: spacing.x6,
    marginBottom: spacing.x2,
    textAlign: 'center',
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
});
