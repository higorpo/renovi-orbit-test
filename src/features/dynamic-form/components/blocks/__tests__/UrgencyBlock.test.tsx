import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FormBlock } from '../../../types'
import { UrgencyBlock } from '../UrgencyBlock'

describe('UrgencyBlock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('falls back to default urgency options when options are empty', () => {
    const block: FormBlock = {
      id: 'u',
      type: 'urgency',
      label: 'Urgência',
      description_ai: 'U',
      options: [],
    }
    render(<UrgencyBlock block={block} value={undefined} onChange={vi.fn()} />)
    expect(screen.getByRole('radio', { name: /Sem pressa/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Emergência/i })).toBeInTheDocument()
  })

  it('applies urgent style and shows slaHours metadata', () => {
    const onChange = vi.fn()
    const block: FormBlock = {
      id: 'u',
      type: 'urgency',
      label: 'Urgência',
      description_ai: 'U',
      options: [
        {
          value: 'urgent',
          label: 'Urgente',
          emoji: '🟠',
          metadata: { slaHours: 24 },
        },
      ],
    }
    render(<UrgencyBlock block={block} value="urgent" onChange={onChange} />)
    expect(screen.getByText(/24h/i)).toBeInTheDocument()
    const selected = screen.getByRole('radio', { name: /Urgente/i })
    expect(selected.className).toMatch(/orange/)
  })

  it('calls onChange when selecting an option', () => {
    const onChange = vi.fn()
    const block: FormBlock = {
      id: 'u',
      type: 'urgency',
      label: 'Urgência',
      description_ai: 'U',
      options: [],
    }
    render(<UrgencyBlock block={block} value={undefined} onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: /Normal/i }))
    expect(onChange).toHaveBeenCalledWith('medium')
    act(() => {
      vi.runAllTimers()
    })
  })
})
