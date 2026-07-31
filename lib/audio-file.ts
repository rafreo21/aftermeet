const SUPPORTED_AUDIO_EXTENSIONS = [
  ".aac",
  ".amr",
  ".caf",
  ".flac",
  ".m4a",
  ".mp3",
  ".mp4",
  ".mpeg",
  ".mpga",
  ".oga",
  ".ogg",
  ".opus",
  ".wav",
  ".webm",
];

export function isSupportedAudioFile(file: Pick<File, "name" | "type">) {
  const mimeType = file.type.trim().toLowerCase();
  if (mimeType.startsWith("audio/")) return true;

  // Chromium commonly identifies audio-only WebM files as video/webm.
  if (mimeType === "video/webm") return true;

  const fileName = file.name.trim().toLowerCase();
  return SUPPORTED_AUDIO_EXTENSIONS.some((extension) => fileName.endsWith(extension));
}
