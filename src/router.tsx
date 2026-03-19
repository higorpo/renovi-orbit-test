import { lazy } from 'react'
import { createBrowserRouter, Outlet } from 'react-router'
import { RootLayout } from './layouts/RootLayout'
import { RouterErrorBoundary } from '@/components/RouterErrorBoundary'
import { GuestOnlyRoute, ProtectedRoute } from '@/features/auth'
import { DashboardFakePage } from '@/layouts/DashboardLayout'
import { ServiceRequestsPage } from '@/features/view-service-requests'

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

const RequestQuote = lazy(() => import('@/features/request-quote').then(m => ({ default: m.RequestQuote })))
const DashboardLayout = lazy(() => import('@/layouts/DashboardLayout').then(m => ({ default: m.DashboardLayout })))
const ServiceDetailPlaceholder = lazy(() => import('@/features/view-service-requests').then(m => ({ default: m.ServiceDetailPlaceholder })))
const MyAccountPage = lazy(() => import('@/features/my-account').then(m => ({ default: m.MyAccountPage })))
const ProviderProfilePage = lazy(() => import('@/features/provider-profile').then(m => ({ default: m.ProviderProfilePage })))
const ProviderJobsPage = lazy(() => import('@/features/provider-jobs').then(m => ({ default: m.ProviderJobsPage })))
const JobDetailPage = lazy(() => import('@/features/provider-jobs').then(m => ({ default: m.JobDetailPage })))

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
                <ProviderJobsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: 'jobs/:id',
            element: (
              <ProtectedRoute allowedRoles={['provider']}>
                <JobDetailPage />
              </ProtectedRoute>
            ),
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
