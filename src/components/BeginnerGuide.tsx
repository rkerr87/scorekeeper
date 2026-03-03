import { Diamond } from './Diamond'
import type { PlayType } from '../engine/types'

const POSITION_NAMES: Record<number, string> = {
  1: 'pitcher', 2: 'catcher', 3: 'first baseman',
  4: 'second baseman', 5: 'third baseman', 6: 'shortstop',
  7: 'left fielder', 8: 'center fielder', 9: 'right fielder',
}

function getExplanation(playType: PlayType, notation: string): string {
  switch (playType) {
    case 'K': return 'Strikeout (swinging). The batter swung and missed strike three.'
    case 'KL': return 'Strikeout (looking). The batter did not swing at strike three.'
    case 'BB': return 'Walk (base on balls). Four balls — batter goes to first base.'
    case 'HBP': return 'Hit by pitch. The batter was hit and goes to first base.'
    case '1B': return 'Single. The batter hit safely and reached first base.'
    case '2B': return 'Double. The batter hit safely and reached second base.'
    case '3B': return 'Triple. The batter hit safely and reached third base.'
    case 'HR': return 'Home run! The batter and all runners score.'
    case 'GO': {
      const parts = notation.split('-').map(Number)
      const fielders = parts.map(n => POSITION_NAMES[n] ?? `#${n}`).join(' to ')
      return `Ground out (${notation}). Fielded by ${fielders}.`
    }
    case 'FO': {
      const pos = parseInt(notation.replace('F', ''))
      return `Fly out (${notation}). Caught by the ${POSITION_NAMES[pos] ?? `fielder #${pos}`}.`
    }
    case 'LO': {
      const pos = parseInt(notation.replace('L', ''))
      return `Line out (${notation}). Line drive caught by the ${POSITION_NAMES[pos] ?? `fielder #${pos}`}.`
    }
    case 'PO': return `Pop out (${notation}). Pop fly caught.`
    case 'FC': return "Fielder's choice. The batter reached base but a runner was put out."
    case 'E': return `Error (${notation}). A fielder made an error, allowing the batter to reach base.`
    case 'DP': return `Double play (${notation}). Two outs recorded on one play.`
    case 'SAC': return 'Sacrifice. The batter was out but advanced a runner.'
    case 'SB': return 'Stolen base. A runner advanced a base while the pitcher was delivering.'
    case 'WP': return "Wild pitch. The pitcher threw a pitch the catcher couldn't handle, runners advance."
    case 'PB': return 'Passed ball. The catcher failed to catch a pitch, runners advance.'
    case 'BK': return 'Balk. Illegal pitching action, runners advance one base.'
    default: return notation
  }
}

function getBasesForPlay(playType: PlayType): number[] {
  switch (playType) {
    case '1B': return [1]
    case '2B': return [1, 2]
    case '3B': return [1, 2, 3]
    case 'HR': return [1, 2, 3, 4]
    case 'BB': case 'HBP': return [1]
    default: return []
  }
}

interface BeginnerGuideProps {
  playType: PlayType
  notation: string
  onDismiss: () => void
}

export function BeginnerGuide({ playType, notation, onDismiss }: BeginnerGuideProps) {
  const explanation = getExplanation(playType, notation)
  const bases = getBasesForPlay(playType)

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mx-4 mb-4 relative">
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute top-2 right-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-blue-300 hover:text-blue-500 text-xl leading-none"
      >
        ×
      </button>
      <div className="flex items-start gap-4">
        <Diamond
          basesReached={bases}
          runScored={playType === 'HR'}
          size={80}
        />
        <div className="flex-1 pr-8">
          <div className="text-lg font-bold text-blue-900 mb-1">{notation}</div>
          <p className="text-sm text-blue-800">{explanation}</p>
        </div>
      </div>
    </div>
  )
}
