/**
 * Game constants, neon color schemes, and layout metrics
 */

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

export const GRID_COLS = 5;
export const GRID_ROWS = 8;

export const TILE_SIZE = 106;
export const TILE_GAP = 10;
export const TILE_RADIUS = 18;

// Centered grid positioning
export const GRID_WIDTH = GRID_COLS * TILE_SIZE + (GRID_COLS - 1) * TILE_GAP; // 570px
export const GRID_HEIGHT = GRID_ROWS * TILE_SIZE + (GRID_ROWS - 1) * TILE_GAP; // 918px
export const GRID_OFFSET_X = Math.floor((GAME_WIDTH - GRID_WIDTH) / 2); // 75px
export const GRID_OFFSET_Y = 140; // Below header

// Danger zone: Row 7 (the bottom row). If a shot lands beyond row 7, game over.
export const DANGER_ROW = 7;
export const DANGER_LINE_Y = GRID_OFFSET_Y + GRID_ROWS * (TILE_SIZE + TILE_GAP) + 6;

// Shooter rail and bottom dock positions
export const SHOOTER_Y = 1130;
export const SHOOTER_X = GAME_WIDTH / 2;
export const BOTTOM_DOCK_Y = 1230;

// Cyber Neon Color Map: Backgrounds, borders, glow, text
export const NEON_COLORS = {
  2: {
    bg: 0x072735,
    border: 0x00f0ff,
    glow: '#00f0ff',
    text: '#00f0ff',
    textColorInt: 0x00f0ff,
  },
  4: {
    bg: 0x0a2f15,
    border: 0x39ff14,
    glow: '#39ff14',
    text: '#39ff14',
    textColorInt: 0x39ff14,
  },
  8: {
    bg: 0x302b04,
    border: 0xffea00,
    glow: '#ffea00',
    text: '#ffea00',
    textColorInt: 0xffea00,
  },
  16: {
    bg: 0x3a1e05,
    border: 0xff7b00,
    glow: '#ff7b00',
    text: '#ff7b00',
    textColorInt: 0xff7b00,
  },
  32: {
    bg: 0x3a0820,
    border: 0xff007f,
    glow: '#ff007f',
    text: '#ff007f',
    textColorInt: 0xff007f,
  },
  64: {
    bg: 0x28053a,
    border: 0xb500ff,
    glow: '#b500ff',
    text: '#b500ff',
    textColorInt: 0xb500ff,
  },
  128: {
    bg: 0x04193d,
    border: 0x007bff,
    glow: '#007bff',
    text: '#007bff',
    textColorInt: 0x007bff,
  },
  256: {
    bg: 0x04352a,
    border: 0x00ffc4,
    glow: '#00ffc4',
    text: '#00ffc4',
    textColorInt: 0x00ffc4,
  },
  512: {
    bg: 0x3a0b06,
    border: 0xff3b00,
    glow: '#ff3b00',
    text: '#ff3b00',
    textColorInt: 0xff3b00,
  },
  1024: {
    bg: 0x3a001b,
    border: 0xff005d,
    glow: '#ff005d',
    text: '#ffffff',
    textColorInt: 0xffffff,
  },
  2048: {
    bg: 0x3d3000,
    border: 0xffd700,
    glow: '#ffd700',
    text: '#ffffff',
    textColorInt: 0xffffff,
  },
  4096: {
    bg: 0x003d3d,
    border: 0x00ffff,
    glow: '#ffffff',
    text: '#ffffff',
    textColorInt: 0xffffff,
  },
  8192: {
    bg: 0x3d002b,
    border: 0xff00aa,
    glow: '#ffffff',
    text: '#ffffff',
    textColorInt: 0xffffff,
  },
  '★': {
    bg: 0x24103b,
    border: 0xffd700,
    glow: '#00f0ff',
    text: '#ffffff',
    textColorInt: 0xffffff,
  },
};

export const WILDCARD_VALUE = '★';

export const DEFAULT_NEON = {
  bg: 0x221133,
  border: 0xffffff,
  glow: '#ffffff',
  text: '#ffffff',
  textColorInt: 0xffffff,
};

export const AUDIO_KEYS = {
  MERGE: 'snd_merge',
  SHOOT: 'snd_shoot',
  COMBO: 'snd_combo',
  GAMEOVER: 'snd_gameover',
  SWAP: 'snd_swap',
  LAND: 'snd_land',
  WARN: 'snd_warn',
  POWERUP: 'snd_powerup',
  HAMMER: 'snd_hammer',
  HYPE: 'snd_hype',
  COMBO_1: 'snd_combo_1',
  COMBO_2: 'snd_combo_2',
  COMBO_3: 'snd_combo_3',
  COMBO_4: 'snd_combo_4',
  COMBO_5: 'snd_combo_5',
  COMBO_6: 'snd_combo_6',
  COMBO_7: 'snd_combo_7',
  COMBO_8: 'snd_combo_8',
};

export const PRAISE_PHRASES = [
  'NICE!',
  'GREAT!',
  'AMAZING!',
  'SUPER MERGE!',
  'CYBER COMBO!',
  'UNSTOPPABLE!',
  'SUPERNOVA!',
];

export const ANIMATION = {
  SHOOT_SPEED: 2200, // Pixels per second
  MERGE_DURATION: 160, // ms
  DROP_DURATION: 140, // ms
  POP_DURATION: 180, // ms
};

export const MILESTONES = [64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384];

export const COIN_REWARDS = {
  MERGE: 2,
  COMBO: 5,
  MILESTONE: 100,
};

export const POWERUP_COSTS = {
  HAMMER: 300,
  WILDCARD: 450,
  ROW_CLEAR: 600,
  REVIVE: 500,
  SWAP: 100,
};
