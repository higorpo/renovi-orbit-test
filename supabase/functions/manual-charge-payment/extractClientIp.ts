export function extractClientIp(req: Request): string | null {
  const cfConnectingIp = req.headers.get("CF-Connecting-IP")?.trim();
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  const forwardedFor = req.headers.get("X-Forwarded-For");
  if (forwardedFor) {
    const firstHop = forwardedFor.split(",")[0]?.trim();
    if (firstHop) {
      return firstHop;
    }
  }

  return null;
}
