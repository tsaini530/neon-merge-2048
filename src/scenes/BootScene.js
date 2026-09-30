import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  TILE_SIZE,
  TILE_RADIUS,
  NEON_COLORS,
  AUDIO_KEYS,
} from '../config/constants.js';
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
      // Signal first frame rendered to YouTube Playables SDK & Playgama Bridge
      ytService.firstFrameReady();
      playgamaService.sendGameReady();
    });
  }

  _createLoadingUI() {
    // Cyber background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x080914);

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
  }

  create() {
    // Generate all procedural neon textures into TextureManager
    this._generateBlockTextures();
    this._generateParticleTextures();
    this._generateGridTextures();

    // Transition to MainScene
    this.time.delayedCall(150, () => {
      this.scene.start('MainScene');
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
