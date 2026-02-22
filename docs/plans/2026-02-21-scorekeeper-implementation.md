# Scorekeeper PWA Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Progressive Web App for little league scorekeeping that mirrors the paper Glover's scorebook, supports offline play with game code sync, and provides intuitive play entry for both experienced and beginner scorekeepers.

**Architecture:** React frontend with Vite, Tailwind styling, IndexedDB for offline state, Supabase for optional cloud sync. Core workflow: create team roster → start game → enter plays via buttons/field diagram → sync via game code.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Dexie.js (IndexedDB), Supabase JS client, vite-plugin-pwa

---

## Phase 1: Project Setup & Core Infrastructure

### Task 1: Initialize Vite + React + TypeScript project

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tailwind.config.js`
- Create: `src/main.tsx`

**Step 1: Create Vite React TypeScript project**

```bash
npm create vite@latest scorekeeper -- --template react-ts
cd scorekeeper
npm install
```

**Step 2: Install dependencies**

```bash
npm install -D tailwindcss postcss autoprefixer vite-plugin-pwa
npm install dexie axios zustand
npm install -D @types/node
```

**Step 3: Configure Tailwind**

Create `tailwind.config.js`:
```javascript
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

Create `postcss.config.js`:
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

**Step 4: Update `src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 5: Configure Vite PWA**

Update `vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      manifest: {
        name: 'Scorekeeper',
        short_name: 'Scorekeeper',
        description: 'Little League Scorekeeping App',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})
```

**Step 6: Verify setup**

```bash
npm run dev
```

Expected: Vite dev server running on http://localhost:5173

**Step 7: Commit**

```bash
git add .
git commit -m "chore: initialize vite react typescript project with tailwind and pwa"
```

---

### Task 2: Set up Dexie.js for IndexedDB

**Files:**
- Create: `src/db/database.ts`
- Create: `src/db/schema.ts`

**Step 1: Create database schema**

Create `src/db/schema.ts`:
```typescript
export interface Team {
  id?: number;
  name: string;
  createdAt: Date;
}

export interface Player {
  id?: number;
  teamId: number;
  name: string;
  jerseyNumber: number;
  position: string;
  battingOrder?: number;
  createdAt: Date;
}

export interface Game {
  id?: number;
  teamId: number;
  code: string; // shareable game code
  date: Date;
  opponentName: string;
  homeOrAway: 'home' | 'away';
  finalScoreUs?: number;
  finalScoreThem?: number;
  status: 'draft' | 'in_progress' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

export interface GamePlay {
  id?: number;
  gameId: number;
  inning: number;
  half: 'top' | 'bottom';
  batterPlayerId: number;
  playType: string; // K, 1B, 2B, 3B, HR, 6-3, etc.
  fieldersInvolved: number[]; // position numbers [6, 3]
  resultBasesReached: number[]; // positions runners reached
  runsScored: number;
  rbiCount: number;
  pitchCount: number; // running pitch count for pitcher
  timestamp: Date;
}

export interface GameState {
  id?: number;
  gameId: number;
  currentInning: number;
  currentHalf: 'top' | 'bottom';
  outs: number;
  scoreUs: number;
  scoreThem: number;
  currentPitchCount: number;
  lastUpdated: Date;
}
```

**Step 2: Create Dexie database instance**

Create `src/db/database.ts`:
```typescript
import Dexie, { Table } from 'dexie';
import { Team, Player, Game, GamePlay, GameState } from './schema';

export class ScoreKeeperDB extends Dexie {
  teams!: Table<Team>;
  players!: Table<Player>;
  games!: Table<Game>;
  gamePlays!: Table<GamePlay>;
  gameStates!: Table<GameState>;

  constructor() {
    super('scorekeeper_db');
    this.version(1).stores({
      teams: '++id',
      players: '++id, teamId',
      games: '++id, teamId, code',
      gamePlays: '++id, gameId, [gameId+inning+half]',
      gameStates: '++id, gameId'
    });
  }
}

export const db = new ScoreKeeperDB();
```

**Step 3: Write test for database initialization**

Create `src/db/__tests__/database.test.ts`:
```typescript
import { db } from '../database';

describe('ScoreKeeperDB', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.close();
  });

  it('should initialize database', async () => {
    expect(db.tables.length).toBeGreaterThan(0);
    expect(db.tables.map(t => t.name)).toContain('teams');
    expect(db.tables.map(t => t.name)).toContain('players');
    expect(db.tables.map(t => t.name)).toContain('games');
  });

  it('should insert and retrieve a team', async () => {
    const teamId = await db.teams.add({
      name: 'Test Team',
      createdAt: new Date()
    });
    const team = await db.teams.get(teamId);
    expect(team?.name).toBe('Test Team');
  });
});
```

**Step 4: Run tests**

```bash
npm install -D vitest @testing-library/react
npm run test -- src/db/__tests__/database.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/db/
git commit -m "feat: set up dexie indexeddb with team player game schema"
```

---

### Task 3: Set up Zustand state management

**Files:**
- Create: `src/store/gameStore.ts`
- Create: `src/store/__tests__/gameStore.test.ts`

**Step 1: Create game store**

Create `src/store/gameStore.ts`:
```typescript
import { create } from 'zustand';
import { Game, GamePlay, GameState } from '../db/schema';

interface GameStoreState {
  currentGame: Game | null;
  currentGameState: GameState | null;
  gamePlays: GamePlay[];

  // Actions
  setCurrentGame: (game: Game) => void;
  setCurrentGameState: (state: GameState) => void;
  addGamePlay: (play: GamePlay) => void;
  setGamePlays: (plays: GamePlay[]) => void;
  clearCurrentGame: () => void;
}

export const useGameStore = create<GameStoreState>((set) => ({
  currentGame: null,
  currentGameState: null,
  gamePlays: [],

  setCurrentGame: (game) => set({ currentGame: game }),
  setCurrentGameState: (state) => set({ currentGameState: state }),
  addGamePlay: (play) => set((state) => ({
    gamePlays: [...state.gamePlays, play]
  })),
  setGamePlays: (plays) => set({ gamePlays: plays }),
  clearCurrentGame: () => set({
    currentGame: null,
    currentGameState: null,
    gamePlays: []
  })
}));
```

**Step 2: Write store tests**

Create `src/store/__tests__/gameStore.test.ts`:
```typescript
import { useGameStore } from '../gameStore';
import { Game, GameState } from '../../db/schema';

describe('GameStore', () => {
  beforeEach(() => {
    const { clearCurrentGame } = useGameStore.getState();
    clearCurrentGame();
  });

  it('should set current game', () => {
    const store = useGameStore.getState();
    const mockGame: Game = {
      id: 1,
      teamId: 1,
      code: 'TEST-0221',
      date: new Date(),
      opponentName: 'Test Opponent',
      homeOrAway: 'home',
      status: 'in_progress',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    store.setCurrentGame(mockGame);
    expect(useGameStore.getState().currentGame).toEqual(mockGame);
  });

  it('should add game play', () => {
    const store = useGameStore.getState();
    const mockPlay: GamePlay = {
      id: 1,
      gameId: 1,
      inning: 1,
      half: 'top',
      batterPlayerId: 1,
      playType: 'K',
      fieldersInvolved: [],
      resultBasesReached: [],
      runsScored: 0,
      rbiCount: 0,
      pitchCount: 1,
      timestamp: new Date()
    };

    store.addGamePlay(mockPlay);
    expect(useGameStore.getState().gamePlays).toHaveLength(1);
  });
});
```

**Step 3: Run tests**

```bash
npm run test -- src/store/__tests__/gameStore.test.ts
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/store/
git commit -m "feat: add zustand store for game state management"
```

---

## Phase 2: Core UI Components

### Task 4: Create ScoreSummary component (top info bar)

**Files:**
- Create: `src/components/ScoreSummary.tsx`
- Create: `src/components/__tests__/ScoreSummary.test.tsx`

**Step 1: Write test**

Create `src/components/__tests__/ScoreSummary.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react';
import { ScoreSummary } from '../ScoreSummary';

describe('ScoreSummary', () => {
  it('should display inning, outs, and score', () => {
    render(
      <ScoreSummary
        inning={3}
        half="top"
        outs={2}
        scoreUs={2}
        scoreThem={1}
        pitchCount={15}
      />
    );

    expect(screen.getByText(/Top of 3/)).toBeInTheDocument();
    expect(screen.getByText(/Outs: 2/)).toBeInTheDocument();
    expect(screen.getByText(/2 - 1/)).toBeInTheDocument();
    expect(screen.getByText(/P: 15/)).toBeInTheDocument();
  });
});
```

**Step 2: Implement component**

Create `src/components/ScoreSummary.tsx`:
```typescript
import React from 'react';

interface ScoreSummaryProps {
  inning: number;
  half: 'top' | 'bottom';
  outs: number;
  scoreUs: number;
  scoreThem: number;
  pitchCount: number;
}

export const ScoreSummary: React.FC<ScoreSummaryProps> = ({
  inning,
  half,
  outs,
  scoreUs,
  scoreThem,
  pitchCount
}) => {
  const halfDisplay = half === 'top' ? 'Top' : 'Bottom';

  return (
    <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
      <div className="text-lg font-bold">
        {halfDisplay} of {inning}
      </div>
      <div className="text-lg">
        Outs: {outs}
      </div>
      <div className="text-2xl font-bold">
        {scoreUs} - {scoreThem}
      </div>
      <div className="text-lg">
        P: {pitchCount}
      </div>
    </div>
  );
};
```

**Step 3: Run tests**

```bash
npm install -D @testing-library/react @testing-library/jest-dom
npm run test -- src/components/__tests__/ScoreSummary.test.tsx
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/components/ScoreSummary.tsx
git commit -m "feat: add ScoreSummary component displaying game info"
```

---

### Task 5: Create Diamond SVG component for baserunning visualization

**Files:**
- Create: `src/components/Diamond.tsx`
- Create: `src/components/__tests__/Diamond.test.tsx`

**Step 1: Write test**

Create `src/components/__tests__/Diamond.test.tsx`:
```typescript
import { render } from '@testing-library/react';
import { Diamond } from '../Diamond';

describe('Diamond', () => {
  it('should render diamond svg', () => {
    const { container } = render(
      <Diamond basesReached={[1, 2]} homeRun={false} />
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should render line to first base', () => {
    const { container } = render(
      <Diamond basesReached={[1]} homeRun={false} />
    );
    expect(container.innerHTML).toContain('path');
  });

  it('should render complete diamond when home run', () => {
    const { container } = render(
      <Diamond basesReached={[1, 2, 3, 4]} homeRun={true} />
    );
    // Should have path all the way around
    expect(container.innerHTML).toContain('path');
  });
});
```

**Step 2: Implement component**

Create `src/components/Diamond.tsx`:
```typescript
import React from 'react';

interface DiamondProps {
  basesReached: number[]; // [1, 2, 3, 4] where 4 = home
  homeRun?: boolean;
  notation?: string; // e.g., "1B", "2B", "6-3"
}

export const Diamond: React.FC<DiamondProps> = ({
  basesReached,
  homeRun = false,
  notation = ''
}) => {
  // SVG coordinates for diamond
  const home = { x: 50, y: 80 };
  const first = { x: 80, y: 50 };
  const second = { x: 50, y: 20 };
  const third = { x: 20, y: 50 };

  const bases = [home, first, second, third, home];

  // Build path based on bases reached
  let pathD = `M ${home.x} ${home.y}`;

  if (basesReached.includes(1)) {
    pathD += ` L ${first.x} ${first.y}`;
  }
  if (basesReached.includes(2)) {
    pathD += ` L ${second.x} ${second.y}`;
  }
  if (basesReached.includes(3)) {
    pathD += ` L ${third.x} ${third.y}`;
  }
  if (basesReached.includes(4) || homeRun) {
    pathD += ` L ${home.x} ${home.y}`;
  }

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="120" viewBox="0 0 120 120" className="border border-gray-300">
        {/* Diamond outline */}
        <polygon
          points={`${home.x},${home.y} ${first.x},${first.y} ${second.x},${second.y} ${third.x},${third.y}`}
          fill="none"
          stroke="black"
          strokeWidth="1"
        />

        {/* Baserunning path */}
        <path
          d={pathD}
          fill={homeRun ? '#FFD700' : 'none'}
          stroke={homeRun ? '#FFD700' : '#666'}
          strokeWidth={homeRun ? 12 : 2}
          strokeLinecap="round"
        />

        {/* Base markers */}
        <circle cx={first.x} cy={first.y} r="4" fill="gray" />
        <circle cx={second.x} cy={second.y} r="4" fill="gray" />
        <circle cx={third.x} cy={third.y} r="4" fill="gray" />
      </svg>
      {notation && <div className="text-xs font-bold mt-1">{notation}</div>}
    </div>
  );
};
```

**Step 3: Run tests**

```bash
npm run test -- src/components/__tests__/Diamond.test.tsx
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/components/Diamond.tsx
git commit -m "feat: add Diamond SVG component for baserunning visualization"
```

---

### Task 6: Create AtBatCell component (single scoresheet cell)

**Files:**
- Create: `src/components/AtBatCell.tsx`
- Create: `src/components/__tests__/AtBatCell.test.tsx`

**Step 1: Write test**

Create `src/components/__tests__/AtBatCell.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react';
import { AtBatCell } from '../AtBatCell';

describe('AtBatCell', () => {
  it('should render empty cell', () => {
    const { container } = render(
      <AtBatCell
        batter="John Doe"
        jerseyNumber={23}
        inning={1}
        playData={null}
        isCurrentBatter={false}
        onClick={() => {}}
      />
    );

    expect(container.querySelector('[data-testid="atbat-cell"]')).toBeInTheDocument();
  });

  it('should display play notation', () => {
    const playData = {
      playType: 'K',
      basesReached: [],
      notation: 'K'
    };

    render(
      <AtBatCell
        batter="John Doe"
        jerseyNumber={23}
        inning={1}
        playData={playData}
        isCurrentBatter={false}
        onClick={() => {}}
      />
    );

    expect(screen.getByText('K')).toBeInTheDocument();
  });

  it('should highlight current batter', () => {
    const { container } = render(
      <AtBatCell
        batter="John Doe"
        jerseyNumber={23}
        inning={1}
        playData={null}
        isCurrentBatter={true}
        onClick={() => {}}
      />
    );

    expect(container.querySelector('.bg-yellow-100')).toBeInTheDocument();
  });
});
```

**Step 2: Implement component**

Create `src/components/AtBatCell.tsx`:
```typescript
import React from 'react';
import { Diamond } from './Diamond';

interface PlayData {
  playType: string;
  basesReached: number[];
  notation: string;
  homeRun?: boolean;
}

interface AtBatCellProps {
  batter: string;
  jerseyNumber: number;
  inning: number;
  playData: PlayData | null;
  isCurrentBatter: boolean;
  onClick: () => void;
}

export const AtBatCell: React.FC<AtBatCellProps> = ({
  batter,
  jerseyNumber,
  inning,
  playData,
  isCurrentBatter,
  onClick
}) => {
  return (
    <div
      data-testid="atbat-cell"
      onClick={onClick}
      className={`
        border border-gray-300 p-2 min-h-24 cursor-pointer
        flex flex-col items-center justify-center
        ${isCurrentBatter ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-white hover:bg-gray-50'}
      `}
    >
      {playData ? (
        <>
          <Diamond
            basesReached={playData.basesReached}
            homeRun={playData.homeRun}
            notation={playData.notation}
          />
        </>
      ) : (
        <div className="text-gray-300 text-sm">#{jerseyNumber}</div>
      )}
    </div>
  );
};
```

**Step 3: Run tests**

```bash
npm run test -- src/components/__tests__/AtBatCell.test.tsx
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/components/AtBatCell.tsx
git commit -m "feat: add AtBatCell component for individual at-bats"
```

---

### Task 7: Create Scoresheet component (main grid)

**Files:**
- Create: `src/components/Scoresheet.tsx`
- Create: `src/components/__tests__/Scoresheet.test.tsx`

**Step 1: Write test**

Create `src/components/__tests__/Scoresheet.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react';
import { Scoresheet } from '../Scoresheet';
import { Player } from '../../db/schema';

describe('Scoresheet', () => {
  const mockPlayers: Player[] = [
    { id: 1, teamId: 1, name: 'John Doe', jerseyNumber: 23, position: 'C', createdAt: new Date() },
    { id: 2, teamId: 1, name: 'Jane Smith', jerseyNumber: 7, position: 'SS', createdAt: new Date() }
  ];

  it('should render scoresheet with players', () => {
    render(
      <Scoresheet
        players={mockPlayers}
        currentInning={1}
        currentHalf="top"
        currentBatterIndex={0}
        gamePlays={[]}
        onCellClick={() => {}}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('should render inning columns', () => {
    render(
      <Scoresheet
        players={mockPlayers}
        currentInning={3}
        currentHalf="top"
        currentBatterIndex={0}
        gamePlays={[]}
        onCellClick={() => {}}
      />
    );

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
```

**Step 2: Implement component**

Create `src/components/Scoresheet.tsx`:
```typescript
import React from 'react';
import { Player, GamePlay } from '../db/schema';
import { AtBatCell } from './AtBatCell';

interface ScoresheetProps {
  players: Player[];
  currentInning: number;
  currentHalf: 'top' | 'bottom';
  currentBatterIndex: number;
  gamePlays: GamePlay[];
  onCellClick: (playerIndex: number, inning: number) => void;
}

export const Scoresheet: React.FC<ScoresheetProps> = ({
  players,
  currentInning,
  currentHalf,
  currentBatterIndex,
  gamePlays,
  onCellClick
}) => {
  // Get play for a specific player and inning
  const getPlayForCell = (playerId: number, inning: number): any | null => {
    return gamePlays.find(p => p.batterPlayerId === playerId && p.inning === inning) || null;
  };

  const innings = Array.from({ length: 6 }, (_, i) => i + 1);

  return (
    <div className="overflow-x-auto bg-white">
      <table className="border-collapse w-full">
        <thead>
          <tr>
            <th className="border border-gray-300 p-2 w-24 bg-gray-100">Batter</th>
            {innings.map(inning => (
              <th key={inning} className="border border-gray-300 p-2 w-24 bg-gray-100 font-bold">
                {inning}
              </th>
            ))}
            <th className="border border-gray-300 p-2 w-16 bg-gray-100">AB</th>
            <th className="border border-gray-300 p-2 w-16 bg-gray-100">R</th>
            <th className="border border-gray-300 p-2 w-16 bg-gray-100">H</th>
            <th className="border border-gray-300 p-2 w-16 bg-gray-100">RBI</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player, playerIndex) => (
            <tr key={player.id}>
              <td className="border border-gray-300 p-2 bg-gray-50 text-sm font-semibold">
                <div>{player.name}</div>
                <div className="text-xs text-gray-600">#{player.jerseyNumber}</div>
              </td>
              {innings.map(inning => (
                <td key={`${player.id}-${inning}`} className="border border-gray-300 p-1">
                  <AtBatCell
                    batter={player.name}
                    jerseyNumber={player.jerseyNumber}
                    inning={inning}
                    playData={getPlayForCell(player.id || 0, inning)}
                    isCurrentBatter={playerIndex === currentBatterIndex && currentInning === inning}
                    onClick={() => onCellClick(playerIndex, inning)}
                  />
                </td>
              ))}
              <td className="border border-gray-300 p-2 text-center">0</td>
              <td className="border border-gray-300 p-2 text-center">0</td>
              <td className="border border-gray-300 p-2 text-center">0</td>
              <td className="border border-gray-300 p-2 text-center">0</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

**Step 3: Run tests**

```bash
npm run test -- src/components/__tests__/Scoresheet.test.tsx
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/components/Scoresheet.tsx
git commit -m "feat: add Scoresheet component with grid layout"
```

---

## Phase 3: Play Entry Interface

### Task 8: Create PlayEntryPanel component with common buttons

**Files:**
- Create: `src/components/PlayEntryPanel.tsx`
- Create: `src/components/__tests__/PlayEntryPanel.test.tsx`

**Step 1: Write test**

Create `src/components/__tests__/PlayEntryPanel.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayEntryPanel } from '../PlayEntryPanel';

describe('PlayEntryPanel', () => {
  it('should render common play buttons', () => {
    render(
      <PlayEntryPanel onPlayRecorded={() => {}} />
    );

    expect(screen.getByRole('button', { name: /K/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /BB/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1B/ })).toBeInTheDocument();
  });

  it('should call onPlayRecorded when K button clicked', async () => {
    const onPlayRecorded = jest.fn();
    render(
      <PlayEntryPanel onPlayRecorded={onPlayRecorded} />
    );

    const kButton = screen.getByRole('button', { name: /K/ });
    await userEvent.click(kButton);

    expect(onPlayRecorded).toHaveBeenCalledWith('K');
  });
});
```

**Step 2: Install test dependencies**

```bash
npm install -D @testing-library/user-event
```

**Step 3: Implement component**

Create `src/components/PlayEntryPanel.tsx`:
```typescript
import React, { useState } from 'react';

interface PlayEntryPanelProps {
  onPlayRecorded: (playType: string) => void;
  onClose?: () => void;
}

const COMMON_PLAYS = [
  { label: 'K', key: 'K' },
  { label: 'ꓘ (looking)', key: 'K_looking' },
  { label: 'BB', key: 'BB' },
  { label: 'HBP', key: 'HBP' },
  { label: '1B', key: '1B' },
  { label: '2B', key: '2B' },
  { label: '3B', key: '3B' },
  { label: 'HR', key: 'HR' },
];

const FIELDING_PLAYS = [
  { label: 'Ground out', key: 'groundout' },
  { label: 'Fly out', key: 'flyout' },
  { label: 'Line out', key: 'lineout' },
  { label: 'Pop out', key: 'popout' },
];

const SPECIAL_PLAYS = [
  { label: 'FC', key: 'FC' },
  { label: 'E', key: 'E' },
  { label: 'DP', key: 'DP' },
  { label: 'SB', key: 'SB' },
  { label: 'WP', key: 'WP' },
  { label: 'PB', key: 'PB' },
  { label: 'BK', key: 'BK' },
];

export const PlayEntryPanel: React.FC<PlayEntryPanelProps> = ({
  onPlayRecorded,
  onClose
}) => {
  const [mode, setMode] = useState<'select' | 'details'>('select');

  const handlePlayClick = (key: string) => {
    // For now, record immediately for simple plays
    if (['K', 'K_looking', 'BB', 'HBP', '1B', '2B', '3B', 'HR'].includes(key)) {
      onPlayRecorded(key);
    } else {
      // For complex plays, would need to show more UI
      setMode('details');
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-300 shadow-lg p-4 max-h-96 overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">Record Play</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 text-2xl"
          >
            ×
          </button>
        )}
      </div>

      {mode === 'select' ? (
        <>
          <div className="mb-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">Common Outcomes</div>
            <div className="grid grid-cols-4 gap-2">
              {COMMON_PLAYS.map(play => (
                <button
                  key={play.key}
                  onClick={() => handlePlayClick(play.key)}
                  className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded text-sm font-bold"
                >
                  {play.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">Fielding Plays</div>
            <div className="grid grid-cols-2 gap-2">
              {FIELDING_PLAYS.map(play => (
                <button
                  key={play.key}
                  onClick={() => handlePlayClick(play.key)}
                  className="bg-green-500 hover:bg-green-600 text-white py-2 px-3 rounded text-sm font-bold"
                >
                  {play.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-700 mb-2">Special Plays</div>
            <div className="grid grid-cols-4 gap-2">
              {SPECIAL_PLAYS.map(play => (
                <button
                  key={play.key}
                  onClick={() => handlePlayClick(play.key)}
                  className="bg-orange-500 hover:bg-orange-600 text-white py-2 px-3 rounded text-sm font-bold"
                >
                  {play.label}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
```

**Step 4: Run tests**

```bash
npm run test -- src/components/__tests__/PlayEntryPanel.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/PlayEntryPanel.tsx
git commit -m "feat: add PlayEntryPanel with common play buttons"
```

---

## Phase 4: Game Flow & Integration

### Task 9: Create GamePage component (main game view)

**Files:**
- Create: `src/pages/GamePage.tsx`
- Create: `src/pages/__tests__/GamePage.test.tsx`

**Step 1: Write test**

Create `src/pages/__tests__/GamePage.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react';
import { GamePage } from '../GamePage';

describe('GamePage', () => {
  it('should render game page with scoresheet and controls', () => {
    const mockGame = {
      id: 1,
      teamId: 1,
      code: 'TEST-0221',
      date: new Date(),
      opponentName: 'Test Opponent',
      homeOrAway: 'home' as const,
      status: 'in_progress' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    render(<GamePage />);

    expect(screen.getByRole('heading', { name: /Game/ })).toBeInTheDocument();
  });
});
```

**Step 2: Implement component**

Create `src/pages/GamePage.tsx`:
```typescript
import React, { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { db } from '../db/database';
import { ScoreSummary } from '../components/ScoreSummary';
import { Scoresheet } from '../components/Scoresheet';
import { PlayEntryPanel } from '../components/PlayEntryPanel';
import { Player, GamePlay } from '../db/schema';

export const GamePage: React.FC = () => {
  const { currentGame, currentGameState, gamePlays, setGamePlays } = useGameStore();
  const [players, setPlayers] = useState<Player[]>([]);
  const [showPlayEntry, setShowPlayEntry] = useState(false);
  const [currentBatterIndex, setCurrentBatterIndex] = useState(0);

  // Load players when game changes
  useEffect(() => {
    const loadPlayers = async () => {
      if (!currentGame) return;
      const p = await db.players.where('teamId').equals(currentGame.teamId).toArray();
      setPlayers(p);
    };
    loadPlayers();
  }, [currentGame]);

  // Load game plays
  useEffect(() => {
    const loadPlays = async () => {
      if (!currentGame) return;
      const plays = await db.gamePlays.where('gameId').equals(currentGame.id || 0).toArray();
      setGamePlays(plays);
    };
    loadPlays();
  }, [currentGame, setGamePlays]);

  if (!currentGame || !currentGameState) {
    return <div className="p-4">No active game. Start a new game to begin.</div>;
  }

  const handlePlayRecorded = async (playType: string) => {
    if (!currentGame || !players[currentBatterIndex]) return;

    const newPlay: GamePlay = {
      gameId: currentGame.id || 0,
      inning: currentGameState.currentInning,
      half: currentGameState.currentHalf,
      batterPlayerId: players[currentBatterIndex].id || 0,
      playType,
      fieldersInvolved: [],
      resultBasesReached: [],
      runsScored: 0,
      rbiCount: 0,
      pitchCount: currentGameState.currentPitchCount + 1,
      timestamp: new Date()
    };

    await db.gamePlays.add(newPlay);
    setGamePlays([...gamePlays, newPlay]);
    setShowPlayEntry(false);

    // Advance to next batter
    if (currentBatterIndex < players.length - 1) {
      setCurrentBatterIndex(currentBatterIndex + 1);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <ScoreSummary
        inning={currentGameState.currentInning}
        half={currentGameState.currentHalf}
        outs={currentGameState.outs}
        scoreUs={currentGameState.scoreUs}
        scoreThem={currentGameState.scoreThem}
        pitchCount={currentGameState.currentPitchCount}
      />

      <div className="flex-1 overflow-auto">
        <Scoresheet
          players={players}
          currentInning={currentGameState.currentInning}
          currentHalf={currentGameState.currentHalf}
          currentBatterIndex={currentBatterIndex}
          gamePlays={gamePlays}
          onCellClick={() => setShowPlayEntry(true)}
        />
      </div>

      <div className="p-4 bg-white border-t border-gray-300 flex gap-2">
        <button
          onClick={() => setShowPlayEntry(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded font-bold"
        >
          Record Play
        </button>
        <button className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded font-bold">
          Undo
        </button>
      </div>

      {showPlayEntry && (
        <PlayEntryPanel
          onPlayRecorded={handlePlayRecorded}
          onClose={() => setShowPlayEntry(false)}
        />
      )}
    </div>
  );
};
```

**Step 3: Run tests**

```bash
npm run test -- src/pages/__tests__/GamePage.test.tsx
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/pages/GamePage.tsx
git commit -m "feat: add GamePage with scoresheet integration"
```

---

## Phase 5: Setup & Sync

### Task 10: Create TeamSetupPage for roster management

**Files:**
- Create: `src/pages/TeamSetupPage.tsx`

**Step 1: Implement component**

Create `src/pages/TeamSetupPage.tsx`:
```typescript
import React, { useState, useEffect } from 'react';
import { db } from '../db/database';
import { Team, Player } from '../db/schema';

export const TeamSetupPage: React.FC = () => {
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerNumber, setNewPlayerNumber] = useState('');

  useEffect(() => {
    const loadTeam = async () => {
      const teams = await db.teams.toArray();
      if (teams.length > 0) {
        setTeam(teams[0]);
        const p = await db.players.where('teamId').equals(teams[0].id || 0).toArray();
        setPlayers(p);
      }
    };
    loadTeam();
  }, []);

  const handleCreateTeam = async () => {
    const teamName = prompt('Enter team name:');
    if (!teamName) return;

    const teamId = await db.teams.add({
      name: teamName,
      createdAt: new Date()
    });

    const newTeam: Team = {
      id: teamId,
      name: teamName,
      createdAt: new Date()
    };
    setTeam(newTeam);
  };

  const handleAddPlayer = async () => {
    if (!team || !newPlayerName || !newPlayerNumber) return;

    const playerId = await db.players.add({
      teamId: team.id || 0,
      name: newPlayerName,
      jerseyNumber: parseInt(newPlayerNumber),
      position: '',
      createdAt: new Date()
    });

    const newPlayer: Player = {
      id: playerId,
      teamId: team.id || 0,
      name: newPlayerName,
      jerseyNumber: parseInt(newPlayerNumber),
      position: '',
      createdAt: new Date()
    };

    setPlayers([...players, newPlayer]);
    setNewPlayerName('');
    setNewPlayerNumber('');
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Team Setup</h1>

      {!team ? (
        <button
          onClick={handleCreateTeam}
          className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded font-bold"
        >
          Create Team
        </button>
      ) : (
        <>
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">{team.name}</h2>
            <p className="text-gray-600">{players.length} players</p>
          </div>

          <div className="mb-6 border rounded-lg p-4">
            <h3 className="text-lg font-bold mb-4">Add Player</h3>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Player name"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                className="flex-1 border rounded px-3 py-2"
              />
              <input
                type="number"
                placeholder="Jersey #"
                value={newPlayerNumber}
                onChange={(e) => setNewPlayerNumber(e.target.value)}
                className="w-20 border rounded px-3 py-2"
              />
              <button
                onClick={handleAddPlayer}
                className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded font-bold"
              >
                Add
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-4">Roster</h3>
            <table className="w-full border-collapse border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Name</th>
                  <th className="border p-2 text-left">#</th>
                  <th className="border p-2 text-left">Position</th>
                </tr>
              </thead>
              <tbody>
                {players.map(p => (
                  <tr key={p.id}>
                    <td className="border p-2">{p.name}</td>
                    <td className="border p-2">{p.jerseyNumber}</td>
                    <td className="border p-2">{p.position || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
```

**Step 2: Commit**

```bash
git add src/pages/TeamSetupPage.tsx
git commit -m "feat: add TeamSetupPage for roster management"
```

---

### Task 11: Create supabase sync service

**Files:**
- Create: `src/services/syncService.ts`
- Create: `src/services/__tests__/syncService.test.ts`

**Step 1: Implement sync service**

Create `src/services/syncService.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';
import { Game, GamePlay } from '../db/schema';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '');

export class SyncService {
  // Generate a 6-character game code
  static generateGameCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // Upload game state to Supabase
  static async uploadGame(game: Game, plays: GamePlay[]): Promise<string> {
    const code = this.generateGameCode();

    try {
      // Store game state (would need Supabase table)
      console.log('Uploading game', code, game, plays);
      return code;
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  }

  // Download game state from Supabase
  static async downloadGame(code: string): Promise<{ game: Game; plays: GamePlay[] } | null> {
    try {
      // Fetch game state by code
      console.log('Downloading game', code);
      return null;
    } catch (error) {
      console.error('Download failed:', error);
      return null;
    }
  }
}
```

**Step 2: Write test**

Create `src/services/__tests__/syncService.test.ts`:
```typescript
import { SyncService } from '../syncService';

describe('SyncService', () => {
  it('should generate valid game code', () => {
    const code = SyncService.generateGameCode();
    expect(code).toHaveLength(6);
    expect(/^[A-Z0-9]{6}$/.test(code)).toBe(true);
  });

  it('should generate unique codes', () => {
    const code1 = SyncService.generateGameCode();
    const code2 = SyncService.generateGameCode();
    expect(code1).not.toBe(code2);
  });
});
```

**Step 3: Run tests**

```bash
npm run test -- src/services/__tests__/syncService.test.ts
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/services/syncService.ts
git commit -m "feat: add sync service for game code upload/download"
```

---

## Phase 6: Testing & Polish

### Task 12: Add .env setup and documentation

**Files:**
- Create: `.env.example`
- Create: `README.md`

**Step 1: Create .env.example**

Create `.env.example`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Step 2: Create README**

Create `README.md`:
```markdown
# Scorekeeper PWA

A Progressive Web App for little league scorekeeping.

## Setup

1. Clone the repo
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local` and add your Supabase credentials
4. Run dev server: `npm run dev`
5. Visit http://localhost:5173

## Build

```bash
npm run build
```

## Testing

```bash
npm run test
```

## Key Features

- Paper-mirrored scoresheet UI
- Offline-first with IndexedDB
- Game code sync for volunteer handoffs
- Pitch count tracking
- Undo/edit functionality
- Beginner mode with paper marking guidance
```

**Step 3: Commit**

```bash
git add .env.example README.md
git commit -m "docs: add environment setup and readme"
```

---

## Phase 7: Field Diagram & Advanced Input

### Task 13: Create FieldDiagram component for fielding plays

**Files:**
- Create: `src/components/FieldDiagram.tsx`
- Create: `src/components/__tests__/FieldDiagram.test.tsx`

**Step 1: Write test**

Create `src/components/__tests__/FieldDiagram.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FieldDiagram } from '../FieldDiagram';

describe('FieldDiagram', () => {
  it('should render all 9 positions', () => {
    render(
      <FieldDiagram
        onPositionSelected={() => {}}
        selectedPositions={[]}
      />
    );

    for (let i = 1; i <= 9; i++) {
      expect(screen.getByText(i.toString())).toBeInTheDocument();
    }
  });

  it('should highlight selected positions', () => {
    const { container } = render(
      <FieldDiagram
        onPositionSelected={() => {}}
        selectedPositions={[6, 3]}
      />
    );

    // Should have highlighting on selected positions
    const highlighted = container.querySelectorAll('.bg-yellow-300');
    expect(highlighted.length).toBeGreaterThan(0);
  });

  it('should call onPositionSelected when position tapped', async () => {
    const onPositionSelected = jest.fn();
    render(
      <FieldDiagram
        onPositionSelected={onPositionSelected}
        selectedPositions={[]}
      />
    );

    const position6 = screen.getByText('6');
    await userEvent.click(position6);

    expect(onPositionSelected).toHaveBeenCalledWith(6);
  });
});
```

**Step 2: Implement component**

Create `src/components/FieldDiagram.tsx`:
```typescript
import React from 'react';

const POSITIONS = [
  { num: 1, label: 'P', x: '50%', y: '15%' },
  { num: 2, label: 'C', x: '50%', y: '85%' },
  { num: 3, label: '1B', x: '75%', y: '65%' },
  { num: 4, label: '2B', x: '50%', y: '50%' },
  { num: 5, label: '3B', x: '25%', y: '65%' },
  { num: 6, label: 'SS', x: '35%', y: '55%' },
  { num: 7, label: 'LF', x: '15%', y: '40%' },
  { num: 8, label: 'CF', x: '50%', y: '30%' },
  { num: 9, label: 'RF', x: '85%', y: '40%' },
];

interface FieldDiagramProps {
  onPositionSelected: (position: number) => void;
  selectedPositions: number[];
}

export const FieldDiagram: React.FC<FieldDiagramProps> = ({
  onPositionSelected,
  selectedPositions
}) => {
  return (
    <div className="relative w-96 h-96 bg-green-100 border-2 border-green-700 rounded-full mx-auto">
      {/* Diamond outline */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
      >
        <polygon
          points="50,10 90,50 50,90 10,50"
          fill="none"
          stroke="#8B7355"
          strokeWidth="1"
        />
      </svg>

      {/* Position buttons */}
      {POSITIONS.map(pos => (
        <button
          key={pos.num}
          onClick={() => onPositionSelected(pos.num)}
          className={`
            absolute w-14 h-14 rounded-full flex items-center justify-center
            font-bold text-white text-lg transition
            ${
              selectedPositions.includes(pos.num)
                ? 'bg-yellow-400 ring-2 ring-yellow-600'
                : 'bg-blue-500 hover:bg-blue-600'
            }
          `}
          style={{
            left: `calc(${pos.x} - 28px)`,
            top: `calc(${pos.y} - 28px)`
          }}
        >
          <div className="flex flex-col items-center">
            <div className="text-xs">{pos.label}</div>
            <div>{pos.num}</div>
          </div>
        </button>
      ))}
    </div>
  );
};
```

**Step 3: Run tests**

```bash
npm run test -- src/components/__tests__/FieldDiagram.test.tsx
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/components/FieldDiagram.tsx
git commit -m "feat: add FieldDiagram for fielding play selection"
```

---

### Task 14: Update PlayEntryPanel to use FieldDiagram

**Files:**
- Modify: `src/components/PlayEntryPanel.tsx`

**Step 1: Update component**

Update `src/components/PlayEntryPanel.tsx` to add fielding flow:

```typescript
// Add to component after SPECIAL_PLAYS constant:
const [selectedFielders, setSelectedFielders] = useState<number[]>([]);
const [fielderMode, setFielderMode] = useState<'first' | 'second' | null>(null);

// In the JSX, after mode === 'select', add:
{mode === 'fielding' && (
  <div className="text-center">
    <h4 className="font-bold mb-4">
      {fielderMode === 'first' ? 'Who fielded it?' : 'Thrown to?'}
    </h4>
    <FieldDiagram
      selectedPositions={selectedFielders}
      onPositionSelected={(pos) => {
        if (fielderMode === 'first') {
          setSelectedFielders([pos]);
          setFielderMode('second');
        } else {
          setSelectedFielders([...selectedFielders, pos]);
          // Create play notation like "6-3"
          const notation = selectedFielders[0] + '-' + pos;
          onPlayRecorded(notation);
          setFielderMode(null);
          setSelectedFielders([]);
        }
      }}
    />
  </div>
)}

// Update handlePlayClick:
const handlePlayClick = (key: string) => {
  if (['K', 'K_looking', 'BB', 'HBP', '1B', '2B', '3B', 'HR'].includes(key)) {
    onPlayRecorded(key);
  } else if (['groundout', 'flyout', 'lineout', 'popout'].includes(key)) {
    setMode('fielding');
    setFielderMode('first');
    setSelectedFielders([]);
  } else {
    // Other special plays
    setMode('details');
  }
};
```

**Step 2: Commit**

```bash
git add src/components/PlayEntryPanel.tsx
git commit -m "feat: integrate FieldDiagram into PlayEntryPanel for fielding plays"
```

---

## Final Phase: App Shell & Navigation

### Task 15: Create App.tsx with routing

**Files:**
- Create: `src/App.tsx`
- Modify: `src/main.tsx`

**Step 1: Update main.tsx**

Update `src/main.tsx`:
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

**Step 2: Create App.tsx**

Create `src/App.tsx`:
```typescript
import React, { useState, useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { db } from './db/database';
import { GamePage } from './pages/GamePage';
import { TeamSetupPage } from './pages/TeamSetupPage';
import { Game, GameState } from './db/schema';

function App() {
  const { setCurrentGame, setCurrentGameState } = useGameStore();
  const [page, setPage] = useState<'home' | 'game' | 'setup'>('home');

  const handleNewGame = async () => {
    const opponentName = prompt('Opponent name:');
    const homeOrAway = prompt('Home or Away?', 'home');

    if (!opponentName) return;

    const teams = await db.teams.toArray();
    if (teams.length === 0) {
      setPage('setup');
      return;
    }

    const gameId = await db.games.add({
      teamId: teams[0].id || 0,
      code: Math.random().toString(36).substring(2, 8).toUpperCase(),
      date: new Date(),
      opponentName,
      homeOrAway: homeOrAway === 'home' ? 'home' : 'away',
      status: 'in_progress',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const game: Game = {
      id: gameId,
      teamId: teams[0].id || 0,
      code: Math.random().toString(36).substring(2, 8).toUpperCase(),
      date: new Date(),
      opponentName,
      homeOrAway: homeOrAway === 'home' ? 'home' : 'away',
      status: 'in_progress',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const gameState: GameState = {
      gameId: gameId,
      currentInning: 1,
      currentHalf: 'top',
      outs: 0,
      scoreUs: 0,
      scoreThem: 0,
      currentPitchCount: 0,
      lastUpdated: new Date()
    };

    const gameStateId = await db.gameStates.add(gameState);
    gameState.id = gameStateId;

    setCurrentGame(game);
    setCurrentGameState(gameState);
    setPage('game');
  };

  return (
    <div className="h-screen w-screen">
      {page === 'home' && (
        <div className="p-6 max-w-md mx-auto">
          <h1 className="text-4xl font-bold mb-8">Scorekeeper</h1>
          <button
            onClick={() => setPage('setup')}
            className="block w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded font-bold mb-4"
          >
            Manage Team Roster
          </button>
          <button
            onClick={handleNewGame}
            className="block w-full bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded font-bold"
          >
            Start New Game
          </button>
        </div>
      )}

      {page === 'setup' && (
        <div>
          <div className="p-4 bg-gray-100 border-b">
            <button
              onClick={() => setPage('home')}
              className="text-blue-600 hover:underline font-bold"
            >
              ← Back
            </button>
          </div>
          <TeamSetupPage />
        </div>
      )}

      {page === 'game' && <GamePage />}
    </div>
  );
}

export default App;
```

**Step 3: Run dev server and verify**

```bash
npm run dev
```

Expected: App loads, can start new game, see scoresheet

**Step 4: Commit**

```bash
git add src/App.tsx src/main.tsx
git commit -m "feat: add main app shell with navigation"
```

---

## Summary

This plan covers:
- ✅ Project setup (Vite, React, TS, Tailwind, PWA)
- ✅ Database (IndexedDB via Dexie)
- ✅ State management (Zustand)
- ✅ Core UI components (Scoresheet, Diamond, AtBatCell)
- ✅ Play entry interface (buttons, field diagram)
- ✅ Game flow (GamePage, TeamSetup)
- ✅ Sync infrastructure (SyncService)
- ✅ Main app shell (App.tsx with navigation)

**Not yet implemented (Phase 2):**
- Beginner mode UI & paper guidance panel
- Full undo/edit functionality
- Supabase integration & game code sync
- Pitch count integration throughout UI
- Season stats calculations
- Export/share functionality

---

## Plan saved to: `docs/plans/2026-02-21-scorekeeper-implementation.md`

---

## Execution Options

Plan is complete and ready. Two execution approaches:

**1. Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks. Fast iteration, good for catching issues early.

**2. Parallel Session (separate worktree)** — You open a new session with superpowers:executing-plans, I batch execute tasks with checkpoints.

Which approach would you prefer?
