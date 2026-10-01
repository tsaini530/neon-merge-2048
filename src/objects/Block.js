import Phaser from 'phaser';
import {
  TILE_SIZE,
  TILE_RADIUS,
  NEON_COLORS,
  DEFAULT_NEON,
} from '../config/constants.js';
import { formatTileNumber } from '../utils/numberFormat.js';

export class Block extends Phaser.GameObjects.Container {
  /**
   * @param {Phaser.Scene} scene 
   * @param {number} x 
   * @param {number} y 
   * @param {number} value (2, 4, 8, 16, etc.)
   */
  constructor(scene, x, y, value = 2) {
    super(scene, x, y);
    this.value = value;
    this.col = -1;
    this.row = -1;
    this.isMerging = false;
    this.isGhost = false;

    // Outer glow / aura sprite
    this.glowSprite = scene.add.sprite(0, 0, 'particle_glow');
    this.glowSprite.setDisplaySize(TILE_SIZE * 1.45, TILE_SIZE * 1.45);
    this.glowSprite.setAlpha(0.28);
    this.add(this.glowSprite);

    // Main tile background sprite
    this.bgSprite = scene.add.sprite(0, 0, `tile_${value}`);
    this.bgSprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
    this.add(this.bgSprite);

    // Number text label
    const initialText = formatTileNumber(value);
    this.textLabel = scene.add.text(0, 0, initialText, {
      fontFamily: '"Arial Black", "Impact", "Trebuchet MS", sans-serif',
      fontSize: this._getFontSize(initialText),
      fontStyle: 'bold',
      color: '#ffffff',
      align: 'center',
    });
    this.textLabel.setOrigin(0.5, 0.5);
    this.add(this.textLabel);

    this.setSize(TILE_SIZE, TILE_SIZE);
    this.setDepth(15);
    scene.add.existing(this);

    this.applyTheme();
  }

  _getFontSize(formatted) {
    const len = String(formatted).length;
    if (len >= 5) return '26px';
    if (len === 4) return '30px';
    if (len === 3) return '36px';
    return '42px';
  }

  /**
   * Apply visual theme, colors, and textures based on current value
   */
  applyTheme() {
    const theme = NEON_COLORS[this.value] || DEFAULT_NEON;

    // Check if texture exists in cache, else fallback to generic tile
    const textureKey = `tile_${this.value}`;
    if (this.scene && this.scene.textures && this.scene.textures.exists(textureKey)) {
      this.bgSprite.setTexture(textureKey);
    }

    if (this.textLabel) {
      const formatted = formatTileNumber(this.value);
      this.textLabel.setText(formatted);
      this.textLabel.setFontSize(this._getFontSize(formatted));
      this.textLabel.setColor(theme.text);
    }

    if (this.glowSprite) {
      this.glowSprite.setTint(theme.border);
      this.glowSprite.setAlpha(this.value >= 128 ? 0.45 : 0.25);
    }
  }

  /**
   * Update the block's numeric value with celebratory pop
   * @param {number} newValue 
   */
  setValue(newValue) {
    this.value = newValue;
    this.applyTheme();

    // Visual scale pop
    if (this.scene && this.scene.tweens) {
      this.scene.tweens.killTweensOf(this);
      this.scene.tweens.add({
        targets: this,
        scaleX: 1.25,
        scaleY: 1.25,
        duration: 110,
        yoyo: true,
        ease: 'Back.easeOut',
      });
    }
  }

  /**
   * Subtle spawn pop animation
   */
  spawnPop() {
    this.setScale(1);
    if (this.scene && this.scene.tweens) {
      this.scene.tweens.add({
        targets: this,
        scaleX: { from: 0.2, to: 1 },
        scaleY: { from: 0.2, to: 1 },
        duration: 180,
        ease: 'Back.easeOut',
      });
    }
  }

  /**
   * Impact squish when block hits another tile or wall
   */
  squish() {
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.15,
      scaleY: 0.88,
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeInOut',
    });
  }

  /**
   * Slide smoothly to new grid coordinate
   * @param {number} targetX 
   * @param {number} targetY 
   * @param {number} duration 
   * @returns {Promise}
   */
  moveTo(targetX, targetY, duration = 130) {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this,
        x: targetX,
        y: targetY,
        duration: duration,
        ease: 'Cubic.easeOut',
        onComplete: () => resolve(),
      });
    });
  }

  /**
   * Animate absorption into target block during recursive merge
   * @param {number} targetX 
   * @param {number} targetY 
   * @returns {Promise}
   */
  mergeInto(targetX, targetY) {
    this.isMerging = true;
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this,
        x: targetX,
        y: targetY,
        scaleX: 0.2,
        scaleY: 0.2,
        alpha: 0.1,
        duration: 150,
        ease: 'Quad.easeIn',
        onComplete: () => {
          this.destroy();
          resolve();
        },
      });
    });
  }

  /**
   * Highlight this block as a ghost/landing indicator
   */
  setAsGhost(alpha = 0.45) {
    this.isGhost = true;
    this.setAlpha(alpha);
    if (this.glowSprite) {
      this.glowSprite.setAlpha(0.1);
    }
  }

  /**
   * Pulse when reaching dangerous bottom rows
   * @param {boolean} active 
   */
  setDangerPulsing(active) {
    if (active) {
      if (!this.dangerTween) {
        this.dangerTween = this.scene.tweens.add({
          targets: this.bgSprite,
          alpha: 0.65,
          duration: 350,
          yoyo: true,
          repeat: -1,
        });
      }
    } else if (this.dangerTween) {
      this.dangerTween.stop();
      this.dangerTween = null;
      this.bgSprite.setAlpha(1);
    }
  }

  /**
   * High-voltage match prediction pulse when player aims at a matching column
   * @param {boolean} active 
   */
  setPredictedMatch(active) {
    if (this.isGhost || this.isMerging) return;

    if (active) {
      if (!this.matchTween) {
        this.matchTween = this.scene.tweens.add({
          targets: this,
          scaleX: 1.10,
          scaleY: 1.10,
          duration: 220,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        if (this.glowSprite) {
          this.glowSprite.setAlpha(0.75);
          this.glowSprite.setTint(0x39ff14);
        }
      }
    } else if (this.matchTween) {
      this.matchTween.stop();
      this.matchTween = null;
      this.setScale(1);
      this.applyTheme();
    }
  }

  /**
   * Organic gel/crystal wobble when adjacent block hits
   */
  wobble() {
    if (this.isMerging || this.isGhost) return;
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.07,
      scaleY: 0.93,
      duration: 80,
      yoyo: true,
      ease: 'Quad.easeInOut',
    });
  }

  /**
   * Vaporize disintegrator effect (used by Hammer tool)
   * @returns {Promise}
   */
  vaporize() {
    this.isMerging = true;
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this,
        scaleX: 1.35,
        scaleY: 1.35,
        alpha: 0,
        duration: 160,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.destroy();
          resolve();
        },
      });
    });
  }

  /**
   * Display or remove animated target lock reticle for hammer mode
   * @param {boolean} active 
   */
  setTargetCrosshair(active) {
    if (this.isGhost || this.isMerging) return;

    if (active) {
      if (!this.crosshairGraphics) {
        this.crosshairGraphics = this.scene.add.graphics();
        this.crosshairGraphics.lineStyle(3, 0xffaa00, 0.95);
        const s = TILE_SIZE / 2;
        const len = 14;

        // 4 glowing corner brackets
        this.crosshairGraphics.beginPath();
        this.crosshairGraphics.moveTo(-s, -s + len);
        this.crosshairGraphics.lineTo(-s, -s);
        this.crosshairGraphics.lineTo(-s + len, -s);

        this.crosshairGraphics.moveTo(s - len, -s);
        this.crosshairGraphics.lineTo(s, -s);
        this.crosshairGraphics.lineTo(s, -s + len);

        this.crosshairGraphics.moveTo(-s, s - len);
        this.crosshairGraphics.lineTo(-s, s);
        this.crosshairGraphics.lineTo(-s + len, s);

        this.crosshairGraphics.moveTo(s - len, s);
        this.crosshairGraphics.lineTo(s, s);
        this.crosshairGraphics.lineTo(s, s - len);
        this.crosshairGraphics.strokePath();

        // Pulsing target center
        this.crosshairGraphics.lineStyle(2, 0xff0044, 0.85);
        this.crosshairGraphics.beginPath();
        this.crosshairGraphics.moveTo(-8, 0);
        this.crosshairGraphics.lineTo(8, 0);
        this.crosshairGraphics.moveTo(0, -8);
        this.crosshairGraphics.lineTo(0, 8);
        this.crosshairGraphics.strokePath();

        this.add(this.crosshairGraphics);

        this.crosshairTween = this.scene.tweens.add({
          targets: this.crosshairGraphics,
          scaleX: 1.15,
          scaleY: 1.15,
          duration: 320,
          yoyo: true,
          repeat: -1,
        });
      }
    } else {
      if (this.crosshairTween) {
        this.crosshairTween.stop();
        this.crosshairTween = null;
      }
      if (this.crosshairGraphics) {
        this.crosshairGraphics.destroy();
        this.crosshairGraphics = null;
      }
    }
  }
}

export default Block;
