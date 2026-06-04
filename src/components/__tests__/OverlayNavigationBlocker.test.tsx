// @vitest-environment happy-dom

import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { OverlayNavigationBlocker } from '@/components/OverlayNavigationBlocker'
import * as overlayHistory from '@/lib/overlayHistory'

vi.mock('@/lib/overlayHistory', async (importOriginal) => {
  const actual = await importOriginal<typeof overlayHistory>()
  return {
    ...actual,
    closeTopOverlay: vi.fn(() => true),
    useHasOpenOverlay: vi.fn(() => true),
  }
})

describe('OverlayNavigationBlocker', () => {
  it('renders inside the router without crashing', () => {
    const router = createMemoryRouter([
      {
        path: '/',
        element: (
          <>
            <OverlayNavigationBlocker />
            <div>Home</div>
          </>
        ),
      },
    ])

    expect(() => render(<RouterProvider router={router} />)).not.toThrow()
  })
})
