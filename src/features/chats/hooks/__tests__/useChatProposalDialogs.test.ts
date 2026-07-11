// @vitest-environment happy-dom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatProposalDialogs } from '../useChatProposalDialogs'

const {
  buildRevisionInitialValuesMock,
  getProposalDetailMock,
  useProposalDetailMock,
} = vi.hoisted(() => ({
  buildRevisionInitialValuesMock: vi.fn(),
  getProposalDetailMock: vi.fn(),
  useProposalDetailMock: vi.fn(),
}))

vi.mock('@/features/negotiation-proposals', () => ({
  buildDateUnavailableRevisionInitialValues: buildRevisionInitialValuesMock,
  getProposalDetail: getProposalDetailMock,
  useProposalDetail: useProposalDetailMock,
}))

describe('useChatProposalDialogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProposalDetailMock.mockImplementation(
      ({ proposalId }: { proposalId: string | null }) => ({
        data:
          proposalId === 'proposal-accept'
            ? { proposal_suggested_slots: [{ date: '2026-07-20' }] }
            : undefined,
      })
    )
  })

  it('opens and closes proposal action dialogs with the selected proposal', () => {
    const { result } = renderHook(() =>
      useChatProposalDialogs({ chatId: 'chat-1', isProviderViewer: false })
    )

    act(() => result.current.handleProposalAction('accept', 'proposal-1'))
    expect(result.current.acceptOpen).toBe(true)
    expect(result.current.acceptProposalId).toBe('proposal-1')

    act(() => result.current.handleAcceptDialogOpenChange(false))
    expect(result.current.acceptOpen).toBe(false)
    expect(result.current.acceptProposalId).toBeNull()

    act(() => result.current.handleProposalAction('reject', 'proposal-2'))
    expect(result.current.rejectOpen).toBe(true)
    expect(result.current.rejectProposalId).toBe('proposal-2')

    act(() => result.current.handleProposalAction('view_details', 'proposal-3'))
    expect(result.current.detailsDialogOpen).toBe(true)
    expect(result.current.detailsProposalId).toBe('proposal-3')
  })

  it('loads proposal details before opening the edit composer', async () => {
    const proposal = { id: 'proposal-1', proposed_amount: 250 }
    getProposalDetailMock.mockResolvedValue({ data: proposal, error: null })
    const { result } = renderHook(() =>
      useChatProposalDialogs({ chatId: 'chat-1', isProviderViewer: true })
    )

    await act(() => result.current.openProposalComposerEdit('proposal-1'))

    expect(getProposalDetailMock).toHaveBeenCalledWith('proposal-1')
    expect(result.current.proposalComposerMode).toBe('edit')
    expect(result.current.proposalComposerInitialProposal).toBe(proposal)
    expect(result.current.proposalComposerOpen).toBe(true)
  })

  it('keeps the edit composer closed when proposal details fail', async () => {
    getProposalDetailMock.mockResolvedValue({
      data: null,
      error: new Error('failed'),
    })
    const { result } = renderHook(() =>
      useChatProposalDialogs({ chatId: 'chat-1', isProviderViewer: true })
    )

    await act(() => result.current.openProposalComposerEdit('proposal-1'))

    expect(result.current.proposalComposerOpen).toBe(false)
    expect(result.current.proposalComposerInitialProposal).toBeNull()
  })

  it('moves from acceptance to revision with unavailable-date initial values', () => {
    const initialValues = { reason: 'DATE_UNAVAILABLE' }
    buildRevisionInitialValuesMock.mockReturnValue(initialValues)
    const { result } = renderHook(() =>
      useChatProposalDialogs({ chatId: 'chat-1', isProviderViewer: false })
    )

    act(() => result.current.handleProposalAction('accept', 'proposal-accept'))
    act(() => result.current.handleAcceptRequestRevision())

    expect(buildRevisionInitialValuesMock).toHaveBeenCalledWith([
      { date: '2026-07-20' },
    ])
    expect(result.current.acceptOpen).toBe(false)
    expect(result.current.acceptProposalId).toBeNull()
    expect(result.current.revisionOpen).toBe(true)
    expect(result.current.revisionProposalId).toBe('proposal-accept')
    expect(result.current.revisionInitialValues).toBe(initialValues)
  })

  it('resets open dialogs when the chat changes', async () => {
    const { result, rerender } = renderHook(
      ({ chatId }: { chatId: string }) =>
        useChatProposalDialogs({ chatId, isProviderViewer: false }),
      { initialProps: { chatId: 'chat-1' } }
    )

    act(() =>
      result.current.handleProposalAction('request_revision', 'proposal-1')
    )
    expect(result.current.revisionOpen).toBe(true)

    rerender({ chatId: 'chat-2' })

    await waitFor(() => expect(result.current.revisionOpen).toBe(false))
    expect(result.current.revisionProposalId).toBeNull()
  })

  it('opens the create composer and clears details on close', () => {
    const { result } = renderHook(() =>
      useChatProposalDialogs({ chatId: 'chat-1', isProviderViewer: true })
    )

    act(() => result.current.openProposalComposerCreate())
    expect(result.current.proposalComposerOpen).toBe(true)
    expect(result.current.proposalComposerMode).toBe('create')
    expect(result.current.proposalComposerInitialProposal).toBeNull()

    act(() => result.current.openProposalDetails('proposal-9'))
    expect(result.current.detailsDialogOpen).toBe(true)
    expect(result.current.detailsProposalId).toBe('proposal-9')

    act(() => result.current.handleDetailsDialogOpenChange(false))
    expect(result.current.detailsDialogOpen).toBe(false)
    expect(result.current.detailsProposalId).toBeNull()
  })

  it('routes edit_proposal through handleProposalAction', async () => {
    const proposal = { id: 'proposal-edit', proposed_amount: 100 }
    getProposalDetailMock.mockResolvedValue({ data: proposal, error: null })
    const { result } = renderHook(() =>
      useChatProposalDialogs({ chatId: 'chat-1', isProviderViewer: true })
    )

    await act(async () => {
      result.current.handleProposalAction('edit_proposal', 'proposal-edit')
    })

    await waitFor(() => expect(result.current.proposalComposerOpen).toBe(true))
    expect(result.current.proposalComposerMode).toBe('edit')
    expect(result.current.proposalComposerInitialProposal).toBe(proposal)
  })

  it('clears revision state when the revision dialog closes', () => {
    const { result } = renderHook(() =>
      useChatProposalDialogs({ chatId: 'chat-1', isProviderViewer: false })
    )

    act(() =>
      result.current.handleProposalAction('request_revision', 'proposal-rev')
    )
    expect(result.current.revisionOpen).toBe(true)

    act(() => result.current.handleRevisionDialogOpenChange(false))
    expect(result.current.revisionOpen).toBe(false)
    expect(result.current.revisionProposalId).toBeNull()
    expect(result.current.revisionInitialValues).toBeNull()
  })

  it('no-ops accept-to-revision when there is no accept proposal id', () => {
    const { result } = renderHook(() =>
      useChatProposalDialogs({ chatId: 'chat-1', isProviderViewer: false })
    )

    act(() => result.current.handleAcceptRequestRevision())

    expect(buildRevisionInitialValuesMock).not.toHaveBeenCalled()
    expect(result.current.revisionOpen).toBe(false)
  })

  it('queries proposal details with provider audience for providers', () => {
    renderHook(() =>
      useChatProposalDialogs({ chatId: 'chat-1', isProviderViewer: true })
    )

    expect(useProposalDetailMock).toHaveBeenCalledWith(
      expect.objectContaining({ audience: 'provider' })
    )
  })

  it('keeps proposal ids when dialogs stay open', () => {
    const { result } = renderHook(() =>
      useChatProposalDialogs({ chatId: 'chat-1', isProviderViewer: false })
    )

    act(() => result.current.handleProposalAction('accept', 'proposal-keep'))
    act(() => result.current.handleAcceptDialogOpenChange(true))
    expect(result.current.acceptProposalId).toBe('proposal-keep')

    act(() =>
      result.current.handleProposalAction('request_revision', 'proposal-rev-keep')
    )
    act(() => result.current.handleRevisionDialogOpenChange(true))
    expect(result.current.revisionProposalId).toBe('proposal-rev-keep')

    act(() => result.current.openProposalDetails('proposal-details-keep'))
    act(() => result.current.handleDetailsDialogOpenChange(true))
    expect(result.current.detailsProposalId).toBe('proposal-details-keep')
  })

  it('builds revision values from an empty suggested-slot list', () => {
    buildRevisionInitialValuesMock.mockReturnValue({ reason: 'DATE_UNAVAILABLE' })
    useProposalDetailMock.mockImplementation(
      ({ proposalId }: { proposalId: string | null }) => ({
        data:
          proposalId === 'proposal-empty-slots'
            ? { proposal_suggested_slots: undefined }
            : undefined,
      })
    )
    const { result } = renderHook(() =>
      useChatProposalDialogs({ chatId: 'chat-1', isProviderViewer: false })
    )

    act(() =>
      result.current.handleProposalAction('accept', 'proposal-empty-slots')
    )
    act(() => result.current.handleAcceptRequestRevision())

    expect(buildRevisionInitialValuesMock).toHaveBeenCalledWith([])
    expect(result.current.revisionOpen).toBe(true)
  })

  it('queries accept dialog detail with client audience even for providers', () => {
    renderHook(() =>
      useChatProposalDialogs({ chatId: 'chat-1', isProviderViewer: true })
    )

    expect(useProposalDetailMock).toHaveBeenCalledWith(
      expect.objectContaining({ audience: 'client', enabled: false })
    )
  })

  it('queries client audience for client viewers on details and revision', () => {
    const { result } = renderHook(() =>
      useChatProposalDialogs({ chatId: 'chat-1', isProviderViewer: false })
    )

    act(() => result.current.openProposalDetails('proposal-details'))
    act(() =>
      result.current.handleProposalAction('request_revision', 'proposal-rev')
    )

    expect(useProposalDetailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalId: 'proposal-details',
        enabled: true,
        audience: 'client',
      })
    )
    expect(useProposalDetailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalId: 'proposal-rev',
        enabled: true,
        audience: 'client',
      })
    )
  })

  it('clears revisionInitialValues on request_revision action', () => {
    const { result } = renderHook(() =>
      useChatProposalDialogs({ chatId: 'chat-1', isProviderViewer: false })
    )

    act(() => result.current.handleProposalAction('accept', 'proposal-accept'))
    act(() => result.current.handleAcceptRequestRevision())
    expect(result.current.revisionInitialValues).not.toBeNull()

    act(() =>
      result.current.handleProposalAction('request_revision', 'proposal-fresh')
    )
    expect(result.current.revisionInitialValues).toBeNull()
    expect(result.current.revisionProposalId).toBe('proposal-fresh')
  })

  it('closes reject dialog via setRejectOpen', () => {
    const { result } = renderHook(() =>
      useChatProposalDialogs({ chatId: 'chat-1', isProviderViewer: false })
    )

    act(() => result.current.handleProposalAction('reject', 'proposal-reject'))
    expect(result.current.rejectOpen).toBe(true)

    act(() => result.current.setRejectOpen(false))
    expect(result.current.rejectOpen).toBe(false)
  })

  it('resets all dialog state when chatId becomes null', async () => {
    const { result, rerender } = renderHook(
      ({ chatId }: { chatId: string | null }) =>
        useChatProposalDialogs({ chatId, isProviderViewer: false }),
      { initialProps: { chatId: 'chat-1' as string | null } }
    )

    act(() => result.current.handleProposalAction('accept', 'proposal-1'))
    act(() => result.current.handleProposalAction('reject', 'proposal-2'))
    expect(result.current.acceptOpen).toBe(true)
    expect(result.current.rejectOpen).toBe(true)

    rerender({ chatId: null })

    await waitFor(() => expect(result.current.acceptOpen).toBe(false))
    expect(result.current.rejectOpen).toBe(false)
    expect(result.current.acceptProposalId).toBeNull()
    expect(result.current.rejectProposalId).toBeNull()
  })

  it('ignores unsupported proposal actions', () => {
    const { result } = renderHook(() =>
      useChatProposalDialogs({ chatId: 'chat-1', isProviderViewer: false })
    )

    act(() =>
      result.current.handleProposalAction(
        'unsupported' as Parameters<typeof result.current.handleProposalAction>[0],
        'proposal-1'
      )
    )

    expect(result.current.acceptOpen).toBe(false)
    expect(result.current.rejectOpen).toBe(false)
    expect(result.current.revisionOpen).toBe(false)
    expect(result.current.detailsDialogOpen).toBe(false)
    expect(getProposalDetailMock).not.toHaveBeenCalled()
  })
})
