import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FormBlock } from '../../../types'
import { DateBlock } from '../DateBlock'

const baseBlock: FormBlock = {
  id: 'visit_date',
  type: 'date',
  label: 'Data da visita',
  required: true,
  description_ai: 'Visit date',
  helpText: 'Escolha um dia útil',
}

describe('DateBlock', () => {
  it('renders a date input and calls onChange with the selected value', () => {
    const onChange = vi.fn()
    render(<DateBlock block={baseBlock} value={undefined} onChange={onChange} />)

    const input = screen.getByLabelText(/Data da visita/i)
    expect(input).toHaveAttribute('type', 'date')
    expect(input).toHaveAttribute('aria-required', 'true')
    expect(input).toHaveAttribute('aria-describedby', 'visit_date-help')

    fireEvent.change(input, { target: { value: '2026-07-15' } })
    expect(onChange).toHaveBeenCalledWith('2026-07-15')
  })

  it('maps cleared input to empty string', () => {
    const onChange = vi.fn()
    render(
      <DateBlock block={baseBlock} value="2026-07-15" onChange={onChange} />,
    )

    fireEvent.change(screen.getByLabelText(/Data da visita/i), {
      target: { value: '' },
    })
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('shows required error after blur when empty', async () => {
    render(<DateBlock block={baseBlock} value="" onChange={vi.fn()} />)

    fireEvent.blur(screen.getByLabelText(/Data da visita/i))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/obrigatório/i)
      expect(screen.getByLabelText(/Data da visita/i)).toHaveAttribute(
        'aria-invalid',
        'true',
      )
      expect(screen.getByLabelText(/Data da visita/i)).toHaveAttribute(
        'aria-describedby',
        'visit_date-error',
      )
    })
  })

  it('shows success state when touched with a valid value', async () => {
    render(
      <DateBlock
        block={{ ...baseBlock, required: false }}
        value="2026-07-15"
        onChange={vi.fn()}
      />,
    )

    fireEvent.blur(screen.getByLabelText(/Data da visita/i))

    await waitFor(() => {
      expect(screen.getByLabelText(/Data da visita/i)).toHaveAttribute(
        'aria-invalid',
        'false',
      )
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
