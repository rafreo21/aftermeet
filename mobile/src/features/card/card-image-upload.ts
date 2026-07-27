import type { CardAssetField } from '@/lib/card-assets-client';
import { guessImageFileName, guessImageMimeType, isRemoteImageUrl } from '@/lib/card-assets-client';
import { mobileFetch } from '@/lib/mobile-api';

export async function uploadCardImage(
  accessToken: string,
  cardId: string,
  field: CardAssetField,
  uri: string,
) {
  if (!uri.trim() || isRemoteImageUrl(uri)) return uri.trim();

  const formData = new FormData();
  formData.append('cardId', cardId);
  formData.append('field', field);
  formData.append('file', {
    uri,
    name: guessImageFileName(uri, field),
    type: guessImageMimeType(uri),
  } as unknown as Blob);

  const response = await mobileFetch('/api/cards/assets', accessToken, {
    method: 'POST',
    body: formData,
  });
  const payload = await response.json().catch(() => ({})) as { url?: string; error?: string; preview?: boolean };
  if (!response.ok || !payload.url) {
    const statusHint = response.status === 404
      ? ' Save the card first, then try publishing again.'
      : response.status === 503
        ? ' Image storage is not configured on the server yet.'
        : '';
    throw new Error((payload.error || 'Could not upload this card image.') + statusHint);
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
