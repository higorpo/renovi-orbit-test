import { createBrowserRouter } from 'react-router'
import { RootLayout } from './layouts/RootLayout'
import App from './App'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <App />,
      },
    ],
  },
])
