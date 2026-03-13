/**
 * Magic byte signatures for allowed image types.
 * Used to validate blob content matches declared MIME type (prevents spoofing).
 */

const JPEG_SIG = new Uint8Array([0xff, 0xd8, 0xff]);
const PNG_SIG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP_RIFF = new Uint8Array([0x52, 0x49, 0x46, 0x46]); // RIFF
const WEBP_WEBP = new Uint8Array([0x57, 0x45, 0x42, 0x50]); // WEBP at offset 8
const HEIC_FTYP = new Uint8Array([0x66, 0x74, 0x79, 0x70]); // ftyp at offset 4
const HEIC_BRANDS = ["heic", "heix", "hevc", "hevx", "mif1", "msf1"];

function bytesMatch(buf: Uint8Array, offset: number, sig: Uint8Array): boolean {
  if (offset + sig.length > buf.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (buf[offset + i] !== sig[i]) return false;
  }
  return true;
}

function readBrand(buf: Uint8Array, offset: number): string {
  return String.fromCharCode(buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3]);
}

export async function validateMagicBytes(blob: Blob, declaredMime: string): Promise<boolean> {
  const buf = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const mime = declaredMime.toLowerCase();

  if (mime === "image/jpeg") {
    return bytesMatch(buf, 0, JPEG_SIG);
  }
  if (mime === "image/png") {
    return bytesMatch(buf, 0, PNG_SIG);
  }
  if (mime === "image/webp") {
    return bytesMatch(buf, 0, WEBP_RIFF) && buf.length >= 12 && bytesMatch(buf, 8, WEBP_WEBP);
  }
  if (mime === "image/heic" || mime === "image/heif") {
    if (buf.length < 12) return false;
    if (!bytesMatch(buf, 4, HEIC_FTYP)) return false;
    const brand = readBrand(buf, 8);
    return HEIC_BRANDS.includes(brand);
  }
  return false;
}
