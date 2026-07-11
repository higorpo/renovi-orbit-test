import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getProviderProposalContextLabel,
  isProposalExpiringSoon,
} from '../providerProposalStatus'

describe('providerProposalStatus', () => {
  describe('getProviderProposalContextLabel', () => {
    it.each([
      ['PENDING', 'Aguardando cliente'],
      ['REVISION_REQUESTED', 'Revisão solicitada'],
      ['REVISED', 'Proposta revisada'],
      ['ACCEPTED', 'Proposta aceita'],
      ['REJECTED', 'Proposta recusada'],
      ['REJECTED_AUTOMATICALLY', 'Recusada automaticamente'],
      ['EXPIRED', 'Proposta expirada'],
    ] as const)('maps %s to its provider-facing label', (status, expected) => {
      expect(getProviderProposalContextLabel(status, 'negotiation')).toBe(expected)
    })

    it('distinguishes an existing conversation from generic negotiation', () => {
      expect(getProviderProposalContextLabel(undefined, 'negotiation', true)).toBe(
        'Conversa iniciada',
      )
      expect(getProviderProposalContextLabel(undefined, 'negotiation', false)).toBe(
        'Em negociação',
      )
    })

    it('returns null without a proposal outside negotiation', () => {
      expect(getProviderProposalContextLabel(undefined, 'in_progress', true)).toBeNull()
    })
  })

  describe('isProposalExpiringSoon', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime('2026-07-10T12:00:00.000Z')
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('returns true for a future deadline within three days', () => {
      expect(isProposalExpiringSoon('2026-07-13T12:00:00.000Z')).toBe(true)
    })

    it('returns false for a future deadline beyond three days', () => {
      expect(isProposalExpiringSoon('2026-07-13T12:00:00.001Z')).toBe(false)
    })

    it.each([
      null,
      undefined,
      'invalid-date',
      '2026-07-10T12:00:00.000Z',
      '2026-07-09T12:00:00.000Z',
    ])('returns false for absent, invalid, or elapsed deadline %j', (deadline) => {
      expect(isProposalExpiringSoon(deadline)).toBe(false)
    })
  })
})
