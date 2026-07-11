import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FormBlock } from '../../types'
import { DescriptionBlock } from '../DescriptionBlock'

const baseBlock: FormBlock = {
  id: 'desc',
  type: 'description_ai',
  label: 'Descrição',
  required: true,
  description_ai: 'Job description',
  helpText: 'Seja específico',
  validation: { minLength: 10, maxLength: 100 },
}

describe('DescriptionBlock', () => {
  it('shows tips when required and empty', () => {
    render(<DescriptionBlock block={baseBlock} value="" onChange={vi.fn()} />)
    expect(screen.getByText(/Dicas para uma boa descrição/i)).toBeInTheDocument()
    expect(screen.getByText(/O que precisa ser feito/i)).toBeInTheDocument()
  })

  it('shows minimum length error when value is too short', () => {
    render(
      <DescriptionBlock block={baseBlock} value="curto" onChange={vi.fn()} />,
    )
    expect(screen.getByText(/Mínimo: 10 caracteres/i)).toBeInTheDocument()
  })

  it('shows valid checkmark when length is within bounds', () => {
    render(
      <DescriptionBlock
        block={baseBlock}
        value="descrição ok com tamanho"
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText(/Descrição válida/i)).toBeInTheDocument()
  })

  it('calls onChange when typing', () => {
    const onChange = vi.fn()
    render(<DescriptionBlock block={baseBlock} value="" onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'novo texto' },
    })
    expect(onChange).toHaveBeenCalledWith('novo texto')
  })

  it('shows orange counter near 90% of maxLength', () => {
    const value = 'x'.repeat(91)
    render(
      <DescriptionBlock block={baseBlock} value={value} onChange={vi.fn()} />,
    )
    expect(screen.getByText('91 / 100')).toHaveClass('text-orange-500')
  })
})
