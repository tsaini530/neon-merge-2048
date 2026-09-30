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
      return [2, 4, 8, 16, 32, 64];
    } else if (maxBoardValue >= 512) {
      return [2, 4, 8, 16, 32];
    } else if (maxBoardValue >= 128) {
      return [2, 4, 8, 16];
    } else if (maxBoardValue >= 32) {
      return [2, 4, 8];
    }
    return [2, 4, 8];
  }

  /**
   * Pick a random number tile based on max unlocked value
   * @param {number} maxBoardValue 
   * @returns {number}
   */
  static getRandomBlockValue(maxBoardValue = 8) {
    const pool = this.getSpawnPool(maxBoardValue);
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
   * Calculate score for a merge
   * @param {number} mergedValue 
   * @param {number} combo 
   * @returns {number}
   */
  static calculateMergeScore(mergedValue, combo = 1) {
    return mergedValue * Math.max(1, combo);
  }
}

export default GameSettings;
