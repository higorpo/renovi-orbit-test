import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createConversationPresenceChannel,
  removeRealtimeChannel,
  subscribeConversationRealtime,
  subscribeInboxRealtime,
  teardownPresenceChannel,
} from '../realtime.api'

const {
  channelMock,
  removeChannelMock,
  subscribeConversationChannelMock,
  subscribeInboxChannelMock,
} = vi.hoisted(() => ({
  channelMock: vi.fn(),
  removeChannelMock: vi.fn(),
  subscribeConversationChannelMock: vi.fn(),
  subscribeInboxChannelMock: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    channel: channelMock,
    removeChannel: removeChannelMock,
  },
}))

vi.mock('../../utils/conversationRealtimeChannel', () => ({
  subscribeConversationChannel: subscribeConversationChannelMock,
}))

vi.mock('../../utils/inboxRealtimeChannel', () => ({
  subscribeInboxChannel: subscribeInboxChannelMock,
}))

describe('realtime API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('subscribes to inbox realtime with the shared client', async () => {
    const channel = { topic: 'inbox' }
    const handlers = {
      onMessageInserted: vi.fn(),
      onConversationChanged: vi.fn(),
    }
    subscribeInboxChannelMock.mockReturnValue(channel)

    expect(subscribeInboxRealtime('user-1', handlers)).toBe(channel)
    expect(subscribeInboxChannelMock).toHaveBeenCalledWith(
      expect.objectContaining({ channel: channelMock }),
      'user-1',
      handlers
    )
  })

  it('subscribes to conversation realtime with an optional scope', () => {
    const channel = { topic: 'conversation' }
    const handlers = {
      onMessageInserted: vi.fn(),
      onConversationChanged: vi.fn(),
    }
    const scope = { userId: 'user-1' }
    subscribeConversationChannelMock.mockReturnValue(channel)

    expect(subscribeConversationRealtime('chat-1', handlers, scope)).toBe(
      channel
    )
    expect(subscribeConversationChannelMock).toHaveBeenCalledWith(
      expect.objectContaining({ channel: channelMock }),
      'chat-1',
      handlers,
      scope
    )
  })

  it('creates a presence channel keyed by the current user', () => {
    const channel = { topic: 'presence' }
    channelMock.mockReturnValue(channel)

    expect(createConversationPresenceChannel('chat-1', 'user-1')).toBe(channel)
    expect(channelMock).toHaveBeenCalledWith('conversation:chat-1:presence', {
      config: { presence: { key: 'user-1' } },
    })
  })

  it('removes a realtime channel', () => {
    const channel = { topic: 'presence' }

    removeRealtimeChannel(channel as never)

    expect(removeChannelMock).toHaveBeenCalledWith(channel)
  })

  it('removes a presence channel even when untracking fails', async () => {
    const channel = {
      untrack: vi.fn().mockRejectedValue(new Error('socket closed')),
    }

    await expect(
      teardownPresenceChannel(channel as never)
    ).resolves.toBeUndefined()
    expect(channel.untrack).toHaveBeenCalledOnce()
    expect(removeChannelMock).toHaveBeenCalledWith(channel)
  })
})
