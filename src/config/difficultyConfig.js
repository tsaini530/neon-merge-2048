/**
 * Difficulty Configuration for Easy, Medium, and Hard Modes
 */

export const DIFFICULTY = {
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD',
};

export const DIFFICULTY_CONFIG = {
  [DIFFICULTY.EASY]: {
    id: DIFFICULTY.EASY,
    label: 'EASY',
    subLabel: 'Casual & Relaxed',
    tag: 'ZEN MODE',
    color: '#00ff88',
    colorInt: 0x00ff88,
    badgeBg: 0x072b1a,
    targetGoal: 512,
    initialRows: 3,
    initialValues: [2, 4, 8],
    rowDropShots: 0, // Disabled
    rowDropWarning: 0,
    matchAssistRate: 0.40, // 40% chance to drop matching tile
    hidePredictionBadge: false, // Shows ★ MERGE / ★ COMBO
    minComboForMultiplier: 2, // Standard combo (starts at 2)
    scoreMultiplier: 1.0,
    swapCost: 10,
    startingHammers: 2,
    coinRewardMultiplier: 1.0,
  },

  [DIFFICULTY.MEDIUM]: {
    id: DIFFICULTY.MEDIUM,
    label: 'MEDIUM',
    subLabel: 'Classic Arcade',
    tag: 'STANDARD',
    color: '#ffea00',
    colorInt: 0xffea00,
    badgeBg: 0x2e2704,
    targetGoal: 2048,
    initialRows: 4,
    initialValues: [2, 4, 8, 16, 32],
    rowDropShots: 12, // Pushes down every 12 shots
    rowDropWarning: 2, // Warning on last 2 shots
    matchAssistRate: 0.15,
    hidePredictionBadge: false,
    minComboForMultiplier: 2,
    scoreMultiplier: 1.5,
    swapCost: 20,
    startingHammers: 1,
    coinRewardMultiplier: 1.5,
  },

  [DIFFICULTY.HARD]: {
    id: DIFFICULTY.HARD,
    label: 'HARD',
    subLabel: 'Expert Master',
    tag: 'PRO STAKES',
    color: '#ff0055',
    colorInt: 0xff0055,
    badgeBg: 0x360515,
    targetGoal: 4096,
    initialRows: 5,
    initialValues: [2, 4, 8, 16, 32, 64],
    rowDropShots: 7, // High pressure: row drop every 7 shots!
    rowDropWarning: 2,
    matchAssistRate: 0.0, // Pure competitive skill
    hidePredictionBadge: true, // Does NOT show multiplier/combo badge easily!
    minComboForMultiplier: 3, // Multiplier strictly requires 3+ cascade chain!
    scoreMultiplier: 2.5,
    swapCost: 30,
    startingHammers: 0,
    coinRewardMultiplier: 2.5,
  },
};

export default { DIFFICULTY, DIFFICULTY_CONFIG };
