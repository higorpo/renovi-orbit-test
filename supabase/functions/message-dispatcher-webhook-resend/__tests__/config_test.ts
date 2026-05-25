import { assert } from "std/testing/asserts";
import { join } from "std/path/mod";

const configPath = join(Deno.cwd(), "supabase", "config.toml");

Deno.test("message-dispatcher-webhook-resend is registered with verify_jwt false", async () => {
  const text = await Deno.readTextFile(configPath);
  assert(text.includes("[functions.message-dispatcher-webhook-resend]"));

  const section = text.split("[functions.message-dispatcher-webhook-resend]")[1]
    ?.split("\n[")[0] ?? "";
  assert(/verify_jwt\s*=\s*false/.test(section));
});
