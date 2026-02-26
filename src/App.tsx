import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { GameProvider } from './contexts/GameContext'
import { AppLayout } from './layouts/AppLayout'
import { HomePage } from './pages/HomePage'
import { TeamPage } from './pages/TeamPage'
import { GameSetupPage } from './pages/GameSetupPage'
import { GamePage } from './pages/GamePage'
import { NotFoundPage } from './pages/NotFoundPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'team', element: <TeamPage /> },
      { path: 'game/:gameId/setup', element: <GameSetupPage /> },
      { path: 'game/:gameId', element: <GamePage /> },
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
