import {
  GAME_WIDTH,
  GAME_HEIGHT,
  GRID_COLS,
  GRID_ROWS,
  TILE_SIZE,
  TILE_GAP,
  GRID_OFFSET_X,
  GRID_OFFSET_Y,
} from './constants.js';

export class GameSettings {
  /**
   * Get center pixel position of a cell (col, row)
   * @param {number} col (0 .. 4)
   * @param {number} row (0 .. 7)
   * @returns {{x: number, y: number}}
   */
  static getCellPosition(col, row) {
    const x = GRID_OFFSET_X + col * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2;
    const y = GRID_OFFSET_Y + row * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2;
    return { x, y };
  }

  /**
   * Map screen/world X coordinate to column index clamped to 0..GRID_COLS-1
   * @param {number} x 
   * @returns {number}
   */
  static getColumnFromX(x) {
    const colStep = TILE_SIZE + TILE_GAP;
    const relativeX = x - GRID_OFFSET_X;
    const col = Math.floor(relativeX / colStep);
    return Math.max(0, Math.min(GRID_COLS - 1, col));
  }

  /**
   * Calculate center X for a given column
   * @param {number} col 
   * @returns {number}
   */
  static getColumnCenterX(col) {
    return GRID_OFFSET_X + col * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2;
  }

  /**
   * Calculate spawn probabilities based on highest tile unlocked
   * @param {number} maxBoardValue 
   * @returns {number[]} Array of weighted possible values
   */
  static getSpawnPool(maxBoardValue = 8) {
    if (maxBoardValue >= 1024) {
      return [2, 4, 8, 16, 32, 64, 128];
    } else if (maxBoardValue >= 512) {
      return [2, 4, 8, 16, 32, 64];
    } else if (maxBoardValue >= 256) {
      return [2, 4, 8, 16, 32];
    } else if (maxBoardValue >= 64) {
      return [2, 4, 8, 16];
    }
    return [2, 4, 8];
  }

  /**
   * Pick a random number tile based on max unlocked value and difficulty config
   * @param {number} maxBoardValue 
   * @param {object} [diffConfig] 
   * @param {object} [gridManager]
   * @returns {number}
   */
  static getRandomBlockValue(maxBoardValue = 8, diffConfig = null, gridManager = null) {
    const pool = this.getSpawnPool(maxBoardValue);

    // 1. Friendly Match Assist: In Easy/Medium, chance to roll a tile that matches an active column bottom
    if (diffConfig && diffConfig.matchAssistRate > 0 && gridManager && Math.random() < diffConfig.matchAssistRate) {
      const bottomTiles = [];
      for (let c = 0; c < 5; c++) {
        const landing = gridManager.getLandingRow(c);
        if (landing > 0) {
          const b = gridManager.getBlock(c, landing - 1);
          if (b && typeof b.value === 'number' && pool.includes(b.value)) {
            bottomTiles.push(b.value);
          }
        }
      }
      if (bottomTiles.length > 0) {
        return bottomTiles[Math.floor(Math.random() * bottomTiles.length)];
      }
    }

    // Weighted selection: lower values are more frequent
    const weights = pool.map((val, idx) => Math.max(1, 10 - idx * 2));
    const totalWeight = weights.reduce((acc, w) => acc + w, 0);
    let rand = Math.random() * totalWeight;

    for (let i = 0; i < pool.length; i++) {
      if (rand < weights[i]) {
        return pool[i];
      }
      rand -= weights[i];
    }
    return pool[0];
  }

  /**
   * Calculate score for a merge taking difficulty multiplier into account
   * In Hard mode: multipliers are NOT awarded easily (requires combo >= 3)!
   * @param {number} mergedValue 
   * @param {number} combo 
   * @param {object} [diffConfig]
   * @returns {number}
   */
  static calculateMergeScore(mergedValue, combo = 1, diffConfig = null) {
    let multiplier = 1;
    const baseMult = diffConfig?.scoreMultiplier || 1.0;

    if (diffConfig && diffConfig.minComboForMultiplier === 3) {
      // Hard mode: do NOT show or give multipliers easily!
      if (combo >= 3) {
        multiplier = (combo - 1) * baseMult;
      } else {
        multiplier = 1.0; // No multiplier on simple combo 1 or 2 in Hard!
      }
    } else {
      // Easy / Medium mode: standard combo multipliers
      multiplier = Math.max(1, combo) * baseMult;
    }

    return Math.round(mergedValue * multiplier);
  }
}

export default GameSettings;
