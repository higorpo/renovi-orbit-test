// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CHAT_CONVERSATIONS_LIST_QUERY_KEY,
  CHAT_FREE_MESSAGING_QUERY_KEY,
  CHAT_MESSAGES_QUERY_KEY,
  CONVERSATION_DETAIL_QUERY_KEY,
} from '../../constants/queryKeys'
import { useCloseConversationMutation } from '../useCloseConversationMutation'

const {
  closeConversationMock,
  conversationClosedMock,
  toastErrorMock,
  toastSuccessMock,
  useOnlineStatusMock,
} = vi.hoisted(() => ({
  closeConversationMock: vi.fn(),
  conversationClosedMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  useOnlineStatusMock: vi.fn(),
}))

vi.mock('../../api/chats.api', () => ({
  closeConversation: closeConversationMock,
}))

vi.mock('../useChatAnalytics', () => ({
  useChatAnalytics: () => ({ conversation_closed: conversationClosedMock }),
}))

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: useOnlineStatusMock,
}))

vi.mock('sonner', () => ({
  toast: { error: toastErrorMock, success: toastSuccessMock },
}))

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useCloseConversationMutation', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    useOnlineStatusMock.mockReturnValue(true)
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
  })

  it('closes the conversation and refreshes related chat queries', async () => {
    closeConversationMock.mockResolvedValue({
      data: {
        conversation: {
          service_request_id: 'request-1',
          closure_type: 'MANUAL',
        },
      },
      error: null,
    })
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(
      () => useCloseConversationMutation('chat-1'),
      {
        wrapper: createWrapper(queryClient),
      }
    )

    await act(() => result.current.mutateAsync())

    expect(closeConversationMock).toHaveBeenCalledWith({ chatId: 'chat-1' })
    expect(conversationClosedMock).toHaveBeenCalledWith({
      chat_id: 'chat-1',
      service_request_id: 'request-1',
      closure_type: 'MANUAL',
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [CHAT_MESSAGES_QUERY_KEY, 'chat-1'],
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [CONVERSATION_DETAIL_QUERY_KEY, 'chat-1'],
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [CHAT_FREE_MESSAGING_QUERY_KEY, 'chat-1'],
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [CHAT_CONVERSATIONS_LIST_QUERY_KEY],
    })
    expect(toastSuccessMock).toHaveBeenCalledWith('Conversa encerrada.')
  })

  it('blocks the API call while offline and shows the offline message', async () => {
    useOnlineStatusMock.mockReturnValue(false)
    const { result } = renderHook(
      () => useCloseConversationMutation('chat-1'),
      {
        wrapper: createWrapper(queryClient),
      }
    )

    await expect(result.current.mutateAsync()).rejects.toThrow('OFFLINE')

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(
        'Você está offline. Conecte-se à internet para encerrar a conversa.'
      )
    )
    expect(closeConversationMock).not.toHaveBeenCalled()
  })

  it('shows the API error message when closing fails', async () => {
    closeConversationMock.mockResolvedValue({
      data: null,
      error: {
        code: 'CONVERSATION_CLOSED',
        message: 'A conversa já foi encerrada.',
      },
    })
    const { result } = renderHook(
      () => useCloseConversationMutation('chat-1'),
      {
        wrapper: createWrapper(queryClient),
      }
    )

    await expect(result.current.mutateAsync()).rejects.toMatchObject({
      message: 'A conversa já foi encerrada.',
    })

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(
        'A conversa já foi encerrada.'
      )
    )
    expect(toastSuccessMock).not.toHaveBeenCalled()
  })

  it('does not call the API without a conversation id', async () => {
    const { result } = renderHook(() => useCloseConversationMutation(null), {
      wrapper: createWrapper(queryClient),
    })

    await expect(result.current.mutateAsync()).rejects.toThrow(
      'Conversa não encontrada.'
    )
    expect(closeConversationMock).not.toHaveBeenCalled()
  })
})
