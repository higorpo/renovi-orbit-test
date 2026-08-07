/**
 * Strip markdown code fence around JSON (e.g. ```json ... ```) so it can be parsed.
 */
export function stripJsonCodeFence(raw: string): string {
  let s = raw.trim();
  const open = /^```(?:json)?\s*\n?/i;
  const close = /\n?```\s*$/;
  if (open.test(s)) s = s.replace(open, "");
  if (close.test(s)) s = s.replace(close, "");
  return s.trim();
}
