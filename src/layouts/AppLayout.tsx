import { Outlet, Link, useLocation } from 'react-router-dom'

export function AppLayout() {
  const location = useLocation()
  const isGamePage = location.pathname.startsWith('/game/')

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {!isGamePage && (
        <header className="bg-slate-800 text-white px-6 py-4">
          <Link to="/" className="text-xl font-bold tracking-tight">
            Scorekeeper
          </Link>
        </header>
      )}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
