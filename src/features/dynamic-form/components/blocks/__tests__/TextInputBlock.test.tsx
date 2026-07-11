import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FormBlock } from '../../../types'
import { TextInputBlock } from '../TextInputBlock'

const baseBlock: FormBlock = {
  id: 'name',
  type: 'text',
  label: 'Nome',
  required: true,
  description_ai: 'Name',
}

describe('TextInputBlock', () => {
  it('falls back to type text for disallowed inputType', () => {
    render(
      <TextInputBlock
        block={{
          ...baseBlock,
          config: { inputType: 'javascript' },
        }}
        value=""
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByLabelText(/Nome/i)).toHaveAttribute('type', 'text')
  })

  it('uses allowed inputType and inputMode from config', () => {
    render(
      <TextInputBlock
        block={{
          ...baseBlock,
          config: { inputType: 'email', inputMode: 'email' },
        }}
        value=""
        onChange={vi.fn()}
      />,
    )
    const input = screen.getByLabelText(/Nome/i)
    expect(input).toHaveAttribute('type', 'email')
    expect(input).toHaveAttribute('inputmode', 'email')
  })

  it('shows unit when idle without error or success', () => {
    render(
      <TextInputBlock
        block={{ ...baseBlock, required: false, unit: 'kg' }}
        value=""
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('kg')).toBeInTheDocument()
  })

  it('calls onChange when typing', () => {
    const onChange = vi.fn()
    render(<TextInputBlock block={baseBlock} value="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/Nome/i), {
      target: { value: 'Ana' },
    })
    expect(onChange).toHaveBeenCalledWith('Ana')
  })
})
