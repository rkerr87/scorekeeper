import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { PreferencesProvider } from './contexts/PreferencesContext'
import { GameProvider } from './contexts/GameContext'
import { AppLayout } from './layouts/AppLayout'
import { HomePage } from './pages/HomePage'
import { TeamPage } from './pages/TeamPage'
import { GameSetupPage } from './pages/GameSetupPage'
import { GamePage } from './pages/GamePage'
import { GameStatsPage } from './pages/GameStatsPage'
import { SeasonStatsPage } from './pages/SeasonStatsPage'
import { NotFoundPage } from './pages/NotFoundPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'team', element: <TeamPage /> },
      { path: 'stats', element: <SeasonStatsPage /> },
      { path: 'game/:gameId/setup', element: <GameSetupPage /> },
      { path: 'game/:gameId', element: <GamePage /> },
      { path: 'game/:gameId/stats', element: <GameStatsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

function App() {
  return (
    <PreferencesProvider>
      <GameProvider>
        <RouterProvider router={router} />
      </GameProvider>
    </PreferencesProvider>
  )
}

export default App
