const WEBM_SIG = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]);
const OGG_SIG = new Uint8Array([0x4f, 0x67, 0x67, 0x53]);
const FTYP_SIG = new Uint8Array([0x66, 0x74, 0x79, 0x70]);
const ADTS_SYNC = 0xff;

function bytesMatch(buf: Uint8Array, offset: number, sig: Uint8Array): boolean {
  if (offset + sig.length > buf.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (buf[offset + i] !== sig[i]) return false;
  }
  return true;
}

function isAdtsAac(buf: Uint8Array): boolean {
  if (buf.length < 2 || buf[0] !== ADTS_SYNC) return false;
  return (buf[1]! & 0xf6) === 0xf0;
}

export async function validateAudioMagicBytes(blob: Blob, declaredMime: string): Promise<boolean> {
  const buf = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const mime = declaredMime.toLowerCase().split(";")[0]?.trim() ?? "";

  if (mime === "audio/webm" || mime === "audio/ogg") {
    if (mime === "audio/webm") return bytesMatch(buf, 0, WEBM_SIG);
    return bytesMatch(buf, 0, OGG_SIG);
  }

  if (mime === "audio/mp4" || mime === "audio/m4a" || mime === "audio/aac") {
    if (bytesMatch(buf, 4, FTYP_SIG)) return true;
    if (mime === "audio/aac") return isAdtsAac(buf);
    return false;
  }

  return false;
}
