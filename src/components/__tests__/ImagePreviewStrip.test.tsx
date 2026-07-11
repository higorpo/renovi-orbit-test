import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ImagePreviewStrip } from '../ImagePreviewStrip'

describe('ImagePreviewStrip', () => {
  it('renders nothing when urls are empty and not loading', () => {
    const { container } = render(<ImagePreviewStrip urls={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows loading pulse with loading aria-label', () => {
    render(<ImagePreviewStrip urls={[]} isLoading />)
    expect(screen.getByRole('list', { name: /Carregando fotos/i })).toBeInTheDocument()
  })

  it('shows count aria-label and caps visible thumbs with +N badge', () => {
    render(
      <ImagePreviewStrip
        urls={['/a.jpg', '/b.jpg', '/c.jpg', '/d.jpg', '/e.jpg']}
      />,
    )

    expect(
      screen.getByRole('list', { name: /5 foto\(s\) anexada\(s\)/i }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Mais 2 foto\(s\)/i)).toHaveTextContent('+2')
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('renders muted placeholder for empty url strings', () => {
    const { container } = render(<ImagePreviewStrip urls={['']} />)
    expect(container.querySelector('img')).not.toBeInTheDocument()
    expect(screen.getByRole('listitem')).toBeInTheDocument()
  })

  it('hides broken images on error', () => {
    render(<ImagePreviewStrip urls={['/broken.jpg']} />)
    const img = screen.getByRole('listitem').querySelector('img')
    expect(img).toBeTruthy()
    fireEvent.error(img!)
    expect(img!.style.display).toBe('none')
  })
})
