import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FormBlock } from '../../../types'
import { CheckboxBlock } from '../CheckboxBlock'

const block: FormBlock = {
  id: 'c',
  type: 'checkbox',
  label: 'Itens',
  required: true,
  description_ai: 'C',
  options: [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
    { value: 'none', label: 'Nenhuma', exclusive: true },
  ],
}

describe('CheckboxBlock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('toggles options into the selection array', () => {
    const onChange = vi.fn()
    render(<CheckboxBlock block={block} value={[]} onChange={onChange} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /^A$/i }))
    expect(onChange).toHaveBeenCalledWith(['a'])
  })

  it('replaces selection when exclusive option is chosen', () => {
    const onChange = vi.fn()
    render(
      <CheckboxBlock block={block} value={['a', 'b']} onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: /Nenhuma/i }))
    expect(onChange).toHaveBeenCalledWith(['none'])
  })

  it('deselects an already selected option', () => {
    const onChange = vi.fn()
    render(
      <CheckboxBlock block={block} value={['a', 'b']} onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: /^A$/i }))
    expect(onChange).toHaveBeenCalledWith(['b'])
  })

  it('shows required error after blur with empty selection', () => {
    render(<CheckboxBlock block={block} value={[]} onChange={vi.fn()} />)
    fireEvent.blur(screen.getByRole('checkbox', { name: /^A$/i }))
    act(() => {
      vi.runAllTimers()
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
