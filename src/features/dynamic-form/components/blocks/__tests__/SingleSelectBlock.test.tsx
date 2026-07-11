import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FormBlock } from '../../../types'
import { SingleSelectBlock } from '../SingleSelectBlock'

const block: FormBlock = {
  id: 'choice',
  type: 'single_select',
  label: 'Escolha',
  required: true,
  description_ai: 'Choice',
  options: [
    { value: 'a', label: 'Opção A' },
    { value: 'outro', label: 'Outro' },
    { value: 'b', label: 'Opção B' },
  ],
  config: { allowOther: true, columns: 3, otherLabel: 'Custom' },
}

describe('SingleSelectBlock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('filters outro option from grid when allowOther is true', () => {
    render(<SingleSelectBlock block={block} value={undefined} onChange={vi.fn()} />)
    expect(screen.queryByRole('radio', { name: /^Outro$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Custom/i })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup')).toHaveClass('grid-cols-3')
  })

  it('selects other and wires other text input', () => {
    const onChange = vi.fn()
    const onOtherTextChange = vi.fn()
    render(
      <SingleSelectBlock
        block={block}
        value="other"
        onChange={onChange}
        otherText="detalhe"
        onOtherTextChange={onOtherTextChange}
      />,
    )
    const otherInput = screen.getByDisplayValue('detalhe')
    fireEvent.change(otherInput, { target: { value: 'novo' } })
    expect(onOtherTextChange).toHaveBeenCalledWith('novo')
  })

  it('calls onChange when an option is selected', () => {
    const onChange = vi.fn()
    render(<SingleSelectBlock block={block} value={undefined} onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: /Opção A/i }))
    expect(onChange).toHaveBeenCalledWith('a')
    act(() => {
      vi.runAllTimers()
    })
  })

  it('shows required error after blur without selection', () => {
    render(<SingleSelectBlock block={block} value={undefined} onChange={vi.fn()} />)
    fireEvent.blur(screen.getByRole('radio', { name: /Opção A/i }))
    act(() => {
      vi.runAllTimers()
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('renders emoji, description, help text and success', () => {
    render(
      <SingleSelectBlock
        block={{
          ...block,
          options: [
            {
              value: 'a',
              label: 'Opção A',
              emoji: '⭐',
              description: 'Detalhe A',
            },
            { value: 'b', label: 'Opção B' },
          ],
          config: { allowOther: false, columns: 1 },
          helpText: 'Ajuda single',
        }}
        value="a"
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('⭐')).toBeInTheDocument()
    expect(screen.getByText('Detalhe A')).toBeInTheDocument()
    expect(screen.getByText('Ajuda single')).toBeInTheDocument()
    expect(screen.getByRole('radiogroup')).toHaveClass('grid-cols-1')
    fireEvent.blur(screen.getByRole('radio', { name: /Opção A/i }))
    act(() => {
      vi.runAllTimers()
    })
    expect(screen.getByText(/Seleção válida/i)).toBeInTheDocument()
  })

  it('uses default Outro label when otherLabel is unset', () => {
    render(
      <SingleSelectBlock
        block={{
          ...block,
          config: { allowOther: true, columns: 4 },
          options: [{ value: 'a', label: 'A' }],
        }}
        value={undefined}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('radio', { name: /^Outro$/i })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup')).toHaveClass('grid-cols-4')
  })

  it('selects other option via Outro button', () => {
    const onChange = vi.fn()
    render(<SingleSelectBlock block={block} value={undefined} onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: /Custom/i }))
    expect(onChange).toHaveBeenCalledWith('other')
  })
})

describe('SingleSelectBlock additional branches', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('filters other values and labels when allowOther is enabled', () => {
    render(
      <SingleSelectBlock
        block={{
          ...block,
          options: [
            { value: 'other', label: 'English other' },
            { value: 'outro', label: 'Portuguese value' },
            { value: 'custom', label: 'Outro' },
            { value: 'a', label: 'A' },
          ],
        }}
        value={undefined}
        onChange={vi.fn()}
      />,
    )

    expect(screen.queryByText('English other')).not.toBeInTheDocument()
    expect(screen.queryByText('Portuguese value')).not.toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(2)
  })

  it('styles the unselected other option as invalid', () => {
    render(<SingleSelectBlock block={block} value={undefined} onChange={vi.fn()} />)
    const other = screen.getByRole('radio', { name: /Custom/i })

    fireEvent.blur(screen.getByRole('radio', { name: /Opção A/i }))
    act(() => {
      vi.runAllTimers()
    })

    expect(other).toHaveClass('border-destructive/30')
  })

  it('hides help text and references the error when invalid', () => {
    render(
      <SingleSelectBlock
        block={{ ...block, helpText: 'Choose one option' }}
        value={undefined}
        onChange={vi.fn()}
      />,
    )
    const group = screen.getByRole('radiogroup')
    expect(group).toHaveAttribute('aria-describedby', 'choice-help')

    fireEvent.blur(screen.getByRole('radio', { name: /Opção A/i }))
    act(() => {
      vi.runAllTimers()
    })

    expect(screen.queryByText('Choose one option')).not.toBeInTheDocument()
    expect(group).toHaveAttribute('aria-describedby', 'choice-error')
  })

  it('does not show success for an empty value after blur', () => {
    render(<SingleSelectBlock block={block} value="" onChange={vi.fn()} />)

    fireEvent.blur(screen.getByRole('radio', { name: /Opção A/i }))
    act(() => {
      vi.runAllTimers()
    })

    expect(screen.queryByText(/Seleção válida/i)).not.toBeInTheDocument()
  })

  it('safely edits other text without a callback', () => {
    render(
      <SingleSelectBlock block={block} value="other" onChange={vi.fn()} />,
    )

    expect(() =>
      fireEvent.change(screen.getByLabelText(/Descreva a opção outro/i), {
        target: { value: 'detail' },
      }),
    ).not.toThrow()
  })

  it('renders without a label and defaults to two columns', () => {
    render(
      <SingleSelectBlock
        block={{
          ...block,
          label: '',
          config: { allowOther: false },
          options: [{ value: 'a', label: 'A' }],
        }}
        value={undefined}
        onChange={vi.fn()}
      />,
    )

    expect(screen.queryByText('Escolha')).not.toBeInTheDocument()
    expect(screen.getByRole('radiogroup')).toHaveClass('grid-cols-2')
  })

  it('treats empty options as an empty list', () => {
    render(
      <SingleSelectBlock
        block={{
          ...block,
          options: undefined,
          config: { allowOther: false },
        }}
        value={undefined}
        onChange={vi.fn()}
      />,
    )

    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })
})
