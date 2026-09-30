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
import ytService from '../sdk/ytService.js';
import playgamaService from '../sdk/playgamaService.js';

export class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
  }

  create(data) {
    const savedData = data?.savedData || null;

    this.score = 0;
    this.bestScore = 0;
    this.coins = 100;
    this.nextMilestone = 128;
    this.combo = 0;
    this.isInputActive = true;
    this.reviveCount = 0;
    this.hyperEnergy = 0; // 0 .. 100
    this.isHammerMode = false;
    this.hammerCount = 1;
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
    this.pauseBtn = this.add.container(54, topBarY);
    const pBg = this.add.graphics();
    pBg.fillStyle(0x0e1329, 0.95);
    pBg.lineStyle(2, 0x00f0ff, 0.85);
    pBg.fillRoundedRect(-22, -22, 44, 44, 12);
    pBg.strokeRoundedRect(-22, -22, 44, 44, 12);
    this.pauseBtn.add(pBg);

    const pIcon = this.add.text(0, 0, '❚❚', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '16px',
      color: '#00f0ff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.pauseBtn.add(pIcon);

    const pauseHit = this.add.rectangle(54, topBarY, 56, 56, 0x000000, 0);
    pauseHit.setDepth(50);
    pauseHit.setInteractive({ useHandCursor: true });
    pauseHit.on('pointerdown', (pointer) => {
      if (pointer && pointer.event) pointer.event.stopPropagation();
      this.pauseGame();
    });

    // 1b. Top-Left (Next to Pause): HOW TO PLAY ("?") Button
    this.helpBtn = this.add.container(116, topBarY);
    const helpBg = this.add.graphics();
    helpBg.fillStyle(0x0e1329, 0.95);
    helpBg.lineStyle(2, 0x39ff14, 0.85);
    helpBg.fillRoundedRect(-22, -22, 44, 44, 12);
    helpBg.strokeRoundedRect(-22, -22, 44, 44, 12);
    this.helpBtn.add(helpBg);

    const helpIcon = this.add.text(0, 0, '?', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '20px',
      color: '#39ff14',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.helpBtn.add(helpIcon);

    const helpHit = this.add.rectangle(116, topBarY, 56, 56, 0x000000, 0);
    helpHit.setDepth(50);
    helpHit.setInteractive({ useHandCursor: true });
    helpHit.on('pointerdown', (pointer) => {
      if (pointer && pointer.event) pointer.event.stopPropagation();
      this.openHowToPlay();
    });

    // 2. Top-Center: Score & Best Record Capsule
    const scoreBoxW = 230;
    const scoreBoxH = 62;
    const scoreCapsule = this.add.container(GAME_WIDTH / 2, topBarY);
    const scBg = this.add.graphics();
    scBg.fillStyle(0x0a0e22, 0.96);
    scBg.lineStyle(2, 0x1f2c4e, 0.9);
    scBg.fillRoundedRect(-scoreBoxW / 2, -scoreBoxH / 2, scoreBoxW, scoreBoxH, 16);
    scBg.strokeRoundedRect(-scoreBoxW / 2, -scoreBoxH / 2, scoreBoxW, scoreBoxH, 16);
    scoreCapsule.add(scBg);

    this.scoreText = this.add.text(0, -9, '0', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '28px',
      color: '#00f0ff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    scoreCapsule.add(this.scoreText);

    this.bestText = this.add.text(0, 15, `★ BEST: ${this.bestScore.toLocaleString()}`, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '12px',
      color: '#ffe600',
      letterSpacing: 1,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    scoreCapsule.add(this.bestText);

    // 3. Top-Right: Next Milestone Goal Badge
    this.milestoneBadge = this.add.container(635, topBarY);
    this.milestoneBg = this.add.graphics();
    this._drawMilestoneBadge();
    this.milestoneBadge.add(this.milestoneBg);

    this.milestoneValText = this.add.text(0, -7, `${this.nextMilestone}`, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.milestoneBadge.add(this.milestoneValText);

    this.milestoneLabel = this.add.text(0, 15, this._getLevelName(this.nextMilestone), {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '10px',
      color: '#8da2d4',
      letterSpacing: 1,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.milestoneBadge.add(this.milestoneLabel);

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

    // Hammer Active Banner (Prominent notification with tap-to-cancel)
    this.hammerBanner = this.add.container(GAME_WIDTH / 2, 148);
    const hBg = this.add.graphics();
    hBg.fillStyle(0x381200, 0.96);
    hBg.lineStyle(3, 0xffaa00, 0.95);
    hBg.fillRoundedRect(-240, -22, 480, 44, 14);
    hBg.strokeRoundedRect(-240, -22, 480, 44, 14);
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

    this.hammerBanner.setSize(480, 44);
    this.hammerBanner.setInteractive(
      new Phaser.Geom.Rectangle(-240, -22, 480, 44),
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
    const theme = NEON_COLORS[this.nextMilestone] || DEFAULT_NEON;
    const color = theme.textColorInt || 0xffea00;

    this.milestoneBg.fillStyle(0x0e1329, 0.95);
    this.milestoneBg.lineStyle(2, color, 0.9);
    this.milestoneBg.fillRoundedRect(-48, -26, 96, 52, 14);
    this.milestoneBg.strokeRoundedRect(-48, -26, 96, 52, 14);

    if (this.milestoneValText) {
      this.milestoneValText.setColor(theme.text || '#ffffff');
    }
    if (this.milestoneLabel) {
      this.milestoneLabel.setText(this._getLevelName(this.nextMilestone));
    }
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
          this._showFloatingText(GAME_WIDTH / 2, BOTTOM_DOCK_Y - 40, `NEED ${POWERUP_COSTS.HAMMER} COINS FOR SMASH!`, '#ff005d');
          this.events.emit('play-sound', AUDIO_KEYS.WARN, { volume: 0.5 });
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
      this.shooter.setAimColumn(this.shooter.activeCol, true);
    }
  }

  _setupControls() {
    let isDragging = false;

    this.input.on('pointerdown', (pointer) => {
      // Ensure Web Audio context is resumed on user click
      if (this.sound && this.sound.context && this.sound.context.state === 'suspended') {
        this.sound.context.resume();
      }

      // 0. Instant Top-Left Corner Hits (Pause and Help ?)
      if (pointer.y <= 95) {
        if (pointer.x <= 85) {
          this.pauseGame();
          return;
        }
        if (pointer.x > 85 && pointer.x <= 155) {
          this.openHowToPlay();
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

    // Calculate score
    const earnedPoints = GameSettings.calculateMergeScore(value, combo);
    this._addScore(earnedPoints);

    // Calculate and award coins
    let earnedCoins = COIN_REWARDS.MERGE;
    if (combo >= 2) {
      earnedCoins += COIN_REWARDS.COMBO * (combo - 1);
    }
    this._addCoins(earnedCoins, x, y);

    // Check Milestone Unlock
    if (typeof value === 'number' && value >= this.nextMilestone) {
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

    if (combo >= 2) {
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
    this.scoreText.setText(this.score.toLocaleString());

    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      this.bestText.setText(this.bestScore.toLocaleString());
    }

    // Award bonus hammer every threshold
    if (this.score >= this.nextHammerScoreThreshold) {
      this.nextHammerScoreThreshold += 6000;
      this.hammerCount++;
      this.shooter.setHammerCount(this.hammerCount);
      this._showFloatingText(GAME_WIDTH / 2, BOTTOM_DOCK_Y - 40, '⚡ +1 SMASHER EARNED!', '#ffaa00');
      this.events.emit('play-sound', AUDIO_KEYS.POWERUP, { volume: 0.7 });
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

  startNewGame() {
    this.score = 0;
    this.scoreText.setText('0');
    this.reviveCount = 0;
    this.hyperEnergy = 0;
    this._updateHyperBar();
    this.isInputActive = true;
    this.isHammerMode = false;
    this.hammerBanner.setVisible(false);
    this.cameras.main.resetFX();

    this.gridManager.initStartingBoard();
    const maxVal = this.gridManager.getMaxValue();
    this.nextMilestone = MILESTONES.find((m) => m > maxVal) || 128;
    this.milestoneValText.setText(`${this.nextMilestone}`);
    this._drawMilestoneBadge();

    this.shooter.initShooter(maxVal);
    this.shooter.unlock();

    this.isTutorialDismissed = false;
    this._createTutorial();

    this._saveGameState();
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

    const bannerText = this.add.text(GAME_WIDTH / 2, bannerY - 12, '👆 TAP COLUMN TO SHOOT & MERGE!', {
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
      this.bestScore = data.bestScore || 0;
      this.bestText.setText(`★ BEST: ${this.bestScore.toLocaleString()}`);

      if (data.coins !== undefined) {
        this.coins = data.coins;
        this.coinText.setText(`${this.coins}`);
      }
      if (data.nextMilestone !== undefined) {
        this.nextMilestone = data.nextMilestone;
      }
      if (data.hammerCount !== undefined) {
        this.hammerCount = data.hammerCount;
        this.shooter.setHammerCount(this.hammerCount);
      }

      if (data.grid && Array.isArray(data.grid) && data.grid.length > 0) {
        this.score = data.score || 0;
        this.scoreText.setText(this.score.toLocaleString());
        this.gridManager.deserialize(data.grid);
      } else {
        this.gridManager.initStartingBoard();
      }
    } else {
      this.gridManager.initStartingBoard();
    }

    const maxVal = this.gridManager.getMaxValue();
    if (!this.nextMilestone || this.nextMilestone <= maxVal) {
      this.nextMilestone = MILESTONES.find((m) => m > maxVal) || 2048;
    }
    this.milestoneValText.setText(`${this.nextMilestone}`);
    this._drawMilestoneBadge();

    this.shooter.initShooter(this.gridManager.getMaxValue());
  }

  _saveGameState() {
    const payload = {
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
