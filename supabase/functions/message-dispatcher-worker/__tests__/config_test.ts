import { assert } from "std/testing/asserts";
import { join } from "std/path/mod";

const configPath = join(Deno.cwd(), "supabase", "config.toml");

Deno.test("message-dispatcher-worker is registered with verify_jwt false", async () => {
  const text = await Deno.readTextFile(configPath);
  assert(text.includes("[functions.message-dispatcher-worker]"));

  const section = text.split("[functions.message-dispatcher-worker]")[1]?.split("\n[")[0] ?? "";
  assert(/verify_jwt\s*=\s*false/.test(section));
});
