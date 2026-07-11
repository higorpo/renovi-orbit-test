import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const scrollPrev = vi.fn()
const scrollNext = vi.fn()
const on = vi.fn()
const off = vi.fn()
let canScrollPrevValue = true
let canScrollNextValue = true

vi.mock('embla-carousel-react', () => ({
  default: () => {
    const api = {
      canScrollPrev: () => canScrollPrevValue,
      canScrollNext: () => canScrollNextValue,
      scrollPrev,
      scrollNext,
      on,
      off,
    }
    const ref = vi.fn()
    return [ref, api]
  },
}))

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../carousel'

describe('carousel', () => {
  beforeEach(() => {
    scrollPrev.mockClear()
    scrollNext.mockClear()
    on.mockClear()
    off.mockClear()
    canScrollPrevValue = true
    canScrollNextValue = true
  })

  it('renders slides and navigates with buttons and keys', async () => {
    const setApi = vi.fn()
    render(
      <Carousel setApi={setApi} opts={{ loop: false }}>
        <CarouselContent>
          <CarouselItem>Slide 1</CarouselItem>
          <CarouselItem>Slide 2</CarouselItem>
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>,
    )

    expect(screen.getByText('Slide 1')).toBeInTheDocument()
    expect(screen.getByText('Slide 2')).toBeInTheDocument()
    await waitFor(() => {
      expect(setApi).toHaveBeenCalled()
    })

    fireEvent.click(screen.getByRole('button', { name: /Previous slide/i }))
    expect(scrollPrev).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Next slide/i }))
    expect(scrollNext).toHaveBeenCalled()

    const region = screen.getByRole('region')
    fireEvent.keyDown(region, { key: 'ArrowLeft' })
    expect(scrollPrev).toHaveBeenCalledTimes(2)
    fireEvent.keyDown(region, { key: 'ArrowRight' })
    expect(scrollNext).toHaveBeenCalledTimes(2)
  })

  it('supports vertical orientation', () => {
    render(
      <Carousel orientation="vertical">
        <CarouselContent>
          <CarouselItem>V1</CarouselItem>
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>,
    )

    expect(screen.getByText('V1')).toBeInTheDocument()
  })

  it('ignores unrelated keydowns on the region', () => {
    render(
      <Carousel>
        <CarouselContent>
          <CarouselItem>Only</CarouselItem>
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>,
    )

    fireEvent.keyDown(screen.getByRole('region'), { key: 'Enter' })
    expect(scrollPrev).not.toHaveBeenCalled()
    expect(scrollNext).not.toHaveBeenCalled()
  })

  it('disables navigation when embla reports no scroll room', async () => {
    canScrollPrevValue = false
    canScrollNextValue = false

    render(
      <Carousel>
        <CarouselContent>
          <CarouselItem>Only</CarouselItem>
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Previous slide/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /Next slide/i })).toBeDisabled()
    })
  })

  it('derives vertical orientation from opts.axis when orientation is omitted', () => {
    render(
      <Carousel opts={{ axis: 'y' }}>
        <CarouselContent>
          <CarouselItem>Axis Y</CarouselItem>
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>,
    )

    expect(screen.getByText('Axis Y')).toBeInTheDocument()
  })
})

describe('carousel composition', () => {
  it('rejects carousel children rendered outside the provider', () => {
    expect(() => render(<CarouselContent />)).toThrow(
      'useCarousel must be used within a <Carousel />',
    )
    expect(() => render(<CarouselItem />)).toThrow(
      'useCarousel must be used within a <Carousel />',
    )
  })

  it('forwards custom classes and button variants', () => {
    render(
      <Carousel className="custom-carousel">
        <CarouselContent className="custom-content">
          <CarouselItem className="custom-item">Slide</CarouselItem>
        </CarouselContent>
        <CarouselPrevious className="custom-prev" variant="ghost" />
        <CarouselNext className="custom-next" size="sm" />
      </Carousel>,
    )

    expect(screen.getByRole('region')).toHaveClass('custom-carousel')
    expect(screen.getByText('Slide')).toHaveClass('custom-item')
    expect(screen.getByRole('button', { name: /Previous slide/i })).toHaveClass('custom-prev')
    expect(screen.getByRole('button', { name: /Next slide/i })).toHaveClass('custom-next')
  })
})
