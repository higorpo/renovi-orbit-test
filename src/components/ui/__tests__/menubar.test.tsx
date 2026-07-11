import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from '../menubar'

describe('menubar', () => {
  it('renders open menu items including inset and checkbox variants', () => {
    const onSelect = vi.fn()
    render(
      <Menubar>
        <MenubarMenu open>
          <MenubarTrigger>Arquivo</MenubarTrigger>
          <MenubarContent>
            <MenubarLabel>Arquivo</MenubarLabel>
            <MenubarLabel inset>Inset label</MenubarLabel>
            <MenubarSeparator />
            <MenubarItem onSelect={onSelect}>
              Novo
              <MenubarShortcut>⌘N</MenubarShortcut>
            </MenubarItem>
            <MenubarItem inset>Inset</MenubarItem>
            <MenubarCheckboxItem checked>Auto save</MenubarCheckboxItem>
            <MenubarCheckboxItem checked={false}>Unchecked</MenubarCheckboxItem>
            <MenubarRadioGroup value="light">
              <MenubarRadioItem value="light">Claro</MenubarRadioItem>
              <MenubarRadioItem value="dark">Escuro</MenubarRadioItem>
            </MenubarRadioGroup>
            <MenubarSub open>
              <MenubarSubTrigger>Compartilhar</MenubarSubTrigger>
              <MenubarSubTrigger inset>Inset sub</MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarItem>Email</MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>,
    )

    expect(screen.getByText('Novo')).toBeInTheDocument()
    expect(screen.getByText('Inset').className).toContain('pl-8')
    expect(screen.getByText('Auto save')).toBeInTheDocument()
    expect(screen.getByText('Unchecked')).toBeInTheDocument()
    expect(screen.getByText('Claro')).toBeInTheDocument()
    expect(screen.getByText('Compartilhar')).toBeInTheDocument()
    expect(screen.getByText('Inset sub').className).toContain('pl-8')
    expect(screen.getByText('Email')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Novo'))
    expect(onSelect).toHaveBeenCalled()
  })
})
