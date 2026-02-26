import { useState } from 'react'

interface SubstitutionData {
  newPlayerName: string
  newJerseyNumber: number
  newPosition: string
}

interface SubstitutionDialogProps {
  currentPlayerName: string
  orderPosition: number
  onConfirm: (data: SubstitutionData) => void
  onCancel: () => void
}

export function SubstitutionDialog({
  currentPlayerName,
  orderPosition,
  onConfirm,
  onCancel,
}: SubstitutionDialogProps) {
  const [name, setName] = useState('')
  const [jersey, setJersey] = useState('')
  const [position, setPosition] = useState('')

  const handleConfirm = () => {
    if (!name.trim() || !jersey.trim()) return
    onConfirm({
      newPlayerName: name.trim(),
      newJerseyNumber: parseInt(jersey),
      newPosition: position.trim() || 'UT',
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Substitution</h3>
        <p className="text-sm text-slate-500 mb-4">
          Replacing {currentPlayerName} (#{orderPosition} in order)
        </p>

        <div className="space-y-3 mb-6">
          <input
            type="text"
            placeholder="New player name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Jersey #"
              value={jersey}
              onChange={e => setJersey(e.target.value)}
              className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Position"
              value={position}
              onChange={e => setPosition(e.target.value)}
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2.5 rounded-lg font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!name.trim() || !jersey.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white py-2.5 rounded-lg font-semibold"
          >
            Confirm Sub
          </button>
        </div>
      </div>
    </div>
  )
}
