import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FormBlock } from '../../../types'
import { TextareaBlock } from '../TextareaBlock'

const block: FormBlock = {
  id: 'notes',
  type: 'textarea',
  label: 'Notas',
  description_ai: 'Notes',
  validation: { maxLength: 100 },
}

describe('TextareaBlock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows muted counter under 90% of maxLength', () => {
    render(
      <TextareaBlock block={block} value={'a'.repeat(45)} onChange={vi.fn()} />,
    )
    const counter = screen.getByText('45 / 100')
    expect(counter).toHaveClass('text-muted-foreground')
  })

  it('shows orange counter when length exceeds 90% of max', () => {
    render(
      <TextareaBlock block={block} value={'a'.repeat(91)} onChange={vi.fn()} />,
    )
    expect(screen.getByText('91 / 100')).toHaveClass('text-orange-500')
  })

  it('shows destructive counter when over maxLength', () => {
    // maxLength on the DOM input prevents typing past max; pass a longer value directly
    render(
      <TextareaBlock
        block={{ ...block, validation: { maxLength: 10 } }}
        value={'a'.repeat(11)}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('11 / 10')).toHaveClass('text-destructive')
  })

  it('shows Texto válido after blur when value is valid', () => {
    render(
      <TextareaBlock
        block={{ ...block, required: false, helpText: undefined }}
        value="ok"
        onChange={vi.fn()}
      />,
    )
    fireEvent.blur(screen.getByLabelText(/Notas/i))
    act(() => {
      vi.runAllTimers()
    })
    expect(screen.getByText(/Texto válido/i)).toBeInTheDocument()
  })

  it('calls onChange when typing', () => {
    const onChange = vi.fn()
    render(<TextareaBlock block={block} value="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/Notas/i), {
      target: { value: 'hello' },
    })
    expect(onChange).toHaveBeenCalledWith('hello')
  })
})
