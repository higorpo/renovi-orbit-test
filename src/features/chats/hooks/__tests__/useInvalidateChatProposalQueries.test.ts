// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CreateProviderProposalResult } from '@/features/negotiation-proposals'
import {
  CHAT_FREE_MESSAGING_QUERY_KEY,
  CHAT_MESSAGES_QUERY_KEY,
  CHAT_PROPOSAL_TIMELINE_QUERY_KEY,
} from '../../constants/queryKeys'
import type { ChatMessageListItem } from '../../types/chats.types'
import { useInvalidateChatProposalQueries } from '../useInvalidateChatProposalQueries'

const { useAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
}))

vi.mock('@/features/auth', () => ({
  useAuth: useAuthMock,
}))

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

const submitResult: CreateProviderProposalResult = {
  id: 'proposal-1',
  proposal: {
    id: 'proposal-1',
    service_request_id: 'request-1',
    provider_id: 'provider-1',
    status: 'SUBMITTED',
    version: 2,
    revision_count: 0,
    submitted_at: '2026-07-10T12:00:00.000Z',
    proposed_amount: 300,
    final_amount: 300,
    proposal_suggested_slots: [],
  },
  timeline_message: {
    id: 'message-proposal',
    chat_id: 'chat-1',
    message_type: 'PROPOSAL',
    linked_entity_type: 'PROPOSAL',
    linked_entity_id: 'proposal-1',
    created_at: '2026-07-10T12:00:00.000Z',
  },
}

describe('useInvalidateChatProposalQueries', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ user: { id: 'provider-1' } })
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
  })

  it('optimistically merges a proposal timeline message and invalidates related queries', () => {
    const existingMessage: ChatMessageListItem = {
      id: 'message-1',
      chat_id: 'chat-1',
      sender_user_id: 'provider-1',
      message_type: 'TEXT',
      payload: { text: 'Existing' },
      linked_entity_type: null,
      linked_entity_id: null,
      idempotency_key: 'message-1',
      delivery_status: 'SENT',
      created_at: '2026-07-10T11:00:00.000Z',
      updated_at: '2026-07-10T11:00:00.000Z',
    }
    queryClient.setQueryData([CHAT_MESSAGES_QUERY_KEY, 'chat-1'], {
      pages: [{ items: [existingMessage], has_more: false, next_cursor: null }],
      pageParams: [null],
    })
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(
      () => useInvalidateChatProposalQueries('chat-1'),
      {
        wrapper: createWrapper(queryClient),
      }
    )

    act(() => result.current(submitResult))

    const cached = queryClient.getQueryData<{
      pages: Array<{ items: ChatMessageListItem[] }>
    }>([CHAT_MESSAGES_QUERY_KEY, 'chat-1'])
    expect(cached?.pages[0]?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'message-proposal',
          sender_user_id: 'provider-1',
          payload: { proposal_id: 'proposal-1', version: 2 },
        }),
      ])
    )
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [CHAT_MESSAGES_QUERY_KEY, 'chat-1'],
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [CHAT_PROPOSAL_TIMELINE_QUERY_KEY, 'chat-1'],
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [CHAT_FREE_MESSAGING_QUERY_KEY, 'chat-1'],
    })
  })

  it('invalidates queries without changing message cache when the user is unavailable', () => {
    useAuthMock.mockReturnValue({ user: null })
    queryClient.setQueryData([CHAT_MESSAGES_QUERY_KEY, 'chat-1'], {
      pages: [{ items: [], has_more: false, next_cursor: null }],
      pageParams: [null],
    })
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(
      () => useInvalidateChatProposalQueries('chat-1'),
      {
        wrapper: createWrapper(queryClient),
      }
    )

    act(() => result.current(submitResult))

    const cached = queryClient.getQueryData<{
      pages: Array<{ items: ChatMessageListItem[] }>
    }>([CHAT_MESSAGES_QUERY_KEY, 'chat-1'])
    expect(cached?.pages[0]?.items).toEqual([])
    expect(invalidateQueries).toHaveBeenCalledTimes(3)
  })

  it('does nothing without a conversation id', () => {
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(
      () => useInvalidateChatProposalQueries(null),
      {
        wrapper: createWrapper(queryClient),
      }
    )

    act(() => result.current(submitResult))

    expect(invalidateQueries).not.toHaveBeenCalled()
  })
})
