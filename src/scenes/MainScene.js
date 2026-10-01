import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  GRID_COLS,
  GRID_ROWS,
  TILE_SIZE,
  TILE_GAP,
  GRID_OFFSET_X,
  GRID_OFFSET_Y,
  DANGER_LINE_Y,
  SHOOTER_Y,
  SHOOTER_X,
  BOTTOM_DOCK_Y,
  AUDIO_KEYS,
  NEON_COLORS,
  DEFAULT_NEON,
  PRAISE_PHRASES,
  MILESTONES,
  COIN_REWARDS,
  POWERUP_COSTS,
} from '../config/constants.js';
import { GameSettings } from '../config/gameSettings.js';
import { GridManager } from '../objects/GridManager.js';
import { Shooter } from '../objects/Shooter.js';
import { DIFFICULTY, DIFFICULTY_CONFIG } from '../config/difficultyConfig.js';
import { formatTileNumber, formatScore } from '../utils/numberFormat.js';
import ytService from '../sdk/ytService.js';
import playgamaService from '../sdk/playgamaService.js';

export class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
  }

  create(data) {
    const savedData = data?.savedData || null;

    this.currentDifficulty = data?.difficulty || DIFFICULTY.MEDIUM;
    this.diffConfig = DIFFICULTY_CONFIG[this.currentDifficulty] || DIFFICULTY_CONFIG[DIFFICULTY.MEDIUM];
    this.shotsUntilRowDrop = this.diffConfig.rowDropShots;
    this.stageCleared = false;
    this.difficultyModal = null;
    this.stageClearModal = null;

    this.score = 0;
    this.bestScore = 0;
    this.coins = 100;
    this.nextMilestone = this.diffConfig.targetGoal || 2048;
    this.combo = 0;
    this.isInputActive = true;
    this.reviveCount = 0;
    this.hyperEnergy = 0; // 0 .. 100
    this.isHammerMode = false;
    this.hammerCount = this.diffConfig.startingHammers !== undefined ? this.diffConfig.startingHammers : 1;
    this.nextHammerScoreThreshold = 6000;
    this.howToPlayModal = null;
    this.tutorialContainer = null;
    this.isTutorialDismissed = false;

    // 1. Setup Background & Neon Grid
    this._createBackground();
    this._createGridBackdrop();
    this._createDangerLine();

    // 2. Setup HUD (Score, High Score, Hyper Gauge)
    this._createHUD();

    // 3. Initialize Particle Emitters
    this._createParticleEmitters();

    // 4. Initialize Grid & Shooter
    this.gridManager = new GridManager(this);
    this.shooter = new Shooter(this, this.gridManager);
    this.shooter.setHammerCount(this.hammerCount);

    // 5. Setup Audio & Custom Event Handlers
    this._setupAudioEvents();

    // 6. Setup Controls (Drag-to-aim, Tap-to-fire, Hammer Tool)
    this._setupControls();

    // 7. Apply Preloaded Cloud/Storage Progress Synchronously BEFORE gameplay starts
    this._applySavedData(savedData);
    if (!savedData) {
      this._saveGameState();
    }

    // 7b. Launch FTUE visual guide if score is 0 (First Time User Experience)
    if (this.score === 0) {
      this._createTutorial();
    }

    // 8. YouTube Playables & Playgama gameReady() Lifecycle Signal (Dispatched after progress is restored)
    ytService.gameReady();
    playgamaService.sendGameReady();

    // Auto-save and pause on system blur/pause
    ytService.onPause(() => {
      this._saveGameState();
      this.pauseGame();
    });
    playgamaService.onPause(() => {
      this._saveGameState();
      this.pauseGame();
    });

    // Listen for scene resume from PauseScene or GameOverScene
    this.events.on('resume', () => {
      this.isInputActive = true;
      this.shooter.unlock();
    });
  }

  _createBackground() {
    // Cyberpunk gradient background
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x080914, 0x080914, 0x0e1124, 0x0e1124, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Subtle ambient scanline grid
    this.gridGlow = this.add.graphics();
    this.gridGlow.lineStyle(1, 0x00f0ff, 0.04);
    for (let x = 0; x < GAME_WIDTH; x += 40) {
      this.gridGlow.moveTo(x, 0);
      this.gridGlow.lineTo(x, GAME_HEIGHT);
    }
    for (let y = 0; y < GAME_HEIGHT; y += 40) {
      this.gridGlow.moveTo(0, y);
      this.gridGlow.lineTo(GAME_WIDTH, y);
    }
    this.gridGlow.strokePath();
  }

  _createGridBackdrop() {
    this.laneGraphics = this.add.graphics();
    const trackH = GRID_ROWS * (TILE_SIZE + TILE_GAP) + 12;

    for (let c = 0; c < GRID_COLS; c++) {
      const cx = GameSettings.getColumnCenterX(c);
      const trackX = cx - TILE_SIZE / 2;
      const trackY = GRID_OFFSET_Y - 6;

      // 5 Distinct Vertical Column Tracks (matching reference screenshot with neon styling)
      this.laneGraphics.fillStyle(0x090d20, 0.72);
      this.laneGraphics.fillRoundedRect(trackX, trackY, TILE_SIZE, trackH, 16);

      this.laneGraphics.lineStyle(1.5, 0x16213e, 0.8);
      this.laneGraphics.strokeRoundedRect(trackX, trackY, TILE_SIZE, trackH, 16);

      // Subtle slot markers inside each lane
      for (let r = 0; r < GRID_ROWS; r++) {
        const pos = GameSettings.getCellPosition(c, r);
        const slot = this.add.image(pos.x, pos.y, 'grid_slot');
        slot.setOrigin(0.5);
        slot.setAlpha(0.35);
      }
    }
  }

  _createDangerLine() {
    this.dangerBar = this.add.graphics();
    this._drawDangerLine(0.4);

    // Pulsing danger animation
    this.tweens.add({
      targets: this.dangerBar,
      alpha: 0.85,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  _drawDangerLine(alpha = 0.5) {
    this.dangerBar.clear();
    const startX = GRID_OFFSET_X - 10;
    const endX = GRID_OFFSET_X + GRID_COLS * (TILE_SIZE + TILE_GAP);

    // Neon hazard bar
    this.dangerBar.lineStyle(3, 0xff005d, alpha);
    this.dangerBar.beginPath();
    this.dangerBar.moveTo(startX, DANGER_LINE_Y);
    this.dangerBar.lineTo(endX, DANGER_LINE_Y);
    this.dangerBar.strokePath();

    // Hazard accent tags
    this.dangerBar.fillStyle(0xff005d, alpha * 0.8);
    for (let x = startX + 10; x < endX; x += 40) {
      this.dangerBar.fillTriangle(x, DANGER_LINE_Y, x + 8, DANGER_LINE_Y - 8, x + 16, DANGER_LINE_Y);
    }
  }

  _createHUD() {
    const topBarY = 52;

    // 1. Top-Left: PAUSE Button ("||")
    this.pauseBtn = this.add.container(44, topBarY);
    const pBg = this.add.graphics();
    pBg.fillStyle(0x0e1329, 0.95);
    pBg.lineStyle(2, 0x00f0ff, 0.85);
    pBg.fillRoundedRect(-19, -21, 38, 42, 12);
    pBg.strokeRoundedRect(-19, -21, 38, 42, 12);
    this.pauseBtn.add(pBg);

    const pIcon = this.add.text(0, 0, '❚❚', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '15px',
      color: '#00f0ff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.pauseBtn.add(pIcon);

    const pauseHit = this.add.rectangle(44, topBarY, 46, 48, 0x000000, 0);
    pauseHit.setDepth(50);
    pauseHit.setInteractive({ useHandCursor: true });
    pauseHit.on('pointerdown', (pointer) => {
      if (pointer && pointer.event) pointer.event.stopPropagation();
      this.pauseGame();
    });

    // 1b. HOW TO PLAY ("?") Button
    this.helpBtn = this.add.container(90, topBarY);
    const helpBg = this.add.graphics();
    helpBg.fillStyle(0x0e1329, 0.95);
    helpBg.lineStyle(2, 0x39ff14, 0.85);
    helpBg.fillRoundedRect(-19, -21, 38, 42, 12);
    helpBg.strokeRoundedRect(-19, -21, 38, 42, 12);
    this.helpBtn.add(helpBg);

    const helpIcon = this.add.text(0, 0, '?', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '18px',
      color: '#39ff14',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.helpBtn.add(helpIcon);

    const helpHit = this.add.rectangle(90, topBarY, 46, 48, 0x000000, 0);
    helpHit.setDepth(50);
    helpHit.setInteractive({ useHandCursor: true });
    helpHit.on('pointerdown', (pointer) => {
      if (pointer && pointer.event) pointer.event.stopPropagation();
      this.openHowToPlay();
    });

    // 1c. STAGE / DIFFICULTY Pill Badge (Tapping opens Difficulty Select Modal!)
    this.stageBadge = this.add.container(175, topBarY);
    this.stageBadgeBg = this.add.graphics();
    this.stageBadge.add(this.stageBadgeBg);

    this.stageBadgeText = this.add.text(0, -6, `${this.diffConfig.label} ▾`, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '13px',
      color: this.diffConfig.color,
      fontStyle: 'bold',
      letterSpacing: 0.5,
    }).setOrigin(0.5);
    this.stageBadge.add(this.stageBadgeText);

    this.stageBadgeSub = this.add.text(0, 10, 'MODE', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '9px',
      color: '#8da2d4',
      letterSpacing: 1.5,
    }).setOrigin(0.5);
    this.stageBadge.add(this.stageBadgeSub);

    const stageHit = this.add.rectangle(175, topBarY, 94, 46, 0x000000, 0);
    stageHit.setDepth(50);
    stageHit.setInteractive({ useHandCursor: true });
    stageHit.on('pointerdown', (pointer) => {
      if (pointer && pointer.event) pointer.event.stopPropagation();
      this._showDifficultySelectModal();
    });

    // 2. Top-Center: Score & Best Record Capsule
    const scoreBoxW = 205;
    const scoreBoxH = 58;
    const scoreCapsule = this.add.container(GAME_WIDTH / 2, topBarY);
    const scBg = this.add.graphics();
    scBg.fillStyle(0x0a0e22, 0.96);
    scBg.lineStyle(2, 0x1f2c4e, 0.9);
    scBg.fillRoundedRect(-scoreBoxW / 2, -scoreBoxH / 2, scoreBoxW, scoreBoxH, 16);
    scBg.strokeRoundedRect(-scoreBoxW / 2, -scoreBoxH / 2, scoreBoxW, scoreBoxH, 16);
    scoreCapsule.add(scBg);

    this.scoreText = this.add.text(0, -9, `${formatScore(this.score)}`, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '26px',
      color: '#00f0ff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    scoreCapsule.add(this.scoreText);

    this.bestText = this.add.text(0, 15, `★ BEST: ${formatScore(this.bestScore)}`, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '11px',
      color: '#ffe600',
      letterSpacing: 1,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    scoreCapsule.add(this.bestText);

    // 2b. ROW DROP Countdown / Status Pill
    this.rowDropBadge = this.add.container(515, topBarY);
    this.rowDropBg = this.add.graphics();
    this.rowDropBadge.add(this.rowDropBg);

    this.rowDropText = this.add.text(0, -6, '', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '13px',
      color: '#00f0ff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.rowDropBadge.add(this.rowDropText);

    this.rowDropSub = this.add.text(0, 10, 'SHOTS', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '9px',
      color: '#8da2d4',
      letterSpacing: 1,
    }).setOrigin(0.5);
    this.rowDropBadge.add(this.rowDropSub);

    // 3. Top-Right: Target Goal Milestone Badge
    this.milestoneBadge = this.add.container(638, topBarY);
    this.milestoneBg = this.add.graphics();
    this._drawMilestoneBadge();
    this.milestoneBadge.add(this.milestoneBg);

    this.milestoneValText = this.add.text(0, -7, `${formatTileNumber(this.nextMilestone)}`, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '19px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.milestoneBadge.add(this.milestoneValText);

    this.milestoneLabel = this.add.text(0, 14, 'GOAL', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '10px',
      color: '#8da2d4',
      letterSpacing: 1.5,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.milestoneBadge.add(this.milestoneLabel);

    this._updateStageBadge();
    this._updateRowDropBadge();

    // 4. Sub-Header (Y = 112): Coin Balance & Hyper Gauge
    const subBarY = 112;

    // Coins Counter (Left)
    this.coinContainer = this.add.container(120, subBarY);
    const coinBg = this.add.graphics();
    coinBg.fillStyle(0x0e1329, 0.92);
    coinBg.lineStyle(1.5, 0xffea00, 0.7);
    coinBg.fillRoundedRect(-60, -18, 120, 36, 12);
    coinBg.strokeRoundedRect(-60, -18, 120, 36, 12);
    this.coinContainer.add(coinBg);

    // Gold Coin Icon Badge
    const coinGraphic = this.add.graphics();
    coinGraphic.fillStyle(0xffea00, 1);
    coinGraphic.fillCircle(-36, 0, 11);
    coinGraphic.fillStyle(0xcca000, 1);
    coinGraphic.fillCircle(-36, 0, 8);
    this.coinContainer.add(coinGraphic);

    const coinSym = this.add.text(-36, 0, '¢', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '12px',
      color: '#0e1329',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.coinContainer.add(coinSym);

    this.coinText = this.add.text(0, 0, `${this.coins}`, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '16px',
      color: '#ffea00',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.coinContainer.add(this.coinText);

    // Green "+" Shop Indicator Badge
    const plusBg = this.add.graphics();
    plusBg.fillStyle(0x0a2f15, 0.95);
    plusBg.lineStyle(1.5, 0x39ff14, 0.95);
    plusBg.fillRoundedRect(38, -12, 22, 24, 6);
    plusBg.strokeRoundedRect(38, -12, 22, 24, 6);
    this.coinContainer.add(plusBg);

    const plusText = this.add.text(49, 0, '+', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '16px',
      color: '#39ff14',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.coinContainer.add(plusText);

    // Dedicated top-depth touch hit area for shop
    const shopHit = this.add.rectangle(120, subBarY, 130, 44, 0x000000, 0);
    shopHit.setDepth(45);
    shopHit.setInteractive({ useHandCursor: true });
    shopHit.on('pointerdown', (pointer) => {
      if (pointer && pointer.event) pointer.event.stopPropagation();
      this.openShop();
    });

    // ⚡ Hyper Gauge (Center-Right)
    const meterY = subBarY;
    this.meterW = 340;
    this.meterH = 12;

    this.hyperBarBg = this.add.graphics();
    this.hyperBarBg.fillStyle(0x0a0e21, 0.9);
    this.hyperBarBg.fillRoundedRect(GAME_WIDTH / 2 + 50 - this.meterW / 2, meterY - 6, this.meterW, this.meterH, 6);
    this.hyperBarBg.lineStyle(1, 0x1f2c4e, 0.85);
    this.hyperBarBg.strokeRoundedRect(GAME_WIDTH / 2 + 50 - this.meterW / 2, meterY - 6, this.meterW, this.meterH, 6);

    this.hyperBarFill = this.add.graphics();
    this._updateHyperBar();

    this.hyperTag = this.add.text(GAME_WIDTH / 2 + 50, meterY - 14, '⚡ HYPER CHARGE', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '10px',
      color: '#00f0ff',
      letterSpacing: 2,
    }).setOrigin(0.5);

    // Floating Combo Display
    this.comboBanner = this.add.text(GAME_WIDTH / 2, 142, '', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '22px',
      color: '#ffe600',
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0);

    // Hammer Active Banner (Prominent notification with tap-to-cancel, positioned cleanly above grid)
    this.hammerBanner = this.add.container(GAME_WIDTH / 2, 108);
    this.hammerBanner.setDepth(150);
    const hBg = this.add.graphics();
    hBg.fillStyle(0x381200, 0.96);
    hBg.lineStyle(3, 0xffaa00, 0.95);
    hBg.fillRoundedRect(-240, -20, 480, 40, 14);
    hBg.strokeRoundedRect(-240, -20, 480, 40, 14);
    this.hammerBanner.add(hBg);

    const hText = this.add.text(-40, 0, '🎯 TAP ANY TILE TO SMASH!', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '14px',
      color: '#ffea00',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5);
    this.hammerBanner.add(hText);

    const hCancel = this.add.text(180, 0, '[✕ CANCEL]', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '12px',
      color: '#ff005d',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.hammerBanner.add(hCancel);

    this.hammerBanner.setSize(480, 40);
    this.hammerBanner.setInteractive(
      new Phaser.Geom.Rectangle(-240, -20, 480, 40),
      Phaser.Geom.Rectangle.Contains
    );
    this.hammerBanner.input.cursor = 'pointer';
    this.hammerBanner.on('pointerdown', (pointer) => {
      if (pointer && pointer.event) pointer.event.stopPropagation();
      this._toggleHammerMode(false);
    });
    this.hammerBanner.setVisible(false);
  }

  _getLevelName(milestone) {
    if (milestone <= 64) return 'LVL 1';
    if (milestone <= 128) return 'LVL 2';
    if (milestone <= 256) return 'LVL 3';
    if (milestone <= 512) return 'LVL 4';
    if (milestone <= 1024) return 'LVL 5';
    if (milestone <= 2048) return 'LVL 6 (CHAMP)';
    return 'LVL 7 (MASTER)';
  }

  _drawMilestoneBadge() {
    if (!this.milestoneBg) return;
    this.milestoneBg.clear();
    const displayVal = this.diffConfig?.targetGoal || this.nextMilestone;
    const theme = NEON_COLORS[displayVal] || DEFAULT_NEON;
    const color = theme.textColorInt || 0xffea00;

    this.milestoneBg.fillStyle(0x0e1329, 0.95);
    this.milestoneBg.lineStyle(2, color, 0.9);
    this.milestoneBg.fillRoundedRect(-48, -26, 96, 52, 14);
    this.milestoneBg.strokeRoundedRect(-48, -26, 96, 52, 14);

    if (this.milestoneValText) {
      this.milestoneValText.setText(formatTileNumber(displayVal));
      this.milestoneValText.setColor(theme.text || '#ffffff');
    }
    if (this.milestoneLabel) {
      this.milestoneLabel.setText('GOAL');
    }
  }

  _updateStageBadge() {
    if (!this.stageBadgeBg || !this.stageBadgeText) return;
    const cfg = this.diffConfig || DIFFICULTY_CONFIG[DIFFICULTY.MEDIUM];
    this.stageBadgeBg.clear();
    this.stageBadgeBg.fillStyle(cfg.badgeBg || 0x0e1329, 0.95);
    this.stageBadgeBg.lineStyle(2, cfg.colorInt || 0x00f0ff, 0.95);
    this.stageBadgeBg.fillRoundedRect(-47, -21, 94, 42, 12);
    this.stageBadgeBg.strokeRoundedRect(-47, -21, 94, 42, 12);

    this.stageBadgeText.setText(`${cfg.label} ▾`);
    this.stageBadgeText.setColor(cfg.color || '#00f0ff');
  }

  _updateRowDropBadge() {
    if (!this.rowDropBg || !this.rowDropText) return;
    const cfg = this.diffConfig || DIFFICULTY_CONFIG[DIFFICULTY.MEDIUM];
    this.rowDropBg.clear();

    if (!cfg.rowDropShots) {
      // Easy / Zen mode
      this.rowDropBg.fillStyle(0x061e14, 0.95);
      this.rowDropBg.lineStyle(1.5, 0x00ff88, 0.85);
      this.rowDropBg.fillRoundedRect(-46, -21, 92, 42, 12);
      this.rowDropBg.strokeRoundedRect(-46, -21, 92, 42, 12);
      this.rowDropText.setText('ZEN');
      this.rowDropText.setColor('#00ff88');
      this.rowDropSub.setText('NO DROPS');
      this.rowDropSub.setColor('#79dfb0');
    } else {
      const isUrgent = this.shotsUntilRowDrop <= (cfg.rowDropWarning || 2);
      const bgColor = isUrgent ? 0x360515 : 0x0a1026;
      const borderColor = isUrgent ? 0xff0055 : 0x1f3c6e;
      const textColor = isUrgent ? '#ff0055' : '#00f0ff';

      this.rowDropBg.fillStyle(bgColor, 0.95);
      this.rowDropBg.lineStyle(isUrgent ? 2 : 1.5, borderColor, 0.95);
      this.rowDropBg.fillRoundedRect(-46, -21, 92, 42, 12);
      this.rowDropBg.strokeRoundedRect(-46, -21, 92, 42, 12);

      this.rowDropText.setText(isUrgent ? `! DROP: ${this.shotsUntilRowDrop}` : `DROP: ${this.shotsUntilRowDrop}`);
      this.rowDropText.setColor(textColor);
      this.rowDropSub.setText(isUrgent ? 'DANGER!' : 'SHOTS');
      this.rowDropSub.setColor(isUrgent ? '#ff6b8b' : '#8da2d4');
    }
  }

  _pulseRowDropWarning() {
    if (!this.rowDropBadge) return;
    this.tweens.killTweensOf(this.rowDropBadge);
    this.tweens.add({
      targets: this.rowDropBadge,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 120,
      yoyo: true,
      ease: 'Back.easeOut',
    });
  }

  _celebrateMilestone(value) {
    const nextTarget = MILESTONES.find((m) => m > value) || value * 2;
    this.nextMilestone = nextTarget;
    this.milestoneValText.setText(`${this.nextMilestone}`);
    this._drawMilestoneBadge();

    // Badge pop animation
    this.tweens.add({
      targets: this.milestoneBadge,
      scaleX: 1.25,
      scaleY: 1.25,
      duration: 160,
      yoyo: true,
      ease: 'Back.easeOut',
    });

    // Audio & screen flash
    this.events.emit('play-sound', AUDIO_KEYS.HYPE, { volume: 0.95 });
    this.cameras.main.flash(260, 255, 230, 0);

    // Award milestone coin bonus
    this._addCoins(COIN_REWARDS.MILESTONE, GAME_WIDTH / 2, 280);

    // Celebration banner with Level Name
    const lvl = this._getLevelName(value);
    this._showCelebrationText(`★ ${lvl} COMPLETE! ★\nUNLOCKED ${value} TILE!\n+${COIN_REWARDS.MILESTONE} COINS BONUS`);

    this._saveGameState();
  }

  _addCoins(amount, x, y) {
    this.coins += amount;
    this.coinText.setText(`${this.coins}`);

    // Coin container pop animation
    this.tweens.add({
      targets: this.coinContainer,
      scaleX: 1.18,
      scaleY: 1.18,
      duration: 90,
      yoyo: true,
      ease: 'Back.easeOut',
    });

    if (x !== undefined && y !== undefined) {
      this._showFloatingText(x, y - 28, `+${amount}`, '#ffea00');
    }
  }

  pauseGame() {
    if (this.scene.isActive('PauseScene') || this.scene.isActive('ShopScene') || this.scene.isActive('GameOverScene')) return;
    this.isInputActive = false;
    this.shooter.hideAim();
    this.events.emit('play-sound', AUDIO_KEYS.WARN, { volume: 0.5 });
    this.scene.pause('MainScene');
    this.scene.launch('PauseScene', {
      score: this.score,
      bestScore: this.bestScore,
      difficulty: this.currentDifficulty,
    });
  }

  openShop() {
    if (this.scene.isActive('ShopScene') || this.scene.isActive('PauseScene') || this.scene.isActive('GameOverScene')) return;
    this.isInputActive = false;
    this.shooter.hideAim();
    this.events.emit('play-sound', AUDIO_KEYS.LAND, { volume: 0.6 });
    this.scene.pause('MainScene');
    this.scene.launch('ShopScene', {
      coins: this.coins,
    });
  }

  _updateHyperBar() {
    this.hyperBarFill.clear();
    const pct = Math.max(0, Math.min(100, this.hyperEnergy)) / 100;
    if (pct <= 0) return;

    const fillWidth = Math.max(8, (this.meterW - 4) * pct);
    const color = pct >= 0.8 ? 0xffe600 : 0x00f0ff;
    this.hyperBarFill.fillStyle(color, 0.95);
    this.hyperBarFill.fillRoundedRect(GAME_WIDTH / 2 - this.meterW / 2 + 2, 122, fillWidth, this.meterH - 4, 3);
  }

  _createParticleEmitters() {
    this.sparkEmitter = this.add.particles(0, 0, 'particle_spark', {
      speed: { min: 80, max: 280 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.1, end: 0 },
      blendMode: 'ADD',
      lifespan: 450,
      emitting: false,
    });

    this.glowEmitter = this.add.particles(0, 0, 'particle_glow', {
      speed: { min: 20, max: 90 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.85, end: 0 },
      blendMode: 'ADD',
      lifespan: 550,
      emitting: false,
    });
  }

  _setupAudioEvents() {
    this.events.on('play-sound', (key, config = {}) => {
      if (!ytService.isAudioEnabled()) return;
      try {
        // Resume Web Audio AudioContext if browser autoplay policy suspended it
        if (this.sound && this.sound.context && this.sound.context.state === 'suspended') {
          this.sound.context.resume();
        }

        if (this.sound && (this.cache.audio.exists(key) || this.sound.get(key))) {
          this.sound.play(key, config);
        }
      } catch (err) {
        console.warn('Audio play error:', err);
      }
    });

    this.events.on('toggle-hammer', () => this._toggleHammerMode());
  }

  _toggleHammerMode(forceState) {
    if (forceState !== undefined) {
      this.isHammerMode = forceState;
    } else {
      if (this.hammerCount <= 0) {
        if (this.coins >= POWERUP_COSTS.HAMMER) {
          this.coins -= POWERUP_COSTS.HAMMER;
          this.hammerCount = 1;
          this.coinText.setText(`${this.coins}`);
          this.shooter.setHammerCount(this.hammerCount);
          this._showFloatingText(GAME_WIDTH / 2, BOTTOM_DOCK_Y - 40, `+1 SMASH BOUGHT! (-${POWERUP_COSTS.HAMMER} COINS)`, '#ffea00');
          this.events.emit('play-sound', AUDIO_KEYS.POWERUP, { volume: 0.8 });
          this._saveGameState();
          this.isHammerMode = true;
        } else {
          this._showFloatingText(GAME_WIDTH / 2, BOTTOM_DOCK_Y - 40, `NEED COINS! OPENING SHOP FOR FREE SMASH...`, '#ff005d');
          this.events.emit('play-sound', AUDIO_KEYS.WARN, { volume: 0.5 });
          this.time.delayedCall(300, () => {
            this.openShop();
          });
          return;
        }
      } else {
        this.isHammerMode = !this.isHammerMode;
      }
    }

    this.hammerBanner.setVisible(this.isHammerMode);
    this.shooter.setHammerActive(this.isHammerMode);
    this.gridManager.showHammerTargets(this.isHammerMode);

    if (this.isHammerMode) {
      this.events.emit('play-sound', AUDIO_KEYS.WARN, { volume: 0.45 });
      this.shooter.hideAim();

      // Pulsing banner tween
      this.tweens.killTweensOf(this.hammerBanner);
      this.hammerBanner.setScale(0.92);
      this.tweens.add({
        targets: this.hammerBanner,
        scaleX: 1.02,
        scaleY: 1.02,
        duration: 300,
        yoyo: true,
        repeat: -1,
      });
    } else {
      this.tweens.killTweensOf(this.hammerBanner);
      this.hammerBanner.setScale(1);
      this.shooter.setAimColumn(this.shooter.activeCol, true);
    }
  }

  handleSwapRequest() {
    this._dismissTutorial();
    const cost = this.diffConfig?.swapCost || POWERUP_COSTS.SWAP || 20;

    if (this.coins >= cost) {
      this.coins -= cost;
      this.coinText.setText(`${this.coins}`);
      this._showFloatingText(GAME_WIDTH / 2, BOTTOM_DOCK_Y - 40, `-${cost} ¢`, '#ffea00');
      this.events.emit('play-sound', AUDIO_KEYS.POWERUP, { volume: 0.6 });
      this._saveGameState();
      return true;
    } else {
      this._showFloatingText(GAME_WIDTH / 2, BOTTOM_DOCK_Y - 40, `NEED ${cost} ¢ FOR SWAP!`, '#ff005d');
      this.events.emit('play-sound', AUDIO_KEYS.WARN, { volume: 0.7 });
      if (this.shooter && typeof this.shooter.highlightInsufficientCoins === 'function') {
        this.shooter.highlightInsufficientCoins();
      }
      return false;
    }
  }

  _setupControls() {
    let isDragging = false;

    this.input.on('pointerdown', (pointer) => {
      // Ensure Web Audio context is resumed on user click
      if (this.sound && this.sound.context && this.sound.context.state === 'suspended') {
        this.sound.context.resume();
      }

      // 0. Instant Top-Left Corner Hits (Pause, Help ?, Stage Badge)
      if (pointer.y <= 95) {
        if (pointer.x <= 68) {
          this.pauseGame();
          return;
        }
        if (pointer.x > 68 && pointer.x <= 118) {
          this.openHowToPlay();
          return;
        }
        if (pointer.x > 118 && pointer.x <= 230) {
          this._showDifficultySelectModal();
          return;
        }
      }

      // 0b. Direct Coin Shop Tap (Coin capsule region: X <= 220, Y between 85 and 135)
      if (pointer.x <= 220 && pointer.y >= 85 && pointer.y <= 135) {
        this.openShop();
        return;
      }

      if (!this.isInputActive) return;

      this._dismissTutorial();

      // 1. Foolproof Bottom Dock click handling
      if (pointer.y >= BOTTOM_DOCK_Y - 45) {
        // Tapped HAMMER SMASH button (Right side of dock: X >= 430)
        if (pointer.x >= GAME_WIDTH / 2 + 70) {
          this._toggleHammerMode();
          return;
        }

        // Tapped SWAP button or NEXT tile (Center & Left of dock: X < 430)
        this.shooter.swapBlocks();
        return;
      }

      // 2. Handle Hammer Targeting mode: user tapped on the grid!
      if (this.isHammerMode) {
        // Find closest active block on the board
        const target = this.gridManager.getClosestBlock(pointer.x, pointer.y);
        if (target) {
          this._executeHammerSmash(target.col, target.row);
          return;
        }

        // If clicked on empty air outside the board, do NOT cancel accidentally!
        // Player stays in hammer mode until they smash or tap [✕ CANCEL]
        return;
      }

      if (this.shooter.isShooting) return;
      if (pointer.y < 135) return; // Prevent tapping inside header/gauge

      isDragging = true;
      this.shooter.updateDragPosition(pointer.x);
    });

    this.input.on('pointermove', (pointer) => {
      if (this.isHammerMode) return;
      if (!isDragging || !this.isInputActive || this.shooter.isShooting) return;
      this.shooter.updateDragPosition(pointer.x);
    });

    this.input.on('pointerup', (pointer) => {
      if (this.isHammerMode) return;
      if (!isDragging || !this.isInputActive || this.shooter.isShooting) {
        isDragging = false;
        return;
      }
      isDragging = false;
      const targetCol = GameSettings.getColumnFromX(this.shooter.carriage.x);
      this._handleFire(targetCol);
    });
  }

  async _executeHammerSmash(col, row) {
    this._toggleHammerMode(false);
    this.isInputActive = false;

    // Consume 1 hammer charge
    this.hammerCount = Math.max(0, this.hammerCount - 1);
    this.shooter.setHammerCount(this.hammerCount);

    const pos = GameSettings.getCellPosition(col, row);

    // Play hammer disintegrator audio and VFX
    this.events.emit('play-sound', AUDIO_KEYS.HAMMER, { volume: 0.9 });
    this.sparkEmitter.setParticleTint(0xffaa00);
    this.sparkEmitter.explode(32, pos.x, pos.y);
    this.cameras.main.shake(160, 0.012);

    this._showFloatingText(pos.x, pos.y, 'SMASHED!', '#ffaa00');

    await this.gridManager.destroyBlockWithHammer(col, row, (step) => this._onMergeStep(step));
    this.isInputActive = true;
    this.shooter.unlock();
    this._saveGameState();
  }

  _handleFire(col) {
    this._dismissTutorial();
    this.shooter.shoot(col, async (result) => {
      const { block, landingRow, isOverflow } = result;

      if (isOverflow) {
        // Overflow beyond danger row -> Game Over
        block.destroy();
        this._handleGameOver();
        return;
      }

      // Place block in grid
      this.gridManager.placeBlock(block, col, landingRow);

      // Process recursive merges
      this.combo = 0;
      const mergesCount = await this.gridManager.processRecursiveMerges(
        block,
        (step) => this._onMergeStep(step)
      );

      // Check if difficulty has row drops enabled
      if (this.diffConfig && this.diffConfig.rowDropShots > 0) {
        this.shotsUntilRowDrop--;
        this._updateRowDropBadge();

        if (this.shotsUntilRowDrop <= (this.diffConfig.rowDropWarning || 2) && this.shotsUntilRowDrop > 0) {
          this.events.emit('play-sound', AUDIO_KEYS.WARN, { volume: 0.45 });
          this._pulseRowDropWarning();
        } else if (this.shotsUntilRowDrop <= 0) {
          this.shotsUntilRowDrop = this.diffConfig.rowDropShots;
          this._updateRowDropBadge();

          this._showFloatingText(GAME_WIDTH / 2, DANGER_LINE_Y - 40, '⚠️ ROW DROP!', '#ff0055');
          this.events.emit('play-sound', AUDIO_KEYS.WARN, { volume: 0.8 });
          this.cameras.main.shake(220, 0.012);

          const dropRes = await this.gridManager.pushRowDown(this.diffConfig);
          if (dropRes.isOverflow || this.gridManager.isGameOver()) {
            this._handleGameOver();
            return;
          }
        }
      }

      // Check danger state and game over
      const isOver = this.gridManager.isGameOver();
      if (isOver) {
        this._handleGameOver();
      } else {
        // Unlock shooter for next move
        this.shooter.unlock();
        this._saveGameState();
      }
    });
  }

  _onMergeStep(step) {
    const { value, combo, x, y } = step;

    // Calculate score taking difficulty and combo into account
    const earnedPoints = GameSettings.calculateMergeScore(value, combo, this.diffConfig);
    this._addScore(earnedPoints);

    // Calculate and award coins with difficulty multiplier
    const coinMult = this.diffConfig?.coinRewardMultiplier || 1.0;
    let earnedCoins = Math.round(COIN_REWARDS.MERGE * coinMult);
    if (combo >= 2) {
      earnedCoins += Math.round(COIN_REWARDS.COMBO * (combo - 1) * coinMult);
    }
    this._addCoins(earnedCoins, x, y);

    // Check Stage Clear Victory Condition
    if (typeof value === 'number' && value >= this.diffConfig.targetGoal && !this.stageCleared) {
      this.stageCleared = true;
      this._celebrateStageClear(value);
    } else if (typeof value === 'number' && value >= this.nextMilestone) {
      this._celebrateMilestone(value);
    }

    // Fill Hyper-Meter
    this.hyperEnergy += 18 + combo * 4;
    this._updateHyperBar();

    if (this.hyperEnergy >= 100) {
      this.hyperEnergy = 0;
      this._updateHyperBar();
      this._triggerHyperSurge();
    }

    // Particle burst
    const theme = NEON_COLORS[value];
    const tintColor = theme ? theme.border : 0x00f0ff;

    this.sparkEmitter.setParticleTint(tintColor);
    this.sparkEmitter.explode(18, x, y);

    this.glowEmitter.setParticleTint(tintColor);
    this.glowEmitter.explode(8, x, y);

    // Camera micro-shake for high-impact merges
    if (value >= 128) {
      this.cameras.main.shake(140, 0.008);
    } else if (value >= 64) {
      this.cameras.main.shake(100, 0.005);
    }

    // Play musical ascending pentatonic combo chime
    const noteIdx = Math.min(8, Math.max(1, combo));
    const noteKey = AUDIO_KEYS[`COMBO_${noteIdx}`] || AUDIO_KEYS.MERGE;
    this.events.emit('play-sound', noteKey, { volume: 0.85 });

    // In Hard mode, combo banner requires minComboForMultiplier (3+)
    const minCombo = this.diffConfig?.minComboForMultiplier || 2;
    if (combo >= minCombo) {
      this._showComboBanner(combo);
    }

    // Floating score popup
    this._showFloatingText(x, y, `+${earnedPoints}`);
  }

  _triggerHyperSurge() {
    this.events.emit('play-sound', AUDIO_KEYS.HYPE, { volume: 0.95 });
    this.cameras.main.flash(240, 255, 230, 0);

    // Laser shockwave VFX
    const shockwave = this.add.graphics();
    shockwave.lineStyle(8, 0xffd700, 1);
    shockwave.strokeCircle(GAME_WIDTH / 2, 125, 10);
    this.tweens.add({
      targets: shockwave,
      scaleX: 25,
      scaleY: 25,
      alpha: 0,
      duration: 500,
      ease: 'Cubic.easeOut',
      onComplete: () => shockwave.destroy(),
    });

    this._showCelebrationText('⚡ HYPER SURGE! WILDCARD READY!');
    this.shooter.loadWildcard();
  }

  _showFloatingText(x, y, text, color = '#39ff14') {
    const label = this.add.text(x, y, text, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '24px',
      color: color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: label,
      y: y - 55,
      alpha: 0,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 650,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  _showCelebrationText(text) {
    const banner = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 100, text, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '26px',
      color: '#ffe600',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
      letterSpacing: 2,
    }).setOrigin(0.5);

    banner.setScale(0);
    this.tweens.add({
      targets: banner,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 250,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(700, () => {
          this.tweens.add({
            targets: banner,
            alpha: 0,
            y: banner.y - 40,
            duration: 250,
            onComplete: () => banner.destroy(),
          });
        });
      },
    });
  }

  _showComboBanner(combo) {
    const phrase = PRAISE_PHRASES[Math.min(PRAISE_PHRASES.length - 1, combo - 2)];
    this.comboBanner.setText(`${phrase} COMBO x${combo}!`);
    this.comboBanner.setAlpha(1);
    this.comboBanner.setScale(1.4);

    this.tweens.killTweensOf(this.comboBanner);
    this.tweens.add({
      targets: this.comboBanner,
      scaleX: 1,
      scaleY: 1,
      duration: 180,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(850, () => {
          this.tweens.add({
            targets: this.comboBanner,
            alpha: 0,
            duration: 250,
          });
        });
      },
    });
  }

  _addScore(points) {
    this.score += points;
    this.scoreText.setText(formatScore(this.score));

    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      this.bestText.setText(`★ BEST: ${formatScore(this.bestScore)}`);
    }

    // Award bonus hammer every threshold - capped at 3 max and scaled threshold
    if (this.score >= this.nextHammerScoreThreshold) {
      this.nextHammerScoreThreshold = Math.max(
        this.nextHammerScoreThreshold + 6000,
        Math.floor(this.score * 1.5)
      );
      if (this.hammerCount < 3) {
        this.hammerCount++;
        this.shooter.setHammerCount(this.hammerCount);
        this._showFloatingText(GAME_WIDTH / 2, BOTTOM_DOCK_Y - 40, '⚡ +1 SMASHER EARNED!', '#ffaa00');
        this.events.emit('play-sound', AUDIO_KEYS.POWERUP, { volume: 0.7 });
      }
    }

    // Score pop animation
    this.tweens.add({
      targets: this.scoreText,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 80,
      yoyo: true,
    });
  }

  _handleGameOver() {
    this.isInputActive = false;
    this.shooter.hideAim();

    this._saveGameState();

    this.events.emit('play-sound', AUDIO_KEYS.GAMEOVER, { volume: 0.9 });
    this.cameras.main.shake(300, 0.015);

    this.time.delayedCall(600, () => {
      this.scene.pause('MainScene');
      this.scene.launch('GameOverScene', {
        score: this.score,
        bestScore: this.bestScore,
        coins: this.coins,
        highestTile: this.gridManager.getMaxValue(),
        difficulty: this.currentDifficulty,
        canRevive: this.reviveCount < 2,
      });
    });
  }

  /**
   * Revive handler called after watching rewarded ad
   */
  async revivePlayer() {
    this.reviveCount++;
    this.events.emit('play-sound', AUDIO_KEYS.POWERUP, { volume: 0.85 });

    // Laser shockwave VFX clearing bottom rows
    const shockwave = this.add.graphics();
    shockwave.lineStyle(6, 0x00f0ff, 1);
    shockwave.strokeCircle(GAME_WIDTH / 2, DANGER_LINE_Y - 80, 10);

    this.tweens.add({
      targets: shockwave,
      scaleX: 30,
      scaleY: 30,
      alpha: 0,
      duration: 600,
      ease: 'Cubic.easeOut',
      onComplete: () => shockwave.destroy(),
    });

    await this.gridManager.clearBottomRows(3);

    this.isInputActive = true;
    this.shooter.unlock();
  }

  startNewGame(diffKey) {
    if (diffKey && DIFFICULTY_CONFIG[diffKey]) {
      this.currentDifficulty = diffKey;
      this.diffConfig = DIFFICULTY_CONFIG[diffKey];
    }

    this.score = 0;
    this.scoreText.setText('0');
    this.reviveCount = 0;
    this.hyperEnergy = 0;
    this._updateHyperBar();
    this.isInputActive = true;
    this.isHammerMode = false;
    this.stageCleared = false;
    this.hammerBanner.setVisible(false);
    this.cameras.main.resetFX();

    this.shotsUntilRowDrop = this.diffConfig.rowDropShots;
    this.hammerCount = this.diffConfig.startingHammers !== undefined ? this.diffConfig.startingHammers : 1;
    this.shooter.setHammerCount(this.hammerCount);
    this.shooter.updateSwapCost(this.diffConfig.swapCost);
    this._updateStageBadge();
    this._updateRowDropBadge();

    this.gridManager.initStartingBoard(this.diffConfig);
    const maxVal = this.gridManager.getMaxValue();
    this.nextMilestone = this.diffConfig.targetGoal || 2048;
    this.milestoneValText.setText(`${formatTileNumber(this.nextMilestone)}`);
    this._drawMilestoneBadge();

    this.shooter.initShooter(maxVal);
    this.shooter.unlock();

    this.isTutorialDismissed = false;
    this._createTutorial();

    this._saveGameState();
  }

  _showDifficultySelectModal() {
    if (this.difficultyModal || this.stageClearModal || this.howToPlayModal) return;
    if (this.scene.isActive('PauseScene') || this.scene.isActive('ShopScene') || this.scene.isActive('GameOverScene')) return;

    this.isInputActive = false;
    this.shooter.hideAim();
    this.events.emit('play-sound', AUDIO_KEYS.WARN, { volume: 0.4 });

    this.difficultyModal = this.add.container(0, 0);
    this.difficultyModal.setDepth(120);

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05060e, 0.92);
    overlay.setInteractive();
    this.difficultyModal.add(overlay);

    const cardW = 590;
    const cardH = 680;
    const cardY = GAME_HEIGHT / 2;

    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x0a0e20, 0.98);
    cardBg.fillRoundedRect(GAME_WIDTH / 2 - cardW / 2, cardY - cardH / 2, cardW, cardH, 24);
    cardBg.lineStyle(3, 0x00f0ff, 0.9);
    cardBg.strokeRoundedRect(GAME_WIDTH / 2 - cardW / 2, cardY - cardH / 2, cardW, cardH, 24);
    this.difficultyModal.add(cardBg);

    // Glowing top accent
    const topAccent = this.add.graphics();
    topAccent.fillStyle(0x00f0ff, 1);
    topAccent.fillRoundedRect(GAME_WIDTH / 2 - 140, cardY - cardH / 2 - 3, 280, 6, 3);
    this.difficultyModal.add(topAccent);

    // Title
    const title = this.add.text(GAME_WIDTH / 2, cardY - cardH / 2 + 45, '⚡ SELECT DIFFICULTY ⚡', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '24px',
      color: '#00f0ff',
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setOrigin(0.5);
    this.difficultyModal.add(title);

    const sub = this.add.text(GAME_WIDTH / 2, cardY - cardH / 2 + 75, 'CHOOSE YOUR CHALLENGE LEVEL', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '11px',
      color: '#8da2d4',
      letterSpacing: 2,
    }).setOrigin(0.5);
    this.difficultyModal.add(sub);

    // Close '✕' button
    const closeBtn = this.add.text(GAME_WIDTH / 2 + cardW / 2 - 36, cardY - cardH / 2 + 36, '✕', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '24px',
      color: '#8da2d4',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this._closeDifficultyModal());
    this.difficultyModal.add(closeBtn);

    // 3 Difficulty cards
    const diffKeys = [DIFFICULTY.EASY, DIFFICULTY.MEDIUM, DIFFICULTY.HARD];
    let startY = cardY - cardH / 2 + 165;
    const cardItemH = 135;
    const cardItemW = 530;

    diffKeys.forEach((key) => {
      const cfg = DIFFICULTY_CONFIG[key];
      const isSelected = this.currentDifficulty === key;

      const itemContainer = this.add.container(GAME_WIDTH / 2, startY);

      const itemBg = this.add.graphics();
      itemBg.fillStyle(isSelected ? cfg.badgeBg : 0x0d122b, 0.95);
      itemBg.lineStyle(isSelected ? 2.5 : 1.5, isSelected ? cfg.colorInt : 0x223154, 0.95);
      itemBg.fillRoundedRect(-cardItemW / 2, -cardItemH / 2, cardItemW, cardItemH, 16);
      itemBg.strokeRoundedRect(-cardItemW / 2, -cardItemH / 2, cardItemW, cardItemH, 16);
      itemContainer.add(itemBg);

      // Title & Tag
      const headerText = this.add.text(-cardItemW / 2 + 20, -cardItemH / 2 + 18, `${cfg.label} - ${cfg.subLabel}`, {
        fontFamily: '"Arial Black", sans-serif',
        fontSize: '17px',
        color: cfg.color,
        fontStyle: 'bold',
      });
      itemContainer.add(headerText);

      // Target Goal Badge
      const goalText = this.add.text(cardItemW / 2 - 20, -cardItemH / 2 + 18, `GOAL: ${cfg.targetGoal}`, {
        fontFamily: '"Arial Black", sans-serif',
        fontSize: '15px',
        color: '#ffea00',
        fontStyle: 'bold',
      }).setOrigin(1, 0);
      itemContainer.add(goalText);

      // Detail specs
      let descLine1 = '';
      let descLine2 = '';
      if (key === DIFFICULTY.EASY) {
        descLine1 = '• Relaxed zen play • No row drops • 40% match assist';
        descLine2 = '• Swap cost: 10 ¢ • 2 Starting Hammers';
      } else if (key === DIFFICULTY.MEDIUM) {
        descLine1 = '• Classic arcade • Row drop every 12 shots • 15% match assist';
        descLine2 = '• Swap cost: 20 ¢ • 1.5x Multiplier • 1 Starting Hammer';
      } else {
        descLine1 = '• Pro stakes • Row drop every 7 shots • 0% match assist';
        descLine2 = '• Stealth aim • Strict 3+ combos for multiplier • 2.5x Score!';
      }

      const d1 = this.add.text(-cardItemW / 2 + 20, -cardItemH / 2 + 52, descLine1, {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        color: '#c4d3f2',
      });
      const d2 = this.add.text(-cardItemW / 2 + 20, -cardItemH / 2 + 78, descLine2, {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        color: isSelected ? '#ffffff' : '#8fa4cf',
      });
      itemContainer.add([d1, d2]);

      // Active / Select indicator badge
      if (isSelected) {
        const activeBadge = this.add.text(cardItemW / 2 - 20, cardItemH / 2 - 22, '✓ CURRENT ACTIVE', {
          fontFamily: '"Arial Black", sans-serif',
          fontSize: '13px',
          color: cfg.color,
          fontStyle: 'bold',
        }).setOrigin(1, 0.5);
        itemContainer.add(activeBadge);
      } else {
        const selectBadge = this.add.text(cardItemW / 2 - 20, cardItemH / 2 - 22, 'TAP TO SELECT ▶', {
          fontFamily: '"Arial Black", sans-serif',
          fontSize: '12px',
          color: '#6e80aa',
          fontStyle: 'bold',
        }).setOrigin(1, 0.5);
        itemContainer.add(selectBadge);
      }

      // Hit area
      const hit = this.add.rectangle(0, 0, cardItemW, cardItemH, 0x000000, 0);
      hit.setInteractive({ useHandCursor: true });
      hit.on('pointerdown', (pointer) => {
        if (pointer && pointer.event) pointer.event.stopPropagation();
        this._selectDifficulty(key);
      });
      itemContainer.add(hit);

      this.difficultyModal.add(itemContainer);
      startY += cardItemH + 20;
    });
  }

  _selectDifficulty(key) {
    if (this.currentDifficulty === key) {
      this._closeDifficultyModal();
      return;
    }

    this.currentDifficulty = key;
    this.diffConfig = DIFFICULTY_CONFIG[key];
    this.shotsUntilRowDrop = this.diffConfig.rowDropShots;
    this.stageCleared = false;
    this.hammerCount = this.diffConfig.startingHammers !== undefined ? this.diffConfig.startingHammers : 1;

    this.shooter.setHammerCount(this.hammerCount);
    this.shooter.updateSwapCost(this.diffConfig.swapCost);
    this._updateStageBadge();
    this._updateRowDropBadge();
    this._drawMilestoneBadge();

    this._closeDifficultyModal();
    this.startNewGame(key);
    this._showFloatingText(GAME_WIDTH / 2, 280, `${this.diffConfig.label} MODE STARTED!`, this.diffConfig.color);
  }

  _closeDifficultyModal() {
    if (this.difficultyModal) {
      this.events.emit('play-sound', AUDIO_KEYS.LAND, { volume: 0.5 });
      this.difficultyModal.destroy();
      this.difficultyModal = null;
      this.isInputActive = true;
      this.shooter.unlock();
    }
  }

  _celebrateStageClear(value) {
    if (this.stageClearModal) return;

    this.isInputActive = false;
    this.shooter.hideAim();

    // Fanfare and visual effects
    this.events.emit('play-sound', AUDIO_KEYS.HYPE, { volume: 0.95 });
    this.cameras.main.flash(300, 255, 230, 0);
    this.cameras.main.shake(200, 0.01);

    // Confetti explosion
    for (let i = 0; i < 4; i++) {
      this.time.delayedCall(i * 120, () => {
        const rx = Phaser.Math.Between(150, GAME_WIDTH - 150);
        const ry = Phaser.Math.Between(200, 500);
        this.sparkEmitter.setParticleTint(0xffea00);
        this.sparkEmitter.explode(30, rx, ry);
        this.glowEmitter.setParticleTint(0x00f0ff);
        this.glowEmitter.explode(15, rx, ry);
      });
    }

    // Award bonus coins
    let bonusCoins = 100;
    if (this.currentDifficulty === DIFFICULTY.MEDIUM) bonusCoins = 250;
    if (this.currentDifficulty === DIFFICULTY.HARD) bonusCoins = 500;
    this._addCoins(bonusCoins, GAME_WIDTH / 2, 260);

    this.stageClearModal = this.add.container(0, 0);
    this.stageClearModal.setDepth(130);

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05060e, 0.92);
    overlay.setInteractive();
    this.stageClearModal.add(overlay);

    const cardW = 560;
    const cardH = 620;
    const cardY = GAME_HEIGHT / 2;

    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x0a0f26, 0.98);
    cardBg.fillRoundedRect(GAME_WIDTH / 2 - cardW / 2, cardY - cardH / 2, cardW, cardH, 24);
    cardBg.lineStyle(3, 0xffea00, 0.95);
    cardBg.strokeRoundedRect(GAME_WIDTH / 2 - cardW / 2, cardY - cardH / 2, cardW, cardH, 24);
    this.stageClearModal.add(cardBg);

    // Title
    const title = this.add.text(GAME_WIDTH / 2, cardY - cardH / 2 + 50, '★ STAGE CLEARED! ★', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '28px',
      color: '#ffe600',
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setOrigin(0.5);
    this.stageClearModal.add(title);

    const sub = this.add.text(GAME_WIDTH / 2, cardY - cardH / 2 + 88, `${this.diffConfig.label} MODE CONQUERED!`, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '15px',
      color: this.diffConfig.color,
      letterSpacing: 3,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.stageClearModal.add(sub);

    // 3 Stars ★★★ with animated bounce
    const stars = ['★', '★', '★'];
    const starSpacing = 65;
    stars.forEach((star, idx) => {
      const sx = GAME_WIDTH / 2 + (idx - 1) * starSpacing;
      const sy = cardY - cardH / 2 + 155;
      const starText = this.add.text(sx, sy, star, {
        fontFamily: '"Arial Black", sans-serif',
        fontSize: '44px',
        color: '#ffe600',
      }).setOrigin(0.5).setScale(0);
      this.stageClearModal.add(starText);

      this.tweens.add({
        targets: starText,
        scaleX: 1,
        scaleY: 1,
        duration: 250,
        delay: 200 + idx * 150,
        ease: 'Back.easeOut',
      });
    });

    // Milestone Achieved Capsule
    const achBg = this.add.graphics();
    achBg.fillStyle(0x0e173a, 0.95);
    achBg.lineStyle(2, 0x00f0ff, 0.85);
    achBg.fillRoundedRect(GAME_WIDTH / 2 - 200, cardY - 50, 400, 100, 16);
    achBg.strokeRoundedRect(GAME_WIDTH / 2 - 200, cardY - 50, 400, 100, 16);
    this.stageClearModal.add(achBg);

    const targetLabel = this.add.text(GAME_WIDTH / 2, cardY - 26, `TARGET ${formatTileNumber(value)} ACHIEVED!`, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '19px',
      color: '#00f0ff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.stageClearModal.add(targetLabel);

    const rewardLabel = this.add.text(GAME_WIDTH / 2, cardY + 16, `+${bonusCoins} BONUS COINS ¢`, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '16px',
      color: '#ffea00',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5);
    this.stageClearModal.add(rewardLabel);

    // Next Stage or Replay Button
    let nextStageKey = null;
    let nextBtnLabel = '';
    if (this.currentDifficulty === DIFFICULTY.EASY) {
      nextStageKey = DIFFICULTY.MEDIUM;
      nextBtnLabel = 'NEXT: MEDIUM STAGE ➔';
    } else if (this.currentDifficulty === DIFFICULTY.MEDIUM) {
      nextStageKey = DIFFICULTY.HARD;
      nextBtnLabel = 'NEXT: HARD STAGE ➔';
    } else {
      nextStageKey = DIFFICULTY.HARD;
      nextBtnLabel = 'PLAY HARD AGAIN ↺';
    }

    const btnW = 380;
    const btnH = 56;
    const nextBtnY = cardY + 115;

    const nextBg = this.add.graphics();
    nextBg.fillStyle(0x0a2f15, 0.98);
    nextBg.lineStyle(2.5, 0x39ff14, 0.95);
    nextBg.fillRoundedRect(GAME_WIDTH / 2 - btnW / 2, nextBtnY - btnH / 2, btnW, btnH, 16);
    nextBg.strokeRoundedRect(GAME_WIDTH / 2 - btnW / 2, nextBtnY - btnH / 2, btnW, btnH, 16);
    this.stageClearModal.add(nextBg);

    const nextText = this.add.text(GAME_WIDTH / 2, nextBtnY, nextBtnLabel, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '18px',
      color: '#39ff14',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5);
    this.stageClearModal.add(nextText);

    const nextHit = this.add.rectangle(GAME_WIDTH / 2, nextBtnY, btnW, btnH, 0x000000, 0);
    nextHit.setInteractive({ useHandCursor: true });
    nextHit.on('pointerdown', () => {
      this.events.emit('play-sound', AUDIO_KEYS.LAND, { volume: 0.6 });
      this.stageClearModal.destroy();
      this.stageClearModal = null;
      this._selectDifficulty(nextStageKey);
    });
    this.stageClearModal.add(nextHit);

    // Continue Endless Button
    const contBtnY = cardY + 185;
    const contBg = this.add.graphics();
    contBg.fillStyle(0x131938, 0.98);
    contBg.lineStyle(2, 0x00f0ff, 0.85);
    contBg.fillRoundedRect(GAME_WIDTH / 2 - btnW / 2, contBtnY - btnH / 2, btnW, btnH, 16);
    contBg.strokeRoundedRect(GAME_WIDTH / 2 - btnW / 2, contBtnY - btnH / 2, btnW, btnH, 16);
    this.stageClearModal.add(contBg);

    const contText = this.add.text(GAME_WIDTH / 2, contBtnY, 'CONTINUE ENDLESS RUN', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '16px',
      color: '#00f0ff',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5);
    this.stageClearModal.add(contText);

    const contHit = this.add.rectangle(GAME_WIDTH / 2, contBtnY, btnW, btnH, 0x000000, 0);
    contHit.setInteractive({ useHandCursor: true });
    contHit.on('pointerdown', () => {
      this.events.emit('play-sound', AUDIO_KEYS.LAND, { volume: 0.6 });
      this.stageClearModal.destroy();
      this.stageClearModal = null;
      this.isInputActive = true;
      this.shooter.unlock();
      this._showFloatingText(GAME_WIDTH / 2, 280, 'ENDLESS RUN CONTINUES!', '#ffe600');
    });
    this.stageClearModal.add(contHit);
  }

  _createTutorial() {
    if (this.tutorialContainer || this.isTutorialDismissed) return;
    if (this.score > 0) return;

    this.tutorialContainer = this.add.container(0, 0);
    this.tutorialContainer.setDepth(60);

    const targetCol = 2;
    const targetX = GameSettings.getColumnCenterX(targetCol);

    // 1. Neon Pill Guide Banner
    const bannerY = 760;
    const bannerW = 500;
    const bannerH = 72;

    const bannerBg = this.add.graphics();
    bannerBg.fillStyle(0x060b1c, 0.95);
    bannerBg.lineStyle(2.5, 0x00f0ff, 0.95);
    bannerBg.fillRoundedRect(GAME_WIDTH / 2 - bannerW / 2, bannerY - bannerH / 2, bannerW, bannerH, 20);
    bannerBg.strokeRoundedRect(GAME_WIDTH / 2 - bannerW / 2, bannerY - bannerH / 2, bannerW, bannerH, 20);
    this.tutorialContainer.add(bannerBg);

    const bannerText = this.add.text(GAME_WIDTH / 2, bannerY - 12, '▲ TAP COLUMN TO SHOOT & MERGE!', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '18px',
      color: '#00f0ff',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5);
    this.tutorialContainer.add(bannerText);

    const bannerSub = this.add.text(GAME_WIDTH / 2, bannerY + 16, 'MATCH IDENTICAL TILES: 4 + 4 ➔ 8', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '13px',
      color: '#39ff14',
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setOrigin(0.5);
    this.tutorialContainer.add(bannerSub);

    // 2. Animated Finger Pointer Hand
    const handY = SHOOTER_Y - 95;
    this.tutorialHand = this.add.text(targetX, handY, '👆', {
      fontSize: '46px',
    }).setOrigin(0.5);
    this.tutorialContainer.add(this.tutorialHand);

    // Bouncing Finger Animation
    this.tweens.add({
      targets: this.tutorialHand,
      y: handY - 26,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 480,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Gentle banner pulse
    this.tweens.add({
      targets: [bannerText, bannerBg],
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  _dismissTutorial() {
    if (!this.tutorialContainer) return;
    this.isTutorialDismissed = true;
    this.tweens.add({
      targets: this.tutorialContainer,
      alpha: 0,
      duration: 250,
      onComplete: () => {
        if (this.tutorialContainer) {
          this.tutorialContainer.destroy();
          this.tutorialContainer = null;
        }
      },
    });
  }

  openHowToPlay() {
    if (this.scene.isActive('PauseScene') || this.scene.isActive('ShopScene') || this.scene.isActive('GameOverScene')) return;
    if (this.howToPlayModal) return;

    this.isInputActive = false;
    this.shooter.hideAim();
    this.events.emit('play-sound', AUDIO_KEYS.WARN, { volume: 0.4 });

    this.howToPlayModal = this.add.container(0, 0);
    this.howToPlayModal.setDepth(100);

    // Dark backdrop overlay
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05060e, 0.92);
    overlay.setInteractive();
    this.howToPlayModal.add(overlay);

    const cardW = 580;
    const cardH = 680;
    const cardY = GAME_HEIGHT / 2;

    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x0e1329, 0.98);
    cardBg.fillRoundedRect(GAME_WIDTH / 2 - cardW / 2, cardY - cardH / 2, cardW, cardH, 24);
    cardBg.lineStyle(3, 0x00f0ff, 0.9);
    cardBg.strokeRoundedRect(GAME_WIDTH / 2 - cardW / 2, cardY - cardH / 2, cardW, cardH, 24);
    this.howToPlayModal.add(cardBg);

    // Top neon accent
    const topAccent = this.add.graphics();
    topAccent.fillStyle(0x00f0ff, 1);
    topAccent.fillRoundedRect(GAME_WIDTH / 2 - 140, cardY - cardH / 2 - 3, 280, 6, 3);
    this.howToPlayModal.add(topAccent);

    // Title
    const title = this.add.text(GAME_WIDTH / 2, cardY - cardH / 2 + 50, '⚡ HOW TO PLAY ⚡', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '26px',
      color: '#00f0ff',
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setOrigin(0.5);
    this.howToPlayModal.add(title);

    // Rules list
    const rules = [
      { icon: '🎯', title: 'AIM & TAP TO FIRE', desc: 'Tap any column to launch numbers straight up into the grid.' },
      { icon: '⚡', title: 'MERGE 2048', desc: 'Hit matching numbers (2+2, 4+4, 8+8) to merge into bigger tiles & earn coins!' },
      { icon: '⚠️', title: 'DANGER LINE', desc: 'Keep columns below the red danger line. If full, game is over!' },
      { icon: '🔨', title: 'SMASH HAMMER', desc: 'In a pinch? Tap the Hammer to disintegrate any blocking tile!' },
    ];

    let stepY = cardY - cardH / 2 + 130;
    rules.forEach((rule) => {
      const icon = this.add.text(GAME_WIDTH / 2 - 210, stepY, rule.icon, { fontSize: '28px' }).setOrigin(0.5);
      const rTitle = this.add.text(GAME_WIDTH / 2 - 170, stepY - 14, rule.title, {
        fontFamily: '"Arial Black", sans-serif',
        fontSize: '16px',
        color: '#ffea00',
        fontStyle: 'bold',
      });
      const rDesc = this.add.text(GAME_WIDTH / 2 - 170, stepY + 12, rule.desc, {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        color: '#c0cfee',
        wordWrap: { width: 360 },
      });
      this.howToPlayModal.add([icon, rTitle, rDesc]);
      stepY += 105;
    });

    // Close button
    const btnW = 320;
    const btnH = 56;
    const btnY = cardY + cardH / 2 - 58;
    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x00f0ff, 1);
    btnBg.fillRoundedRect(GAME_WIDTH / 2 - btnW / 2, btnY - btnH / 2, btnW, btnH, 16);
    this.howToPlayModal.add(btnBg);

    const btnText = this.add.text(GAME_WIDTH / 2, btnY, 'LET\'S PLAY!', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '20px',
      color: '#080914',
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setOrigin(0.5);
    this.howToPlayModal.add(btnText);

    const btnHit = this.add.rectangle(GAME_WIDTH / 2, btnY, btnW, btnH, 0x000000, 0);
    btnHit.setInteractive({ useHandCursor: true });
    btnHit.on('pointerdown', () => {
      this.events.emit('play-sound', AUDIO_KEYS.LAND, { volume: 0.6 });
      this.howToPlayModal.destroy();
      this.howToPlayModal = null;
      this.isInputActive = true;
      this.shooter.unlock();
    });
    this.howToPlayModal.add(btnHit);
  }

  _applySavedData(data) {
    if (data && typeof data === 'object') {
      if (data.difficulty && DIFFICULTY_CONFIG[data.difficulty]) {
        this.currentDifficulty = data.difficulty;
        this.diffConfig = DIFFICULTY_CONFIG[data.difficulty];
        this.shotsUntilRowDrop = this.diffConfig.rowDropShots;
      }
      this.bestScore = data.bestScore || 0;
      this.bestText.setText(`★ BEST: ${formatScore(this.bestScore)}`);

      if (data.coins !== undefined) {
        this.coins = data.coins;
        this.coinText.setText(`${this.coins}`);
      }
      if (data.nextMilestone !== undefined) {
        this.nextMilestone = data.nextMilestone;
      }
      if (data.hammerCount !== undefined) {
        this.hammerCount = Math.min(3, data.hammerCount);
        this.shooter.setHammerCount(this.hammerCount);
      }

      if (data.grid && Array.isArray(data.grid) && data.grid.length > 0) {
        this.score = data.score || 0;
        this.scoreText.setText(formatScore(this.score));
        this.gridManager.deserialize(data.grid);
      } else {
        this.gridManager.initStartingBoard(this.diffConfig);
      }
    } else {
      this.gridManager.initStartingBoard(this.diffConfig);
    }

    const maxVal = this.gridManager.getMaxValue();
    if (!this.nextMilestone || this.nextMilestone <= maxVal) {
      this.nextMilestone = this.diffConfig.targetGoal || 2048;
    }
    this.milestoneValText.setText(`${formatTileNumber(this.nextMilestone)}`);
    this._drawMilestoneBadge();
    this._updateStageBadge();
    this._updateRowDropBadge();

    this.shooter.updateSwapCost(this.diffConfig.swapCost);
    this.shooter.initShooter(this.gridManager.getMaxValue());
  }

  _saveGameState() {
    const payload = {
      difficulty: this.currentDifficulty,
      score: this.score,
      bestScore: this.bestScore,
      coins: this.coins,
      nextMilestone: this.nextMilestone,
      hammerCount: this.hammerCount,
      grid: this.gridManager.serialize(),
      timestamp: Date.now(),
    };
    ytService.saveData(payload);
    playgamaService.saveData(payload);
  }
}

export default MainScene;
