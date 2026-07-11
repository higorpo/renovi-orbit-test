import { fireEvent, render, screen } from '@testing-library/react'
import { Inbox } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { EmptyState } from '../empty-state'

describe('EmptyState', () => {
  it('renders title, description, and optional action', () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Vazio"
        description="Nada por aqui"
        ariaLabel="lista vazia"
        action={<button type="button">Criar</button>}
      />,
    )
    expect(screen.getByRole('status', { name: /lista vazia/i })).toBeInTheDocument()
    expect(screen.getByText('Vazio')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Criar/i })).toBeInTheDocument()
  })

  it('calls onClearFilters when clear button is clicked', () => {
    const onClearFilters = vi.fn()
    render(
      <EmptyState
        icon={Inbox}
        title="Vazio"
        description="Filtrado"
        onClearFilters={onClearFilters}
        clearFiltersLabel="Limpar tudo"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Limpar tudo/i }))
    expect(onClearFilters).toHaveBeenCalledTimes(1)
  })
})
