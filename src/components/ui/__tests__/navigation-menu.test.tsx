import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '../navigation-menu'

describe('navigation-menu', () => {
  it('exports trigger style helper', () => {
    expect(navigationMenuTriggerStyle()).toContain('inline-flex')
  })

  it('renders trigger and content', async () => {
    render(
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Produtos</NavigationMenuTrigger>
            <NavigationMenuContent>
              <NavigationMenuLink href="/a">Item A</NavigationMenuLink>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>,
    )

    fireEvent.click(screen.getByText('Produtos'))
    await waitFor(() => {
      expect(screen.getByText('Item A')).toBeInTheDocument()
    })
  })
})
