import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '../context-menu'

describe('context-menu', () => {
  it('opens on context menu and renders item variants', async () => {
    const onSelect = vi.fn()
    render(
      <ContextMenu>
        <ContextMenuTrigger>
          <div>Área</div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel inset>Ações</ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={onSelect}>
            Copiar
            <ContextMenuShortcut>⌘C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem inset>Inset</ContextMenuItem>
          <ContextMenuCheckboxItem checked>Fixo</ContextMenuCheckboxItem>
          <ContextMenuRadioGroup value="1">
            <ContextMenuRadioItem value="1">Um</ContextMenuRadioItem>
            <ContextMenuRadioItem value="2">Dois</ContextMenuRadioItem>
          </ContextMenuRadioGroup>
          <ContextMenuSub>
            <ContextMenuSubTrigger inset>Mais</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem>Extra</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>,
    )

    fireEvent.contextMenu(screen.getByText('Área'))
    expect(await screen.findByText('Copiar')).toBeInTheDocument()
    expect(screen.getByText('Inset').className).toContain('pl-8')
    expect(screen.getByText('Fixo')).toBeInTheDocument()
    expect(screen.getByText('Um')).toBeInTheDocument()
    expect(screen.getByText('Mais').className).toContain('pl-8')

    fireEvent.click(screen.getByText('Copiar'))
    expect(onSelect).toHaveBeenCalled()
  })
})
