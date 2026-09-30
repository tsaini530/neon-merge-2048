import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, AUDIO_KEYS } from '../config/constants.js';
import ytService from '../sdk/ytService.js';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PauseScene' });
  }

  init(data) {
    this.score = data.score || 0;
    this.bestScore = data.bestScore || 0;
    this.isClosing = false;
  }

  create() {
    this.isClosing = false;
    const centerY = GAME_HEIGHT / 2 - 20;

    // 1. Dark Backdrop Overlay (Blocks all clicks from reaching game underneath)
    this.overlay = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x05060e,
      0.85
    );
    this.overlay.setDepth(1);
    this.overlay.setInteractive();

    // Tapping on outer backdrop safely resumes the game
    this.overlay.on('pointerdown', (pointer) => {
      if (this.isClosing) return;
      if (Math.abs(pointer.x - GAME_WIDTH / 2) > 270 || Math.abs(pointer.y - centerY) > 240) {
        this._handleResume();
      }
    });

    // 2. Modal Panel Card Visuals
    const boxW = 520;
    const boxH = 460;

    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x0e1329, 0.98);
    panelBg.fillRoundedRect(GAME_WIDTH / 2 - boxW / 2, centerY - boxH / 2, boxW, boxH, 24);
    panelBg.lineStyle(3, 0x00f0ff, 0.95);
    panelBg.strokeRoundedRect(GAME_WIDTH / 2 - boxW / 2, centerY - boxH / 2, boxW, boxH, 24);
    panelBg.setDepth(5);

    // Glowing cyan top bar accent
    const topBar = this.add.graphics();
    topBar.fillStyle(0x00f0ff, 1);
    topBar.fillRoundedRect(GAME_WIDTH / 2 - 120, centerY - boxH / 2 - 3, 240, 6, 3);
    topBar.setDepth(6);

    // Title
    const titleText = this.add.text(GAME_WIDTH / 2, centerY - 175, 'GAME PAUSED', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '32px',
      color: '#00f0ff',
      fontStyle: 'bold',
      letterSpacing: 3,
    }).setOrigin(0.5);
    titleText.setDepth(7);

    // Close "✕" Button in top-right
    const closeX = GAME_WIDTH / 2 + boxW / 2 - 42;
    const closeY = centerY - boxH / 2 + 40;
    const closeLabel = this.add.text(closeX, closeY, '✕', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '26px',
      color: '#8da2d4',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    closeLabel.setDepth(10);

    const closeHit = this.add.rectangle(closeX, closeY, 64, 64, 0x000000, 0);
    closeHit.setDepth(15);
    closeHit.setInteractive({ useHandCursor: true });
    closeHit.on('pointerdown', () => this._handleResume());
    closeHit.on('pointerover', () => closeLabel.setColor('#ff005d'));
    closeHit.on('pointerout', () => closeLabel.setColor('#8da2d4'));

    // Score & Best Capsule (Uses universal standard star ★ - no broken emoji glyphs!)
    const statBg = this.add.graphics();
    statBg.fillStyle(0x070b1a, 0.95);
    statBg.lineStyle(1.5, 0x1f2c4e, 0.95);
    statBg.fillRoundedRect(GAME_WIDTH / 2 - 210, centerY - 135, 420, 52, 14);
    statBg.strokeRoundedRect(GAME_WIDTH / 2 - 210, centerY - 135, 420, 52, 14);
    statBg.setDepth(7);

    const statText = this.add.text(
      GAME_WIDTH / 2,
      centerY - 109,
      `SCORE: ${this.score.toLocaleString()}   │   ★ BEST: ${this.bestScore.toLocaleString()}`,
      {
        fontFamily: '"Arial Black", sans-serif',
        fontSize: '15px',
        color: '#ffea00',
        letterSpacing: 1,
        fontStyle: 'bold',
      }
    ).setOrigin(0.5);
    statText.setDepth(8);

    // 3. Action Buttons (Direct top-level interactive rectangles at depth 15)
    // Button 1: RESUME GAME
    const resumeY = centerY - 15;
    this._createButton(
      GAME_WIDTH / 2,
      resumeY,
      '▶  RESUME GAME',
      0x39ff14,
      0x0a2f15,
      () => this._handleResume()
    );

    // Button 2: SOUND TOGGLE
    const isSoundOn = ytService.isAudioEnabled();
    const soundY = centerY + 65;
    this.soundBtn = this._createButton(
      GAME_WIDTH / 2,
      soundY,
      isSoundOn ? 'SOUND: ON' : 'SOUND: OFF',
      isSoundOn ? 0x00f0ff : 0x6e7a9e,
      isSoundOn ? 0x072735 : 0x141824,
      () => this._handleToggleSound()
    );

    // Button 3: RESTART RUN (Instant clean restart & popup close!)
    const restartY = centerY + 145;
    this._createButton(
      GAME_WIDTH / 2,
      restartY,
      '↺  RESTART RUN',
      0xff005d,
      0x380512,
      () => this._handleRestart()
    );
  }

  _createButton(x, y, text, borderColor, bgColor, onClick) {
    const width = 380;
    const height = 58;

    // Visual button background
    const bg = this.add.graphics();
    bg.fillStyle(bgColor, 0.98);
    bg.fillRoundedRect(x - width / 2, y - height / 2, width, height, 16);
    bg.lineStyle(2.5, borderColor, 0.95);
    bg.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 16);
    bg.setDepth(10);

    // Button label
    const label = this.add.text(x, y, text, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setOrigin(0.5);
    label.setDepth(11);

    // Top-depth interactive hitbox
    const hitZone = this.add.rectangle(x, y, width, height, 0x000000, 0);
    hitZone.setInteractive({ useHandCursor: true });
    hitZone.setDepth(15);

    hitZone.on('pointerdown', (pointer) => {
      if (pointer && pointer.event) pointer.event.stopPropagation();
      // Button press visual feedback
      label.setScale(0.96);
      bg.setScale(0.98);
      onClick();
    });

    hitZone.on('pointerup', () => {
      label.setScale(1);
      bg.setScale(1);
    });

    hitZone.on('pointerover', () => {
      label.setScale(1.04);
    });

    hitZone.on('pointerout', () => {
      label.setScale(1);
      bg.setScale(1);
    });

    return { bg, label, hitZone, x, y, width, height };
  }

  _playSound(key, config = {}) {
    if (!ytService.isAudioEnabled()) return;
    try {
      if (this.sound && this.sound.context && this.sound.context.state === 'suspended') {
        this.sound.context.resume();
      }
      if (this.sound && (this.cache.audio.exists(key) || this.sound.get(key))) {
        this.sound.play(key, config);
      }
    } catch (err) {
      console.warn('Audio play error in PauseScene:', err);
    }
  }

  _handleResume() {
    if (this.isClosing) return;
    this.isClosing = true;

    this._playSound(AUDIO_KEYS.LAND, { volume: 0.65 });

    // Smoothly stop PauseScene and resume MainScene
    const main = this.scene.get('MainScene');
    this.scene.resume('MainScene');
    if (main) {
      main.isInputActive = true;
    }
    this.scene.stop('PauseScene');
  }

  _handleToggleSound() {
    const newState = !ytService.isAudioEnabled();
    ytService.setAudioEnabled(newState);

    const soundText = newState ? 'SOUND: ON' : 'SOUND: OFF';
    this.soundBtn.label.setText(soundText);

    // Update button styling
    this.soundBtn.bg.clear();
    const borderColor = newState ? 0x00f0ff : 0x6e7a9e;
    const bgColor = newState ? 0x072735 : 0x141824;
    this.soundBtn.bg.fillStyle(bgColor, 0.98);
    this.soundBtn.bg.fillRoundedRect(
      this.soundBtn.x - this.soundBtn.width / 2,
      this.soundBtn.y - this.soundBtn.height / 2,
      this.soundBtn.width,
      this.soundBtn.height,
      16
    );
    this.soundBtn.bg.lineStyle(2.5, borderColor, 0.95);
    this.soundBtn.bg.strokeRoundedRect(
      this.soundBtn.x - this.soundBtn.width / 2,
      this.soundBtn.y - this.soundBtn.height / 2,
      this.soundBtn.width,
      this.soundBtn.height,
      16
    );

    if (newState) {
      this._playSound(AUDIO_KEYS.LAND, { volume: 0.8 });
    }
  }

  _handleRestart() {
    if (this.isClosing) return;
    this.isClosing = true;

    this._playSound(AUDIO_KEYS.POWERUP, { volume: 0.8 });

    // Immediately resume MainScene and start fresh game, then stop PauseScene
    const main = this.scene.get('MainScene');
    this.scene.resume('MainScene');
    if (main) {
      main.startNewGame();
    }
    this.scene.stop('PauseScene');
  }
}

export default PauseScene;
