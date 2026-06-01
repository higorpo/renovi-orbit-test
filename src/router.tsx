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
const ClientMyServicesPage = lazy(() =>
  import('@/features/client-my-services/components/ClientMyServicesPage').then((m) => ({
    default: m.ClientMyServicesPage,
  })),
)
const ClientMyServicesDetailPlaceholder = lazy(() =>
  import('@/features/client-my-services/components/ClientMyServicesDetailPlaceholder').then((m) => ({
    default: m.ClientMyServicesDetailPlaceholder,
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
const ProviderBudgetsShell = lazy(() =>
  import('@/features/provider-budgets/components/ProviderBudgetsShell').then((m) => ({
    default: m.ProviderBudgetsShell,
  })),
)
const ProviderBudgetsRouteSlot = lazy(() =>
  import('@/features/provider-budgets/components/ProviderBudgetsShell').then((m) => ({
    default: m.ProviderBudgetsRouteSlot,
  })),
)
const ClientBudgetsShell = lazy(() =>
  import('@/features/client-budgets/components/ClientBudgetsShell').then((m) => ({
    default: m.ClientBudgetsShell,
  })),
)
const ClientBudgetsRouteSlot = lazy(() =>
  import('@/features/client-budgets/components/ClientBudgetsShell').then((m) => ({
    default: m.ClientBudgetsRouteSlot,
  })),
)
const ChatsLayout = lazy(() =>
  import('@/features/chats/components/ChatsLayout/ChatsLayout').then((m) => ({
    default: m.ChatsLayout,
  })),
)
const ChatsConversationRoute = lazy(() =>
  import('@/features/chats/components/ChatsLayout/ChatsConversationRoute').then((m) => ({
    default: m.ChatsConversationRoute,
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
            element: <ClientMyServicesPage />,
          },
          {
            path: 'services/:id',
            element: <ClientMyServicesDetailPlaceholder />,
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
            path: 'budgets',
            element: (
              <ProtectedRoute allowedRoles={['provider']}>
                <ProviderBudgetsShell />
              </ProtectedRoute>
            ),
            children: [
              { index: true, element: <ProviderBudgetsRouteSlot /> },
              { path: 'pedido/:serviceRequestId', element: <ProviderBudgetsRouteSlot /> },
            ],
          },
          {
            path: 'orcamentos',
            element: (
              <ProtectedRoute allowedRoles={['client']}>
                <ClientBudgetsShell />
              </ProtectedRoute>
            ),
            children: [{ index: true, element: <ClientBudgetsRouteSlot /> }],
          },
          {
            path: 'earnings',
            element: (
              <ProtectedRoute allowedRoles={['provider']}>
                <DashboardFakePage title="Ganhos" />
              </ProtectedRoute>
            ),
          },
          {
            path: 'chats',
            element: (
              <ProtectedRoute allowedRoles={['client', 'provider']}>
                <ChatsLayout />
              </ProtectedRoute>
            ),
            children: [
              {
                path: ':chatId',
                element: <ChatsConversationRoute />,
              },
            ],
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
