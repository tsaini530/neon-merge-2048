import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, AUDIO_KEYS, POWERUP_COSTS } from '../config/constants.js';
import ytService from '../sdk/ytService.js';
import playgamaService from '../sdk/playgamaService.js';

export class ShopScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ShopScene' });
  }

  init(data) {
    this.coins = data.coins || 0;
    this.isClosing = false;
    this.isAdShowing = false;
  }

  create() {
    this.isClosing = false;
    this.isAdShowing = false;
    const centerY = GAME_HEIGHT / 2;
    const main = this.scene.get('MainScene');

    // 1. Dark Backdrop Overlay
    this.overlay = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x05060e,
      0.90
    );
    this.overlay.setDepth(1);
    this.overlay.setInteractive();
    this.overlay.on('pointerdown', (pointer) => {
      if (this.isClosing || this.isAdShowing) return;
      if (Math.abs(pointer.x - GAME_WIDTH / 2) > 290 || Math.abs(pointer.y - centerY) > 375) {
        this._handleClose();
      }
    });

    // 2. Main Dialog Panel Card
    const boxW = 580;
    const boxH = 750;

    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x0e1329, 0.98);
    panelBg.fillRoundedRect(GAME_WIDTH / 2 - boxW / 2, centerY - boxH / 2, boxW, boxH, 24);
    panelBg.lineStyle(3, 0xffea00, 0.95);
    panelBg.strokeRoundedRect(GAME_WIDTH / 2 - boxW / 2, centerY - boxH / 2, boxW, boxH, 24);
    panelBg.setDepth(5);

    // Glowing gold top bar accent
    const topBar = this.add.graphics();
    topBar.fillStyle(0xffea00, 1);
    topBar.fillRoundedRect(GAME_WIDTH / 2 - 140, centerY - boxH / 2 - 3, 280, 6, 3);
    topBar.setDepth(6);

    // Title
    const titleText = this.add.text(GAME_WIDTH / 2, centerY - 325, '⚡ CYBER POWER SHOP', {
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
    balBg.lineStyle(1.5, 0xffea00, 0.85);
    balBg.fillRoundedRect(GAME_WIDTH / 2 - 160, centerY - 280, 320, 42, 12);
    balBg.strokeRoundedRect(GAME_WIDTH / 2 - 160, centerY - 280, 320, 42, 12);
    balBg.setDepth(7);

    this.balanceText = this.add.text(
      GAME_WIDTH / 2,
      centerY - 259,
      `YOUR BALANCE:  ${this.coins} ¢`,
      {
        fontFamily: '"Arial Black", sans-serif',
        fontSize: '17px',
        color: '#ffea00',
        letterSpacing: 1,
        fontStyle: 'bold',
      }
    ).setOrigin(0.5);
    this.balanceText.setDepth(8);

    // Status Notification Text
    this.statusText = this.add.text(GAME_WIDTH / 2, centerY - 224, 'TAP ANY ITEM OR SPONSOR REWARD', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '13px',
      color: '#8da2d4',
      letterSpacing: 1,
    }).setOrigin(0.5);
    this.statusText.setDepth(8);

    // 3. FREE SPONSOR REWARDS (Rewarded Ads)
    const adHeader = this.add.text(GAME_WIDTH / 2, centerY - 188, '── ▶ FREE SPONSOR REWARDS ──', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '13px',
      color: '#00f0ff',
      letterSpacing: 2,
    }).setOrigin(0.5);
    adHeader.setDepth(7);

    // Two side-by-side Free Ad Buttons
    const adBtnW = 250;
    const adBtnH = 76;
    const adBtnY = centerY - 132;

    // Card 1: Free Coins
    this._createRewardedAdCard({
      x: GAME_WIDTH / 2 - 134,
      y: adBtnY,
      width: adBtnW,
      height: adBtnH,
      title: '+100 COINS (¢)',
      desc: 'Free Sponsor Reward',
      placement: 'shop_coins',
      color: 0xffea00,
      hex: '#ffea00',
      onReward: () => {
        this.coins += 100;
        this.balanceText.setText(`YOUR BALANCE:  ${this.coins} ¢`);
        if (main) {
          main.coins = this.coins;
          if (main.coinText) main.coinText.setText(`${this.coins}`);
          main._saveGameState();
        }
        this._showFloatingText(GAME_WIDTH / 2 - 134, adBtnY - 45, '+100 ¢', '#ffea00');
      },
    });

    // Card 2: Free Smasher
    this._createRewardedAdCard({
      x: GAME_WIDTH / 2 + 134,
      y: adBtnY,
      width: adBtnW,
      height: adBtnH,
      title: '+1 SMASHER (★)',
      desc: 'Free Sponsor Reward',
      placement: 'shop_hammer',
      color: 0x00ff88,
      hex: '#00ff88',
      onReward: () => {
        if (main) {
          main.hammerCount++;
          main.shooter.setHammerCount(main.hammerCount);
          main._saveGameState();
        }
        this._showFloatingText(GAME_WIDTH / 2 + 134, adBtnY - 45, '+1 SMASH!', '#00ff88');
      },
    });

    // 4. POWER-UP SHOP (Purchasable with Coins)
    const shopHeader = this.add.text(GAME_WIDTH / 2, centerY - 64, '── ⚡ COIN POWER-UPS ──', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '13px',
      color: '#ffd700',
      letterSpacing: 2,
    }).setOrigin(0.5);
    shopHeader.setDepth(7);

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

    let startY = centerY - 10;
    items.forEach((item, index) => {
      this._createShopRow(GAME_WIDTH / 2, startY + index * 84, item);
    });

    // 5. Bottom Close Button
    const bottomBtnY = centerY + 270;
    this._createFlatButton(
      GAME_WIDTH / 2,
      bottomBtnY,
      '✕  CLOSE & RESUME GAME',
      0x8da2d4,
      0x141824,
      () => this._handleClose()
    );
  }

  _createRewardedAdCard({ x, y, width, height, title, desc, placement, color, hex, onReward }) {
    const bg = this.add.graphics();
    const renderBg = (borderColor, fillAlpha = 0.12) => {
      bg.clear();
      bg.fillStyle(0x070b1a, 0.96);
      bg.fillRoundedRect(x - width / 2, y - height / 2, width, height, 14);
      bg.fillStyle(borderColor, fillAlpha);
      bg.fillRoundedRect(x - width / 2, y - height / 2, width, height, 14);
      bg.lineStyle(2, borderColor, 0.9);
      bg.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 14);
    };
    renderBg(color, 0.10);
    bg.setDepth(8);

    const titleTxt = this.add.text(x, y - 18, title, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '16px',
      color: hex,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    titleTxt.setDepth(9);

    const subTxt = this.add.text(x, y + 8, '[ ▶ WATCH AD ]', {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '13px',
      color: '#ffffff',
      letterSpacing: 1,
    }).setOrigin(0.5);
    subTxt.setDepth(9);

    const hit = this.add.rectangle(x, y, width, height, 0x000000, 0);
    hit.setDepth(15);
    hit.setInteractive({ useHandCursor: true });

    let isBusy = false;

    hit.on('pointerdown', async (pointer) => {
      if (pointer && pointer.event) pointer.event.stopPropagation();
      if (isBusy || this.isAdShowing) return;

      isBusy = true;
      this.isAdShowing = true;
      this._playSound(AUDIO_KEYS.SWAP, { volume: 0.4 });

      subTxt.setText('▶ OPENING AD...');
      subTxt.setColor('#00f0ff');
      renderBg(0x00f0ff, 0.25);
      this.statusText.setText('LOADING SPONSOR AD...');
      this.statusText.setColor('#00f0ff');

      const isRewarded = await playgamaService.showRewarded(placement);

      this.isAdShowing = false;

      if (isRewarded) {
        // Rewarded!
        onReward();
        this._playSound(AUDIO_KEYS.POWERUP, { volume: 0.85 });
        this.statusText.setText(`✓ ${title} UNLOCKED!`);
        this.statusText.setColor('#39ff14');

        subTxt.setText('✓ CLAIMED!');
        subTxt.setColor('#39ff14');
        renderBg(0x39ff14, 0.25);

        this.time.delayedCall(2000, () => {
          subTxt.setText('[ ▶ WATCH AD ]');
          subTxt.setColor('#ffffff');
          renderBg(color, 0.10);
          isBusy = false;
        });
      } else {
        // Early close or failed: Strictly NO reward granted!
        this._playSound(AUDIO_KEYS.WARN, { volume: 0.6 });
        this.statusText.setText('✕ AD CLOSED EARLY — NO REWARD');
        this.statusText.setColor('#ff005d');

        subTxt.setText('✕ AD CANCELLED');
        subTxt.setColor('#ff005d');
        renderBg(0xff005d, 0.25);

        this.time.delayedCall(2200, () => {
          subTxt.setText('[ ▶ WATCH AD ]');
          subTxt.setColor('#ffffff');
          renderBg(color, 0.10);
          isBusy = false;
        });
      }
    });

    hit.on('pointerover', () => {
      if (!isBusy) titleTxt.setScale(1.04);
    });
    hit.on('pointerout', () => {
      titleTxt.setScale(1);
    });
  }

  _createShopRow(x, y, item) {
    const rowW = 510;
    const rowH = 72;

    // Card background
    const bg = this.add.graphics();
    bg.fillStyle(0x070b1a, 0.95);
    bg.fillRoundedRect(x - rowW / 2, y - rowH / 2, rowW, rowH, 14);
    bg.lineStyle(2, item.color, 0.75);
    bg.strokeRoundedRect(x - rowW / 2, y - rowH / 2, rowW, rowH, 14);
    bg.setDepth(8);

    // Title & Description
    const title = this.add.text(x - rowW / 2 + 18, y - 15, item.name, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    title.setDepth(9);

    const desc = this.add.text(x - rowW / 2 + 18, y + 9, item.desc, {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: '#8da2d4',
    });
    desc.setDepth(9);

    // Buy Button on Right
    const btnW = 120;
    const btnH = 44;
    const btnX = x + rowW / 2 - 72;
    const btnY = y;

    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x1a2138, 0.98);
    btnBg.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 12);
    btnBg.lineStyle(2, item.color, 0.9);
    btnBg.strokeRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 12);
    btnBg.setDepth(10);

    const btnLabel = this.add.text(btnX, btnY, `${item.cost} ¢`, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '16px',
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
      this.statusText.setText(`✕ NEED ${item.cost - this.coins} MORE COINS! (WATCH AD ABOVE)`);
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

  _showFloatingText(x, y, text, color) {
    const toast = this.add.text(x, y, text, {
      fontFamily: '"Arial Black", sans-serif',
      fontSize: '20px',
      color: color,
    }).setOrigin(0.5);
    toast.setDepth(20);

    this.tweens.add({
      targets: toast,
      y: y - 40,
      alpha: 0,
      duration: 1100,
      onComplete: () => toast.destroy(),
    });
  }

  _createFlatButton(x, y, text, borderColor, bgColor, onClick) {
    const width = 440;
    const height = 50;

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
    if (playgamaService.isAudioMuted()) return;
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
    if (this.isClosing || this.isAdShowing) return;
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
