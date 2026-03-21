import { lazy } from 'react'
import { createBrowserRouter, Outlet } from 'react-router'
import { RootLayout } from './layouts/RootLayout'
import { RouterErrorBoundary } from '@/components/RouterErrorBoundary'
import { GuestOnlyRoute, ProtectedRoute } from '@/features/auth'

const App = lazy(() => import('./App'))
const Login = lazy(() => import('./features/auth/components/Login/Login'))
const ClientSignup = lazy(() => import('./features/auth/components/ClientSignup/ClientSignup'))
const ProviderSignup = lazy(() => import('./features/auth/components/ProviderSignup/ProviderSignup'))
const ForgotPassword = lazy(() => import('./features/auth/components/ForgotPassword/ForgotPassword'))
const ResetPassword = lazy(() => import('./features/auth/components/ResetPassword/ResetPassword'))
const FormDemoPage =
  import.meta.env.DEV
    ? lazy(() => import('@/features/dynamic-form').then(m => ({ default: m.FormDemoPage })))
    : null

/** Lazy routes use direct file paths (not feature barrels) so Rollup splits chunks per screen. */
const RequestQuote = lazy(() =>
  import('@/features/request-quote/components/RequestQuote/RequestQuote').then((m) => ({
    default: m.RequestQuote,
  })),
)
const DashboardLayout = lazy(() =>
  import('@/layouts/DashboardLayout/DashboardLayout').then((m) => ({
    default: m.DashboardLayout,
  })),
)
const DashboardFakePage = lazy(() =>
  import('@/layouts/DashboardLayout/DashboardFakePage').then((m) => ({
    default: m.DashboardFakePage,
  })),
)
const ServiceRequestsPage = lazy(() =>
  import('@/features/view-service-requests/components/ServiceRequestsPage').then((m) => ({
    default: m.ServiceRequestsPage,
  })),
)
const ServiceDetailPlaceholder = lazy(() =>
  import('@/features/view-service-requests/components/ServiceDetailPlaceholder').then((m) => ({
    default: m.ServiceDetailPlaceholder,
  })),
)
const MyAccountPage = lazy(() =>
  import('@/features/my-account/components/MyAccountPage').then((m) => ({
    default: m.MyAccountPage,
  })),
)
const ProviderProfilePage = lazy(() =>
  import('@/features/provider-profile/components/ProviderProfilePage').then((m) => ({
    default: m.ProviderProfilePage,
  })),
)
const ProviderJobsShell = lazy(() =>
  import('@/features/provider-jobs/components/ProviderJobsShell').then((m) => ({
    default: m.ProviderJobsShell,
  })),
)
const ProviderJobsRouteSlot = lazy(() =>
  import('@/features/provider-jobs/components/ProviderJobsShell').then((m) => ({
    default: m.ProviderJobsRouteSlot,
  })),
)

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouterErrorBoundary />,
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
      ...(import.meta.env.DEV && FormDemoPage
        ? [{ path: 'demo/form', element: <FormDemoPage /> }]
        : []),
      {
        path: 'pedir-orcamento',
        element: <RequestQuote />,
      },
      {
        path: 'perfil/:slug',
        element: <ProviderProfilePage />,
      },
      {
        element: (
          <ProtectedRoute allowedRoles={['client', 'provider']}>
            <DashboardLayout />
          </ProtectedRoute>
        ),
        path: 'dashboard',
        children: [
          { index: true, element: <DashboardFakePage title="Visão geral" /> },
          {
            path: 'requests',
            element: <ServiceRequestsPage />,
          },
          {
            path: 'services/:id',
            element: <ServiceDetailPlaceholder />,
          },
          {
            path: 'addresses',
            element: (
              <ProtectedRoute allowedRoles={['client']}>
                <DashboardFakePage title="Endereços" />
              </ProtectedRoute>
            ),
          },
          {
            path: 'conta',
            element: (
              <ProtectedRoute allowedRoles={['client', 'provider']}>
                <MyAccountPage />
              </ProtectedRoute>
            ),
          },
          { path: 'settings', element: <DashboardFakePage title="Configurações" /> },
          { path: 'help', element: <DashboardFakePage title="Ajuda" /> },
          {
            path: 'jobs',
            element: (
              <ProtectedRoute allowedRoles={['provider']}>
                <ProviderJobsShell />
              </ProtectedRoute>
            ),
            children: [
              { index: true, element: <ProviderJobsRouteSlot /> },
              { path: ':jobId', element: <ProviderJobsRouteSlot /> },
            ],
          },
          {
            path: 'earnings',
            element: (
              <ProtectedRoute allowedRoles={['provider']}>
                <DashboardFakePage title="Ganhos" />
              </ProtectedRoute>
            ),
          },
        ],
      },
      {
        element: <ProtectedRoute allowedRoles={['client']}><Outlet /></ProtectedRoute>,
        path: 'example',
        children: [{ index: true, element: <div>Example page for client</div> }],
      },
    ],
  },
])
