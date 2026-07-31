function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

/**
 * Browser and device file pickers sometimes report an M4A/MP4 recording as
 * audio/mpeg. Detect the container signature before storing or serving it so
 * the guest player receives a MIME type it can actually decode.
 */
export function detectAudioMimeType(bytes: Uint8Array, declaredType = "") {
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") return "audio/mp4";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE") return "audio/wav";
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === "OggS") return "audio/ogg";
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "audio/webm";
  if (bytes.length >= 3 && ascii(bytes, 0, 3) === "ID3") return "audio/mpeg";
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "audio/mpeg";
  return declaredType.trim().toLowerCase() || "audio/mp4";
}

export function audioFileExtension(mimeType: string) {
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("aac")) return "aac";
  return "m4a";
}
