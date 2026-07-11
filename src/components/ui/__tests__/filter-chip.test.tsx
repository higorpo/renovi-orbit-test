import { fireEvent, render, screen } from '@testing-library/react'
import { Star } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { FilterChip } from '../filter-chip'

describe('FilterChip', () => {
  it('exposes aria-selected and calls onClick when active chip is clicked', () => {
    const onClick = vi.fn()
    render(
      <FilterChip
        label="Favoritos"
        icon={Star}
        iconColor="text-amber-500"
        isActive
        onClick={onClick}
      />,
    )
    const tab = screen.getByRole('tab', { name: /Favoritos/i })
    expect(tab).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(tab)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled when disabled prop is set', () => {
    render(
      <FilterChip
        label="Off"
        icon={Star}
        iconColor="text-amber-500"
        isActive={false}
        onClick={vi.fn()}
        disabled
      />,
    )
    expect(screen.getByRole('tab', { name: /Off/i })).toBeDisabled()
  })
})
