import { Outlet } from 'react-router'
import { Toaster } from 'sonner'

export function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster richColors position="top-center" />
    </>
  )
}
