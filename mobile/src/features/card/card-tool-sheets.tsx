import {
  Code,
  ContactlessPayment,
  Copy,
  EnvelopeSimple,
  GoogleLogo,
  LinkSimple,
  Monitor,
  SquaresFour,
  Wallet,
  Watch,
} from 'phosphor-react-native';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Body, Button } from '@/components/ui';
import { showsCompanyDetails } from '@/features/card/company-display';
import type { themeSurfaceStyle } from '@/features/card/theme-colors';
import {
  copyNfcCardLink,
  copyNfcManufacturerPayload,
  isNativeNfcSupported,
  openNfcSettings,
  programNfcTag,
} from '@/features/card/nfc-actions';
import {
  downloadShareAsset,
  virtualBackgroundInstructions,
  watchSetupInstructions,
} from '@/features/card/share-assets';
import { updateQuickShareWidget, widgetSetupInstructions } from '@/features/card/widget-sync';
import {
  addAppleWalletPass,
  addGoogleWalletPass,
} from '@/features/card/wallet-actions';
import type { MobileCard } from '@/features/card/types';
import type { SignatureProfile } from '@/lib/email-signature';
import { colors, radius, spacing } from '@/theme/tokens';

export type CardToolTheme = ReturnType<typeof themeSurfaceStyle>;

type SheetActions = {
  busy: string;
  run: (action: string, task: () => Promise<void>) => Promise<void>;
  setMessage: (value: string) => void;
};

type SharedSheetProps = {
  card: MobileCard;
  publicUrl: string;
  theme: CardToolTheme;
  actions: SheetActions;
  accessToken?: string;
};

function SheetMessage({ message, error }: { message?: string; error?: string }) {
  return (
    <>
      {message ? <Text style={styles.success}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );
}

export function WalletToolSheetContent({
  card,
  theme,
  actions,
  accessToken,
  walletAvailable,
  walletNote,
  showCompany,
  message,
  error,
}: SharedSheetProps & {
  walletAvailable: boolean | null;
  walletNote: string;
  showCompany: boolean;
  message: string;
  error: string;
}) {
  const { busy, run, setMessage } = actions;

  return (
    <View style={styles.sheetBody}>
      <Body>Your card appears in Wallet with name, role, company, and a scannable QR code.</Body>
      <View style={[styles.walletPreview, { backgroundColor: theme.backgroundColor }]}>
        <Text style={[styles.walletHeader, { color: theme.softColor }]}>AfterMeet Card</Text>
        <View style={styles.walletFields}>
          <View style={styles.walletField}>
            <Text style={[styles.walletLabel, { color: theme.mutedColor }]}>NAME</Text>
            <Text style={[styles.walletValue, { color: theme.color }]}>{card.name || 'Your name'}</Text>
          </View>
          {card.role ? (
            <View style={styles.walletField}>
              <Text style={[styles.walletLabel, { color: theme.mutedColor }]}>JOB TITLE</Text>
              <Text style={[styles.walletValue, { color: theme.color }]}>{card.role}</Text>
            </View>
          ) : null}
          {showCompany && card.company ? (
            <View style={styles.walletField}>
              <Text style={[styles.walletLabel, { color: theme.mutedColor }]}>COMPANY</Text>
              <Text style={[styles.walletValue, { color: theme.color }]}>{card.company}</Text>
            </View>
          ) : null}
        </View>
      </View>
      {Platform.OS === 'ios' ? (
        <>
          <Button
            loading={busy === 'apple'}
            disabled={walletAvailable === false}
            onPress={() => void run('apple', async () => {
              if (!accessToken) throw new Error('Sign in required.');
              await addAppleWalletPass(card.slug, accessToken);
              setMessage('Choose Add to Wallet from the share sheet.');
            })}>
            <Wallet size={18} color={colors.ink} weight="bold" />
            Add to Apple Wallet
          </Button>
          {walletAvailable === false && walletNote ? (
            <Text style={styles.note}>{walletNote} Ask your admin to add Apple Wallet signing keys on the server.</Text>
          ) : null}
        </>
      ) : null}
      {Platform.OS === 'android' ? (
        <>
          <Button
            loading={busy === 'google'}
            disabled={walletAvailable === false}
            onPress={() => void run('google', async () => {
              if (!accessToken) throw new Error('Sign in required.');
              await addGoogleWalletPass(card.slug, accessToken);
              setMessage('Finish adding the pass in Google Wallet.');
            })}>
            <GoogleLogo size={18} color={colors.ink} weight="bold" />
            Add to Google Wallet
          </Button>
          {walletAvailable === false && walletNote ? (
            <Text style={styles.note}>{walletNote} Ask your admin to add GOOGLE_WALLET_ISSUER_ID and GOOGLE_WALLET_SERVICE_ACCOUNT_JSON on Vercel.</Text>
          ) : null}
        </>
      ) : null}
      <SheetMessage message={message} error={error} />
    </View>
  );
}

export function NfcToolSheetContent({
  publicUrl,
  actions,
  message,
  error,
}: Pick<SharedSheetProps, 'publicUrl' | 'actions'> & { message: string; error: string }) {
  const { busy, run, setMessage } = actions;

  return (
    <View style={styles.sheetBody}>
      <Body>Program a physical NFC tag or copy the link for manufacturer tools.</Body>
      {isNativeNfcSupported() ? (
        <>
          <Button
            loading={busy === 'nfc'}
            onPress={() => void run('nfc', async () => {
              await programNfcTag(publicUrl);
              setMessage('NFC tag programmed. Tap it with a phone to open your card.');
            })}>
            <ContactlessPayment size={18} color={colors.ink} weight="bold" />
            Program NFC tag
          </Button>
          <Button variant="secondary" onPress={() => void openNfcSettings()}>
            Open NFC settings
          </Button>
        </>
      ) : (
        <Text style={styles.note}>NFC writing works on Android. iPhone can read tags but cannot write them from the app.</Text>
      )}
      <Button
        variant="secondary"
        loading={busy === 'nfc-link'}
        onPress={() => void run('nfc-link', async () => {
          const value = await copyNfcCardLink(publicUrl);
          setMessage(`Card link copied: ${value}`);
        })}>
        <LinkSimple size={16} color={colors.ink} weight="bold" />
        Copy card link for NFC
      </Button>
      <Button
        variant="ghost"
        loading={busy === 'nfc-copy'}
        onPress={() => void run('nfc-copy', async () => {
          await copyNfcManufacturerPayload(publicUrl);
          setMessage('Programming JSON copied for manufacturer tools.');
        })}>
        <Copy size={16} color={colors.ink} weight="bold" />
        Copy NFC programming JSON
      </Button>
      <SheetMessage message={message} error={error} />
    </View>
  );
}

export function WidgetToolSheetContent({
  card,
  publicUrl,
  theme,
  actions,
  accessToken,
  showCompany,
  initials,
  message,
  error,
}: SharedSheetProps & {
  showCompany: boolean;
  initials: string;
  message: string;
  error: string;
}) {
  const { busy, run, setMessage } = actions;

  return (
    <View style={styles.sheetBody}>
      <Body>{widgetSetupInstructions(Platform.OS === 'android' ? 'android' : 'ios')}</Body>
      <Body style={styles.note}>QR Scan is 2×2 with the AfterMeet logo. Business Card shows your photo when published.</Body>
      <View style={styles.widgetGallery}>
        <View style={styles.widgetOptionCard}>
          <View style={styles.widgetOptionHeader}>
            <Text style={styles.widgetOptionBrand}>AfterMeet</Text>
            <Text style={styles.widgetOptionSize}>2 × 2</Text>
          </View>
          <View style={styles.widgetQrOnlyPreview}>
            <View style={[styles.widgetQrOnlyFrame, { borderColor: theme.backgroundColor }]}>
              <Text style={styles.widgetQrLabel}>QR</Text>
            </View>
          </View>
          <Text style={styles.widgetOptionTitle}>QR Scan</Text>
          <Text style={styles.widgetOptionCopy}>Large scannable QR for quick sharing.</Text>
        </View>

        <View style={styles.widgetOptionCard}>
          <View style={styles.widgetOptionHeader}>
            <Text style={styles.widgetOptionBrand}>AfterMeet</Text>
            <Text style={styles.widgetOptionSize}>4 × 2</Text>
          </View>
          <View style={styles.widgetBusinessPreview}>
            <View style={styles.widgetBusinessQr}>
              <Text style={styles.widgetQrLabelLight}>QR</Text>
            </View>
            <View style={styles.widgetBusinessCopy}>
              <View style={styles.widgetAvatarSmall}>
                <Text style={styles.widgetAvatarText}>{initials}</Text>
              </View>
              <Text style={styles.widgetNameLight}>{card.name}</Text>
              {card.role ? <Text style={styles.widgetRoleLight}>{card.role}</Text> : null}
              {showCompany && card.company ? <Text style={styles.widgetCompanyLight}>{card.company}</Text> : null}
            </View>
          </View>
          <Text style={styles.widgetOptionTitle}>Business Card</Text>
          <Text style={styles.widgetOptionCopy}>QR plus your name, role, and company.</Text>
        </View>

        <View style={styles.widgetOptionCard}>
          <View style={styles.widgetOptionHeader}>
            <Text style={styles.widgetOptionBrand}>AfterMeet</Text>
            <Text style={styles.widgetOptionSize}>4 × 2</Text>
          </View>
          <View style={styles.widgetConnectionsPreview}>
            <Text style={[styles.widgetConnectionsEyebrow, { color: theme.backgroundColor }]}>RECENT CONNECTIONS</Text>
            <View style={styles.widgetConnectionRow}>
              <View style={styles.widgetAvatarSmall}><Text style={styles.widgetAvatarText}>C</Text></View>
              <View style={styles.widgetConnectionCopy}>
                <Text style={styles.widgetNameLight}>Recent connection</Text>
                <Text style={styles.widgetRoleLight}>Shared via your card</Text>
              </View>
              <Text style={styles.widgetActionChip}>☎</Text>
              <Text style={styles.widgetActionChip}>✉</Text>
            </View>
          </View>
          <Text style={styles.widgetOptionTitle}>Recent Connections</Text>
          <Text style={styles.widgetOptionCopy}>Quick call or message people who shared back.</Text>
        </View>
      </View>
      <Button
        loading={busy === 'widget'}
        onPress={() => void run('widget', async () => {
          await updateQuickShareWidget(card, publicUrl, accessToken);
          setMessage('All three widgets updated. Add or refresh them from your widget picker.');
        })}>
        <SquaresFour size={18} color={colors.ink} weight="bold" />
        Refresh home-screen widgets
      </Button>
      <SheetMessage message={message} error={error} />
    </View>
  );
}

export function SignatureToolSheetContent({
  card,
  signatureProfile,
  initials,
  showCompany,
  copied,
  copySignature,
  message,
  error,
}: {
  card: MobileCard;
  signatureProfile: SignatureProfile;
  initials: string;
  showCompany: boolean;
  copied: string;
  copySignature: (kind: 'plain' | 'html') => Promise<void>;
  message: string;
  error: string;
}) {
  return (
    <View style={styles.sheetBody}>
      <Body>Paste the HTML version into Gmail, Outlook, or Apple Mail signature settings.</Body>
      <View style={styles.signaturePreview}>
        <View style={styles.signaturePhoto}>
          <Text style={styles.signaturePhotoText}>{initials}</Text>
        </View>
        <View style={styles.signatureBody}>
          <Text style={styles.signatureName}>{card.name || 'Your name'}</Text>
          {card.role ? <Text style={styles.signatureLine}>{card.role}</Text> : null}
          {showCompany && card.company ? <Text style={styles.signatureLine}>{card.company}</Text> : null}
          {signatureProfile.phone ? <Text style={styles.signatureContact}>☎ {signatureProfile.phone}</Text> : null}
          {signatureProfile.email ? <Text style={styles.signatureContact}>✉ {signatureProfile.email}</Text> : null}
          <Text style={styles.signatureLink}>View my card</Text>
        </View>
      </View>
      <Button variant="secondary" onPress={() => void copySignature('plain')}>
        <EnvelopeSimple size={18} color={colors.ink} weight="bold" />
        {copied === 'plain' ? 'Plain copied' : 'Copy plain signature'}
      </Button>
      <Button variant="ghost" onPress={() => void copySignature('html')}>
        <Code size={16} color={colors.ink} weight="bold" />
        {copied === 'html' ? 'HTML copied' : 'Copy HTML signature'}
      </Button>
      <SheetMessage message={message} error={error} />
    </View>
  );
}

export function WatchToolSheetContent({
  card,
  actions,
  accessToken,
  published,
  message,
  error,
}: SharedSheetProps & { published: boolean; message: string; error: string }) {
  const { busy, run, setMessage } = actions;

  return (
    <View style={styles.sheetBody}>
      <Body>{watchSetupInstructions(Platform.OS === 'android' ? 'android' : 'ios')}</Body>
      <View style={styles.watchPreview}>
        <Text style={styles.watchLabel}>Personal card</Text>
        <View style={styles.watchQr}>
          <Text style={styles.widgetQrLabel}>QR</Text>
        </View>
      </View>
      <Button
        loading={busy === 'watch'}
        disabled={!accessToken || !published}
        onPress={() => void run('watch', async () => {
          if (!accessToken) throw new Error('Sign in required.');
          await downloadShareAsset(card.slug, 'watch-face', accessToken);
          setMessage('Watch QR downloaded. Add it to your watch face.');
        })}>
        <Watch size={18} color={colors.ink} weight="bold" />
        Download watch QR
      </Button>
      <SheetMessage message={message} error={error} />
    </View>
  );
}

export function BackgroundToolSheetContent({
  card,
  theme,
  actions,
  accessToken,
  published,
  subtitle,
  message,
  error,
}: SharedSheetProps & { published: boolean; subtitle: string; message: string; error: string }) {
  const { busy, run, setMessage } = actions;

  return (
    <View style={styles.sheetBody}>
      <Body>{virtualBackgroundInstructions()}</Body>
      <View style={[styles.backgroundPreview, { backgroundColor: theme.backgroundColor }]}>
        <View style={styles.backgroundOverlay}>
          <Text style={styles.backgroundName}>{card.name}</Text>
          {subtitle ? <Text style={styles.backgroundSubtitle}>{subtitle}</Text> : null}
          <View style={styles.backgroundQr}>
            <Text style={styles.widgetQrLabel}>QR</Text>
          </View>
        </View>
      </View>
      <Button
        loading={busy === 'background'}
        disabled={!accessToken || !published}
        onPress={() => void run('background', async () => {
          if (!accessToken) throw new Error('Sign in required.');
          await downloadShareAsset(card.slug, 'virtual-background', accessToken);
          setMessage('Virtual background downloaded. Import it in your meeting app.');
        })}>
        <Monitor size={18} color={colors.ink} weight="bold" />
        Download virtual background
      </Button>
      <SheetMessage message={message} error={error} />
    </View>
  );
}

export function cardToolInitials(card: MobileCard) {
  return card.name.trim().split(/\s+/).map((part) => part[0] || '').join('').slice(0, 2).toUpperCase() || 'AM';
}

export function cardToolShowCompany(card: MobileCard) {
  return showsCompanyDetails(card);
}

const styles = StyleSheet.create({
  sheetBody: { gap: spacing.x3 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  success: { color: '#2F5711', fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  walletPreview: {
    borderRadius: radius.medium,
    padding: spacing.x4,
    gap: spacing.x3,
  },
  walletHeader: { fontSize: 11, fontWeight: '800' },
  walletFields: { gap: spacing.x3 },
  walletField: { gap: 2 },
  walletLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  walletValue: { fontSize: 18, fontWeight: '800' },
  signaturePreview: {
    flexDirection: 'row',
    borderRadius: radius.medium,
    padding: spacing.x4,
    gap: spacing.x4,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  signaturePhoto: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signaturePhotoText: { color: colors.white, fontSize: 20, fontWeight: '800' },
  signatureBody: { flex: 1, gap: 2 },
  signatureName: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  signatureLine: { color: colors.muted, fontSize: 13 },
  signatureContact: { color: colors.ink, fontSize: 13, marginTop: 4 },
  signatureLink: { color: '#2F5711', fontSize: 12, fontWeight: '800', marginTop: 8 },
  widgetQrLabel: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  widgetAvatarText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  widgetGallery: { gap: spacing.x3 },
  widgetOptionCard: {
    borderRadius: radius.medium,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.x4,
    gap: spacing.x3,
  },
  widgetOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  widgetOptionBrand: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  widgetOptionSize: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  widgetOptionTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  widgetOptionCopy: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  widgetQrOnlyPreview: {
    borderRadius: 18,
    backgroundColor: '#141814',
    padding: spacing.x4,
    alignItems: 'center',
  },
  widgetQrOnlyFrame: {
    width: 96,
    height: 96,
    borderRadius: 16,
    borderWidth: 3,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  widgetBusinessPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    borderRadius: 18,
    backgroundColor: '#141814',
    padding: spacing.x4,
  },
  widgetBusinessQr: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  widgetBusinessCopy: { flex: 1, gap: 2 },
  widgetConnectionsPreview: {
    borderRadius: 18,
    backgroundColor: '#141814',
    padding: spacing.x4,
    gap: spacing.x3,
  },
  widgetConnectionsEyebrow: { fontSize: 10, fontWeight: '800' },
  widgetConnectionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2 },
  widgetConnectionCopy: { flex: 1, gap: 1 },
  widgetActionChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#243024',
    color: colors.white,
    textAlign: 'center',
    lineHeight: 28,
    overflow: 'hidden',
  },
  widgetAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#243024',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  widgetNameLight: { color: colors.white, fontSize: 13, fontWeight: '800' },
  widgetRoleLight: { color: '#B8C4B3', fontSize: 10 },
  widgetCompanyLight: { color: '#8FA088', fontSize: 10 },
  widgetQrLabelLight: { color: colors.white, fontSize: 11, fontWeight: '800' },
  watchPreview: {
    alignItems: 'center',
    padding: spacing.x4,
    borderRadius: 28,
    backgroundColor: '#050505',
    gap: spacing.x3,
  },
  watchLabel: { color: colors.white, fontSize: 13, fontWeight: '600' },
  watchQr: {
    width: 120,
    height: 120,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundPreview: {
    height: 120,
    borderRadius: radius.medium,
    padding: spacing.x4,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  backgroundOverlay: {
    width: 180,
    padding: spacing.x3,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.94)',
    gap: 2,
  },
  backgroundName: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  backgroundSubtitle: { color: colors.muted, fontSize: 11 },
  backgroundQr: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#E9F7DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
