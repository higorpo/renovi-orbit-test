import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FormBlock } from '../../../types'
import { SliderBlock } from '../SliderBlock'

describe('SliderBlock', () => {
  it('defaults to min when value is undefined', () => {
    render(
      <SliderBlock
        block={{
          id: 's',
          type: 'slider',
          label: 'Nível',
          description_ai: 'S',
          min: 2,
          max: 8,
        }}
        value={undefined}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByLabelText(/Nível/i)).toHaveValue('2')
  })

  it('calls onChange with parsed float and shows unit', () => {
    const onChange = vi.fn()
    render(
      <SliderBlock
        block={{
          id: 's',
          type: 'slider',
          label: 'Nível',
          description_ai: 'S',
          min: 0,
          max: 100,
          unit: '%',
        }}
        value={10}
        onChange={onChange}
      />,
    )
    expect(screen.getByText('10 %')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Nível/i), { target: { value: '42' } })
    expect(onChange).toHaveBeenCalledWith(42)
  })
})

describe('SliderBlock validation states', () => {
  it('shows required metadata, help text, and default range values', () => {
    render(
      <SliderBlock
        block={{
          id: 'required-slider',
          type: 'slider',
          label: 'Intensity',
          description_ai: 'Choose intensity',
          required: true,
          helpText: 'Move the slider',
        }}
        value={undefined}
        onChange={vi.fn()}
      />,
    )

    const slider = screen.getByLabelText(/Intensity/i)
    expect(slider).toHaveAttribute('min', '0')
    expect(slider).toHaveAttribute('max', '100')
    expect(slider).toHaveAttribute('step', '1')
    expect(slider).toHaveAttribute('aria-required', 'true')
    expect(slider).toHaveAttribute('aria-describedby', 'required-slider-help')
    expect(screen.getByText('Move the slider')).toBeInTheDocument()
    expect(screen.getByLabelText('obrigatório')).toBeInTheDocument()
  })

  it('shows a success message after a defined value is touched', () => {
    render(
      <SliderBlock
        block={{
          id: 'valid-slider',
          type: 'slider',
          description_ai: 'Choose',
          min: 1,
          max: 5,
          step: 0.5,
          unit: 'kg',
        }}
        value={2.5}
        onChange={vi.fn()}
      />,
    )

    const slider = screen.getByRole('slider')
    fireEvent.blur(slider)
    expect(screen.getByText('Valor selecionado: 2.5 kg')).toBeInTheDocument()
    expect(slider).not.toHaveAttribute('aria-describedby')
  })

  it('shows the validation message after an empty required value is touched', async () => {
    vi.useFakeTimers()
    render(
      <SliderBlock
        block={{
          id: 'invalid-slider',
          type: 'slider',
          label: 'Amount',
          description_ai: 'Choose',
          required: true,
          validation: { message: 'Choose an amount' },
        }}
        value={undefined}
        onChange={vi.fn()}
      />,
    )

    const slider = screen.getByRole('slider')
    fireEvent.blur(slider)
    await vi.runAllTimersAsync()

    expect(screen.getByRole('alert')).toHaveTextContent('Choose an amount')
    expect(slider).toHaveAttribute('aria-invalid', 'true')
    expect(slider).toHaveAttribute('aria-describedby', 'invalid-slider-error')
    expect(slider).toHaveClass('accent-destructive')
    vi.useRealTimers()
  })
})
