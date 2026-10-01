import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  TILE_SIZE,
  TILE_RADIUS,
  NEON_COLORS,
  AUDIO_KEYS,
} from '../config/constants.js';
import { DIFFICULTY, DIFFICULTY_CONFIG } from '../config/difficultyConfig.js';
import { formatScore } from '../utils/numberFormat.js';
import ytService from '../sdk/ytService.js';
import playgamaService from '../sdk/playgamaService.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this._createLoadingUI();

    // Load local audio files (relative paths for YouTube Playables bundle compliance)
    this.load.audio(AUDIO_KEYS.SHOOT, './assets/audio/shoot.wav');
    this.load.audio(AUDIO_KEYS.MERGE, './assets/audio/merge.wav');
    this.load.audio(AUDIO_KEYS.COMBO, './assets/audio/combo.wav');
    this.load.audio(AUDIO_KEYS.LAND, './assets/audio/land.wav');
    this.load.audio(AUDIO_KEYS.SWAP, './assets/audio/swap.wav');
    this.load.audio(AUDIO_KEYS.GAMEOVER, './assets/audio/gameover.wav');
    this.load.audio(AUDIO_KEYS.WARN, './assets/audio/warn.wav');
    this.load.audio(AUDIO_KEYS.POWERUP, './assets/audio/powerup.wav');
    this.load.audio(AUDIO_KEYS.HAMMER, './assets/audio/hammer.wav');
    this.load.audio(AUDIO_KEYS.HYPE, './assets/audio/hype.wav');
    this.load.audio(AUDIO_KEYS.COMBO_1, './assets/audio/combo_1.wav');
    this.load.audio(AUDIO_KEYS.COMBO_2, './assets/audio/combo_2.wav');
    this.load.audio(AUDIO_KEYS.COMBO_3, './assets/audio/combo_3.wav');
    this.load.audio(AUDIO_KEYS.COMBO_4, './assets/audio/combo_4.wav');
    this.load.audio(AUDIO_KEYS.COMBO_5, './assets/audio/combo_5.wav');
    this.load.audio(AUDIO_KEYS.COMBO_6, './assets/audio/combo_6.wav');
    this.load.audio(AUDIO_KEYS.COMBO_7, './assets/audio/combo_7.wav');
    this.load.audio(AUDIO_KEYS.COMBO_8, './assets/audio/combo_8.wav');

    // Load sprite assets
    this.load.image('particle_glow', './assets/sprites/particle_glow.png');
    this.load.image('particle_spark', './assets/sprites/particle_spark.png');
    this.load.image('tile_base', './assets/sprites/tile_base.png');

    // Handle load events
    this.load.on('progress', (value) => {
      if (this.progressBar) {
        this.progressBar.clear();
        this.progressBar.fillStyle(0x00f0ff, 1);
        this.progressBar.fillRoundedRect(
          GAME_WIDTH / 2 - 160,
          GAME_HEIGHT / 2 + 30,
          320 * value,
          16,
          8
        );
      }
    });

    this.load.on('complete', () => {
      // Signal first visual frame rendered to YouTube Playables SDK
      ytService.firstFrameReady();
    });
  }

  _createLoadingUI() {
    // Cyber background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x080914);

    this.loadingContainer = this.add.container(0, 0);

    // Title text
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, 'NEON MERGE', {
      fontFamily: '"Arial Black", "Impact", sans-serif',
      fontSize: '44px',
      color: '#00f0ff',
      fontStyle: 'bold',
      letterSpacing: 4,
    }).setOrigin(0.5);

    const subtitle = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, '2048 COLUMN SHOOTER', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '18px',
      color: '#ff007f',
      letterSpacing: 6,
    }).setOrigin(0.5);

    // Progress bar frame
    const progressBox = this.add.graphics();
    progressBox.lineStyle(2, 0x1f274a, 1);
    progressBox.strokeRoundedRect(GAME_WIDTH / 2 - 162, GAME_HEIGHT / 2 + 28, 324, 20, 10);

    this.progressBar = this.add.graphics();
    this.loadingContainer.add([title, subtitle, progressBox, this.progressBar]);
  }

  async create() {
    // Generate all procedural neon textures into TextureManager
    this._generateBlockTextures();
    this._generateParticleTextures();
    this._generateGridTextures();

    // Fetch saved player progress from Cloud Storage (Required by Playgama before gameplay starts)
    let savedData = null;
    try {
      savedData = await Promise.race([
        playgamaService.loadData(),
        new Promise((resolve) => setTimeout(() => resolve(null), 1500))
      ]);
      if (!savedData) {
        savedData = await Promise.race([
          ytService.loadData(),
          new Promise((resolve) => setTimeout(() => resolve(null), 1000))
        ]);
      }
    } catch (e) {
      console.warn('[BootScene] Storage load fallback:', e);
    }

    console.log('[BootScene] Preloaded saved progress:', savedData);
    this.cachedBestScore = (savedData && savedData.bestScore) || 0;

    // Smoothly fade out loading progress bar and show the Start / How-To-Play Guide screen
    this.tweens.add({
      targets: this.loadingContainer,
      alpha: 0,
      duration: 220,
      onComplete: () => {
        if (this.loadingContainer) {
          this.loadingContainer.destroy();
        }
        this._showStartScreen(savedData);
      }
    });
  }

  _showStartScreen(savedData) {
    ytService.gameReady();
    playgamaService.sendGameReady();

    const startContainer = this.add.container(0, 0);

    let selectedDifficulty = (savedData && savedData.difficulty && DIFFICULTY_CONFIG[savedData.difficulty])
      ? savedData.difficulty
      : DIFFICULTY.MEDIUM;

    const hasSavedRun = Boolean(
      savedData &&
      Array.isArray(savedData.grid) &&
      savedData.grid.length > 0 &&
      (savedData.score || 0) > 0
    );

    const bestScore = this.cachedBestScore;

    // --- Subtle Ambient Grid Lines ---
    const gridLines = this.add.graphics();
    gridLines.lineStyle(1, 0x00f0ff, 0.04);
    for (let x = 0; x < GAME_WIDTH; x += 40) {
      gridLines.moveTo(x, 0);
      gridLines.lineTo(x, GAME_HEIGHT);
    }
    for (let y = 0; y < GAME_HEIGHT; y += 40) {
      gridLines.moveTo(0, y);
      gridLines.lineTo(GAME_WIDTH, y);
    }
    gridLines.strokePath();
    startContainer.add(gridLines);

    // --- Header ---
    const headerTitle = this.add.text(GAME_WIDTH / 2, 90, 'NEON MERGE', {
      fontFamily: '"Arial Black", "Impact", sans-serif',
      fontSize: '54px',
      color: '#00f0ff',
      fontStyle: 'bold',
      letterSpacing: 6,
    }).setOrigin(0.5);
    startContainer.add(headerTitle);

    const headerSub = this.add.text(GAME_WIDTH / 2, 138, '2048 COLUMN SHOOTER', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '17px',
      color: '#ff007f',
      letterSpacing: 7,
    }).setOrigin(0.5);
    startContainer.add(headerSub);

    if (bestScore > 0) {
      const bestBg = this.add.graphics();
      bestBg.fillStyle(0x161c36, 0.85);
      bestBg.fillRoundedRect(GAME_WIDTH / 2 - 165, 164, 330, 34, 17);
      bestBg.lineStyle(1.5, 0xffd700, 0.6);
      bestBg.strokeRoundedRect(GAME_WIDTH / 2 - 165, 164, 330, 34, 17);
      startContainer.add(bestBg);

      const bestText = this.add.text(GAME_WIDTH / 2, 181, `★ BEST RECORD: ${formatScore(bestScore)}`, {
        fontFamily: 'sans-serif',
        fontSize: '15px',
        color: '#ffd700',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      startContainer.add(bestText);
    }

    // --- HOW TO PLAY Section ---
    const panelY = bestScore > 0 ? 228 : 196;
    const guideTitle = this.add.text(GAME_WIDTH / 2, panelY, '── HOW TO PLAY ──', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '16px',
      color: '#00f0ff',
      letterSpacing: 4,
    }).setOrigin(0.5);
    startContainer.add(guideTitle);

    // 3 Cards
    const cards = [
      {
        icon: '▲',
        iconColor: 0x00f0ff,
        iconBg: 0x002e3d,
        title: '1. AIM & TAP TO SHOOT',
        desc: 'Tap or drag any column to fire number blocks upward.',
        accent: '#00f0ff',
      },
      {
        icon: '2+2',
        iconColor: 0xffd700,
        iconBg: 0x332800,
        title: '2. MERGE IDENTICAL TILES',
        desc: 'Combine matching numbers (4+4 ➔ 8) to reach the stage target!',
        accent: '#ffd700',
      },
      {
        icon: '!',
        iconColor: 0xff3366,
        iconBg: 0x330d1a,
        title: '3. BEWARE DANGER LINE',
        desc: 'Clear columns before blocks stack over the red hazard line.',
        accent: '#ff3366',
      },
    ];

    const startCardY = panelY + 24;
    const cardW = 600;
    const cardH = 98;

    cards.forEach((card, idx) => {
      const cy = startCardY + idx * (cardH + 14);
      const cardBg = this.add.graphics();
      cardBg.fillStyle(0x0e1329, 0.88);
      cardBg.fillRoundedRect(GAME_WIDTH / 2 - cardW / 2, cy, cardW, cardH, 16);
      cardBg.lineStyle(1.5, card.iconColor, 0.45);
      cardBg.strokeRoundedRect(GAME_WIDTH / 2 - cardW / 2, cy, cardW, cardH, 16);
      startContainer.add(cardBg);

      // Icon square
      const iconBox = this.add.graphics();
      iconBox.fillStyle(card.iconBg, 1);
      iconBox.fillRoundedRect(GAME_WIDTH / 2 - cardW / 2 + 16, cy + 16, 66, 66, 14);
      iconBox.lineStyle(2, card.iconColor, 0.9);
      iconBox.strokeRoundedRect(GAME_WIDTH / 2 - cardW / 2 + 16, cy + 16, 66, 66, 14);
      startContainer.add(iconBox);

      const iconText = this.add.text(GAME_WIDTH / 2 - cardW / 2 + 49, cy + 49, card.icon, {
        fontFamily: '"Arial Black", sans-serif',
        fontSize: card.icon.length > 2 ? '19px' : '32px',
        color: card.accent,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      startContainer.add(iconText);

      // Card Title
      const t = this.add.text(GAME_WIDTH / 2 - cardW / 2 + 100, cy + 22, card.title, {
        fontFamily: '"Arial Black", sans-serif',
        fontSize: '17px',
        color: card.accent,
      });
      startContainer.add(t);

      // Card Description
      const d = this.add.text(GAME_WIDTH / 2 - cardW / 2 + 100, cy + 54, card.desc, {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        color: '#b0c4de',
        wordWrap: { width: 480 },
      });
      startContainer.add(d);
    });

    // --- Visual Tile Chain Demo Preview ---
    const chainY = startCardY + 3 * (cardH + 14) + 14;
    const chainBg = this.add.graphics();
    chainBg.fillStyle(0x0a0e22, 0.92);
    chainBg.fillRoundedRect(GAME_WIDTH / 2 - cardW / 2, chainY, cardW, 82, 16);
    chainBg.lineStyle(1.5, 0x1f2b52, 0.85);
    chainBg.strokeRoundedRect(GAME_WIDTH / 2 - cardW / 2, chainY, cardW, 82, 16);
    startContainer.add(chainBg);

    // Sequence of mini tiles: [ 2 ] ➔ [ 4 ] ➔ [ 8 ] ➔ [ 16 ] ... ➔ [ 2048 ]
    const miniTiles = [
      { num: '2', border: 0x00f0ff },
      { num: '4', border: 0x00ff88 },
      { num: '8', border: 0xff007f },
      { num: '16', border: 0xff7700 },
      { num: '2048', border: 0xffd700 },
    ];

    const stepW = 104;
    const startTileX = GAME_WIDTH / 2 - ((miniTiles.length - 1) * stepW) / 2;
    miniTiles.forEach((tile, i) => {
      const tx = startTileX + i * stepW;
      const ty = chainY + 41;

      const tb = this.add.graphics();
      tb.fillStyle(0x0e1329, 1);
      tb.fillRoundedRect(tx - 26, ty - 26, 52, 52, 10);
      tb.lineStyle(2, tile.border, 0.95);
      tb.strokeRoundedRect(tx - 26, ty - 26, 52, 52, 10);
      startContainer.add(tb);

      const tt = this.add.text(tx, ty, tile.num, {
        fontFamily: '"Arial Black", sans-serif',
        fontSize: tile.num.length > 2 ? '15px' : '22px',
        color: `#${tile.border.toString(16).padStart(6, '0')}`,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      startContainer.add(tt);

      if (i < miniTiles.length - 1) {
        const arr = this.add.text(tx + 52, ty, '➔', {
          fontFamily: 'sans-serif',
          fontSize: '17px',
          color: '#4e6294',
        }).setOrigin(0.5);
        startContainer.add(arr);
      }
    });

    // --- Difficulty Selector ---
    const diffSectionY = chainY + 116;
    const diffTitle = this.add.text(GAME_WIDTH / 2, diffSectionY, '── SELECT DIFFICULTY ──', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '16px',
      color: '#00f0ff',
      letterSpacing: 4,
    }).setOrigin(0.5);
    startContainer.add(diffTitle);

    const diffOptions = [
      { key: DIFFICULTY.EASY, label: 'EASY', color: 0x00ff88, hex: '#00ff88', desc: 'Goal: 512  •  No Row Drops  •  Swap: 10¢' },
      { key: DIFFICULTY.MEDIUM, label: 'MEDIUM', color: 0xffd700, hex: '#ffd700', desc: 'Goal: 2048  •  Row Drop: 12 shots  •  Swap: 20¢' },
      { key: DIFFICULTY.HARD, label: 'HARD', color: 0xff3366, hex: '#ff3366', desc: 'Goal: 4096  •  Row Drop: 7 shots  •  Swap: 30¢  •  No Aim' },
    ];

    const diffBtnY = diffSectionY + 52;
    const diffBtnW = 184;
    const diffBtnH = 56;
    const diffSpacing = 20;
    const totalDiffW = 3 * diffBtnW + 2 * diffSpacing;
    const diffStartX = GAME_WIDTH / 2 - totalDiffW / 2 + diffBtnW / 2;

    const diffGfxMap = {};
    const diffTextMap = {};

    const diffDescText = this.add.text(GAME_WIDTH / 2, diffBtnY + 52, '', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#b0c4de',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    startContainer.add(diffDescText);

    const updateDiffVisuals = () => {
      diffOptions.forEach((opt) => {
        const isSelected = selectedDifficulty === opt.key;
        const gfx = diffGfxMap[opt.key];
        const txt = diffTextMap[opt.key];

        gfx.clear();
        if (isSelected) {
          gfx.fillStyle(opt.color, 0.22);
          gfx.fillRoundedRect(-diffBtnW / 2, -diffBtnH / 2, diffBtnW, diffBtnH, 14);
          gfx.lineStyle(2.5, opt.color, 1);
          gfx.strokeRoundedRect(-diffBtnW / 2, -diffBtnH / 2, diffBtnW, diffBtnH, 14);
          txt.setColor(opt.hex);
          txt.setFontSize('18px');
          diffDescText.setText(opt.desc);
          diffDescText.setColor(opt.hex);
        } else {
          gfx.fillStyle(0x0e1329, 0.7);
          gfx.fillRoundedRect(-diffBtnW / 2, -diffBtnH / 2, diffBtnW, diffBtnH, 14);
          gfx.lineStyle(1.5, 0x222e54, 0.8);
          gfx.strokeRoundedRect(-diffBtnW / 2, -diffBtnH / 2, diffBtnW, diffBtnH, 14);
          txt.setColor('#687ba8');
          txt.setFontSize('16px');
        }
      });
    };

    diffOptions.forEach((opt, idx) => {
      const bx = diffStartX + idx * (diffBtnW + diffSpacing);
      const btnGfx = this.add.graphics();
      const btnText = this.add.text(0, 0, opt.label, {
        fontFamily: '"Arial Black", sans-serif',
        fontSize: '16px',
        color: '#ffffff',
      }).setOrigin(0.5);

      const btnContainer = this.add.container(bx, diffBtnY, [btnGfx, btnText]);
      startContainer.add(btnContainer);

      const hitArea = this.add.rectangle(bx, diffBtnY, diffBtnW, diffBtnH, 0x000000, 0).setInteractive({ useHandCursor: true });
      hitArea.on('pointerdown', () => {
        selectedDifficulty = opt.key;
        try {
          this.sound.play(AUDIO_KEYS.SWAP, { volume: 0.35 });
        } catch (e) {}
        updateDiffVisuals();
      });
      startContainer.add(hitArea);

      diffGfxMap[opt.key] = btnGfx;
      diffTextMap[opt.key] = btnText;
    });

    updateDiffVisuals();

    // --- PRO TIPS Panel ---
    const tipsY = diffBtnY + 96;
    const tipsW = 600;
    const tipsH = 100;
    const tipsBg = this.add.graphics();
    tipsBg.fillStyle(0x0b1026, 0.85);
    tipsBg.fillRoundedRect(GAME_WIDTH / 2 - tipsW / 2, tipsY, tipsW, tipsH, 16);
    tipsBg.lineStyle(1.5, 0x1f2c52, 0.8);
    tipsBg.strokeRoundedRect(GAME_WIDTH / 2 - tipsW / 2, tipsY, tipsW, tipsH, 16);
    startContainer.add(tipsBg);

    const tipHeader = this.add.text(GAME_WIDTH / 2 - tipsW / 2 + 18, tipsY + 16, '★ PRO TIPS', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '15px',
      color: '#ffd700',
    });
    startContainer.add(tipHeader);

    const tipLine1 = this.add.text(GAME_WIDTH / 2 - tipsW / 2 + 18, tipsY + 42, '• Swap incoming tiles (¢) using the bottom swap tool.', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#9cb0d8',
    });
    startContainer.add(tipLine1);

    const tipLine2 = this.add.text(GAME_WIDTH / 2 - tipsW / 2 + 18, tipsY + 66, '• Trigger 3+ cascade merges to activate 2x Multiplier hype mode!', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#9cb0d8',
    });
    startContainer.add(tipLine2);

    // --- Action Button(s) ---
    const actionAreaY = tipsY + 172;

    if (hasSavedRun) {
      // Button 1: CONTINUE RUN
      const contBtnBg = this.add.graphics();
      const contBtnW = 580;
      const contBtnH = 74;
      contBtnBg.fillStyle(0x00f0ff, 0.18);
      contBtnBg.fillRoundedRect(-contBtnW / 2, -contBtnH / 2, contBtnW, contBtnH, 20);
      contBtnBg.lineStyle(3, 0x00f0ff, 1);
      contBtnBg.strokeRoundedRect(-contBtnW / 2, -contBtnH / 2, contBtnW, contBtnH, 20);

      const contText = this.add.text(0, 0, `▶ CONTINUE RUN  (SCORE: ${formatScore(savedData.score)})`, {
        fontFamily: '"Arial Black", sans-serif',
        fontSize: '21px',
        color: '#00f0ff',
        letterSpacing: 2,
      }).setOrigin(0.5);

      const contContainer = this.add.container(GAME_WIDTH / 2, actionAreaY, [contBtnBg, contText]);
      this.tweens.add({
        targets: contContainer,
        scaleX: 1.025,
        scaleY: 1.025,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      startContainer.add(contContainer);

      const contHit = this.add.rectangle(GAME_WIDTH / 2, actionAreaY, contBtnW, contBtnH, 0x000000, 0).setInteractive({ useHandCursor: true });
      contHit.on('pointerdown', () => {
        this._startGame(savedData, selectedDifficulty);
      });
      startContainer.add(contHit);

      // Button 2: START NEW GAME
      const newBtnBg = this.add.graphics();
      const newBtnW = 580;
      const newBtnH = 60;
      newBtnBg.fillStyle(0x0e1329, 0.85);
      newBtnBg.fillRoundedRect(-newBtnW / 2, -newBtnH / 2, newBtnW, newBtnH, 16);
      newBtnBg.lineStyle(1.5, 0x3d4f82, 0.9);
      newBtnBg.strokeRoundedRect(-newBtnW / 2, -newBtnH / 2, newBtnW, newBtnH, 16);

      const newText = this.add.text(0, 0, '↺ START NEW GAME', {
        fontFamily: '"Arial Black", sans-serif',
        fontSize: '18px',
        color: '#8fa5d4',
        letterSpacing: 2,
      }).setOrigin(0.5);

      const newContainer = this.add.container(GAME_WIDTH / 2, actionAreaY + 84, [newBtnBg, newText]);
      startContainer.add(newContainer);

      const newHit = this.add.rectangle(GAME_WIDTH / 2, actionAreaY + 84, newBtnW, newBtnH, 0x000000, 0).setInteractive({ useHandCursor: true });
      newHit.on('pointerdown', () => {
        this._startGame(null, selectedDifficulty);
      });
      startContainer.add(newHit);
    } else {
      // Primary PLAY NOW button
      const playBtnBg = this.add.graphics();
      const playBtnW = 580;
      const playBtnH = 82;
      playBtnBg.fillStyle(0x00f0ff, 0.2);
      playBtnBg.fillRoundedRect(-playBtnW / 2, -playBtnH / 2, playBtnW, playBtnH, 22);
      playBtnBg.lineStyle(3.5, 0x00f0ff, 1);
      playBtnBg.strokeRoundedRect(-playBtnW / 2, -playBtnH / 2, playBtnW, playBtnH, 22);

      const playText = this.add.text(0, 0, 'PLAY NOW ▶', {
        fontFamily: '"Arial Black", "Impact", sans-serif',
        fontSize: '30px',
        color: '#00f0ff',
        fontStyle: 'bold',
        letterSpacing: 3,
      }).setOrigin(0.5);

      const playContainer = this.add.container(GAME_WIDTH / 2, actionAreaY, [playBtnBg, playText]);
      this.tweens.add({
        targets: playContainer,
        scaleX: 1.04,
        scaleY: 1.04,
        duration: 750,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      startContainer.add(playContainer);

      const playHit = this.add.rectangle(GAME_WIDTH / 2, actionAreaY, playBtnW, playBtnH, 0x000000, 0).setInteractive({ useHandCursor: true });
      playHit.on('pointerdown', () => {
        this._startGame(null, selectedDifficulty);
      });
      startContainer.add(playHit);

      const subHint = this.add.text(GAME_WIDTH / 2, actionAreaY + 68, 'Guided first shot • Aim assist enabled', {
        fontFamily: 'sans-serif',
        fontSize: '15px',
        color: '#7188b8',
      }).setOrigin(0.5);
      startContainer.add(subHint);
    }

    // --- Footer Note ---
    const footerText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 38, 'Audio & controls calibrate automatically on tap', {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: '#425178',
    }).setOrigin(0.5);
    startContainer.add(footerText);
  }

  _startGame(savedData, difficulty) {
    if (this.sound && this.sound.context && this.sound.context.state === 'suspended') {
      this.sound.context.resume().catch((err) => console.warn('Audio resume error:', err));
    }
    try {
      this.sound.play(AUDIO_KEYS.SHOOT, { volume: 0.4 });
    } catch (e) {}

    let launchSavedData = savedData;
    if (!launchSavedData && this.cachedBestScore) {
      launchSavedData = { bestScore: this.cachedBestScore, difficulty };
    }

    this.scene.start('MainScene', {
      savedData: launchSavedData,
      difficulty,
    });
  }

  _generateBlockTextures() {
    const size = TILE_SIZE;
    const r = TILE_RADIUS;

    for (const [key, theme] of Object.entries(NEON_COLORS)) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });

      // 1. Dark Neon Tinted Base Fill
      g.fillStyle(theme.bg, 0.95);
      g.fillRoundedRect(0, 0, size, size, r);

      // 2. Inner Cyber Glow Gradient / Bevel
      g.lineStyle(2, 0xffffff, 0.25);
      g.strokeRoundedRect(2, 2, size - 4, size - 4, r - 2);

      // 3. Crisp Neon Outer Border
      g.lineStyle(3, theme.border, 0.95);
      g.strokeRoundedRect(0, 0, size, size, r);

      // 4. Cyber Corner Accent Markers (top-left & top-right)
      g.fillStyle(theme.border, 1);
      g.fillRect(8, 6, 12, 3);
      g.fillRect(size - 20, 6, 12, 3);

      g.generateTexture(`tile_${key}`, size, size);
      g.destroy();
    }
  }

  _generateParticleTextures() {
    if (!this.textures.exists('particle_glow')) {
      const glow = this.make.graphics({ x: 0, y: 0, add: false });
      const gSize = 128;
      const center = gSize / 2;
      for (let i = center; i > 0; i -= 2) {
        const alpha = Math.pow(1 - i / center, 2) * 0.75;
        glow.fillStyle(0xffffff, alpha);
        glow.fillCircle(center, center, i);
      }
      glow.generateTexture('particle_glow', gSize, gSize);
      glow.destroy();
    }

    if (!this.textures.exists('particle_spark')) {
      const spark = this.make.graphics({ x: 0, y: 0, add: false });
      const sSize = 32;
      const sCenter = sSize / 2;
      spark.fillStyle(0xffffff, 1);
      spark.fillCircle(sCenter, sCenter, 4);
      spark.fillRect(sCenter - 1, 0, 2, sSize);
      spark.fillRect(0, sCenter - 1, sSize, 2);
      spark.generateTexture('particle_spark', sSize, sSize);
      spark.destroy();
    }
  }

  _generateGridTextures() {
    // Background empty grid slot texture
    const slot = this.make.graphics({ x: 0, y: 0, add: false });
    slot.fillStyle(0x0e1329, 0.65);
    slot.fillRoundedRect(0, 0, TILE_SIZE, TILE_SIZE, TILE_RADIUS);
    slot.lineStyle(2, 0x1d274a, 0.55);
    slot.strokeRoundedRect(0, 0, TILE_SIZE, TILE_SIZE, TILE_RADIUS);

    // Cross marker in center of empty cell
    slot.lineStyle(1, 0x25335c, 0.35);
    const half = TILE_SIZE / 2;
    slot.moveTo(half - 8, half);
    slot.lineTo(half + 8, half);
    slot.moveTo(half, half - 8);
    slot.lineTo(half, half + 8);
    slot.strokePath();

    slot.generateTexture('grid_slot', TILE_SIZE, TILE_SIZE);
    slot.destroy();
  }
}

export default BootScene;
