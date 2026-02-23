import { createBrowserRouter } from 'react-router'
import { RootLayout } from './layouts/RootLayout'
import App from './App'
import Login from './pages/Login/Login'

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
    ],
  },
])
