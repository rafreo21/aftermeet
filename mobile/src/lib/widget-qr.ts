import { File, Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import QRCode from 'qrcode';
import { Platform } from 'react-native';
import logoAsset from '../../assets/images/splash-icon.png';

const IOS_APP_GROUP = 'group.com.aftermeet.app';
function qrFileName(fileKey: string) {
  const safeKey = fileKey.replace(/[^a-zA-Z0-9_-]/g, '') || 'primary';
  return `quick-share-qr-${safeKey}.png`;
}

export const QR_LOGO = logoAsset;

export async function buildWidgetQrFileUri(cardUrl: string, fileKey = 'primary') {
  const QR_FILE_NAME = qrFileName(fileKey);
  const dataUrl = await QRCode.toDataURL(cardUrl, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 512,
    color: { dark: '#163300', light: '#FFFFFF' },
  });
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');

  if (Platform.OS === 'ios') {
    const group = Paths.appleSharedContainers?.[IOS_APP_GROUP];
    if (group) {
      const file = new File(group, QR_FILE_NAME);
      await FileSystem.writeAsStringAsync(file.uri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return file.uri;
    }
  }

  const path = `${FileSystem.cacheDirectory}${QR_FILE_NAME}`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return path;
}
