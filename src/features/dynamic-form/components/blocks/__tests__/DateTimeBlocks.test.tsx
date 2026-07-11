import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FormBlock } from '../../../types'
import { DateBlock } from '../DateBlock'
import { TimeBlock } from '../TimeBlock'

describe('DateBlock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls onChange when date changes', () => {
    const onChange = vi.fn()
    const block: FormBlock = {
      id: 'd',
      type: 'date',
      label: 'Data',
      description_ai: 'D',
    }
    render(<DateBlock block={block} value={undefined} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/Data/i), {
      target: { value: '2025-06-15' },
    })
    expect(onChange).toHaveBeenCalledWith('2025-06-15')
  })

  it('shows validation error when date is below dateMin', () => {
    const block: FormBlock = {
      id: 'd',
      type: 'date',
      label: 'Data',
      description_ai: 'D',
      validation: { dateMin: '2025-01-10', message: 'Data fora' },
    }
    render(<DateBlock block={block} value="2025-01-01" onChange={vi.fn()} />)
    fireEvent.blur(screen.getByLabelText(/Data/i))
    act(() => {
      vi.advanceTimersByTime(60)
    })
    expect(screen.getByRole('alert')).toHaveTextContent(/Data fora/i)
  })
})

describe('TimeBlock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls onChange when time changes', () => {
    const onChange = vi.fn()
    const block: FormBlock = {
      id: 't',
      type: 'time',
      label: 'Hora',
      description_ai: 'T',
    }
    render(<TimeBlock block={block} value={undefined} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/Hora/i), {
      target: { value: '14:30' },
    })
    expect(onChange).toHaveBeenCalledWith('14:30')
  })

  it('shows validation error when time is above timeMax', () => {
    const block: FormBlock = {
      id: 't',
      type: 'time',
      label: 'Hora',
      description_ai: 'T',
      validation: { timeMax: '12:00', message: 'Hora fora' },
    }
    render(<TimeBlock block={block} value="13:00" onChange={vi.fn()} />)
    fireEvent.blur(screen.getByLabelText(/Hora/i))
    act(() => {
      vi.advanceTimersByTime(60)
    })
    expect(screen.getByRole('alert')).toHaveTextContent(/Hora fora/i)
  })
})
