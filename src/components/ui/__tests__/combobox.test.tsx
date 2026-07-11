import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Combobox } from '../combobox'

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma', disabled: true },
]

function getTrigger() {
  return screen.getAllByRole('combobox').find((el) => el.tagName === 'BUTTON')!
}

describe('combobox', () => {
  it('shows placeholder and selects a single value', async () => {
    const onSelect = vi.fn()
    render(
      <Combobox
        options={options}
        selectedValues={[]}
        onSelect={onSelect}
        placeholder="Escolha"
      />,
    )

    expect(getTrigger()).toHaveTextContent('Escolha')
    fireEvent.click(getTrigger())
    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Alpha'))
    expect(onSelect).toHaveBeenCalledWith('a')
  })

  it('shows selected label for single mode', () => {
    render(
      <Combobox
        options={options}
        selectedValues={['b']}
        onSelect={vi.fn()}
      />,
    )
    expect(getTrigger()).toHaveTextContent('Beta')
  })

  it('supports multi select and deselect', async () => {
    const onSelect = vi.fn()
    const onDeselect = vi.fn()
    render(
      <Combobox
        options={options}
        selectedValues={['a']}
        onSelect={onSelect}
        onDeselect={onDeselect}
        multiple
      />,
    )

    expect(getTrigger()).toHaveTextContent('1 selecionado(s)')
    fireEvent.click(getTrigger())
    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Alpha'))
    expect(onDeselect).toHaveBeenCalledWith('a')

    onSelect.mockClear()
    fireEvent.click(screen.getByText('Beta'))
    expect(onSelect).toHaveBeenCalledWith('b')
  })

  it('does not select disabled options', async () => {
    const onSelect = vi.fn()
    render(
      <Combobox options={options} selectedValues={[]} onSelect={onSelect} />,
    )
    fireEvent.click(getTrigger())
    await waitFor(() => {
      expect(screen.getByText('Gamma')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Gamma'))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('shows empty multi placeholder when nothing selected', () => {
    render(
      <Combobox
        options={options}
        selectedValues={[]}
        onSelect={vi.fn()}
        multiple
      />,
    )
    expect(getTrigger()).toHaveTextContent('Selecione...')
  })

  it('disables the trigger when disabled is set', () => {
    render(
      <Combobox
        options={options}
        selectedValues={[]}
        onSelect={vi.fn()}
        disabled
      />,
    )
    expect(getTrigger()).toBeDisabled()
  })

  it('shows custom empty message when search has no matches', async () => {
    render(
      <Combobox
        options={options}
        selectedValues={[]}
        onSelect={vi.fn()}
        emptyMessage="Nada aqui"
        searchPlaceholder="Filtrar"
      />,
    )
    fireEvent.click(getTrigger())
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Filtrar')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByPlaceholderText('Filtrar'), {
      target: { value: 'zzzz-no-match' },
    })
    expect(await screen.findByText('Nada aqui')).toBeInTheDocument()
  })
})
