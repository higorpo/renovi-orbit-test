import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FormBlock } from '../../../types'
import { TimeBlock } from '../TimeBlock'

const baseBlock: FormBlock = {
  id: 'visit_time',
  type: 'time',
  label: 'Horário',
  required: true,
  description_ai: 'Visit time',
  helpText: 'Entre 8h e 18h',
}

describe('TimeBlock', () => {
  it('renders a time input and calls onChange with the selected value', () => {
    const onChange = vi.fn()
    render(<TimeBlock block={baseBlock} value={undefined} onChange={onChange} />)

    const input = screen.getByLabelText(/Horário/i)
    expect(input).toHaveAttribute('type', 'time')
    expect(input).toHaveAttribute('aria-required', 'true')
    expect(input).toHaveAttribute('aria-describedby', 'visit_time-help')

    fireEvent.change(input, { target: { value: '14:30' } })
    expect(onChange).toHaveBeenCalledWith('14:30')
  })

  it('maps cleared input to empty string', () => {
    const onChange = vi.fn()
    render(
      <TimeBlock block={baseBlock} value="14:30" onChange={onChange} />,
    )

    fireEvent.change(screen.getByLabelText(/Horário/i), {
      target: { value: '' },
    })
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('shows required error after blur when empty', async () => {
    render(<TimeBlock block={baseBlock} value="" onChange={vi.fn()} />)

    fireEvent.blur(screen.getByLabelText(/Horário/i))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/obrigatório/i)
      expect(screen.getByLabelText(/Horário/i)).toHaveAttribute(
        'aria-invalid',
        'true',
      )
    })
  })

  it('keeps help aria when optional and untouched', () => {
    render(
      <TimeBlock
        block={{ ...baseBlock, required: false }}
        value=""
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByLabelText(/Horário/i)).toHaveAttribute(
      'aria-describedby',
      'visit_time-help',
    )
    expect(screen.getByText(/Entre 8h e 18h/i)).toBeInTheDocument()
  })
})
