export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
      <div role="status" className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      <p className="mt-3 text-sm">{label}</p>
    </div>
  )
}
