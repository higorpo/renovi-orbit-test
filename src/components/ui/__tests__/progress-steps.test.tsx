import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressSteps, ProgressStepsCompact } from '../progress-steps'

const steps = [
  { number: 1, title: 'Dados', estimatedTime: '1 min' },
  { number: 2, title: 'Endereço', estimatedTime: '2 min' },
  { number: 3, title: 'Confirmar' },
]

describe('ProgressSteps', () => {
  it('marks completed, current, and pending steps', () => {
    render(<ProgressSteps steps={steps} currentStep={2} />)
    expect(screen.getByText('Dados')).toBeInTheDocument()
    expect(screen.getByText('Endereço')).toBeInTheDocument()
    expect(screen.getByText('~2 min')).toBeInTheDocument()
    expect(screen.getByText(/Etapa/)).toHaveTextContent('2')
    expect(screen.getByText(/de 3/)).toBeInTheDocument()
  })
})

describe('ProgressStepsCompact', () => {
  it('shows current step title, estimate, and counter', () => {
    render(<ProgressStepsCompact steps={steps} currentStep={1} />)
    expect(screen.getByText('Dados')).toBeInTheDocument()
    expect(screen.getByText(/(~1 min)/)).toBeInTheDocument()
    expect(screen.getByText('1/3')).toBeInTheDocument()
  })
})
