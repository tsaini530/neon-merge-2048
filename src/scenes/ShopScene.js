import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, AUDIO_KEYS, POWERUP_COSTS } from '../config/constants.js';
import ytService from '../sdk/ytService.js';

export class ShopScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ShopScene' });
  }

  init(data) {
    this.coins = data.coins || 0;
    this.isClosing = false;
  }

  create() {
    this.isClosing = false;
    const centerY = GAME_HEIGHT / 2 - 10;
    const main = this.scene.get('MainScene');

    // 1. Dark Backdrop Overlay
    this.overlay = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x05060e,
      0.88
    );
    this.overlay.setDepth(1);
    this.overlay.setInteractive();
    this.overlay.on('pointerdown', (pointer) => {
      if (this.isClosing) return;
      if (Math.abs(pointer.x - GAME_WIDTH / 2) > 280 || Math.abs(pointer.y - centerY) > 310) {
        this._handleClose();
      }
    });

    // 2. Main Dialog Panel Card
    const boxW = 560;
    const boxH = 620;

    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x0e1329, 0.98);
    panelBg.fillRoundedRect(GAME_WIDTH / 2 - boxW / 2, centerY - boxH / 2, boxW, boxH, 24);
    panelBg.lineStyle(3, 0xffea00, 0.95);
    panelBg.strokeRoundedRect(GAME_WIDTH / 2 - boxW / 2, centerY - boxH / 2, boxW, boxH, 24);
    panelBg.setDepth(5);

    // Glowing gold top bar accent
    const topBar = this.add.graphics();
    topBar.fillStyle(0xffea00, 1);
    topBar.fillRoundedRect(GAME_WIDTH / 2 - 130, centerY - boxH / 2 - 3, 260, 6, 3);
    topBar.setDepth(6);

    // Title
    const titleText = this.add.text(GAME_WIDTH / 2, centerY - 255, '⚡ CYBER POWER SHOP', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '26px',
      color: '#ffea00',
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setOrigin(0.5);
    titleText.setDepth(7);

    // Close "✕" Button
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
    closeHit.on('pointerdown', () => this._handleClose());
    closeHit.on('pointerover', () => closeLabel.setColor('#ff005d'));
    closeHit.on('pointerout', () => closeLabel.setColor('#8da2d4'));

    // Balance Display Capsule
    const balBg = this.add.graphics();
    balBg.fillStyle(0x070b1a, 0.95);
    balBg.lineStyle(1.5, 0xffea00, 0.8);
    balBg.fillRoundedRect(GAME_WIDTH / 2 - 150, centerY - 215, 300, 42, 12);
    balBg.strokeRoundedRect(GAME_WIDTH / 2 - 150, centerY - 215, 300, 42, 12);
    balBg.setDepth(7);

    this.balanceText = this.add.text(
      GAME_WIDTH / 2,
      centerY - 194,
      `YOUR BALANCE:  ${this.coins} ¢`,
      {
        fontFamily: '"Arial Black", sans-serif',
        fontSize: '16px',
        color: '#ffea00',
        letterSpacing: 1,
        fontStyle: 'bold',
      }
    ).setOrigin(0.5);
    this.balanceText.setDepth(8);

    // Status Notification Text
    this.statusText = this.add.text(GAME_WIDTH / 2, centerY - 158, 'TAP ANY POWER-UP TO PURCHASE', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '12px',
      color: '#8da2d4',
      letterSpacing: 1,
    }).setOrigin(0.5);
    this.statusText.setDepth(8);

    // 3. Shop Items
    const items = [
      {
        name: 'SMASHER (+1)',
        desc: 'Disintegrates any single block on grid',
        cost: POWERUP_COSTS.HAMMER,
        color: 0xffaa00,
        onBuy: () => {
          if (main) {
            main.hammerCount++;
            main.shooter.setHammerCount(main.hammerCount);
          }
        },
      },
      {
        name: 'WILDCARD TILE (★)',
        desc: 'Loads a ★ tile that merges with anything',
        cost: POWERUP_COSTS.WILDCARD,
        color: 0x00f0ff,
        onBuy: () => {
          if (main) {
            main.shooter.loadWildcard();
          }
        },
      },
      {
        name: 'CLEAR DANGER ROW',
        desc: 'Disintegrates lowest danger row of blocks',
        cost: POWERUP_COSTS.ROW_CLEAR,
        color: 0x39ff14,
        onBuy: () => {
          if (main) {
            main.gridManager.clearBottomRows(1);
          }
        },
      },
    ];

    let startY = centerY - 95;
    items.forEach((item, index) => {
      this._createShopRow(GAME_WIDTH / 2, startY + index * 92, item);
    });

    // 4. Bottom Close Button
    const bottomBtnY = centerY + 240;
    this._createFlatButton(
      GAME_WIDTH / 2,
      bottomBtnY,
      '✕  CLOSE & RESUME GAME',
      0x8da2d4,
      0x141824,
      () => this._handleClose()
    );
  }

  _createShopRow(x, y, item) {
    const rowW = 500;
    const rowH = 78;

    // Card background
    const bg = this.add.graphics();
    bg.fillStyle(0x070b1a, 0.95);
    bg.fillRoundedRect(x - rowW / 2, y - rowH / 2, rowW, rowH, 16);
    bg.lineStyle(2, item.color, 0.7);
    bg.strokeRoundedRect(x - rowW / 2, y - rowH / 2, rowW, rowH, 16);
    bg.setDepth(8);

    // Title & Description
    const title = this.add.text(x - rowW / 2 + 20, y - 16, item.name, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '17px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    title.setDepth(9);

    const desc = this.add.text(x - rowW / 2 + 20, y + 10, item.desc, {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: '#8da2d4',
    });
    desc.setDepth(9);

    // Buy Button on Right
    const btnW = 130;
    const btnH = 46;
    const btnX = x + rowW / 2 - 80;
    const btnY = y;

    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x1a2138, 0.98);
    btnBg.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 12);
    btnBg.lineStyle(2, item.color, 0.9);
    btnBg.strokeRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 12);
    btnBg.setDepth(10);

    const btnLabel = this.add.text(btnX, btnY, `${item.cost} ¢`, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '17px',
      color: '#ffea00',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    btnLabel.setDepth(11);

    // Interactive Hitbox
    const hit = this.add.rectangle(btnX, btnY, btnW + 10, btnH + 10, 0x000000, 0);
    hit.setDepth(15);
    hit.setInteractive({ useHandCursor: true });

    hit.on('pointerdown', (pointer) => {
      if (pointer && pointer.event) pointer.event.stopPropagation();
      this._attemptPurchase(item, btnLabel, btnBg);
    });

    hit.on('pointerover', () => btnLabel.setScale(1.08));
    hit.on('pointerout', () => btnLabel.setScale(1));
  }

  _attemptPurchase(item, btnLabel, btnBg) {
    if (this.coins < item.cost) {
      // Not enough coins
      this._playSound(AUDIO_KEYS.WARN, { volume: 0.6 });
      this.statusText.setText(`✕ NEED ${item.cost - this.coins} MORE COINS!`);
      this.statusText.setColor('#ff005d');
      this.tweens.add({
        targets: this.balanceText,
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 90,
        yoyo: true,
      });
      return;
    }

    // Success: Deduct coins
    this.coins -= item.cost;
    this.balanceText.setText(`YOUR BALANCE:  ${this.coins} ¢`);
    this.statusText.setText(`✓ ${item.name} UNLOCKED!`);
    this.statusText.setColor('#39ff14');

    this._playSound(AUDIO_KEYS.POWERUP, { volume: 0.85 });

    // Apply to MainScene
    const main = this.scene.get('MainScene');
    if (main) {
      main.coins = this.coins;
      if (main.coinText) main.coinText.setText(`${this.coins}`);
      item.onBuy();
      main._saveGameState();
    }

    // Button pop
    this.tweens.add({
      targets: [btnLabel, btnBg],
      scaleX: 1.12,
      scaleY: 1.12,
      duration: 100,
      yoyo: true,
    });
  }

  _createFlatButton(x, y, text, borderColor, bgColor, onClick) {
    const width = 420;
    const height = 52;

    const bg = this.add.graphics();
    bg.fillStyle(bgColor, 0.98);
    bg.fillRoundedRect(x - width / 2, y - height / 2, width, height, 14);
    bg.lineStyle(2, borderColor, 0.8);
    bg.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 14);
    bg.setDepth(10);

    const label = this.add.text(x, y, text, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '17px',
      color: '#ffffff',
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setOrigin(0.5);
    label.setDepth(11);

    const hit = this.add.rectangle(x, y, width, height, 0x000000, 0);
    hit.setInteractive({ useHandCursor: true });
    hit.setDepth(15);

    hit.on('pointerdown', (pointer) => {
      if (pointer && pointer.event) pointer.event.stopPropagation();
      onClick();
    });

    hit.on('pointerover', () => label.setScale(1.04));
    hit.on('pointerout', () => label.setScale(1));
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
      console.warn('Audio play error in ShopScene:', err);
    }
  }

  _handleClose() {
    if (this.isClosing) return;
    this.isClosing = true;

    this._playSound(AUDIO_KEYS.LAND, { volume: 0.65 });

    const main = this.scene.get('MainScene');
    this.scene.resume('MainScene');
    if (main) {
      main.isInputActive = true;
    }
    this.scene.stop('ShopScene');
  }
}

export default ShopScene;
