import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SkeletonCard } from '../skeleton-card'
import { SkeletonList, SkeletonStats } from '../skeleton-stats'

describe('SkeletonCard', () => {
  it('renders default three body lines', () => {
    const { container } = render(<SkeletonCard />)
    // Title skeleton + 3 body lines
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4)
  })

  it('respects custom lines count and className', () => {
    const { container } = render(<SkeletonCard lines={1} className="extra" />)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(2)
    expect(container.firstChild).toHaveClass('extra')
  })
})

describe('SkeletonStats', () => {
  it('renders default four stat cards', () => {
    const { container } = render(<SkeletonStats />)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(8)
  })

  it('renders requested count', () => {
    const { container } = render(<SkeletonStats count={2} />)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4)
  })
})

describe('SkeletonList', () => {
  it('renders default three list rows', () => {
    const { container } = render(<SkeletonList />)
    // 3 rows × (avatar + 2 text skeletons)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(9)
  })

  it('renders requested row count', () => {
    const { container } = render(<SkeletonList count={1} />)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3)
  })
})
