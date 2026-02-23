import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Scorekeeper</h1>
      <div className="space-y-4">
        <Link
          to="/team"
          className="block w-full text-center bg-slate-700 hover:bg-slate-800 text-white py-3 px-4 rounded-lg font-semibold"
        >
          Manage Team Roster
        </Link>
        <button
          className="block w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-semibold"
        >
          Start New Game
        </button>
        <button
          className="block w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-semibold"
        >
          Enter Game Code
        </button>
      </div>
    </div>
  )
}
