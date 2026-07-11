import { render, screen } from '@testing-library/react'
import { Home } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { SectionTitleWithIcon } from '../section-title-with-icon'

describe('SectionTitleWithIcon', () => {
  it('renders title and optional subtitle', () => {
    render(
      <SectionTitleWithIcon
        title="Meus serviços"
        icon={Home}
        subtitle="Gerencie pedidos abertos"
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Meus serviços' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Gerencie pedidos abertos')).toBeInTheDocument()
  })

  it('omits subtitle when not provided', () => {
    const { container } = render(
      <SectionTitleWithIcon title="Conta" icon={Home} />,
    )

    expect(screen.getByRole('heading', { name: 'Conta' })).toBeInTheDocument()
    expect(container.querySelector('p')).toBeNull()
  })

  it('applies compact sizing class on the heading', () => {
    render(
      <SectionTitleWithIcon title="Compacto" icon={Home} size="compact" />,
    )

    const heading = screen.getByRole('heading', { name: 'Compacto' })
    expect(heading.className).toContain('text-xl')
    expect(heading.className).not.toContain('sm:text-2xl')
  })

  it('uses custom icon gradient class', () => {
    const { container } = render(
      <SectionTitleWithIcon
        title="Gradiente"
        icon={Home}
        iconGradient="from-sky-400 to-indigo-500"
      />,
    )

    expect(container.innerHTML).toContain('from-sky-400 to-indigo-500')
  })
})
