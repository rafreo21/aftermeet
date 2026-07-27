import * as Clipboard from 'expo-clipboard';
import { Platform } from 'react-native';

export function isNativeNfcSupported() {
  return Platform.OS === 'android';
}

export async function programNfcTag(cardUrl: string) {
  if (!isNativeNfcSupported()) {
    throw new Error('NFC writing works on Android. iPhone can read programmed tags but cannot write them from the app.');
  }

  const NfcManager = (await import('react-native-nfc-manager')).default;
  const { NfcTech, Ndef } = await import('react-native-nfc-manager');

  const supported = await NfcManager.isSupported();
  if (!supported) throw new Error('This device does not support NFC writing.');

  await NfcManager.start();
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const bytes = Ndef.encodeMessage([Ndef.uriRecord(cardUrl)]);
    if (!bytes) throw new Error('Could not encode the NFC message.');
    await NfcManager.ndefHandler.writeNdefMessage(bytes);
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

export async function copyNfcManufacturerPayload(cardUrl: string) {
  const payload = JSON.stringify({
    format: 'NDEF',
    recordType: 'URI',
    url: cardUrl,
    encoding: 'utf-8',
    instructions: 'Program NFC Type 2 tags with a single URI record pointing to this card URL.',
  }, null, 2);
  await Clipboard.setStringAsync(payload);
}
