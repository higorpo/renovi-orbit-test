import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FormBlock } from '../../../types'
import { ImageGalleryBlock } from '../ImageGalleryBlock'

const block: FormBlock = {
  id: 'gallery',
  type: 'image_gallery',
  label: 'Estilos',
  required: true,
  description_ai: 'Gallery',
  helpText: 'Escolha um estilo',
  options: [
    {
      value: 'modern',
      label: 'Moderno',
      image: 'https://cdn.example.com/modern.jpg',
      description: 'Clean look',
      tags: ['clean', 'minimal', 'white', 'extra'],
    },
    {
      value: 'bad',
      label: 'Inválido',
      image: 'ftp://cdn.example.com/bad.jpg',
    },
    {
      value: 'local',
      label: 'Local',
      image: '/assets/local.png',
    },
  ] as never,
  config: { multiSelect: true, columns: 2 },
}

describe('ImageGalleryBlock', () => {
  it('renders labels and help text', () => {
    render(
      <ImageGalleryBlock block={block} value={undefined} onChange={vi.fn()} />,
    )
    expect(screen.getByText('Estilos')).toBeInTheDocument()
    expect(screen.getByText('Escolha um estilo')).toBeInTheDocument()
    expect(screen.getByText('Moderno')).toBeInTheDocument()
  })

  it('skips img for invalid image src and still shows option', () => {
    const { container } = render(
      <ImageGalleryBlock block={block} value={undefined} onChange={vi.fn()} />,
    )
    const imgs = container.querySelectorAll('img')
    const srcs = [...imgs].map((img) => img.getAttribute('src'))
    expect(srcs).toContain('https://cdn.example.com/modern.jpg')
    expect(srcs).toContain('/assets/local.png')
    expect(srcs).not.toContain('ftp://cdn.example.com/bad.jpg')
  })

  it('toggles multi-select values and shows selection count', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <ImageGalleryBlock block={block} value={[]} onChange={onChange} />,
    )

    fireEvent.click(screen.getByText('Moderno'))
    expect(onChange).toHaveBeenCalledWith(['modern'])

    rerender(
      <ImageGalleryBlock block={block} value={['modern']} onChange={onChange} />,
    )
    expect(screen.getByText(/1 estilo selecionado/i)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Local'))
    expect(onChange).toHaveBeenCalledWith(['modern', 'local'])
  })

  it('uses single-select onChange when multiSelect is false', () => {
    const onChange = vi.fn()
    const singleBlock: FormBlock = {
      ...block,
      config: { multiSelect: false },
    }
    render(
      <ImageGalleryBlock
        block={singleBlock}
        value={undefined}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByText('Moderno'))
    expect(onChange).toHaveBeenCalledWith('modern')
  })

  it('shows fallback icon after image error', () => {
    const { container } = render(
      <ImageGalleryBlock block={block} value={undefined} onChange={vi.fn()} />,
    )
    const img = container.querySelector(
      'img[src="https://cdn.example.com/modern.jpg"]',
    )
    expect(img).toBeTruthy()
    fireEvent.error(img!)
    expect(
      container.querySelector('img[src="https://cdn.example.com/modern.jpg"]'),
    ).not.toBeInTheDocument()
  })
})
