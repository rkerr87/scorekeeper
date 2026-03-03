import type { ReactNode } from 'react'

interface BottomSheetProps {
  children: ReactNode
  onClose: () => void
  title?: string
}

export function BottomSheet({ children, onClose, title }: BottomSheetProps) {
  return (
    <div className="fixed inset-0 z-50">
      <div data-testid="bottom-sheet-backdrop" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>
        {title && <h2 className="text-lg font-bold text-slate-900 px-5 pb-3">{title}</h2>}
        <div className="px-5 pb-6">
          {children}
        </div>
      </div>
    </div>
  )
}
