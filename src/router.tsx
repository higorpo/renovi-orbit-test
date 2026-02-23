import { createBrowserRouter } from 'react-router'
import { RootLayout } from './layouts/RootLayout'
import App from './App'
import Login from './pages/Login/Login'
import ClientSignup from './pages/ClientSignup/ClientSignup'

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
        path: 'login',
        element: <Login />,
      },
      {
        path: 'cadastro/cliente',
        element: <ClientSignup />,
      },
    ],
  },
])
