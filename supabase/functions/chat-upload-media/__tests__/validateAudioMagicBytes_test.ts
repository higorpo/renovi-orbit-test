import { assertEquals } from "std/testing/asserts";
import { validateAudioMagicBytes } from "../validateAudioMagicBytes.ts";

function blobFrom(bytes: number[]): Blob {
  return new Blob([new Uint8Array(bytes)]);
}

Deno.test("validateAudioMagicBytes accepts webm and ogg signatures", async () => {
  assertEquals(
    await validateAudioMagicBytes(
      blobFrom([0x1a, 0x45, 0xdf, 0xa3, 0x00]),
      "audio/webm",
    ),
    true,
  );
  assertEquals(
    await validateAudioMagicBytes(
      blobFrom([0x4f, 0x67, 0x67, 0x53, 0x00]),
      "audio/ogg; codecs=opus",
    ),
    true,
  );
});

Deno.test("validateAudioMagicBytes accepts mp4/m4a ftyp and aac ADTS", async () => {
  const ftyp = [
    0x00, 0x00, 0x00, 0x18,
    0x66, 0x74, 0x79, 0x70,
    0x4d, 0x34, 0x41, 0x20,
  ];
  assertEquals(await validateAudioMagicBytes(blobFrom(ftyp), "audio/mp4"), true);
  assertEquals(await validateAudioMagicBytes(blobFrom(ftyp), "audio/m4a"), true);
  assertEquals(await validateAudioMagicBytes(blobFrom(ftyp), "audio/aac"), true);

  // ADTS sync word 0xFFF1
  assertEquals(
    await validateAudioMagicBytes(blobFrom([0xff, 0xf1, 0x50, 0x80]), "audio/aac"),
    true,
  );
});

Deno.test("validateAudioMagicBytes rejects mismatched magic and unknown MIME", async () => {
  assertEquals(
    await validateAudioMagicBytes(blobFrom([0x1a, 0x45, 0xdf, 0xa3]), "audio/ogg"),
    false,
  );
  assertEquals(
    await validateAudioMagicBytes(blobFrom([0xff, 0xf1]), "audio/mp4"),
    false,
  );
  assertEquals(
    await validateAudioMagicBytes(blobFrom([0x00, 0x01]), "audio/wav"),
    false,
  );
});
