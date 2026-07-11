import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FormBlock } from '../../../types'
import { NumberInputBlock } from '../NumberInputBlock'

const block: FormBlock = {
  id: 'qty',
  type: 'number',
  label: 'Quantidade',
  description_ai: 'Qty',
  min: 5,
  max: 10,
  unit: 'm²',
  step: 1,
}

describe('NumberInputBlock', () => {
  it('disables decrement at min and does not call onChange below min', () => {
    const onChange = vi.fn()
    render(<NumberInputBlock block={block} value={5} onChange={onChange} />)
    const dec = screen.getByRole('button', { name: /diminuir valor/i })
    expect(dec).toBeDisabled()
    fireEvent.click(dec)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disables increment at max and does not call onChange above max', () => {
    const onChange = vi.fn()
    render(<NumberInputBlock block={block} value={10} onChange={onChange} />)
    const inc = screen.getByRole('button', { name: /aumentar valor/i })
    expect(inc).toBeDisabled()
    fireEvent.click(inc)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('increments and decrements within range', () => {
    const onChange = vi.fn()
    render(<NumberInputBlock block={block} value={7} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /aumentar valor/i }))
    expect(onChange).toHaveBeenCalledWith(8)
    onChange.mockClear()
    fireEvent.click(screen.getByRole('button', { name: /diminuir valor/i }))
    expect(onChange).toHaveBeenCalledWith(6)
  })

  it('maps empty or dash input to 0', () => {
    const onChange = vi.fn()
    render(<NumberInputBlock block={block} value={7} onChange={onChange} />)
    const input = screen.getByLabelText(/Quantidade/i)
    fireEvent.change(input, { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith(0)
    onChange.mockClear()
    fireEvent.change(input, { target: { value: '-' } })
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('shows range hint with unit when min and max are set', () => {
    render(<NumberInputBlock block={block} value={7} onChange={vi.fn()} />)
    expect(screen.getByText(/Entre 5 e 10 m²/i)).toBeInTheDocument()
  })

  it('shows min-only hint when max is unset', () => {
    render(
      <NumberInputBlock
        block={{ ...block, max: undefined, unit: 'un' }}
        value={6}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText(/Mínimo: 5 un/i)).toBeInTheDocument()
  })

  it('shows max-only hint when min is unset', () => {
    render(
      <NumberInputBlock
        block={{ ...block, min: undefined, unit: 'kg' }}
        value={6}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText(/Máximo: 10 kg/i)).toBeInTheDocument()
  })

  it('parses decimal numeric strings', () => {
    const onChange = vi.fn()
    render(<NumberInputBlock block={block} value={7} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/Quantidade/i), {
      target: { value: '8.5' },
    })
    expect(onChange).toHaveBeenCalledWith(8.5)
  })

  it('shows required asterisk and help text', () => {
    render(
      <NumberInputBlock
        block={{
          ...block,
          required: true,
          helpText: 'Ajuda qty',
          min: undefined,
          max: undefined,
          unit: undefined,
        }}
        value={undefined}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('obrigatório')).toBeInTheDocument()
    expect(screen.getByText('Ajuda qty')).toBeInTheDocument()
  })

  it('increments from undefined using default step', () => {
    const onChange = vi.fn()
    render(
      <NumberInputBlock
        block={{ ...block, min: undefined, max: undefined, step: undefined }}
        value={undefined}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /aumentar valor/i }))
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('shows success state after blur with valid value', () => {
    render(<NumberInputBlock block={block} value={7} onChange={vi.fn()} />)
    fireEvent.blur(screen.getByLabelText(/Quantidade/i))
    expect(screen.getByLabelText(/Quantidade/i)).toHaveAttribute(
      'aria-invalid',
      'false',
    )
  })

  it('shows error after blur when value is below min', async () => {
    render(
      <NumberInputBlock
        block={{ ...block, required: true, helpText: 'hidden when error' }}
        value={1}
        onChange={vi.fn()}
      />,
    )
    fireEvent.blur(screen.getByLabelText(/Quantidade/i))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('hidden when error')).not.toBeInTheDocument()
  })

  it('shows unit beside input when untouched', () => {
    render(
      <NumberInputBlock
        block={{ ...block, min: undefined, max: undefined }}
        value={3}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('m²')).toBeInTheDocument()
  })

  it('decrements from undefined without min', () => {
    const onChange = vi.fn()
    render(
      <NumberInputBlock
        block={{ ...block, min: undefined, max: undefined }}
        value={undefined}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /diminuir valor/i }))
    expect(onChange).toHaveBeenCalledWith(-1)
  })
})

describe('NumberInputBlock non-numeric input', () => {
  it('does not call onChange for an unparsable value', () => {
    const onChange = vi.fn()
    render(<NumberInputBlock block={block} value={7} onChange={onChange} />)
    const input = screen.getByLabelText(/Quantidade/i)
    input.setAttribute('type', 'text')

    fireEvent.change(input, { target: { value: 'abc' } })

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('NumberInputBlock additional branches', () => {
  it('shows an alert for a touched invalid value', async () => {
    render(<NumberInputBlock block={block} value={4} onChange={vi.fn()} />)

    fireEvent.blur(screen.getByLabelText(/Quantidade/i))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('renders without a label', () => {
    render(
      <NumberInputBlock
        block={{ ...block, label: '' }}
        value={7}
        onChange={vi.fn()}
      />,
    )

    expect(screen.queryByText('Quantidade')).not.toBeInTheDocument()
  })

  it('hides the standalone unit after valid input is touched', async () => {
    render(<NumberInputBlock block={block} value={7} onChange={vi.fn()} />)
    expect(screen.getByText('m²')).toBeInTheDocument()

    fireEvent.blur(screen.getByLabelText(/Quantidade/i))

    await screen.findByLabelText(/Quantidade/i)
    expect(screen.queryByText('m²')).not.toBeInTheDocument()
  })

  it('hides the range hint while showing an error', async () => {
    render(<NumberInputBlock block={block} value={4} onChange={vi.fn()} />)

    fireEvent.blur(screen.getByLabelText(/Quantidade/i))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText(/Entre 5 e 10/i)).not.toBeInTheDocument()
  })

  it('uses help and error descriptions according to validation state', async () => {
    const helpBlock = { ...block, helpText: 'Helpful quantity guidance' }
    const { rerender } = render(
      <NumberInputBlock block={helpBlock} value={7} onChange={vi.fn()} />,
    )
    const input = screen.getByLabelText(/Quantidade/i)
    expect(input).toHaveAttribute('aria-describedby', 'qty-help')

    rerender(<NumberInputBlock block={helpBlock} value={4} onChange={vi.fn()} />)
    fireEvent.blur(screen.getByLabelText(/Quantidade/i))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByLabelText(/Quantidade/i)).toHaveAttribute(
      'aria-describedby',
      'qty-error',
    )
  })

  it('disables decrement when value is undefined and min is zero', () => {
    render(
      <NumberInputBlock
        block={{ ...block, min: 0 }}
        value={undefined}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /diminuir valor/i })).toBeDisabled()
  })

  it('shows range hint without unit when unit is unset', () => {
    render(
      <NumberInputBlock
        block={{ ...block, unit: undefined }}
        value={7}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText(/Entre 5 e 10$/i)).toBeInTheDocument()
  })

  it('shows min-only hint without unit', () => {
    render(
      <NumberInputBlock
        block={{ ...block, max: undefined, unit: undefined }}
        value={6}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText(/^Mínimo: 5$/i)).toBeInTheDocument()
  })

  it('shows max-only hint without unit', () => {
    render(
      <NumberInputBlock
        block={{ ...block, min: undefined, unit: undefined }}
        value={6}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText(/^Máximo: 10$/i)).toBeInTheDocument()
  })

  it('uses placeholder when provided', () => {
    render(
      <NumberInputBlock
        block={{ ...block, placeholder: 'Informe' }}
        value={undefined}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByPlaceholderText('Informe')).toBeInTheDocument()
  })
})
