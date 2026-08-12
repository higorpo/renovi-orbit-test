import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Label } from '../label'

describe('Label', () => {
  it('uses medium ink for form labels', () => {
    render(<Label htmlFor="field">Nome completo</Label>)
    const label = screen.getByText('Nome completo')
    expect(label).toHaveClass('font-medium')
    expect(label).toHaveClass('text-ink')
    expect(label).not.toHaveClass('font-semibold')
  })
})
