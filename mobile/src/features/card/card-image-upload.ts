import * as FileSystem from 'expo-file-system/legacy';

import type { CardAssetField } from '@/lib/card-assets-client';
import { guessImageMimeType, isRemoteImageUrl } from '@/lib/card-assets-client';
import { mobileFetch } from '@/lib/mobile-api';

const FIELD_LABEL: Record<CardAssetField, string> = {
  photo: 'profile photo',
  coverPhoto: 'cover photo',
  companyLogo: 'company logo',
};

async function readImageDataUrl(uri: string) {
  const trimmed = uri.trim();
  if (trimmed.startsWith('data:')) return trimmed;

  const mimeType = guessImageMimeType(trimmed);
  const base64 = await FileSystem.readAsStringAsync(trimmed, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!base64) {
    throw new Error('The selected photo could not be read from this device.');
  }
  return `data:${mimeType};base64,${base64}`;
}

export async function uploadCardImage(
  accessToken: string,
  cardId: string,
  field: CardAssetField,
  uri: string,
) {
  if (!uri.trim() || isRemoteImageUrl(uri)) return uri.trim();

  let dataUrl: string;
  try {
    dataUrl = await readImageDataUrl(uri);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Could not read your ${FIELD_LABEL[field]}: ${error.message}`
        : `Could not read your ${FIELD_LABEL[field]}.`,
    );
  }

  const response = await mobileFetch('/api/cards/assets', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardId, field, dataUrl }),
  });
  const payload = await response.json().catch(() => ({})) as { url?: string; error?: string; preview?: boolean };
  if (!response.ok || !payload.url) {
    const statusHint = response.status === 404
      ? ' Save the card first, then try publishing again.'
      : response.status === 503
        ? ' Image storage is not configured on the server yet.'
        : response.status === 413
          ? ' Try a smaller photo under 8 MB.'
          : '';
    throw new Error(
      `Could not upload your ${FIELD_LABEL[field]}${payload.error ? `: ${payload.error}` : '.'}${statusHint}`,
    );
  }
  return payload.url;
}

export async function uploadCardImagesForPublish(
  accessToken: string,
  cardId: string,
  images: { photo: string; coverPhoto: string; companyLogo: string },
) {
  const [photo, coverPhoto, companyLogo] = await Promise.all([
    images.photo ? uploadCardImage(accessToken, cardId, 'photo', images.photo) : Promise.resolve(''),
    images.coverPhoto ? uploadCardImage(accessToken, cardId, 'coverPhoto', images.coverPhoto) : Promise.resolve(''),
    images.companyLogo ? uploadCardImage(accessToken, cardId, 'companyLogo', images.companyLogo) : Promise.resolve(''),
  ]);
  return { photo, coverPhoto, companyLogo };
}
