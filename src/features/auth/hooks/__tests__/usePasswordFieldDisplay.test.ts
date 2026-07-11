// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePasswordFieldDisplay } from '../usePasswordFieldDisplay'

vi.mock('../../utils/passwordPolicy', () => ({
  getPasswordStrengthDisplay: vi.fn((password: string) => ({
    label: password.length >= 10 ? 'forte' : 'fraca',
    score: password.length >= 10 ? 4 : 1,
  })),
}))

describe('usePasswordFieldDisplay', () => {
  it('toggles showPassword and showConfirmPassword', () => {
    const { result } = renderHook(() =>
      usePasswordFieldDisplay({ password: '' }),
    )

    expect(result.current.showPassword).toBe(false)
    expect(result.current.showConfirmPassword).toBe(false)

    act(() => {
      result.current.setShowPassword(true)
      result.current.setShowConfirmPassword(true)
    })

    expect(result.current.showPassword).toBe(true)
    expect(result.current.showConfirmPassword).toBe(true)
  })

  it('updates passwordDisplay when password changes', () => {
    const { result, rerender } = renderHook(
      ({ password }) => usePasswordFieldDisplay({ password }),
      { initialProps: { password: 'short' } },
    )

    expect(result.current.passwordDisplay.label).toBe('fraca')

    rerender({ password: 'Str0ng!pass' })
    expect(result.current.passwordDisplay.label).toBe('forte')
    expect(result.current.passwordDisplay.score).toBe(4)
  })
})
