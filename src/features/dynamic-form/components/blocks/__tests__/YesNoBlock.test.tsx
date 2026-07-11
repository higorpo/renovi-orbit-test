import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FormBlock } from '../../../types'
import { YesNoBlock } from '../YesNoBlock'

const block: FormBlock = {
  id: 'yn',
  type: 'yes_no',
  label: 'Confirma?',
  required: true,
  description_ai: 'Yes no',
  helpText: 'Escolha uma opção',
}

describe('YesNoBlock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders help text above the options', () => {
    render(<YesNoBlock block={block} value={undefined} onChange={vi.fn()} />)
    expect(screen.getByText(/Escolha uma opção/i)).toBeInTheDocument()
  })

  it('calls onChange(false) when Não is selected', () => {
    const onChange = vi.fn()
    render(<YesNoBlock block={block} value={undefined} onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: /^Não$/i }))
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('shows required error after blur without selection', () => {
    render(<YesNoBlock block={block} value={undefined} onChange={vi.fn()} />)
    fireEvent.blur(screen.getByRole('radio', { name: /^Sim$/i }))
    act(() => {
      vi.runAllTimers()
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows success state when a value is selected and touched', () => {
    render(<YesNoBlock block={block} value={true} onChange={vi.fn()} />)
    fireEvent.blur(screen.getByRole('radio', { name: /^Sim$/i }))
    act(() => {
      vi.runAllTimers()
    })
    expect(screen.getByText(/Seleção válida/i)).toBeInTheDocument()
  })
})
