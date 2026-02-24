import { lazy } from 'react'
import { createBrowserRouter, Outlet } from 'react-router'
import { RootLayout } from './layouts/RootLayout'
import { GuestOnlyRoute, ProtectedRoute } from '@/lib/auth/routeGuards'

const App = lazy(() => import('./App'))
const Login = lazy(() => import('./pages/Login/Login'))
const ClientSignup = lazy(() => import('./pages/ClientSignup/ClientSignup'))
const ProviderSignup = lazy(() => import('./pages/ProviderSignup/ProviderSignup'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword/ResetPassword'))

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <App />,
      },
      {
        element: (
          <GuestOnlyRoute>
            <Outlet />
          </GuestOnlyRoute>
        ),
        children: [
          {
            path: 'login',
            element: <Login />,
          },
          {
            path: 'cadastro/cliente',
            element: <ClientSignup />,
          },
          {
            path: 'cadastro/profissional',
            element: <ProviderSignup />,
          },
          {
            path: 'esqueceu-senha',
            element: <ForgotPassword />,
          }
        ],
      },
      {
        path: 'recuperar-senha',
        element: <ResetPassword />,
      },
      {
        element: <ProtectedRoute allowedRoles={['client']}><Outlet /></ProtectedRoute>,
        path: 'example',
        children: [{ index: true, element: <div>Example page for client</div> }],
      },
      // Example: protected routes by role (uncomment when you have dashboard pages)
      // {
      //   element: <ProtectedRoute allowedRoles={['client']}><Outlet /></ProtectedRoute>,
      //   path: 'dashboard/client',
      //   children: [{ index: true, element: <ClientDashboard /> }],
      // },
      // {
      //   element: <ProtectedRoute allowedRoles={['provider']}><Outlet /></ProtectedRoute>,
      //   path: 'dashboard/provider',
      //   children: [{ index: true, element: <ProviderDashboard /> }],
      // },
      // {
      //   element: <ProtectedRoute allowedRoles={['admin']}><Outlet /></ProtectedRoute>,
      //   path: 'admin',
      //   children: [{ path: 'dashboard', element: <AdminDashboard /> }],
      // },
    ],
  },
])
