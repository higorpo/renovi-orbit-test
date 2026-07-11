import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ServiceModel } from '@/features/view-services'
import { useProviderMyServicesPage } from '../useProviderMyServicesPage'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getServiceDetailPath: vi.fn((id: string) => `/dashboard/services/${id}`),
  createDetailState: vi.fn(() => ({ returnTo: '/dashboard/services' })),
  getServiceCoordinates: vi.fn(),
  openGoogleMaps: vi.fn(),
  openReviseProposal: vi.fn(),
  openViewProposal: vi.fn(),
}))

const coreResult = {
  items: [],
  isLoading: false,
  marker: 'core-result',
}

vi.mock('react-router', () => ({
  useNavigate: () => mocks.navigate,
  useLocation: () => ({
    pathname: '/dashboard/services',
    search: '?status=negotiation',
    hash: '',
    state: null,
    key: 'default',
  }),
}))

vi.mock('@/features/view-services', () => ({
  getServiceDetailPath: mocks.getServiceDetailPath,
  createProviderMyServicesServiceDetailState: mocks.createDetailState,
  getServiceCoordinates: mocks.getServiceCoordinates,
}))

vi.mock('@/lib/maps/openGoogleMaps', () => ({
  openGoogleMaps: mocks.openGoogleMaps,
}))

vi.mock('../useMyServicesPageCore', () => ({
  useMyServicesPageCore: () => coreResult,
}))

vi.mock('../useProviderServiceProposalDialogs', () => ({
  useProviderServiceProposalDialogs: () => ({
    openReviseProposal: mocks.openReviseProposal,
    openViewProposal: mocks.openViewProposal,
  }),
}))

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
    proposalCount: 0,
    hasPendingProposal: false,
    pendingProposalCount: 0,
    activeChatCount: 0,
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
    myProposal: null,
    chatSummary: null,
    ...overrides,
  }
}

describe('useProviderMyServicesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the core page state and proposal dialog controller', () => {
    const { result } = renderHook(() => useProviderMyServicesPage())

    expect(result.current.marker).toBe('core-result')
    expect(result.current.proposalDialogs).toMatchObject({
      openReviseProposal: mocks.openReviseProposal,
      openViewProposal: mocks.openViewProposal,
    })
  })

  it('opens service details with provider list return state', () => {
    const model = serviceModel()
    const { result } = renderHook(() => useProviderMyServicesPage())

    act(() => result.current.handleOpenDetails(model))

    expect(mocks.createDetailState).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/dashboard/services',
        search: '?status=negotiation',
      }),
    )
    expect(mocks.navigate).toHaveBeenCalledWith('/dashboard/services/service-1', {
      state: { returnTo: '/dashboard/services' },
    })
  })

  it('opens chat only when the model has a chat id', () => {
    const { result } = renderHook(() => useProviderMyServicesPage())

    act(() => result.current.handleOpenChat(serviceModel()))
    expect(mocks.navigate).not.toHaveBeenCalled()

    act(() =>
      result.current.handleOpenChat(
        serviceModel({
          chatSummary: {
            id: 'chat-1',
            isUnread: false,
            lastInteractionAt: null,
            lastMessagePreview: null,
          },
        }),
      ),
    )
    expect(mocks.navigate).toHaveBeenCalledWith('/dashboard/chats/chat-1')
  })

  it('opens Google Maps only when service coordinates are available', () => {
    const model = serviceModel()
    const { result } = renderHook(() => useProviderMyServicesPage())

    mocks.getServiceCoordinates.mockReturnValueOnce(null)
    act(() => result.current.handleOpenMap(model))
    expect(mocks.openGoogleMaps).not.toHaveBeenCalled()

    const coordinates = { latitude: -23.55, longitude: -46.63 }
    mocks.getServiceCoordinates.mockReturnValueOnce(coordinates)
    act(() => result.current.handleOpenMap(model))
    expect(mocks.openGoogleMaps).toHaveBeenCalledWith(coordinates)
  })

  it('delegates proposal actions to the dialog controller', () => {
    const model = serviceModel()
    const { result } = renderHook(() => useProviderMyServicesPage())

    act(() => {
      result.current.handleReviseProposal(model)
      result.current.handleViewProposal(model)
    })

    expect(mocks.openReviseProposal).toHaveBeenCalledWith(model)
    expect(mocks.openViewProposal).toHaveBeenCalledWith(model)
  })
})
