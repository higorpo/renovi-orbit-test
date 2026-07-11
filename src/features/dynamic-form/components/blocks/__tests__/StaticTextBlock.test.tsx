import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { FormBlock } from '../../../types'
import { StaticTextBlock } from '../StaticTextBlock'

describe('StaticTextBlock', () => {
  it('renders h2 variant with expected classes', () => {
    const block: FormBlock = {
      id: 'st',
      type: 'static_text',
      label: 'Título',
      description_ai: 'Static',
      config: { variant: 'h2' },
    }
    const { container } = render(<StaticTextBlock block={block} />)
    const heading = container.querySelector('h2')
    expect(heading).toHaveTextContent('Título')
    expect(heading).toHaveClass('text-xl', 'font-semibold')
  })

  it('falls back to paragraph for invalid variant', () => {
    const block: FormBlock = {
      id: 'st',
      type: 'static_text',
      label: 'Body',
      description_ai: 'Static',
      config: { variant: 'div' },
    }
    const { container } = render(<StaticTextBlock block={block} />)
    expect(container.querySelector('p')).toHaveTextContent('Body')
  })

  it('applies destructive color class', () => {
    const block: FormBlock = {
      id: 'st',
      type: 'static_text',
      label: 'Atenção',
      description_ai: 'Static',
      config: { color: 'destructive' },
    }
    render(<StaticTextBlock block={block} />)
    expect(screen.getByText('Atenção')).toHaveClass('text-destructive')
  })

  it('renders helpText without a label', () => {
    const block: FormBlock = {
      id: 'st',
      type: 'static_text',
      label: '',
      description_ai: 'Static',
      helpText: 'Somente ajuda',
    }
    render(<StaticTextBlock block={block} />)
    expect(screen.getByText('Somente ajuda')).toBeInTheDocument()
  })
})
