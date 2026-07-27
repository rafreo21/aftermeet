import { Asset } from 'expo-asset';
import { File, Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { isRemoteImageUrl } from '@/lib/card-assets-client';

const IOS_APP_GROUP = 'group.com.aftermeet.app';
const LOGO_FILE = 'widget-logo.png';
const PHOTO_FILE = 'widget-photo.jpg';

function widgetStorageDirectory() {
  if (Platform.OS === 'ios') {
    const group = Paths.appleSharedContainers?.[IOS_APP_GROUP];
    if (group) return group.uri;
  }
  return FileSystem.cacheDirectory || '';
}

export async function readUriAsBase64(uri: string) {
  try {
    return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  } catch {
    return undefined;
  }
}

export async function ensureWidgetLogoUri() {
  const directory = widgetStorageDirectory();
  if (!directory) return undefined;

  const destination = `${directory}${LOGO_FILE}`;
  const existing = await FileSystem.getInfoAsync(destination);
  if (existing.exists) return destination;

  const asset = Asset.fromModule(require('../../assets/images/splash-icon.png'));
  await asset.downloadAsync();
  if (!asset.localUri) return undefined;

  if (Platform.OS === 'ios') {
    const group = Paths.appleSharedContainers?.[IOS_APP_GROUP];
    if (group) {
      const file = new File(group, LOGO_FILE);
      await FileSystem.copyAsync({ from: asset.localUri, to: file.uri });
      return file.uri;
    }
  }

  await FileSystem.copyAsync({ from: asset.localUri, to: destination });
  return destination;
}

export async function cacheWidgetPhotoUri(photo: string) {
  const trimmed = photo.trim();
  if (!trimmed) return undefined;

  const directory = widgetStorageDirectory();
  if (!directory) return undefined;

  const destination = `${directory}${PHOTO_FILE}`;

  try {
    if (isRemoteImageUrl(trimmed)) {
      if (Platform.OS === 'ios') {
        const group = Paths.appleSharedContainers?.[IOS_APP_GROUP];
        if (group) {
          const file = new File(group, PHOTO_FILE);
          await FileSystem.downloadAsync(trimmed, file.uri);
          return file.uri;
        }
      }
      await FileSystem.downloadAsync(trimmed, destination);
      return destination;
    }
    if (trimmed.startsWith('file://') || trimmed.startsWith('content://')) {
      if (Platform.OS === 'ios') {
        const group = Paths.appleSharedContainers?.[IOS_APP_GROUP];
        if (group) {
          const file = new File(group, PHOTO_FILE);
          await FileSystem.copyAsync({ from: trimmed, to: file.uri });
          return file.uri;
        }
      }
      await FileSystem.copyAsync({ from: trimmed, to: destination });
      return destination;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export async function cacheWidgetPhotoBase64(photo: string) {
  const uri = await cacheWidgetPhotoUri(photo);
  if (!uri) return undefined;
  return readUriAsBase64(uri);
}
