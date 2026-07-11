import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FormBlock, FormSchema } from '../../../types'
import { PreviewSummaryBlock } from '../PreviewSummaryBlock'

const schema: FormSchema = {
  version: '2.0',
  id: 'summary-form',
  title: 'Summary',
  metadata: { categorySlug: 'test', categoryId: null, status: 'draft' },
  config: {},
  steps: [
    {
      id: 's1',
      order: 0,
      title: 'Detalhes',
      icon: '📋',
      blocks: [
        {
          id: 'name',
          type: 'text',
          label: 'Nome',
          required: true,
          description_ai: 'Name',
        },
        {
          id: 'city',
          type: 'text',
          label: 'Cidade',
          required: true,
          description_ai: 'City',
        },
      ],
    },
  ],
}

const block: FormBlock = {
  id: 'preview',
  type: 'preview_summary',
  label: 'Resumo',
  description_ai: 'Summary',
}

describe('PreviewSummaryBlock', () => {
  it('shows incomplete warning when completeness is below 80%', () => {
    render(
      <PreviewSummaryBlock
        schema={schema}
        block={block}
        formData={{ name: 'Ana' }}
      />,
    )
    expect(screen.getByText(/Pedido incompleto/i)).toBeInTheDocument()
    expect(screen.getByText(/1 campos preenchidos/i)).toBeInTheDocument()
  })

  it('calls onEdit with field id when Editar is clicked', () => {
    const onEdit = vi.fn()
    render(
      <PreviewSummaryBlock
        schema={schema}
        block={block}
        formData={{ name: 'Ana', city: 'SP' }}
        onEdit={onEdit}
      />,
    )
    fireEvent.click(screen.getAllByRole('button', { name: /Editar/i })[0])
    expect(onEdit).toHaveBeenCalledWith('name')
  })

  it('uses config sections when provided', () => {
    const configBlock: FormBlock = {
      ...block,
      config: {
        sections: [
          {
            id: 'custom',
            title: 'Seção custom',
            icon: '⭐',
            fieldIds: ['name'],
          },
        ],
      },
    }
    render(
      <PreviewSummaryBlock
        schema={schema}
        block={configBlock}
        formData={{ name: 'Ana', city: 'SP' }}
      />,
    )
    expect(screen.getByText('Seção custom')).toBeInTheDocument()
  })

  it('shows empty copy when there are no input fields filled and total is zero', () => {
    const emptySchema: FormSchema = {
      ...schema,
      steps: [
        {
          id: 's1',
          order: 0,
          title: 'Only static',
          blocks: [
            {
              id: 'st',
              type: 'static_text',
              label: 'Info',
              description_ai: 'Static',
            },
          ],
        },
      ],
    }
    render(
      <PreviewSummaryBlock schema={emptySchema} block={block} formData={{}} />,
    )
    expect(
      screen.getByText(/Nenhum campo preenchido ainda/i),
    ).toBeInTheDocument()
  })
})
