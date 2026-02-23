import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="max-w-lg mx-auto p-6 text-center">
      <h1 className="text-2xl font-bold text-slate-900 mb-4">Page Not Found</h1>
      <Link to="/" className="text-blue-600 hover:underline">Back to Home</Link>
    </div>
  )
}
