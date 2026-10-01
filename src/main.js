import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config/constants.js';
import BootScene from './scenes/BootScene.js';
import MainScene from './scenes/MainScene.js';
import PauseScene from './scenes/PauseScene.js';
import ShopScene from './scenes/ShopScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import ytService from './sdk/ytService.js';
import playgamaService from './sdk/playgamaService.js';

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#080914',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    pixelArt: false,
    antialias: true,
  },
  physics: {
    default: false, // Pure custom grid & tween kinematics
  },
  scene: [BootScene, MainScene, PauseScene, ShopScene, GameOverScene],
};

const game = new Phaser.Game(config);

// Bind SDKs to Phaser game instance
ytService.bindGame(game);
playgamaService.bindGame(game);
playgamaService.init();

if (typeof window !== 'undefined') {
  window.game = game;
}

export default game;
