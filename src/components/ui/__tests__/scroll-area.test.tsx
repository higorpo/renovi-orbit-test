import type { HTMLAttributes } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@radix-ui/react-scroll-area', () => {
  const Root = ({
    children,
    className,
    ...props
  }: HTMLAttributes<HTMLDivElement>) => (
    <div className={className} {...props}>
      {children}
    </div>
  )
  const Viewport = ({
    children,
    className,
  }: HTMLAttributes<HTMLDivElement>) => (
    <div className={className}>{children}</div>
  )
  const ScrollAreaScrollbar = ({
    children,
    className,
    orientation,
    ...props
  }: HTMLAttributes<HTMLDivElement> & { orientation?: string }) => (
    <div data-orientation={orientation} className={className} {...props}>
      {children}
    </div>
  )
  const ScrollAreaThumb = ({ className }: { className?: string }) => (
    <div className={className} />
  )
  const Corner = () => <div data-testid="scroll-corner" />
  return {
    Root,
    Viewport,
    ScrollAreaScrollbar,
    ScrollAreaThumb,
    Corner,
  }
})

import { ScrollArea, ScrollBar } from '../scroll-area'

describe('scroll-area', () => {
  it('renders children inside the viewport', () => {
    const { container } = render(
      <ScrollArea className="h-24 w-24">
        <div>Conteúdo longo</div>
      </ScrollArea>,
    )

    expect(screen.getByText('Conteúdo longo')).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('relative', 'overflow-hidden')
  })

  it('applies horizontal scrollbar orientation classes', () => {
    const { container } = render(<ScrollBar orientation="horizontal" />)
    const bar = container.querySelector('[data-orientation="horizontal"]')
    expect(bar?.className).toContain('h-2.5')
    expect(bar?.className).toContain('flex-col')
  })

  it('defaults ScrollBar orientation to vertical', () => {
    const { container } = render(<ScrollBar />)
    const bar = container.querySelector('[data-orientation="vertical"]')
    expect(bar?.className).toContain('h-full')
    expect(bar?.className).toContain('w-2.5')
  })
})
