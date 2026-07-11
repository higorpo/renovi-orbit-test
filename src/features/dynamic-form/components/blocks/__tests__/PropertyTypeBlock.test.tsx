import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FormBlock } from '../../../types'
import { PropertyTypeBlock } from '../PropertyTypeBlock'

describe('PropertyTypeBlock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('falls back to default property type options', () => {
    render(
      <PropertyTypeBlock
        block={{
          id: 'pt',
          type: 'property_type',
          label: 'Tipo',
          description_ai: 'PT',
          options: [],
        }}
        value={undefined}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('radio', { name: /Casa/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Apartamento/i })).toBeInTheDocument()
  })

  it('calls onChange and shows success after selection', () => {
    const onChange = vi.fn()
    render(
      <PropertyTypeBlock
        block={{
          id: 'pt',
          type: 'property_type',
          label: 'Tipo',
          description_ai: 'PT',
          options: [],
        }}
        value="house"
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('radio', { name: /Apartamento/i }))
    expect(onChange).toHaveBeenCalledWith('apartment')
    fireEvent.blur(screen.getByRole('radio', { name: /Casa/i }))
    act(() => {
      vi.runAllTimers()
    })
    expect(screen.getByText(/Seleção válida/i)).toBeInTheDocument()
  })
})
