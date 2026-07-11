import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ToggleGroup, ToggleGroupItem } from '../toggle-group'

describe('toggle-group', () => {
  it('renders items and notifies on value change', () => {
    const onValueChange = vi.fn()
    render(
      <ToggleGroup type="single" value="a" onValueChange={onValueChange}>
        <ToggleGroupItem value="a">A</ToggleGroupItem>
        <ToggleGroupItem value="b">B</ToggleGroupItem>
      </ToggleGroup>,
    )

    fireEvent.click(screen.getByRole('radio', { name: 'B' }))
    expect(onValueChange).toHaveBeenCalledWith('b')
  })

  it('applies outline variant from group context', () => {
    render(
      <ToggleGroup type="single" variant="outline" size="sm">
        <ToggleGroupItem value="x">X</ToggleGroupItem>
      </ToggleGroup>,
    )

    expect(screen.getByRole('radio', { name: 'X' })).toBeInTheDocument()
  })
})
