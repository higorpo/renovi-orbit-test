import { assertEquals } from "std/testing/asserts";
import { validateMagicBytes } from "../fileSignatures.ts";

function blobFrom(bytes: number[]): Blob {
  return new Blob([new Uint8Array(bytes)]);
}

Deno.test("validateMagicBytes accepts JPEG and PNG signatures", async () => {
  assertEquals(
    await validateMagicBytes(blobFrom([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg"),
    true,
  );
  assertEquals(
    await validateMagicBytes(
      blobFrom([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      "image/png",
    ),
    true,
  );
});

Deno.test("validateMagicBytes accepts WebP RIFF+WEBP layout", async () => {
  const bytes = [
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50, 0x00, 0x00, 0x00, 0x00,
  ];
  assertEquals(await validateMagicBytes(blobFrom(bytes), "image/webp"), true);
});

Deno.test("validateMagicBytes accepts HEIC brands and rejects unknown brands", async () => {
  const heic = [
    0x00, 0x00, 0x00, 0x18,
    0x66, 0x74, 0x79, 0x70,
    0x68, 0x65, 0x69, 0x63,
    0x00, 0x00, 0x00, 0x00,
  ];
  assertEquals(await validateMagicBytes(blobFrom(heic), "image/heic"), true);
  assertEquals(await validateMagicBytes(blobFrom(heic), "image/heif"), true);

  const unknownBrand = [
    0x00, 0x00, 0x00, 0x18,
    0x66, 0x74, 0x79, 0x70,
    0x61, 0x76, 0x69, 0x66,
    0x00, 0x00, 0x00, 0x00,
  ];
  assertEquals(await validateMagicBytes(blobFrom(unknownBrand), "image/heic"), false);
});

Deno.test("validateMagicBytes rejects spoofed and unknown MIME types", async () => {
  assertEquals(
    await validateMagicBytes(blobFrom([0xff, 0xd8, 0xff]), "image/png"),
    false,
  );
  assertEquals(await validateMagicBytes(blobFrom([0x00]), "image/gif"), false);
  assertEquals(await validateMagicBytes(blobFrom([0x00, 0x01]), "image/heic"), false);
});
