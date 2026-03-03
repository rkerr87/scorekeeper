import { useState } from 'react'
import type { LineupSlot } from '../engine/types'
import { FieldDiagram } from './FieldDiagram'

interface PositionChange {
  orderPosition: number
  newPosition: string
}

interface PositionChangeDialogProps {
  lineup: LineupSlot[]
  onConfirm: (changes: PositionChange[]) => void
  onCancel: () => void
}

const POSITION_MAP: Record<number, string> = {
  1: 'P', 2: 'C', 3: '1B', 4: '2B', 5: '3B', 6: 'SS', 7: 'LF', 8: 'CF', 9: 'RF',
}

type DialogStep = 'select-player' | 'select-position' | 'confirm-swap'

export function PositionChangeDialog({ lineup, onConfirm, onCancel }: PositionChangeDialogProps) {
  const [step, setStep] = useState<DialogStep>('select-player')
  const [selectedPlayer, setSelectedPlayer] = useState<LineupSlot | null>(null)
  const [swapInfo, setSwapInfo] = useState<{
    player: LineupSlot
    newPos: string
    targetPlayer: LineupSlot
    targetNewPos: string
  } | null>(null)

  const handlePlayerSelect = (slot: LineupSlot) => {
    setSelectedPlayer(slot)
    setStep('select-position')
  }

  const handlePositionClick = (posNum: number) => {
    if (!selectedPlayer) return
    const newPos = POSITION_MAP[posNum]
    if (!newPos) return

    // Same position? ignore
    if (newPos === selectedPlayer.position) return

    const occupant = lineup.find(s => s.position === newPos)

    if (occupant && occupant.orderPosition !== selectedPlayer.orderPosition) {
      // Swap needed
      setSwapInfo({
        player: selectedPlayer,
        newPos,
        targetPlayer: occupant,
        targetNewPos: selectedPlayer.position,
      })
      setStep('confirm-swap')
    } else {
      // No swap - unoccupied position or same player
      onConfirm([{ orderPosition: selectedPlayer.orderPosition, newPosition: newPos }])
    }
  }

  const handleConfirmSwap = () => {
    if (!swapInfo) return
    onConfirm([
      { orderPosition: swapInfo.player.orderPosition, newPosition: swapInfo.newPos },
      { orderPosition: swapInfo.targetPlayer.orderPosition, newPosition: swapInfo.targetNewPos },
    ])
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
        {step === 'select-player' && (
          <>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Position Change</h3>
            <p className="text-xs text-slate-500 mb-3">Select the player changing positions:</p>
            <div className="space-y-1 max-h-64 overflow-y-auto mb-4">
              {lineup.map(slot => (
                <button
                  key={slot.orderPosition}
                  onClick={() => handlePlayerSelect(slot)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <span className="text-xs text-slate-400 font-mono w-4">{slot.orderPosition}.</span>
                  <span className="font-semibold text-slate-800">{slot.playerName}</span>
                  <span className="text-xs text-slate-500">#{slot.jerseyNumber}</span>
                  <span className="ml-auto text-xs font-bold text-blue-600">{slot.position}</span>
                </button>
              ))}
            </div>
            <button
              onClick={onCancel}
              className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 py-2.5 rounded-lg font-semibold transition-all duration-150 active:scale-95"
            >
              Cancel
            </button>
          </>
        )}

        {step === 'select-position' && selectedPlayer && (
          <>
            <h3 className="text-lg font-bold text-slate-900 mb-1">New Position</h3>
            <p className="text-xs text-slate-500 mb-3">
              {selectedPlayer.playerName} (#{selectedPlayer.jerseyNumber}) — currently {selectedPlayer.position}
            </p>
            <FieldDiagram selectedPositions={[]} onPositionClick={handlePositionClick} />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setStep('select-player'); setSelectedPlayer(null) }}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2 rounded-lg font-bold text-sm transition-all duration-150 active:scale-95"
              >
                Back
              </button>
            </div>
          </>
        )}

        {step === 'confirm-swap' && swapInfo && (
          <>
            <h3 className="text-lg font-bold text-slate-900 mb-3">Confirm Position Swap</h3>
            <div className="space-y-2 mb-4">
              <div className="bg-blue-50 rounded-lg p-3 text-sm">
                <span className="font-bold">{swapInfo.player.playerName}</span>
                <span className="text-slate-500"> (#{swapInfo.player.jerseyNumber})</span>
                <span className="mx-1">:</span>
                <span className="font-semibold text-blue-700">{swapInfo.player.position} → {swapInfo.newPos}</span>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-sm">
                <span className="font-bold">{swapInfo.targetPlayer.playerName}</span>
                <span className="text-slate-500"> (#{swapInfo.targetPlayer.jerseyNumber})</span>
                <span className="mx-1">:</span>
                <span className="font-semibold text-blue-700">{swapInfo.targetPlayer.position} → {swapInfo.targetNewPos}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-2.5 rounded-lg font-bold text-sm transition-all duration-150 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSwap}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-bold text-sm transition-all duration-150 active:scale-95"
              >
                Confirm
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
