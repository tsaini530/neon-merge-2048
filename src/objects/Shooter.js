import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GRID_COLS,
  GRID_ROWS,
  TILE_SIZE,
  TILE_GAP,
  GRID_OFFSET_X,
  GRID_OFFSET_Y,
  GRID_HEIGHT,
  SHOOTER_Y,
  BOTTOM_DOCK_Y,
  AUDIO_KEYS,
  ANIMATION,
  WILDCARD_VALUE,
  POWERUP_COSTS,
} from '../config/constants.js';
import { GameSettings } from '../config/gameSettings.js';
import Block from './Block.js';

export class Shooter extends Phaser.GameObjects.Container {
  /**
   * @param {Phaser.Scene} scene 
   * @param {import('./GridManager.js').GridManager} gridManager 
   */
  constructor(scene, gridManager) {
    super(scene, 0, 0);
    this.gridManager = gridManager;

    this.currentBlock = null;
    this.nextBlock = null;
    this.ghostBlock = null;
    this.isShooting = false;
    this.activeCol = 2; // Default center column
    this.activePredictedMatches = [];
    this.hammerCount = 2;

    this.minRailX = GameSettings.getColumnCenterX(0);
    this.maxRailX = GameSettings.getColumnCenterX(GRID_COLS - 1);

    this._createVisualElements();
    this.scene.add.existing(this);
  }

  _createVisualElements() {
    // 1. Column Lane Highlight
    this.colHighlight = this.scene.add.graphics();
    this.colHighlight.setAlpha(0.2);
    this.add(this.colHighlight);

    // 2. Trajectory Laser Beam (Shooting straight up)
    this.laserBeam = this.scene.add.graphics();
    this.add(this.laserBeam);

    // 3. Match prediction connector energy lines
    this.matchLinkGraphics = this.scene.add.graphics();
    this.add(this.matchLinkGraphics);

    // 4. Sliding Rail Track spanning the 5 columns
    this.railGraphics = this.scene.add.graphics();
    this.add(this.railGraphics);
    this._drawRailTrack();

    // 5. Slider Carriage (Carries the launcher cradle & pointer)
    this.carriage = this.scene.add.container(GameSettings.getColumnCenterX(this.activeCol), SHOOTER_Y);
    this._drawCarriageCradle();
    this.add(this.carriage);

    // 6. Match Prediction Tag Badge ("★ MERGE!")
    this.matchBadge = this.scene.add.container(0, 0);
    this.matchBadge.setDepth(35);
    const badgeBg = this.scene.add.graphics();
    badgeBg.fillStyle(0x0a2f15, 0.95);
    badgeBg.lineStyle(2, 0x39ff14, 0.95);
    badgeBg.fillRoundedRect(-54, -14, 108, 28, 8);
    badgeBg.strokeRoundedRect(-54, -14, 108, 28, 8);
    this.matchBadge.add(badgeBg);

    this.matchBadgeText = this.scene.add.text(0, 0, '★ MERGE!', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '13px',
      color: '#39ff14',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.matchBadge.add(this.matchBadgeText);
    this.matchBadge.setVisible(false);

    // 7. Tactical Bottom Dock (Next Tile, Swap Button & Hammer Tool)
    this._createBottomDock();
  }

  _drawRailTrack(activeCol = this.activeCol) {
    this.railGraphics.clear();

    const railY = SHOOTER_Y;
    const padW = TILE_SIZE;
    const padH = 46;

    for (let c = 0; c < GRID_COLS; c++) {
      const cx = GameSettings.getColumnCenterX(c);
      const isActive = c === activeCol;

      const px = cx - padW / 2;
      const py = railY + TILE_SIZE / 2 - 4;

      // Launch Pad Body (matches 5 column bay pads in reference screenshot)
      this.railGraphics.fillStyle(isActive ? 0x0c223c : 0x0a0e20, isActive ? 0.95 : 0.7);
      this.railGraphics.fillRoundedRect(px, py, padW, padH, 12);

      this.railGraphics.lineStyle(isActive ? 2 : 1, isActive ? 0x00f0ff : 0x1c2848, isActive ? 0.95 : 0.6);
      this.railGraphics.strokeRoundedRect(px, py, padW, padH, 12);

      // Upward Chevron ▲ Indicator
      const arrowY = py + padH / 2;
      this.railGraphics.lineStyle(isActive ? 3 : 2, isActive ? 0x39ff14 : 0x3d4e75, isActive ? 0.95 : 0.45);
      this.railGraphics.beginPath();
      this.railGraphics.moveTo(cx - 9, arrowY + 5);
      this.railGraphics.lineTo(cx, arrowY - 5);
      this.railGraphics.lineTo(cx + 9, arrowY + 5);
      this.railGraphics.strokePath();

      if (isActive) {
        // Active indicator pulse glow
        this.railGraphics.fillStyle(0x00f0ff, 0.12);
        this.railGraphics.fillCircle(cx, arrowY, 16);
      }
    }
  }

  _drawCarriageCradle() {
    const cradle = this.scene.add.graphics();

    // Base neon halo glow under current block
    cradle.fillStyle(0x00f0ff, 0.08);
    cradle.fillCircle(0, 0, TILE_SIZE * 0.72);

    // Mechanical cyber brackets
    cradle.lineStyle(3, 0x00f0ff, 0.85);
    cradle.strokeRoundedRect(-TILE_SIZE / 2 - 5, -TILE_SIZE / 2 - 5, TILE_SIZE + 10, TILE_SIZE + 10, 16);

    // Corner guides
    cradle.fillStyle(0x00f0ff, 1);
    cradle.fillRect(-TILE_SIZE / 2 - 5, -TILE_SIZE / 2 - 5, 12, 4);
    cradle.fillRect(TILE_SIZE / 2 - 7, -TILE_SIZE / 2 - 5, 12, 4);
    cradle.fillRect(-TILE_SIZE / 2 - 5, TILE_SIZE / 2 + 1, 12, 4);
    cradle.fillRect(TILE_SIZE / 2 - 7, TILE_SIZE / 2 + 1, 12, 4);

    // Neon Chevron Arrow pointing STRAIGHT UP
    cradle.lineStyle(4, 0x39ff14, 0.95);
    const arrowY = -TILE_SIZE / 2 - 16;
    cradle.beginPath();
    cradle.moveTo(-16, arrowY + 10);
    cradle.lineTo(0, arrowY);
    cradle.lineTo(16, arrowY + 10);
    cradle.strokePath();

    this.carriage.add(cradle);
  }

  _createBottomDock() {
    this.bottomDock = this.scene.add.container(GAME_WIDTH / 2, BOTTOM_DOCK_Y);

    const dockWidth = 570;
    const dockHeight = 58;

    // Cyber dock backdrop
    const dockBg = this.scene.add.graphics();
    dockBg.fillStyle(0x090c1d, 0.95);
    dockBg.fillRoundedRect(-dockWidth / 2, -dockHeight / 2, dockWidth, dockHeight, 18);
    dockBg.lineStyle(2, 0x1f2c4e, 0.9);
    dockBg.strokeRoundedRect(-dockWidth / 2, -dockHeight / 2, dockWidth, dockHeight, 18);
    this.bottomDock.add(dockBg);

    // 1. NEXT Tile Slot Section (Left side of dock, X = -180)
    const nextSlotX = -180;
    const nextLabel = this.scene.add.text(nextSlotX - 44, 0, 'NEXT', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '13px',
      color: '#6e7ea6',
      letterSpacing: 2,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.bottomDock.add(nextLabel);

    this.nextSlotContainer = this.scene.add.container(nextSlotX + 22, 0);
    this.bottomDock.add(this.nextSlotContainer);

    // 2. SWAP Button Section (Center of dock, X = 0)
    this.swapBtn = this.scene.add.container(0, 0);

    this.swapBg = this.scene.add.graphics();
    this.swapBg.fillStyle(0x131938, 0.95);
    this.swapBg.lineStyle(2, 0x00f0ff, 0.85);
    this.swapBg.fillRoundedRect(-65, -19, 130, 38, 12);
    this.swapBg.strokeRoundedRect(-65, -19, 130, 38, 12);
    this.swapBtn.add(this.swapBg);

    const swapCost = this.scene.diffConfig?.swapCost || POWERUP_COSTS.SWAP || 20;
    this.swapText = this.scene.add.text(0, 0, `⇄ SWAP ${swapCost}¢`, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '13px',
      color: '#00f0ff',
      fontStyle: 'bold',
      letterSpacing: 0.5,
    }).setOrigin(0.5);
    this.swapBtn.add(this.swapText);

    this.swapBtn.setSize(130, 38);
    this.swapBtn.setInteractive(
      new Phaser.Geom.Rectangle(-65, -19, 130, 38),
      Phaser.Geom.Rectangle.Contains
    );
    this.swapBtn.on('pointerdown', (pointer) => {
      if (pointer && pointer.event) pointer.event.stopPropagation();
      this.swapBlocks();
    });
    this.bottomDock.add(this.swapBtn);

    // 3. HAMMER SMASH Tool Section (Right of dock, X = 180)
    this.hammerBtn = this.scene.add.container(180, 0);

    this.hammerBg = this.scene.add.graphics();
    this.hammerBg.fillStyle(0x2d1607, 0.95);
    this.hammerBg.lineStyle(2, 0xff7b00, 0.85);
    this.hammerBg.fillRoundedRect(-65, -19, 130, 38, 12);
    this.hammerBg.strokeRoundedRect(-65, -19, 130, 38, 12);
    this.hammerBtn.add(this.hammerBg);

    this.hammerLabel = this.scene.add.text(-8, 0, 'SMASH', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '15px',
      color: '#ffaa00',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5);
    this.hammerBtn.add(this.hammerLabel);

    // Count badge
    this.hammerBadge = this.scene.add.text(48, -10, `${this.hammerCount}`, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#ff3b00',
      padding: { x: 5, y: 2 },
    }).setOrigin(0.5);
    this.hammerBtn.add(this.hammerBadge);

    this.hammerBtn.setSize(130, 38);
    this.hammerBtn.setInteractive(
      new Phaser.Geom.Rectangle(-65, -19, 130, 38),
      Phaser.Geom.Rectangle.Contains
    );
    this.hammerBtn.on('pointerdown', (pointer) => {
      if (pointer && pointer.event) pointer.event.stopPropagation();
      this.scene.events.emit('toggle-hammer');
    });
    this.bottomDock.add(this.hammerBtn);

    this.add(this.bottomDock);
  }

  setHammerActive(isActive) {
    if (isActive) {
      this.hammerBg.clear();
      this.hammerBg.fillStyle(0x3a0011, 0.95);
      this.hammerBg.lineStyle(2, 0xff005d, 0.95);
      this.hammerBg.fillRoundedRect(-65, -19, 130, 38, 12);
      this.hammerBg.strokeRoundedRect(-65, -19, 130, 38, 12);
      this.hammerLabel.setText('✕ CANCEL');
      this.hammerLabel.setColor('#ff005d');
      this.hammerBadge.setVisible(false);
    } else {
      this.hammerBg.clear();
      this.hammerBg.fillStyle(0x2d1607, 0.95);
      this.hammerBg.lineStyle(2, 0xff7b00, 0.85);
      this.hammerBg.fillRoundedRect(-65, -19, 130, 38, 12);
      this.hammerBg.strokeRoundedRect(-65, -19, 130, 38, 12);
      this.hammerLabel.setText('SMASH');
      this.hammerLabel.setColor('#ffaa00');
      this.hammerBadge.setVisible(this.hammerCount > 0);
    }
  }

  setHammerCount(count) {
    this.hammerCount = count;
    this.hammerBadge.setText(`${count}`);
    this.hammerBadge.setVisible(count > 0);
  }

  updateSwapCost(cost) {
    if (this.swapText) {
      this.swapText.setText(`⇄ SWAP ${cost}¢`);
    }
  }

  /**
   * Initialize blocks in shooter slots
   * @param {number} maxBoardValue 
   */
  initShooter(maxBoardValue = 8) {
    if (this.currentBlock) {
      this.currentBlock.destroy();
      this.currentBlock = null;
    }
    if (this.nextBlock) {
      this.nextBlock.destroy();
      this.nextBlock = null;
    }
    if (this.ghostBlock) {
      this.ghostBlock.destroy();
      this.ghostBlock = null;
    }

    let val1 = GameSettings.getRandomBlockValue(maxBoardValue, this.scene.diffConfig, this.gridManager);
    let val2 = GameSettings.getRandomBlockValue(maxBoardValue, this.scene.diffConfig, this.gridManager);

    // First shot guaranteed hook: match the 4 in center column
    if (this.scene.score === 0) {
      val1 = 4;
      val2 = 2;
    }

    // Initial position at center column (col 2)
    this.activeCol = 2;
    const initialX = GameSettings.getColumnCenterX(this.activeCol);
    this.carriage.x = initialX;

    // Current block inside active launcher carriage
    this.currentBlock = new Block(this.scene, initialX, SHOOTER_Y, val1);
    this.currentBlock.setScale(1);
    this.currentBlock.setDepth(25);

    // Next block inside bottom dock
    this.nextBlock = new Block(this.scene, 0, 0, val2);
    this.nextBlock.setScale(0.55);
    this.nextSlotContainer.add(this.nextBlock);

    // Make next slot tap-to-swap as well
    this.nextSlotContainer.setSize(TILE_SIZE * 0.6, TILE_SIZE * 0.6);
    this.nextSlotContainer.setInteractive({ useHandCursor: true });
    this.nextSlotContainer.on('pointerdown', (pointer) => {
      pointer.event.stopPropagation();
      this.swapBlocks();
    });

    this.setAimColumn(2, true);
  }

  /**
   * Load a Wildcard Rainbow Tile into the shooter carriage
   */
  loadWildcard() {
    if (this.currentBlock) {
      this.currentBlock.setValue(WILDCARD_VALUE);
      this.scene.events.emit('play-sound', AUDIO_KEYS.POWERUP, { volume: 0.8 });
      this._updateAimVisuals();
    }
  }

  /**
   * Smoothly glide slider carriage to follow touch/mouse drag position
   * @param {number} x Screen world X coordinate
   */
  updateDragPosition(x) {
    if (this.isShooting) return;

    // Clamp X to slider rail bounds
    const clampedX = Math.max(this.minRailX, Math.min(this.maxRailX, x));

    // Smoothly track carriage and current block
    this.carriage.x = clampedX;
    if (this.currentBlock) {
      this.currentBlock.x = clampedX;
    }

    // Determine nearest column
    const col = GameSettings.getColumnFromX(clampedX);
    if (col !== this.activeCol) {
      this.activeCol = col;
      this.scene.events.emit('play-sound', AUDIO_KEYS.LAND, { volume: 0.12, rate: 2.2 });
    }

    this._updateAimVisuals();
  }

  /**
   * Set target aim column and smoothly glide carriage there
   * @param {number} col (0 .. 4)
   * @param {boolean} immediate
   */
  setAimColumn(col, immediate = false) {
    if (this.isShooting) return;

    this.activeCol = Math.max(0, Math.min(GRID_COLS - 1, col));
    const targetX = GameSettings.getColumnCenterX(this.activeCol);

    if (immediate) {
      this.carriage.x = targetX;
      if (this.currentBlock) {
        this.currentBlock.x = targetX;
      }
      this._updateAimVisuals();
    } else {
      this.scene.tweens.killTweensOf([this.carriage, this.currentBlock]);
      this.scene.tweens.add({
        targets: [this.carriage, this.currentBlock],
        x: targetX,
        duration: 90,
        ease: 'Cubic.easeOut',
        onUpdate: () => this._updateAimVisuals(),
        onComplete: () => this._updateAimVisuals(),
      });
    }
  }

  /**
   * Redraw laser trajectory, match prediction highlights & ghost tile
   */
  _updateAimVisuals() {
    if (this.isShooting || !this.currentBlock) return;

    // Clear previous match prediction states
    if (this.activePredictedMatches.length > 0) {
      this.activePredictedMatches.forEach((b) => b.setPredictedMatch(false));
      this.activePredictedMatches = [];
    }
    this.matchLinkGraphics.clear();
    this._drawRailTrack(this.activeCol);

    const colX = GameSettings.getColumnCenterX(this.activeCol);
    const landingRow = this.gridManager.getLandingRow(this.activeCol);
    const clampedRow = Math.min(landingRow, GRID_ROWS - 1);
    const targetPos = GameSettings.getCellPosition(this.activeCol, clampedRow);

    // Query prospective matches
    const matches = this.gridManager.getProjectedMatches(this.activeCol, this.currentBlock.value);
    const hasMatches = matches.length > 0;

    if (hasMatches) {
      matches.forEach((b) => b.setPredictedMatch(true));
      this.activePredictedMatches = matches;
    }

    const themeColor = hasMatches ? 0x39ff14 : 0x00f0ff;

    // 1. Draw glowing Column Lane Highlight
    this.colHighlight.clear();
    this.colHighlight.fillStyle(themeColor, hasMatches ? 0.12 : 0.08);
    this.colHighlight.fillRoundedRect(
      colX - TILE_SIZE / 2,
      GRID_OFFSET_Y - 8,
      TILE_SIZE,
      (SHOOTER_Y - GRID_OFFSET_Y) + 8,
      12
    );

    // 2. Draw Trajectory Laser Beam straight UP from the sliding carriage
    this.laserBeam.clear();
    const carriageX = this.carriage.x;
    const startY = SHOOTER_Y - TILE_SIZE / 2 - 10;
    const endY = targetPos.y + TILE_SIZE / 2;

    // Outer aura laser
    this.laserBeam.lineStyle(hasMatches ? 8 : 6, themeColor, hasMatches ? 0.35 : 0.22);
    this.laserBeam.beginPath();
    this.laserBeam.moveTo(carriageX, startY);
    this.laserBeam.lineTo(colX, endY);
    this.laserBeam.strokePath();

    // Sharp bright core laser beam
    this.laserBeam.lineStyle(3, themeColor, 0.95);
    this.laserBeam.beginPath();
    this.laserBeam.moveTo(carriageX, startY);
    this.laserBeam.lineTo(colX, endY);
    this.laserBeam.strokePath();

    // 3. Connect energy links to matching neighbor blocks
    const hideBadge = this.scene.diffConfig?.hidePredictionBadge;

    if (hasMatches && !hideBadge) {
      this.matchLinkGraphics.lineStyle(3, 0x39ff14, 0.8);
      for (const m of matches) {
        this.matchLinkGraphics.beginPath();
        this.matchLinkGraphics.moveTo(targetPos.x, targetPos.y);
        this.matchLinkGraphics.lineTo(m.x, m.y);
        this.matchLinkGraphics.strokePath();
      }

      // Show match badge
      this.matchBadge.setPosition(targetPos.x, targetPos.y - TILE_SIZE / 2 - 20);
      this.matchBadgeText.setText(matches.length > 1 ? `★ COMBO x${matches.length}!` : '★ MERGE!');
      this.matchBadge.setVisible(true);
    } else {
      this.matchBadge.setVisible(false);
    }

    // 4. Update Ghost Block preview at landing position
    if (!this.ghostBlock || !this.ghostBlock.scene) {
      if (this.ghostBlock) {
        this.ghostBlock.destroy();
        this.ghostBlock = null;
      }
      this.ghostBlock = new Block(this.scene, targetPos.x, targetPos.y, this.currentBlock.value);
      this.ghostBlock.setAsGhost(0.42);
      this.ghostBlock.setDepth(14);
    } else {
      this.ghostBlock.setPosition(targetPos.x, targetPos.y);
      this.ghostBlock.setValue(this.currentBlock.value);
      this.ghostBlock.setAsGhost(0.42);
      this.ghostBlock.setDepth(14);
      this.ghostBlock.setVisible(true);
    }
  }

  /**
   * Hide aiming trajectory, link lines, and ghost preview
   */
  hideAim() {
    if (this.activePredictedMatches.length > 0) {
      this.activePredictedMatches.forEach((b) => b.setPredictedMatch(false));
      this.activePredictedMatches = [];
    }
    this.colHighlight.clear();
    this.laserBeam.clear();
    this.matchLinkGraphics.clear();
    this.matchBadge.setVisible(false);
    if (this.ghostBlock && this.ghostBlock.scene) {
      this.ghostBlock.setVisible(false);
    }
  }

  /**
   * Swap current block and next block with a tactile 3D flip animation
   */
  swapBlocks() {
    if (this.isShooting || !this.currentBlock || !this.nextBlock) return;

    // Check coin charge through scene handler
    if (typeof this.scene.handleSwapRequest === 'function') {
      const allowed = this.scene.handleSwapRequest();
      if (!allowed) return;
    }

    this.scene.events.emit('play-sound', AUDIO_KEYS.SWAP, { volume: 0.7 });

    // Tactile button bounce
    this.scene.tweens.add({
      targets: this.swapBtn,
      scaleX: 0.94,
      scaleY: 0.94,
      duration: 70,
      yoyo: true,
    });

    const currentVal = this.currentBlock.value;
    const nextVal = this.nextBlock.value;

    // Flip animation
    this.scene.tweens.add({
      targets: [this.currentBlock, this.nextBlock],
      scaleX: 0,
      duration: 110,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.currentBlock.setValue(nextVal);
        this.nextBlock.setValue(currentVal);
        this.nextBlock.setScale(0.55);

        if (this.ghostBlock && this.ghostBlock.scene) {
          this.ghostBlock.setValue(nextVal);
          this.ghostBlock.setAsGhost(0.42);
        }

        // Flip back in
        this.scene.tweens.add({
          targets: this.currentBlock,
          scaleX: 1,
          scaleY: 1,
          duration: 130,
          ease: 'Back.easeOut',
        });
        this.scene.tweens.add({
          targets: this.nextBlock,
          scaleX: 0.55,
          scaleY: 0.55,
          duration: 130,
          ease: 'Back.easeOut',
        });
      },
    });
  }

  /**
   * Visual feedback when player tries to swap without enough coins
   */
  highlightInsufficientCoins() {
    this.scene.tweens.add({
      targets: this.swapBtn,
      x: { from: -7, to: 7 },
      duration: 45,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.swapBtn.x = 0;
      },
    });

    if (this.swapBg) {
      this.swapBg.clear();
      this.swapBg.fillStyle(0x38131d, 0.95);
      this.swapBg.lineStyle(2, 0xff0055, 0.95);
      this.swapBg.fillRoundedRect(-65, -19, 130, 38, 12);
      this.swapBg.strokeRoundedRect(-65, -19, 130, 38, 12);

      this.scene.time.delayedCall(400, () => {
        if (this.swapBg) {
          this.swapBg.clear();
          this.swapBg.fillStyle(0x131938, 0.95);
          this.swapBg.lineStyle(2, 0x00f0ff, 0.85);
          this.swapBg.fillRoundedRect(-65, -19, 130, 38, 12);
          this.swapBg.strokeRoundedRect(-65, -19, 130, 38, 12);
        }
      });
    }
  }

  /**
   * Fire block straight up along the active column
   * @param {number} col 
   * @param {Function} onLanded 
   */
  shoot(col, onLanded) {
    if (this.isShooting || !this.currentBlock) return;

    this.isShooting = true;
    this.hideAim();

    const targetCol = col !== undefined ? col : this.activeCol;
    const targetColX = GameSettings.getColumnCenterX(targetCol);

    // Snap carriage and block exactly to column center before flight
    this.carriage.x = targetColX;
    this.currentBlock.x = targetColX;

    const firedBlock = this.currentBlock;
    const incomingVal = firedBlock.value;

    // Check landing destination
    const sim = this.gridManager.simulateShot(targetCol, incomingVal);
    let targetY;
    let landingRow = sim.landingRow;

    if (sim.landingRow >= GRID_ROWS) {
      // Overflow past danger line -> Game Over
      targetY = GRID_OFFSET_Y + GRID_ROWS * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2;
    } else {
      const pos = GameSettings.getCellPosition(targetCol, sim.landingRow);
      targetY = pos.y;
    }

    // Advance next block to active launcher
    this._advanceNextBlock(targetColX);

    // Play laser shoot sound
    this.scene.events.emit('play-sound', AUDIO_KEYS.SHOOT, { volume: 0.75 });

    // Straight vertical launch tween
    const distance = Math.abs(SHOOTER_Y - targetY);
    const duration = Math.max(120, (distance / ANIMATION.SHOOT_SPEED) * 1000);

    this.scene.tweens.add({
      targets: firedBlock,
      x: targetColX,
      y: targetY,
      duration: duration,
      ease: 'Linear',
      onComplete: () => {
        firedBlock.squish();
        this.scene.events.emit('play-sound', AUDIO_KEYS.LAND, { volume: 0.55 });

        // Trigger neighbor elastic gel wobble on impact
        this.gridManager.triggerNeighborWobble(targetCol, landingRow);

        if (onLanded) {
          onLanded({
            block: firedBlock,
            col: targetCol,
            landingRow: landingRow,
            isOverflow: !sim.canFit,
          });
        }
      },
    });
  }

  /**
   * Advance the next block from bottom dock into the active sliding carriage
   * @param {number} carriageX 
   */
  _advanceNextBlock(carriageX) {
    const nextVal = this.nextBlock.value;

    // Convert nextBlock into the active currentBlock in scene coordinates
    this.nextSlotContainer.remove(this.nextBlock);
    this.nextBlock.destroy();

    this.currentBlock = new Block(
      this.scene,
      this.bottomDock.x - 180 + 22,
      BOTTOM_DOCK_Y,
      nextVal
    );
    this.currentBlock.setScale(0.55);
    this.currentBlock.setDepth(25);

    // Tween the new block gliding up from the dock into the sliding carriage
    this.scene.tweens.add({
      targets: this.currentBlock,
      x: carriageX,
      y: SHOOTER_Y,
      scaleX: 1,
      scaleY: 1,
      duration: 180,
      ease: 'Cubic.easeOut',
    });

    // Spawn new next block in bottom dock
    const maxVal = this.gridManager.getMaxValue();
    const newNextVal = GameSettings.getRandomBlockValue(maxVal, this.scene.diffConfig, this.gridManager);

    this.nextBlock = new Block(this.scene, 40, 0, newNextVal);
    this.nextBlock.setScale(0.1);
    this.nextBlock.setAlpha(0);
    this.nextSlotContainer.add(this.nextBlock);

    this.scene.tweens.add({
      targets: this.nextBlock,
      x: 0,
      scaleX: 0.55,
      scaleY: 0.55,
      alpha: 1,
      duration: 180,
      ease: 'Back.easeOut',
    });
  }

  /**
   * Re-enable shooter after merges and animations resolve
   */
  unlock() {
    this.isShooting = false;
    this.setAimColumn(this.activeCol, true);
  }
}

export default Shooter;
