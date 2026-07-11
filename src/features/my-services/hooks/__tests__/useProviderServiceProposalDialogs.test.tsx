import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProposalDetailView } from '@/features/negotiation-proposals'
import type { ServiceModel } from '@/features/view-services'
import { useProviderServiceProposalDialogs } from '../useProviderServiceProposalDialogs'

const mocks = vi.hoisted(() => ({
  getProposalDetail: vi.fn(),
  useProposalDetail: vi.fn(() => ({ data: null, isLoading: false })),
}))

vi.mock('@/features/negotiation-proposals', () => ({
  PROPOSAL_DETAIL_QUERY_KEY: 'proposal-detail',
  getProposalDetail: mocks.getProposalDetail,
  useProposalDetail: mocks.useProposalDetail,
}))

vi.mock('@/features/view-services', () => ({
  SERVICES_LIST_QUERY_KEY: ['services-list'],
}))

const proposal: ProposalDetailView = {
  id: 'proposal-1',
  service_request_id: 'service-1',
  provider_id: 'provider-1',
  status: 'REVISION_REQUESTED',
  version: 2,
  revision_count: 1,
  revision_reason: null,
  revision_notes: 'Adjust scope',
  submitted_at: '2026-07-01T00:00:00.000Z',
  expired_at: null,
  expires_at: '2026-07-13T00:00:00.000Z',
  proposed_amount: 500,
  tax_rate: 0.15,
  tax_amount: 75,
  final_amount: 425,
  proposal_description: 'Electrical repair',
  proposal_duration_unit: 'hours',
  proposal_duration_value: 4,
  proposal_suggested_slots: [],
  selected_slot: null,
  photos: [],
  client_rejection_response: null,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-02T00:00:00.000Z',
}

function serviceModel(overrides: Partial<ServiceModel> = {}): ServiceModel {
  return {
    id: 'service-1',
    title: 'Electrical repair',
    description: null,
    descriptionPreview: '',
    formData: null,
    formSchema: null,
    listPhase: 'negotiation',
    statusTabId: 'negotiation',
    contractedServiceId: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    requestStatus: 'OPEN',
    cancelledAt: null,
    completedAt: null,
    address: null,
    service: null,
    photoPaths: [],
    proposalCount: 1,
    hasPendingProposal: true,
    pendingProposalCount: 0,
    activeChatCount: 1,
    unreadChatCount: 0,
    counterpartyName: null,
    counterparty: null,
    contracted: null,
    tags: null,
    urgency: null,
    scopeComplexity: null,
    estimatedDurationHint: null,
    missingInfoWarnings: null,
    suggestedEquipment: null,
    suggestedMaterials: null,
    lastActivityAt: null,
    myProposal: {
      id: 'proposal-1',
      status: 'REVISION_REQUESTED',
      finalAmount: 425,
      updatedAt: '2026-07-02T00:00:00.000Z',
      expiredAt: null,
      submittedAt: '2026-07-01T00:00:00.000Z',
      revisionReason: null,
      revisionNotes: 'Adjust scope',
      clientRejectionResponse: null,
    },
    chatSummary: {
      id: 'chat-1',
      isUnread: false,
      lastInteractionAt: null,
      lastMessagePreview: null,
    },
    ...overrides,
  }
}

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useProviderServiceProposalDialogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getProposalDetail.mockResolvedValue({ data: proposal, error: null })
  })

  it('opens proposal details with provider query context and clears state on close', () => {
    const { result } = renderHook(() => useProviderServiceProposalDialogs(), { wrapper })
    const model = serviceModel()

    act(() => result.current.openViewProposal(model))

    expect(result.current.detailsOpen).toBe(true)
    expect(result.current.detailsProposalId).toBe('proposal-1')
    expect(mocks.useProposalDetail).toHaveBeenLastCalledWith({
      proposalId: 'proposal-1',
      enabled: true,
      audience: 'provider',
    })

    act(() => result.current.handleDetailsDialogOpenChange(false))

    expect(result.current.detailsOpen).toBe(false)
    expect(result.current.detailsProposalId).toBeNull()
  })

  it('does not open details or composer when the model has no proposal', async () => {
    const { result } = renderHook(() => useProviderServiceProposalDialogs(), { wrapper })
    const model = serviceModel({ myProposal: null })

    act(() => result.current.openViewProposal(model))
    await act(async () => result.current.openReviseProposal(model))

    expect(mocks.getProposalDetail).not.toHaveBeenCalled()
    expect(result.current.detailsOpen).toBe(false)
    expect(result.current.composerOpen).toBe(false)
  })

  it('loads the latest proposal before opening the revision composer', async () => {
    const { result } = renderHook(() => useProviderServiceProposalDialogs(), { wrapper })

    await act(async () => result.current.openReviseProposal(serviceModel()))

    expect(mocks.getProposalDetail).toHaveBeenCalledWith('proposal-1', 'provider')
    expect(result.current.composerOpen).toBe(true)
    expect(result.current.composerInitialProposal).toBe(proposal)
    expect(result.current.composerContext).toEqual({
      chatId: 'chat-1',
      serviceRequestId: 'service-1',
    })

    act(() => result.current.handleComposerOpenChange(false))
    expect(result.current.composerInitialProposal).toBeNull()
    expect(result.current.composerContext).toBeNull()
  })

  it('keeps the revision composer closed when proposal loading fails', async () => {
    mocks.getProposalDetail.mockResolvedValue({ data: null, error: 'Not found' })
    const { result } = renderHook(() => useProviderServiceProposalDialogs(), { wrapper })

    await act(async () => result.current.openReviseProposal(serviceModel()))

    expect(result.current.composerOpen).toBe(false)
    expect(result.current.composerInitialProposal).toBeNull()
  })

  it('moves from details to composer after loading the editable proposal', async () => {
    const { result } = renderHook(() => useProviderServiceProposalDialogs(), { wrapper })
    act(() => result.current.openViewProposal(serviceModel()))

    await act(async () => result.current.openComposerEditFromDetails())

    expect(mocks.getProposalDetail).toHaveBeenCalledWith('proposal-1', 'provider')
    expect(result.current.detailsOpen).toBe(false)
    expect(result.current.detailsProposalId).toBeNull()
    expect(result.current.composerOpen).toBe(true)
    expect(result.current.composerInitialProposal).toBe(proposal)
    expect(result.current.composerContext).toEqual({
      chatId: 'chat-1',
      serviceRequestId: 'service-1',
    })
  })

  it('invalidates both service list and proposal detail caches after a mutation', () => {
    const { result } = renderHook(() => useProviderServiceProposalDialogs(), { wrapper })
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

    act(() => result.current.invalidateAfterProposalMutation())

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['services-list'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['proposal-detail'] })
  })
})
