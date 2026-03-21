import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { ToastProvider } from './contexts/ToastContext'
import { PreferencesProvider } from './contexts/PreferencesContext'
import { GameProvider } from './contexts/GameContext'
import { AppLayout } from './layouts/AppLayout'
import { HomePage } from './pages/HomePage'
import { TeamsPage } from './pages/TeamsPage'
import { TeamDetailPage } from './pages/TeamDetailPage'
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
      { path: 'teams', element: <TeamsPage /> },
      { path: 'teams/:teamId', element: <TeamDetailPage /> },
      { path: 'stats', element: <SeasonStatsPage /> },
      { path: 'game/:gameId/setup', element: <GameSetupPage /> },
      { path: 'game/:gameId', element: <GamePage /> },
      { path: 'game/:gameId/stats', element: <GameStatsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
], { basename: import.meta.env.BASE_URL.replace(/\/$/, '') })

function App() {
  return (
    <ToastProvider>
      <PreferencesProvider>
        <GameProvider>
          <RouterProvider router={router} />
        </GameProvider>
      </PreferencesProvider>
    </ToastProvider>
  )
}

export default App
