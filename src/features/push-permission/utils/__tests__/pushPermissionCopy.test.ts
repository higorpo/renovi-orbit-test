import { describe, expect, it } from 'vitest'

import { getPushPermissionCopy } from '../pushPermissionCopy'

describe('getPushPermissionCopy', () => {
  it('returns client-specific examples', () => {
    const copy = getPushPermissionCopy('client')
    expect(copy.benefits).toContain('orçamento')
    expect(copy.benefits).toContain('profissional')
  })

  it('returns provider-specific examples', () => {
    const copy = getPushPermissionCopy('provider')
    expect(copy.benefits).toContain('pedido')
    expect(copy.benefits).toContain('proposta')
  })

  it('returns default copy for admin or unknown role', () => {
    expect(getPushPermissionCopy('admin').benefits).toContain('Renovi')
    expect(getPushPermissionCopy(null).benefits).toContain('Renovi')
  })
})
