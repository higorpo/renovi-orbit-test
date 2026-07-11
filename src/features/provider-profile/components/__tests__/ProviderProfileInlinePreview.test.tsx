import { MemoryRouter } from 'react-router'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProviderProfileInlinePreview } from '../ProviderProfileInlinePreview'

vi.mock('../../hooks/usePublicProfileImageUrl', () => ({
  usePublicProfileImageUrl: vi.fn(() => ({
    url: 'https://cdn.example.com/avatar.jpg',
    isLoading: false,
  })),
}))

describe('ProviderProfileInlinePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders provider name and Ver perfil link when slug is present', () => {
    render(
      <MemoryRouter>
        <ProviderProfileInlinePreview
          providerName="João Silva"
          providerSlug="joao-silva"
          providerProfileImagePath="avatars/1.jpg"
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('João Silva')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Ver perfil/i })
    expect(link).toHaveAttribute('href', '/perfil/joao-silva')
    expect(screen.getByText('JS')).toBeInTheDocument()
  })

  it('hides Ver perfil when slug is null', () => {
    render(
      <MemoryRouter>
        <ProviderProfileInlinePreview
          providerName="Maria"
          providerSlug={null}
          providerProfileImagePath={null}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('Maria')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Ver perfil/i })).not.toBeInTheDocument()
    expect(screen.getByText('M')).toBeInTheDocument()
  })

  it('falls back to PR initials when name is blank', () => {
    render(
      <MemoryRouter>
        <ProviderProfileInlinePreview
          providerName="   "
          providerSlug={null}
          providerProfileImagePath={null}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText('PR')).toBeInTheDocument()
  })
})
