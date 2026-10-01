import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, AUDIO_KEYS, NEON_COLORS, POWERUP_COSTS } from '../config/constants.js';
import { formatScore, formatTileNumber } from '../utils/numberFormat.js';
import ytService from '../sdk/ytService.js';
import playgamaService from '../sdk/playgamaService.js';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data) {
    this.score = data.score || 0;
    this.bestScore = data.bestScore || 0;
    this.coins = data.coins || 0;
    this.highestTile = data.highestTile || 2;
    this.difficulty = data.difficulty || 'MEDIUM';
    this.canRevive = data.canRevive !== false;
  }

  create() {
    // Interstitial ad breakpoint on game over
    ytService.requestInterstitialAd();
    playgamaService.showInterstitial('game_over');

    // Play dramatic Game Over audio sequence or High Score celebration!
    const isNewRecord = this.score > 0 && this.score >= this.bestScore;
    this.time.delayedCall(120, () => {
      if (isNewRecord) {
        this._playSound(AUDIO_KEYS.HYPE, { volume: 0.95 });
      } else {
        this._playSound(AUDIO_KEYS.GAMEOVER, { volume: 0.95 });
      }
    });

    const panelY = GAME_HEIGHT / 2 - 20;

    // 1. Dark cyber blur overlay
    this.overlay = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x05060e,
      0.90
    );
    this.overlay.setDepth(1);

    // 2. Dialog Panel Visuals Container
    const panel = this.add.container(GAME_WIDTH / 2, panelY);
    panel.setDepth(5);

    // Panel border and background
    const bg = this.add.graphics();
    bg.fillStyle(0x0e1329, 0.98);
    bg.fillRoundedRect(-270, -280, 540, 560, 24);
    bg.lineStyle(3, 0xff005d, 0.85);
    bg.strokeRoundedRect(-270, -280, 540, 560, 24);

    // Glowing top bar accent
    bg.fillStyle(0xff005d, 1);
    bg.fillRoundedRect(-140, -283, 280, 6, 3);
    panel.add(bg);

    // Title
    const title = this.add.text(0, -220, 'SYSTEM OVERLOAD', {
      fontFamily: '"Arial Black", "Impact", sans-serif',
      fontSize: '34px',
      color: '#ff005d',
      fontStyle: 'bold',
      letterSpacing: 3,
    }).setOrigin(0.5);
    panel.add(title);

    const sub = this.add.text(0, -175, 'GRID CAPACITY EXCEEDED', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '13px',
      color: '#6e7a9e',
      letterSpacing: 4,
    }).setOrigin(0.5);
    panel.add(sub);

    // Score Label & Value
    const scoreTag = this.add.text(0, -120, 'FINAL SCORE', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '15px',
      color: '#8da2d4',
      letterSpacing: 2,
    }).setOrigin(0.5);
    panel.add(scoreTag);

    const scoreVal = this.add.text(0, -75, `${formatScore(this.score)}`, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '48px',
      color: '#00f0ff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    panel.add(scoreVal);

    // Best Score & High Record indicator
    const bestText = isNewRecord ? '★ NEW BEST RECORD! ★' : `BEST: ${formatScore(this.bestScore)}`;
    const bestColor = isNewRecord ? '#ffe600' : '#8da2d4';

    const bestVal = this.add.text(0, -15, bestText, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '18px',
      color: bestColor,
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setOrigin(0.5);
    panel.add(bestVal);

    if (isNewRecord) {
      this.tweens.add({
        targets: bestVal,
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 400,
        yoyo: true,
        repeat: -1,
      });
    }

    // Highest Tile Badge with Difficulty tag
    const tileTag = this.add.text(0, 35, `[${this.difficulty}] MAX TILE: ${formatTileNumber(this.highestTile)}`, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '15px',
      color: '#39ff14',
      letterSpacing: 1.5,
    }).setOrigin(0.5);
    panel.add(tileTag);

    // 3. Interactive Buttons (Direct top-level objects at depth 10 to ensure 100% click reliability)
    let currentRelY = this.canRevive ? 95 : 120;
    this.reviveWorldY = null;

    if (this.canRevive) {
      this.reviveWorldY = panelY + currentRelY;
      const canCoinRevive = this.coins >= POWERUP_COSTS.REVIVE;
      const reviveText = canCoinRevive ? `▶ REVIVE (${POWERUP_COSTS.REVIVE} ¢)` : '▶ REVIVE (WATCH AD)';
      this._createFlatButton(
        GAME_WIDTH / 2,
        this.reviveWorldY,
        reviveText,
        0x39ff14,
        0x0a2f15,
        () => this._handleRevive(canCoinRevive)
      );
      currentRelY += 72;
    }

    this.retryWorldY = panelY + currentRelY;
    this._createFlatButton(
      GAME_WIDTH / 2,
      this.retryWorldY,
      'PLAY AGAIN',
      0x00f0ff,
      0x072735,
      () => this._handleRestart()
    );
    currentRelY += 72;

    this.shareWorldY = panelY + currentRelY;
    this._createFlatButton(
      GAME_WIDTH / 2,
      this.shareWorldY,
      '📲 CHALLENGE A FRIEND',
      0xff007f,
      0x2e0618,
      () => this._handleShareScore()
    );

    // Pop-in animation for panel
    panel.setScale(0.9);
    panel.setAlpha(0);
    this.tweens.add({
      targets: panel,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 220,
      ease: 'Back.easeOut',
    });

    // 4. Secondary Direct Coordinate Tap Fallback (Guarantees clicks work on any browser/device)
    this.input.on('pointerdown', (pointer) => {
      // Check Play Again click
      if (
        Math.abs(pointer.x - GAME_WIDTH / 2) <= 190 &&
        Math.abs(pointer.y - this.retryWorldY) <= 32
      ) {
        this._handleRestart();
        return;
      }

      // Check Revive click
      if (
        this.canRevive &&
        this.reviveWorldY !== null &&
        Math.abs(pointer.x - GAME_WIDTH / 2) <= 190 &&
        Math.abs(pointer.y - this.reviveWorldY) <= 32
      ) {
        this._handleRevive();
        return;
      }

      // Check Challenge click
      if (
        this.shareWorldY !== null &&
        Math.abs(pointer.x - GAME_WIDTH / 2) <= 190 &&
        Math.abs(pointer.y - this.shareWorldY) <= 32
      ) {
        this._handleShareScore();
        return;
      }
    });
  }

  _createFlatButton(x, y, text, borderColor, bgColor, onClick) {
    const width = 380;
    const height = 58;

    // Visual button background
    const bg = this.add.graphics();
    bg.fillStyle(bgColor, 0.98);
    bg.fillRoundedRect(x - width / 2, y - height / 2, width, height, 16);
    bg.lineStyle(2, borderColor, 0.95);
    bg.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 16);
    bg.setDepth(8);

    // Button label
    const label = this.add.text(x, y, text, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setOrigin(0.5);
    label.setDepth(9);

    // Interactive hitbox at top depth
    const hitZone = this.add.rectangle(x, y, width, height, 0x000000, 0);
    hitZone.setInteractive({ useHandCursor: true });
    hitZone.setDepth(15);

    hitZone.on('pointerdown', () => {
      onClick();
    });

    hitZone.on('pointerover', () => {
      label.setScale(1.05);
    });

    hitZone.on('pointerout', () => {
      label.setScale(1);
    });

    return { bg, label, hitZone };
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
      console.warn('Audio play error in GameOverScene:', err);
    }
  }

  async _handleRevive(canCoinRevive) {
    if (canCoinRevive && this.coins >= POWERUP_COSTS.REVIVE) {
      this._playSound(AUDIO_KEYS.POWERUP, { volume: 0.85 });
      this.scene.stop();
      this.scene.resume('MainScene');
      const main = this.scene.get('MainScene');
      if (main) {
        main.coins -= POWERUP_COSTS.REVIVE;
        if (main.coinText) main.coinText.setText(`${main.coins}`);
        main._saveGameState();
        main.revivePlayer();
      }
      return;
    }

    console.log('[GameOverScene] Requesting Rewarded Ad for Revive...');
    let rewarded = false;
    if (ytService.isPlayablesEnv) {
      rewarded = await ytService.requestRewardedAd();
    } else {
      rewarded = await playgamaService.showRewarded();
    }
    if (rewarded) {
      this._playSound(AUDIO_KEYS.POWERUP, { volume: 0.8 });
      this.scene.stop();
      this.scene.resume('MainScene');
      const main = this.scene.get('MainScene');
      if (main) {
        main.revivePlayer();
      }
    }
  }

  _handleRestart() {
    console.log('[GameOverScene] PLAY AGAIN clicked! Restarting game...');
    this._playSound(AUDIO_KEYS.POWERUP, { volume: 0.75 });
    this.scene.stop();
    this.scene.resume('MainScene');
    const main = this.scene.get('MainScene');
    if (main) {
      main.startNewGame();
    }
  }

  _handleShareScore() {
    this._playSound(AUDIO_KEYS.LAND, { volume: 0.8 });
    const text = `🔥 I scored ${this.score.toLocaleString()} points in Neon Merge 2048! Can you beat my high score? Play free instantly:`;
    const url = 'https://neon-merge-2048.netlify.app';

    if (navigator.share) {
      navigator
        .share({
          title: 'Neon Merge 2048 Challenge',
          text: `${text}\n${url}`,
          url: url,
        })
        .catch(() => {});
    } else {
      const shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${text}\n${url}`)}`;
      window.open(shareUrl, '_blank');
    }

    try {
      navigator.clipboard?.writeText?.(`${text}\n${url}`);
    } catch (_) {}

    this._showFloatingToast('CHALLENGE LINK COPIED / OPENED!');
  }

  _showFloatingToast(msg) {
    const toast = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT - 120);
    toast.setDepth(50);

    const bg = this.add.graphics();
    bg.fillStyle(0x00f0ff, 0.95);
    bg.fillRoundedRect(-180, -22, 360, 44, 12);
    toast.add(bg);

    const label = this.add.text(0, 0, msg, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '13px',
      color: '#080914',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5);
    toast.add(label);

    this.tweens.add({
      targets: toast,
      y: GAME_HEIGHT - 160,
      alpha: 0,
      duration: 1800,
      ease: 'Cubic.easeOut',
      onComplete: () => toast.destroy(),
    });
  }
}

export default GameOverScene;
