// Karochat — resolve a safe AUDIO content-type for an uploaded file.
//
// Browsers (and some sources like WhatsApp) report misleading MIME types for
// audio files — e.g. a ".mpeg" audio clip often comes through as `video/mpeg`,
// which the audio-only `music` storage bucket rejects ("mime type video/mpeg is
// not supported"). We trust the file EXTENSION first and map it to a real audio
// MIME type that the bucket allows, only falling back to the browser-reported
// type when it is already an audio/* type.
//
// Every returned value is in the `music` bucket's allowed_mime_types list.

const BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg",
  mpeg: "audio/mpeg",
  mpga: "audio/mpeg",
  m2a: "audio/mpeg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  wave: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  flac: "audio/flac",
  weba: "audio/webm",
  webm: "audio/webm"
};

export function audioContentType(file: File): string {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (BY_EXT[ext]) return BY_EXT[ext];
  if (file.type && file.type.startsWith("audio/")) return file.type;
  return "audio/mpeg";
}
