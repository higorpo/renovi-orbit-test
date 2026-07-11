import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FormBlock } from '../../../types'
import { RadioBlock } from '../RadioBlock'

const block: FormBlock = {
  id: 'r',
  type: 'radio',
  label: 'Opção',
  required: true,
  description_ai: 'R',
  options: [
    { value: 'a', label: 'Alpha', emoji: '🅰️' },
    { value: 'b', label: 'Beta' },
  ],
}

describe('RadioBlock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls onChange when a radio option is selected', () => {
    const onChange = vi.fn()
    render(<RadioBlock block={block} value={undefined} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText(/Alpha/i))
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('shows required error after blur without selection', () => {
    render(<RadioBlock block={block} value={undefined} onChange={vi.fn()} />)
    fireEvent.blur(screen.getByLabelText(/Alpha/i))
    act(() => {
      vi.advanceTimersByTime(60)
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
