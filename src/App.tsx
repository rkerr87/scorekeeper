import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { GameProvider } from './contexts/GameContext'
import { AppLayout } from './layouts/AppLayout'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'team', element: <div>Team page placeholder</div> },
      { path: 'game/:gameId/setup', element: <div>Game setup placeholder</div> },
      { path: 'game/:gameId', element: <div>Game page placeholder</div> },
      { path: 'game/:gameId/stats', element: <div>Game stats placeholder</div> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

function App() {
  return (
    <GameProvider>
      <RouterProvider router={router} />
    </GameProvider>
  )
}

export default App
