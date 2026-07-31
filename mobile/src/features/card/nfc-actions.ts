import * as Clipboard from 'expo-clipboard';
import { Linking, Platform } from 'react-native';

import type { MobileCard } from '@/features/card/types';
import { buildMobileContactQrPayload } from '@/lib/contact-qr-payload';
import { nfcManufacturerPayload, normalizeCardUrl } from '@/lib/nfc-ndef';

export function isNativeNfcSupported() {
  return Platform.OS === 'android';
}

function assertCardUrl(cardUrl: string) {
  const normalized = normalizeCardUrl(cardUrl);
  if (!normalized) {
    throw new Error('Publish your card first so we have a link to program onto the tag.');
  }
  return normalized;
}

async function loadNfcManager() {
  const NfcManager = (await import('react-native-nfc-manager')).default;
  const { NfcTech, Ndef } = await import('react-native-nfc-manager');
  return { NfcManager, NfcTech, Ndef };
}

async function writeNdefMessage(
  NfcManager: Awaited<ReturnType<typeof loadNfcManager>>['NfcManager'],
  NfcTech: Awaited<ReturnType<typeof loadNfcManager>>['NfcTech'],
  Ndef: Awaited<ReturnType<typeof loadNfcManager>>['Ndef'],
  bytes: number[],
) {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, {
      alertMessage: 'Hold your phone against the NFC tag.',
    });
    await NfcManager.ndefHandler.writeNdefMessage(bytes);
    return;
  } catch (error) {
    await NfcManager.cancelTechnologyRequest().catch(() => {});
    if (!NfcTech.NdefFormatable) throw error;
  }

  await NfcManager.requestTechnology(NfcTech.NdefFormatable, {
    alertMessage: 'Hold your phone against the NFC tag.',
  });
  await NfcManager.ndefFormatableHandlerAndroid.formatNdef(bytes);
}

export async function programNfcTag(card: MobileCard, cardUrl: string) {
  if (!isNativeNfcSupported()) {
    throw new Error('NFC writing works on Android. iPhone can read programmed tags but cannot write them from the app.');
  }

  const normalized = assertCardUrl(cardUrl);
  const vcard = buildMobileContactQrPayload(card, normalized);
  const { NfcManager, NfcTech, Ndef } = await loadNfcManager();

  const supported = await NfcManager.isSupported();
  if (!supported) throw new Error('This device does not support NFC writing.');

  const enabled = await NfcManager.isEnabled();
  if (!enabled) {
    throw new Error('Turn on NFC in your phone settings, then try again.');
  }

  await NfcManager.start();
  try {
    const records = [
      Ndef.uriRecord(normalized),
      Ndef.record(Ndef.TNF_MIME_MEDIA, 'text/vcard', [], vcard),
    ];
    const bytes = Ndef.encodeMessage(records);
    if (!bytes) throw new Error('Could not encode the NFC message.');
    await writeNdefMessage(NfcManager, NfcTech, Ndef, bytes);
  } catch (error) {
    if (error instanceof Error && /cancel/i.test(error.message)) {
      throw new Error('NFC programming was cancelled. Hold the tag steady and try again.');
    }
    throw error instanceof Error
      ? error
      : new Error('Could not write the NFC tag. Try a blank NTAG213/215/216 tag.');
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

export async function copyNfcCardLink(cardUrl: string) {
  const normalized = assertCardUrl(cardUrl);
  await Clipboard.setStringAsync(normalized);
  return normalized;
}

export async function copyNfcManufacturerPayload(card: MobileCard, cardUrl: string) {
  const normalized = assertCardUrl(cardUrl);
  const vcard = buildMobileContactQrPayload(card, normalized);
  const payload = JSON.stringify(nfcManufacturerPayload(normalized, vcard), null, 2);
  await Clipboard.setStringAsync(payload);
  return payload;
}

export async function openNfcSettings() {
  if (Platform.OS === 'android') {
    await Linking.sendIntent('android.settings.NFC_SETTINGS').catch(async () => {
      await Linking.openSettings();
    });
    return;
  }
  await Linking.openSettings();
}
