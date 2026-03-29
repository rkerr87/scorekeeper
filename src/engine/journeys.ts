import type { Play, Lineup, BaseRunners } from './types'
import { replayGame } from './engine'

/**
 * For each at-bat play, compute the full base journey of the batter —
 * including bases reached on their own hit AND subsequent advancement.
 * Returns Map<playId, number[]> where the array tracks every base reached.
 *
 * Example: batter singles [1], later advances to 2nd [1,2], then scores [1,2,3,4]
 *
 * The key in the map is the play.id (not sequenceNumber). Plays without IDs are skipped.
 */
export function computeRunnerJourneys(
  plays: Play[],
  lineupHome: Lineup,
  lineupAway: Lineup,
): Map<number, number[]> {
  const result = new Map<number, number[]>()

  if (plays.length === 0) return result

  const sorted = [...plays].sort((a, b) => a.sequenceNumber - b.sequenceNumber)

  // Track active runners on base, keyed by "{orderPosition}-{half}"
  // Value is the play ID that originally put this runner on base
  type RunnerKey = string
  const activeRunners = new Map<RunnerKey, number>()

  // Track previous half to detect half-inning transitions
  let prevHalf: string = 'top'

  for (let i = 0; i < sorted.length; i++) {
    const play = sorted[i]
    const playSlice = sorted.slice(0, i + 1)

    // Replay to get snapshot after this play
    const snapshot = replayGame(playSlice, lineupHome, lineupAway)

    // Detect half-inning transition: when the half changes, bases are cleared.
    // Some runners may have scored on this play (e.g., 5-run rule or SAC for 3rd out).
    // Extend their journeys before removing them from tracking.
    if (snapshot.half !== prevHalf) {
      const endedHalf = prevHalf
      const endedHalfRunners: RunnerKey[] = []

      for (const [key] of activeRunners) {
        if (key.endsWith(`-${endedHalf}`)) {
          endedHalfRunners.push(key)
        }
      }

      // Check if runs were scored on this play
      if (endedHalfRunners.length > 0) {
        const prevSnap = i > 0
          ? replayGame(sorted.slice(0, i), lineupHome, lineupAway)
          : null
        const runsNow = getRunsForHalf(snapshot, endedHalf)
        const runsBefore = prevSnap ? getRunsForHalf(prevSnap, endedHalf) : 0
        const runsOnPlay = runsNow - runsBefore

        if (runsOnPlay > 0 && prevSnap) {
          // Determine which runners scored based on base position (3rd scores first)
          const prevBases = prevSnap.baseRunners
          const runnersWithBases: Array<{ key: RunnerKey; playId: number; base: number }> = []

          for (const key of endedHalfRunners) {
            const rPlayId = activeRunners.get(key)!
            const orderPos = Number(key.split('-')[0])
            let base = 0
            if (prevBases.third?.orderPosition === orderPos) base = 3
            else if (prevBases.second?.orderPosition === orderPos) base = 2
            else if (prevBases.first?.orderPosition === orderPos) base = 1
            if (base > 0) runnersWithBases.push({ key, playId: rPlayId, base })
          }

          // Sort by base descending (3rd scores first, then 2nd, then 1st)
          runnersWithBases.sort((a, b) => b.base - a.base)

          // Extend journeys only for runners who actually scored (up to runsOnPlay)
          for (let r = 0; r < Math.min(runsOnPlay, runnersWithBases.length); r++) {
            const journey = result.get(runnersWithBases[r].playId)
            if (journey) {
              const lastBase = journey.length > 0 ? journey[journey.length - 1] : 0
              for (let b = lastBase + 1; b <= 4; b++) {
                journey.push(b)
              }
            }
          }
        }
      }

      // Remove all runners from the ended half
      for (const key of endedHalfRunners) {
        activeRunners.delete(key)
      }
    }

    // Initialize journey for this play (if it has an id)
    if (play.id !== undefined) {
      result.set(play.id, [...play.basesReached])
    }

    // If this play put the batter on base (reached a base < 4), track them
    if (play.id !== undefined && play.basesReached.length > 0) {
      const maxBase = Math.max(...play.basesReached)
      if (maxBase < 4) {
        const runnerKey = `${play.batterOrderPosition}-${play.half}`
        activeRunners.set(runnerKey, play.id)
      }
    }

    // Check where each active runner is in the current snapshot
    const baseOccupants = getBaseOccupants(snapshot.baseRunners)

    const runnersToRemove: RunnerKey[] = []
    for (const [runnerKey, playId] of activeRunners) {
      const [orderPosStr, half] = runnerKey.split('-')
      const orderPos = Number(orderPosStr)

      // Find if this runner is on any base in the current snapshot
      let currentBase: number | null = null
      for (const [base, occupant] of baseOccupants) {
        if (occupant.orderPosition === orderPos) {
          // Only match if the runner's half matches the play's half
          // (bases in the snapshot belong to the half that was batting)
          if (half === play.half) {
            currentBase = base
          }
          break
        }
      }

      if (currentBase !== null) {
        // Runner is still on base — extend journey if they advanced,
        // filling in intermediate bases so Diamond draws along the base paths
        const journey = result.get(playId)
        if (journey && (journey.length === 0 || journey[journey.length - 1] < currentBase)) {
          const lastBase = journey.length > 0 ? journey[journey.length - 1] : 0
          for (let b = lastBase + 1; b <= currentBase; b++) {
            journey.push(b)
          }
        }
      } else {
        // Runner is no longer on any base — scored or put out
        const journey = result.get(playId)
        if (journey && journey.length > 0) {
          const lastBase = journey[journey.length - 1]
          if (lastBase < 4) {
            // Check if runs were scored on this play
            const prevSnapshot = i > 0
              ? replayGame(sorted.slice(0, i), lineupHome, lineupAway)
              : null
            const runsNow = getRunsForHalf(snapshot, half)
            const runsBefore = prevSnapshot
              ? getRunsForHalf(prevSnapshot, half)
              : 0

            if (runsNow - runsBefore > 0 && snapshot.half === play.half) {
              // Runner scored — fill in all bases from last position to home
              // (only if the half didn't change; if it changed, the runner was
              // stranded when the inning ended, e.g. batter on 3rd after 5-run rule)
              for (let b = lastBase + 1; b <= 4; b++) {
                journey.push(b)
              }
            }
            // If no runs scored, runner was put out — journey stays as-is
          }
        }
        runnersToRemove.push(runnerKey)
      }
    }

    for (const key of runnersToRemove) {
      activeRunners.delete(key)
    }

    prevHalf = snapshot.half
  }

  return result
}

/**
 * Get base occupants from a BaseRunners struct.
 */
function getBaseOccupants(baseRunners: BaseRunners): Map<number, { orderPosition: number; playerName: string }> {
  const map = new Map<number, { orderPosition: number; playerName: string }>()
  if (baseRunners.first) map.set(1, baseRunners.first)
  if (baseRunners.second) map.set(2, baseRunners.second)
  if (baseRunners.third) map.set(3, baseRunners.third)
  return map
}

/**
 * Get the total runs for a specific half from the snapshot.
 * Bottom half = home team batting, top half = away team batting.
 */
function getRunsForHalf(snapshot: { scoreHome: number; scoreAway: number }, half: string): number {
  return half === 'bottom' ? snapshot.scoreHome : snapshot.scoreAway
}
