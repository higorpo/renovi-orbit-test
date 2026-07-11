import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FormStep } from '../../../types'
import { InspectorStep } from '../InspectorStep'

const step: FormStep = {
  id: 'step-1',
  order: 0,
  title: 'Detalhes',
  icon: '🔧',
  description: 'Descreva o serviço',
  blocks: [],
  visibility: [],
}

describe('InspectorStep', () => {
  it('updates title, icon and description via onUpdate', () => {
    const onUpdate = vi.fn()
    render(
      <InspectorStep
        step={step}
        stepId="step-1"
        fieldIds={['field_a']}
        onUpdate={onUpdate}
      />,
    )

    fireEvent.change(screen.getByDisplayValue('Detalhes'), {
      target: { value: 'Novo título' },
    })
    expect(onUpdate).toHaveBeenCalledWith({ title: 'Novo título' })

    onUpdate.mockClear()
    fireEvent.change(screen.getByDisplayValue('🔧'), {
      target: { value: '📌' },
    })
    expect(onUpdate).toHaveBeenCalledWith({ icon: '📌' })

    onUpdate.mockClear()
    fireEvent.change(screen.getByDisplayValue('Descreva o serviço'), {
      target: { value: 'Nova descrição' },
    })
    expect(onUpdate).toHaveBeenCalledWith({ description: 'Nova descrição' })
  })

  it('renders empty placeholders when optional step fields are missing', () => {
    const onUpdate = vi.fn()
    render(
      <InspectorStep
        step={{ id: 's', order: 0, title: '', blocks: [] }}
        stepId="s"
        fieldIds={[]}
        onUpdate={onUpdate}
      />,
    )

    expect(screen.getByPlaceholderText('Título do step')).toHaveValue('')
    expect(screen.getByPlaceholderText('📌')).toHaveValue('')
    expect(screen.getByPlaceholderText('Descrição opcional')).toHaveValue('')
  })

  it('forwards visibility rule changes to onUpdate', () => {
    const onUpdate = vi.fn()
    render(
      <InspectorStep
        step={step}
        stepId="step-1"
        fieldIds={['field_a']}
        onUpdate={onUpdate}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Adicionar/i }))
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: expect.any(Array),
      }),
    )
  })
})
