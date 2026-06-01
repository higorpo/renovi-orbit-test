export function notificationIdForForegroundPayload(payload: {
  title?: string
  body?: string
  data?: Record<string, string>
}): number {
  const key =
    payload.data?.dispatch_id?.trim() ||
    payload.data?.tag?.trim() ||
    `${payload.title ?? ''}:${payload.body ?? ''}`

  let hash = 0
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash << 5) - hash + key.charCodeAt(i)
    hash |= 0
  }

  return (Math.abs(hash) % 2_147_483_646) + 1
}
