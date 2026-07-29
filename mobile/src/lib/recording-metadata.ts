export const CLOUD_RECORDING_RETENTION_DAYS = 10;

export function formatCloudAvailableUntil(isoDate?: string | null): string | null {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function isCloudRecordingExpired(isoDate?: string | null, now = Date.now()): boolean {
  if (!isoDate) return false;
  const time = new Date(isoDate).getTime();
  return !Number.isNaN(time) && time <= now;
}
