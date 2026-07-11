import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LoadMoreButton } from '../load-more-button'

describe('LoadMoreButton', () => {
  it('calls onLoadMore when clicked', () => {
    const onLoadMore = vi.fn()
    render(<LoadMoreButton onLoadMore={onLoadMore} isLoading={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Carregar mais/i }))
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('disables and shows loading label while isLoading', () => {
    render(<LoadMoreButton onLoadMore={vi.fn()} isLoading />)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent(/Carregando/i)
  })
})
