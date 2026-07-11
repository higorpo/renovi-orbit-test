import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../dropdown-menu'

describe('dropdown-menu', () => {
  it('renders open menu items including inset and checkbox variants', () => {
    const onSelect = vi.fn()
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger asChild>
          <button type="button">Abrir</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent sideOffset={8}>
          <DropdownMenuLabel>Ações</DropdownMenuLabel>
          <DropdownMenuLabel inset>Inset label</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onSelect}>
            Editar
            <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem inset>Inset</DropdownMenuItem>
          <DropdownMenuCheckboxItem checked>
            Visível
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={false}>
            Oculto
          </DropdownMenuCheckboxItem>
          <DropdownMenuRadioGroup value="a">
            <DropdownMenuRadioItem value="a">A</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="b">B</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSub open>
            <DropdownMenuSubTrigger>Mais</DropdownMenuSubTrigger>
            <DropdownMenuSubTrigger inset>Mais inset</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Sub item</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    )

    expect(screen.getByText('Editar')).toBeInTheDocument()
    expect(screen.getByText('Inset').className).toContain('pl-8')
    expect(screen.getByText('Visível')).toBeInTheDocument()
    expect(screen.getByText('Oculto')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('Mais')).toBeInTheDocument()
    expect(screen.getByText('Mais inset').className).toContain('pl-8')
    expect(screen.getByText('Sub item')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Editar'))
    expect(onSelect).toHaveBeenCalled()
  })
})
