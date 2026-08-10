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
const ClientServiceCardShowcasePage =
  import.meta.env.DEV
    ? lazy(() =>
        import('@/features/my-services/components/client/ClientServiceCardShowcasePage').then(
          (m) => ({ default: m.ClientServiceCardShowcasePage }),
        ),
      )
    : null
const ProviderServiceCardShowcasePage =
  import.meta.env.DEV
    ? lazy(() =>
        import('@/features/my-services/components/provider/ProviderServiceCardShowcasePage').then(
          (m) => ({ default: m.ProviderServiceCardShowcasePage }),
        ),
      )
    : null
const ServiceNextStepShowcasePage =
  import.meta.env.DEV
    ? lazy(() =>
        import('@/features/view-services/components/ServiceNextStepShowcasePage').then(
          (m) => ({ default: m.ServiceNextStepShowcasePage }),
        ),
      )
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
const MyServicesRouteSlot = lazy(() =>
  import('@/features/my-services/components/MyServicesRouteSlot').then((m) => ({
    default: m.MyServicesRouteSlot,
  })),
)
const ServiceDetailShell = lazy(() =>
  import('@/features/view-services/components/ServiceDetailShell').then((m) => ({
    default: m.ServiceDetailShell,
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
const ProviderJobsRouteSlot = lazy(() =>
  import('@/features/provider-jobs/components/ProviderJobsRouteSlot').then((m) => ({
    default: m.ProviderJobsRouteSlot,
  })),
)
const EarningsPage = lazy(() =>
  import('@/features/provider-earnings/components/EarningsPage').then((m) => ({
    default: m.EarningsPage,
  })),
)
const ProviderCalendarPage = lazy(() =>
  import('@/features/provider-calendar/components/ProviderCalendarPage').then((m) => ({
    default: m.ProviderCalendarPage,
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
        ? [{ path: 'dev/demo/form', element: <FormDemoPage /> }]
        : []),
      ...(import.meta.env.DEV && ProviderServiceCardShowcasePage
        ? [{ path: 'dev/demo/provider-service-card-showcase', element: <ProviderServiceCardShowcasePage /> }]
        : []),
      ...(import.meta.env.DEV && ClientServiceCardShowcasePage
        ? [{ path: 'dev/demo/client-service-card-showcase', element: <ClientServiceCardShowcasePage /> }]
        : []),
      ...(import.meta.env.DEV && ServiceNextStepShowcasePage
        ? [{ path: 'dev/demo/service-next-step-showcase', element: <ServiceNextStepShowcasePage /> }]
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
            path: 'services',
            element: <MyServicesRouteSlot />,
          },
          {
            path: 'services/calendar',
            element: (
              <ProtectedRoute allowedRoles={['provider']}>
                <ProviderCalendarPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'services/:id',
            element: <ServiceDetailShell />,
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
                <ProviderJobsRouteSlot />
              </ProtectedRoute>
            ),
          },
          {
            path: 'earnings',
            element: (
              <ProtectedRoute allowedRoles={['provider']}>
                <EarningsPage />
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
