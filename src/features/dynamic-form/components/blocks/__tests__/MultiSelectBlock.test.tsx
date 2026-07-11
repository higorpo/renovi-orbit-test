import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FormBlock } from '../../../types'
import { MultiSelectBlock } from '../MultiSelectBlock'

const block: FormBlock = {
  id: 'multi',
  type: 'multi_select',
  label: 'Opções',
  required: true,
  description_ai: 'Multi',
  options: [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
    { value: 'none', label: 'Nenhuma', exclusive: true },
    { value: 'other', label: 'Outro' },
  ],
  config: { allowOther: true, columns: 2 },
}

describe('MultiSelectBlock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('toggles options into the selection array', () => {
    const onChange = vi.fn()
    render(<MultiSelectBlock block={block} value={[]} onChange={onChange} />)

    fireEvent.click(screen.getByRole('checkbox', { name: /^A$/i }))
    expect(onChange).toHaveBeenCalledWith(['a'])
  })

  it('replaces selection when exclusive option is chosen', () => {
    const onChange = vi.fn()
    render(
      <MultiSelectBlock block={block} value={['a', 'b']} onChange={onChange} />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: /Nenhuma/i }))
    expect(onChange).toHaveBeenCalledWith(['none'])
  })

  it('clears exclusive values when selecting a non-exclusive option', () => {
    const onChange = vi.fn()
    render(
      <MultiSelectBlock block={block} value={['none']} onChange={onChange} />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: /^B$/i }))
    expect(onChange).toHaveBeenCalledWith(['b'])
  })

  it('deselects an already selected non-exclusive option', () => {
    const onChange = vi.fn()
    render(
      <MultiSelectBlock block={block} value={['a', 'b']} onChange={onChange} />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: /^A$/i }))
    expect(onChange).toHaveBeenCalledWith(['b'])
  })

  it('shows other text input when other is selected', () => {
    const onOtherTextChange = vi.fn()
    render(
      <MultiSelectBlock
        block={block}
        value={['other']}
        onChange={vi.fn()}
        otherText="detalhe"
        onOtherTextChange={onOtherTextChange}
      />,
    )

    const otherInput = screen.getByDisplayValue('detalhe')
    fireEvent.change(otherInput, { target: { value: 'novo' } })
    expect(onOtherTextChange).toHaveBeenCalledWith('novo')
  })

  it('marks as touched after toggle via deferred timer', () => {
    const onChange = vi.fn()
    render(<MultiSelectBlock block={block} value={[]} onChange={onChange} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /^A$/i }))
    act(() => {
      vi.runAllTimers()
    })
    expect(onChange).toHaveBeenCalled()
  })

  it('renders emoji, description and exclusive hint', () => {
    render(
      <MultiSelectBlock
        block={{
          ...block,
          options: [
            {
              value: 'a',
              label: 'A',
              emoji: '🔥',
              description: 'Desc A',
            },
            { value: 'none', label: 'Nenhuma', exclusive: true },
          ],
          config: { columns: 4 },
          helpText: 'Ajuda multi',
        }}
        value={['a']}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('🔥')).toBeInTheDocument()
    expect(screen.getByText('Desc A')).toBeInTheDocument()
    expect(screen.getByText(/seleção exclusiva/i)).toBeInTheDocument()
    expect(screen.getByText('Ajuda multi')).toBeInTheDocument()
    expect(screen.getByRole('group')).toHaveClass('grid-cols-4')
  })

  it('keeps raw options when allowOther is false', () => {
    render(
      <MultiSelectBlock
        block={{
          ...block,
          config: { allowOther: false, columns: 1 },
          options: [
            { value: 'other', label: 'Outro' },
            { value: 'a', label: 'A' },
          ],
        }}
        value={[]}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('checkbox', { name: /^Outro$/i })).toBeInTheDocument()
    expect(screen.getByRole('group')).toHaveClass('grid-cols-1')
  })

  it('shows success message after valid selection is touched', () => {
    render(
      <MultiSelectBlock block={block} value={['a']} onChange={vi.fn()} />,
    )
    fireEvent.blur(screen.getByRole('checkbox', { name: /^A$/i }))
    act(() => {
      vi.runAllTimers()
    })
    expect(screen.getByText(/opção\(ões\) selecionada\(s\)/i)).toBeInTheDocument()
  })

  it('shows required error after blur with empty selection', () => {
    render(<MultiSelectBlock block={block} value={[]} onChange={vi.fn()} />)
    fireEvent.blur(screen.getByRole('checkbox', { name: /^A$/i }))
    act(() => {
      vi.runAllTimers()
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

describe('MultiSelectBlock additional branches', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('filters other values and labels when allowOther is enabled', () => {
    render(
      <MultiSelectBlock
        block={{
          ...block,
          options: [
            { value: 'other', label: 'English other' },
            { value: 'outro', label: 'Portuguese value' },
            { value: 'custom', label: 'Outro' },
            { value: 'a', label: 'A' },
          ],
        }}
        value={[]}
        onChange={vi.fn()}
      />,
    )

    expect(screen.queryByText('English other')).not.toBeInTheDocument()
    expect(screen.queryByText('Portuguese value')).not.toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  })

  it('uses a three-column grid', () => {
    render(
      <MultiSelectBlock
        block={{ ...block, config: { allowOther: true, columns: 3 } }}
        value={[]}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('group')).toHaveClass('grid-cols-3')
  })

  it('deselects a selected option', () => {
    const onChange = vi.fn()
    render(<MultiSelectBlock block={block} value={['b']} onChange={onChange} />)

    fireEvent.click(screen.getByRole('checkbox', { name: /^B$/i }))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('deselects the other option', () => {
    const onChange = vi.fn()
    render(
      <MultiSelectBlock block={block} value={['other']} onChange={onChange} />,
    )

    const otherCheckbox = screen
      .getAllByRole('checkbox')
      .find(
        (el) =>
          el.textContent?.includes('Outro') &&
          el.getAttribute('aria-checked') === 'true',
      )
    expect(otherCheckbox).toBeTruthy()
    fireEvent.click(otherCheckbox!)

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('styles unselected options as invalid after touch', () => {
    render(<MultiSelectBlock block={block} value={[]} onChange={vi.fn()} />)
    const option = screen.getByRole('checkbox', { name: /^A$/i })

    fireEvent.blur(option)
    act(() => {
      vi.runAllTimers()
    })

    expect(option).toHaveClass('border-destructive/30')
  })

  it('hides help text when touched and invalid', () => {
    render(
      <MultiSelectBlock
        block={{ ...block, helpText: 'Choose at least one' }}
        value={[]}
        onChange={vi.fn()}
      />,
    )

    fireEvent.blur(screen.getByRole('checkbox', { name: /^A$/i }))
    act(() => {
      vi.runAllTimers()
    })

    expect(screen.queryByText('Choose at least one')).not.toBeInTheDocument()
  })

  it('safely edits other text without a callback', () => {
    render(
      <MultiSelectBlock
        block={block}
        value={['other']}
        onChange={vi.fn()}
      />,
    )

    expect(() =>
      fireEvent.change(screen.getByLabelText(/Descreva a opção outro/i), {
        target: { value: 'detail' },
      }),
    ).not.toThrow()
  })

  it('renders without a label and defaults to two columns', () => {
    render(
      <MultiSelectBlock
        block={{
          ...block,
          label: '',
          config: { allowOther: false },
          options: [{ value: 'a', label: 'A' }],
        }}
        value={[]}
        onChange={vi.fn()}
      />,
    )

    expect(screen.queryByText('Opções')).not.toBeInTheDocument()
    expect(screen.getByRole('group')).toHaveClass('grid-cols-2')
  })

  it('uses custom otherLabel when allowOther is enabled', () => {
    render(
      <MultiSelectBlock
        block={{
          ...block,
          config: { allowOther: true, otherLabel: 'Custom other' },
        }}
        value={[]}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('checkbox', { name: /Custom other/i })).toBeInTheDocument()
  })

  it('selects the other option from the dashed control', () => {
    const onChange = vi.fn()
    render(<MultiSelectBlock block={block} value={[]} onChange={onChange} />)

    fireEvent.click(screen.getByRole('checkbox', { name: /Outro/i }))
    expect(onChange).toHaveBeenCalledWith(['other'])
  })
})
