import {
  GRID_COLS,
  GRID_ROWS,
  DANGER_ROW,
  ANIMATION,
  AUDIO_KEYS,
  WILDCARD_VALUE,
} from '../config/constants.js';
import { GameSettings } from '../config/gameSettings.js';
import Block from './Block.js';

export class GridManager {
  /**
   * @param {Phaser.Scene} scene 
   */
  constructor(scene) {
    this.scene = scene;
    /** @type {(Block|null)[][]} */
    this.grid = Array.from({ length: GRID_ROWS }, () =>
      Array(GRID_COLS).fill(null)
    );
    this.projectedMatches = [];
  }

  /**
   * Clear the entire grid and destroy all block objects
   */
  clear() {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.grid[r][c]) {
          this.grid[r][c].destroy();
          this.grid[r][c] = null;
        }
      }
    }
  }

  /**
   * Populate starting board with 2 or 3 top rows
   */
  initStartingBoard() {
    this.clear();
    const initialRows = 3;
    const initialValues = [2, 4, 8, 16, 32];

    for (let r = 0; r < initialRows; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        // Leave a couple random empty gaps for interesting puzzle setup
        if (r === 2 && Math.random() < 0.35) continue;

        const val = initialValues[Math.floor(Math.random() * initialValues.length)];
        const pos = GameSettings.getCellPosition(c, r);
        const block = new Block(this.scene, pos.x, pos.y, val);
        block.col = c;
        block.row = r;
        block.spawnPop();
        this.grid[r][c] = block;
      }
    }
  }

  /**
   * Find the landing row for a column (top-anchored stacking)
   * @param {number} col 
   * @returns {number} 0 .. GRID_ROWS. If equal to GRID_ROWS, column is full.
   */
  getLandingRow(col) {
    for (let r = 0; r < GRID_ROWS; r++) {
      if (this.grid[r][col] === null) {
        return r;
      }
    }
    return GRID_ROWS; // Column is completely full
  }

  /**
   * Get block at grid coordinate
   * @param {number} col 
   * @param {number} row 
   * @returns {Block|null}
   */
  getBlock(col, row) {
    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) {
      return null;
    }
    return this.grid[row][col];
  }

  /**
   * Check if shooting into this column is valid or causes game over
   * @param {number} col 
   * @param {number} incomingValue 
   * @returns {{ canFit: boolean, landingRow: number, willDirectMerge: boolean }}
   */
  simulateShot(col, incomingValue) {
    const landingRow = this.getLandingRow(col);
    if (landingRow < GRID_ROWS) {
      return { canFit: true, landingRow, willDirectMerge: false };
    }

    // Column is full (landingRow === GRID_ROWS).
    // If incoming block matches the bottom-most block (row 7), it can still merge!
    const bottomBlock = this.grid[GRID_ROWS - 1][col];
    if (bottomBlock && bottomBlock.value === incomingValue) {
      return { canFit: true, landingRow: GRID_ROWS - 1, willDirectMerge: true };
    }

    return { canFit: false, landingRow: GRID_ROWS, willDirectMerge: false };
  }

  /**
   * Place block into grid matrix
   * @param {Block} block 
   * @param {number} col 
   * @param {number} row 
   */
  placeBlock(block, col, row) {
    if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
      this.grid[row][col] = block;
      block.col = col;
      block.row = row;
    }
  }

  /**
   * Shift any hanging blocks upward to maintain contiguous columns to the ceiling
   * @returns {Promise<boolean>} True if any block moved
   */
  async applyUpwardGravity() {
    let movedAny = false;
    const dropPromises = [];

    for (let c = 0; c < GRID_COLS; c++) {
      let emptyRow = -1;
      for (let r = 0; r < GRID_ROWS; r++) {
        if (this.grid[r][c] === null) {
          if (emptyRow === -1) emptyRow = r;
        } else if (emptyRow !== -1) {
          // Move block at (r, c) up to (emptyRow, c)
          const block = this.grid[r][c];
          this.grid[emptyRow][c] = block;
          this.grid[r][c] = null;
          block.row = emptyRow;

          const targetPos = GameSettings.getCellPosition(c, emptyRow);
          dropPromises.push(block.moveTo(targetPos.x, targetPos.y, ANIMATION.DROP_DURATION));

          emptyRow++;
          movedAny = true;
        }
      }
    }

    if (dropPromises.length > 0) {
      await Promise.all(dropPromises);
    }
    return movedAny;
  }

  /**
   * Find matching adjacent orthogonal blocks
   * @param {number} col 
   * @param {number} row 
   * @param {number|string} targetValue 
   * @returns {Block[]}
   */
  getMatchingNeighbors(col, row, targetValue) {
    const matches = [];
    const dirs = [
      { c: 0, r: -1 }, // Up
      { c: 0, r: 1 },  // Down
      { c: -1, r: 0 }, // Left
      { c: 1, r: 0 },  // Right
    ];

    const isWild = targetValue === WILDCARD_VALUE;

    for (const d of dirs) {
      const nc = col + d.c;
      const nr = row + d.r;
      const neighbor = this.getBlock(nc, nr);
      if (neighbor && !neighbor.isMerging) {
        if (isWild || neighbor.value === WILDCARD_VALUE || neighbor.value === targetValue) {
          matches.push(neighbor);
        }
      }
    }

    return matches;
  }

  /**
   * Preview which blocks will merge if an incoming block is launched into column
   * @param {number} col 
   * @param {number|string} incomingValue 
   * @returns {Block[]}
   */
  getProjectedMatches(col, incomingValue) {
    const sim = this.simulateShot(col, incomingValue);
    if (!sim.canFit && !sim.willDirectMerge) {
      return [];
    }

    const landingRow = sim.landingRow;
    return this.getMatchingNeighbors(col, landingRow, incomingValue);
  }

  /**
   * Trigger elastic gel/crystal wobble on orthogonal neighbors
   * @param {number} col 
   * @param {number} row 
   */
  triggerNeighborWobble(col, row) {
    const dirs = [
      { c: 0, r: -1 },
      { c: 0, r: 1 },
      { c: -1, r: 0 },
      { c: 1, r: 0 },
    ];
    for (const d of dirs) {
      const nb = this.getBlock(col + d.c, row + d.r);
      if (nb) nb.wobble();
    }
  }

  /**
   * Toggle target crosshair reticles and direct click handlers on all active blocks for hammer mode
   * @param {boolean} active 
   */
  showHammerTargets(active) {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const b = this.grid[r][c];
        if (b) {
          b.setTargetCrosshair(active);
          if (active) {
            b.setInteractive(
              new Phaser.Geom.Rectangle(-TILE_SIZE / 2 - 10, -TILE_SIZE / 2 - 10, TILE_SIZE + 20, TILE_SIZE + 20),
              Phaser.Geom.Rectangle.Contains
            );
            b.removeAllListeners('pointerdown');
            b.on('pointerdown', (pointer) => {
              if (pointer && pointer.event) pointer.event.stopPropagation();
              this.scene._executeHammerSmash(b.col, b.row);
            });
          } else {
            b.disableInteractive();
            b.removeAllListeners('pointerdown');
          }
        }
      }
    }
  }

  /**
   * Find closest active block on the entire board to given coordinates
   * @param {number} x 
   * @param {number} y 
   * @returns {{block: Block, col: number, row: number}|null}
   */
  getClosestBlock(x, y) {
    let nearest = null;
    let minDist = Infinity;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const b = this.grid[r][c];
        if (b && !b.isMerging) {
          const d = Math.hypot(b.x - x, b.y - y);
          if (d < minDist) {
            minDist = d;
            nearest = { block: b, col: c, row: r };
          }
        }
      }
    }

    return nearest;
  }

  /**
   * Find nearest occupied block within generous touch radius
   * @param {number} x 
   * @param {number} y 
   * @param {number} maxDist 
   * @returns {{block: Block, col: number, row: number}|null}
   */
  getNearestBlock(x, y, maxDist = 90) {
    let nearest = null;
    let minDist = maxDist;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const b = this.grid[r][c];
        if (b) {
          const d = Math.hypot(b.x - x, b.y - y);
          if (d < minDist) {
            minDist = d;
            nearest = { block: b, col: c, row: r };
          }
        }
      }
    }

    return nearest;
  }

  /**
   * Vaporize a block with the Cyber Hammer tool
   * @param {number} col 
   * @param {number} row 
   * @param {Function} onMergeStep 
   * @returns {Promise<boolean>}
   */
  async destroyBlockWithHammer(col, row, onMergeStep) {
    const block = this.getBlock(col, row);
    if (!block) return false;

    this.grid[row][col] = null;
    await block.vaporize();

    await this.applyUpwardGravity();

    // Check if new merges are enabled by this clearance
    const secondaryMatches = this.findAnyReadyMerge();
    if (secondaryMatches.length > 0) {
      await this.processRecursiveMerges(secondaryMatches[0], onMergeStep);
    }

    this.updateDangerStates();
    return true;
  }

  /**
   * Execute recursive 2048 merge cascade starting from a landed or settled block
   * @param {Block} rootBlock 
   * @param {Function} onMergeStep Callback for each merge step (points, combo, newTile)
   * @returns {Promise<number>} Total combo achieved
   */
  async processRecursiveMerges(rootBlock, onMergeStep) {
    let combo = 0;
    let queue = [rootBlock];

    while (queue.length > 0) {
      const activeBlock = queue.shift();
      if (!activeBlock || activeBlock.isMerging || !this.isBlockInGrid(activeBlock)) {
        continue;
      }

      const col = activeBlock.col;
      const row = activeBlock.row;
      let val = activeBlock.value;

      const matchingNeighbors = this.getMatchingNeighbors(col, row, val);
      if (matchingNeighbors.length === 0) {
        continue;
      }

      combo++;

      // Handle Wildcard merge logic:
      if (val === WILDCARD_VALUE) {
        // Adopt the highest adjacent block's numeric value
        const numericNeighbors = matchingNeighbors.filter((nb) => nb.value !== WILDCARD_VALUE);
        val = numericNeighbors.length > 0 ? numericNeighbors[0].value : 2;
      }

      // Calculate new merged value: 1 match -> 2x, 2 matches -> 4x, etc.
      const multiplier = Math.pow(2, matchingNeighbors.length);
      const newValue = (typeof val === 'number' ? val : 2) * multiplier;

      // Animate neighbors into the active block
      const mergeAnimations = matchingNeighbors.map((nb) => {
        this.grid[nb.row][nb.col] = null;
        return nb.mergeInto(activeBlock.x, activeBlock.y);
      });

      await Promise.all(mergeAnimations);

      // Upgrade active block value with pop effect
      activeBlock.setValue(newValue);

      // Trigger merge step callback (score, sound, VFX)
      if (onMergeStep) {
        onMergeStep({
          value: newValue,
          combo: combo,
          x: activeBlock.x,
          y: activeBlock.y,
          col: activeBlock.col,
          row: activeBlock.row,
        });
      }

      // Compact columns upward if spaces were left
      await this.applyUpwardGravity();

      // Enqueue the updated active block to check for further chain merges
      queue.push(activeBlock);

      // Also check if any other block in the grid can now merge
      const secondaryMatches = this.findAnyReadyMerge();
      if (secondaryMatches.length > 0) {
        queue.push(...secondaryMatches);
      }
    }

    this.updateDangerStates();
    return combo;
  }

  /**
   * Check if block is still valid in current grid
   */
  isBlockInGrid(block) {
    if (!block || block.row < 0 || block.row >= GRID_ROWS || block.col < 0 || block.col >= GRID_COLS) {
      return false;
    }
    return this.grid[block.row][block.col] === block;
  }

  /**
   * Find any other block in grid that has matching neighbors
   * @returns {Block[]}
   */
  findAnyReadyMerge() {
    const ready = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const b = this.grid[r][c];
        if (b && !b.isMerging) {
          const neighbors = this.getMatchingNeighbors(c, r, b.value);
          if (neighbors.length > 0 && !ready.includes(b)) {
            ready.push(b);
          }
        }
      }
    }
    return ready;
  }

  /**
   * Update danger pulsing on tiles near bottom danger line
   */
  updateDangerStates() {
    let hasDanger = false;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const block = this.grid[r][c];
        if (block) {
          const isDanger = r >= DANGER_ROW - 1;
          block.setDangerPulsing(isDanger);
          if (isDanger) hasDanger = true;
        }
      }
    }
    return hasDanger;
  }

  /**
   * Find maximum block value present on the board
   * @returns {number}
   */
  getMaxValue() {
    let max = 2;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.grid[r][c] && this.grid[r][c].value > max) {
          max = this.grid[r][c].value;
        }
      }
    }
    return max;
  }

  /**
   * Check if any block has crossed the danger row without merging
   * @returns {boolean}
   */
  isGameOver() {
    for (let c = 0; c < GRID_COLS; c++) {
      if (this.grid[GRID_ROWS - 1][c] !== null) {
        // If bottom row has blocks and no immediate moves can clear it
        return true;
      }
    }
    return false;
  }

  /**
   * Revive powerup: Clear bottom rows to rescue the player
   * @param {number} rowCount 
   * @returns {Promise}
   */
  async clearBottomRows(rowCount = 3) {
    const startRow = Math.max(0, GRID_ROWS - rowCount);
    const destroyedBlocks = [];

    for (let r = startRow; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const b = this.grid[r][c];
        if (b) {
          this.grid[r][c] = null;
          destroyedBlocks.push(b);
        }
      }
    }

    // Animate vaporize
    destroyedBlocks.forEach((b) => {
      this.scene.tweens.add({
        targets: b,
        scaleX: 0,
        scaleY: 0,
        alpha: 0,
        duration: 250,
        onComplete: () => b.destroy(),
      });
    });

    await this.applyUpwardGravity();
    this.updateDangerStates();
  }

  /**
   * Serialize grid state for cloud saving
   */
  serialize() {
    const state = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.grid[r][c]) {
          state.push({
            c,
            r,
            v: this.grid[r][c].value,
          });
        }
      }
    }
    return state;
  }

  /**
   * Restore grid from saved state
   * @param {Array<{c: number, r: number, v: number}>} savedState 
   */
  deserialize(savedState) {
    this.clear();
    if (!Array.isArray(savedState)) return;

    for (const item of savedState) {
      if (item.r < GRID_ROWS && item.c < GRID_COLS) {
        const pos = GameSettings.getCellPosition(item.c, item.r);
        const block = new Block(this.scene, pos.x, pos.y, item.v);
        block.col = item.c;
        block.row = item.r;
        this.grid[item.r][item.c] = block;
      }
    }
    this.updateDangerStates();
  }
}

export default GridManager;
