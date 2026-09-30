/**
 * Playgama Bridge SDK Integration Service (v2.x)
 * Fully bundled with @playgama/bridge for offline and sandbox readiness.
 */
import bridge, { PLATFORM_MESSAGE, EVENT_NAME } from '@playgama/bridge';

class PlaygamaService {
  constructor() {
    this.bridge = bridge;
    this.isInitialized = false;
    this.initPromise = null;
    this.audioEnabled = true;
    this.isPaused = false;
    this.gameInstance = null;
    this.audioListeners = [];
    this.pauseListeners = [];
    this.resumeListeners = [];
  }

  /**
   * Initialize Playgama Bridge SDK
   */
  async init() {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        console.log('[PlaygamaBridge] Initializing Playgama Bridge SDK...');
        await bridge.initialize();
        this.isInitialized = true;
        console.log('[PlaygamaBridge] Initialized successfully. Platform:', bridge.platform?.id);

        // Initial audio check
        if (bridge.platform && typeof bridge.platform.isAudioEnabled !== 'undefined') {
          this.audioEnabled = Boolean(bridge.platform.isAudioEnabled);
        }

        // Listen for audio state changes
        bridge.platform?.on?.(EVENT_NAME.AUDIO_STATE_CHANGED, (isEnabled) => {
          console.log('[PlaygamaBridge] Audio state changed:', isEnabled);
          this.audioEnabled = Boolean(isEnabled);
          this._syncPhaserAudio();
          this.audioListeners.forEach((fn) => fn(this.audioEnabled));
        });

        // Listen for pause state changes
        bridge.platform?.on?.(EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused) => {
          console.log('[PlaygamaBridge] Pause state changed:', isPaused);
          this.isPaused = Boolean(isPaused);
          if (this.isPaused) {
            if (this.gameInstance) {
              this.gameInstance.scene.pause();
              if (this.gameInstance.sound) this.gameInstance.sound.pauseAll();
            }
            this.pauseListeners.forEach((fn) => fn());
          } else {
            if (this.gameInstance) {
              this.gameInstance.scene.resume();
              if (this.gameInstance.sound && this.audioEnabled) this.gameInstance.sound.resumeAll();
            }
            this.resumeListeners.forEach((fn) => fn());
          }
        });

        // Report 100% loading progress and game ready immediately upon initialization
        if (typeof bridge.setGameLoadingProgress === 'function') {
          bridge.setGameLoadingProgress(100);
        }
        await this.sendGameReady();

        return true;
      } catch (err) {
        console.warn('[PlaygamaBridge] Initialization error:', err);
        return false;
      }
    })();

    return this.initPromise;
  }

  bindGame(game) {
    this.gameInstance = game;
    this._syncPhaserAudio();
  }

  _syncPhaserAudio() {
    if (this.gameInstance && this.gameInstance.sound) {
      this.gameInstance.sound.mute = !this.audioEnabled;
    }
  }

  /**
   * Signal first frame / gameplay ready (Mandatory for Playgama Sandbox & Moderation)
   */
  async sendGameReady() {
    try {
      if (!this.isInitialized && this.initPromise) {
        await this.initPromise;
      }

      if (typeof bridge.setGameLoadingProgress === 'function') {
        bridge.setGameLoadingProgress(100);
      }

      console.log('[PlaygamaBridge] Sending game_ready message to platform...');
      if (bridge.platform && typeof bridge.platform.sendMessage === 'function') {
        await bridge.platform.sendMessage(PLATFORM_MESSAGE.GAME_READY);
        console.log('[PlaygamaBridge] game_ready confirmed via bridge.platform.sendMessage!');
      }

      if (typeof window !== 'undefined' && window.PLAYGAMA_SDK?.gameService?.gameReady) {
        window.PLAYGAMA_SDK.gameService.gameReady();
        console.log('[PlaygamaBridge] game_ready confirmed via PLAYGAMA_SDK!');
      }
    } catch (e) {
      console.warn('[PlaygamaBridge] sendGameReady failed:', e);
    }
  }

  /**
   * Check if audio is enabled
   */
  isAudioMuted() {
    return !this.audioEnabled;
  }

  onAudioEnabledChange(cb) {
    if (typeof cb === 'function') this.audioListeners.push(cb);
  }

  onPause(cb) {
    if (typeof cb === 'function') this.pauseListeners.push(cb);
  }

  onResume(cb) {
    if (typeof cb === 'function') this.resumeListeners.push(cb);
  }

  /**
   * Show Interstitial Ad at natural break
   */
  showInterstitial(placement = 'game_over') {
    try {
      if (bridge.advertisement?.isInterstitialSupported) {
        console.log('[PlaygamaBridge] Showing interstitial ad for placement:', placement);
        bridge.advertisement.showInterstitial(placement);
        return true;
      }
    } catch (err) {
      console.warn('[PlaygamaBridge] Interstitial ad error:', err);
    }
    return false;
  }

  /**
   * Show Rewarded Ad to revive player
   */
  showRewarded() {
    return new Promise((resolve) => {
      let isRewarded = false;

      const stateHandler = (state) => {
        console.log('[PlaygamaBridge] Rewarded ad state:', state);
        if (state === 'rewarded') {
          isRewarded = true;
        } else if (state === 'closed' || state === 'failed') {
          bridge.advertisement.off(EVENT_NAME.REWARDED_STATE_CHANGED, stateHandler);
          resolve(isRewarded);
        }
      };

      try {
        bridge.advertisement.on(EVENT_NAME.REWARDED_STATE_CHANGED, stateHandler);
        bridge.advertisement.showRewarded();
      } catch (e) {
        console.warn('[PlaygamaBridge] showRewarded error:', e);
        resolve(false);
      }
    });
  }

  /**
   * Storage: Save player data
   */
  async saveData(dataObj) {
    try {
      await bridge.storage.set(['neon_merge_data'], [JSON.stringify(dataObj)]);
      console.log('[PlaygamaBridge] Storage save successful');
      return true;
    } catch (err) {
      console.warn('[PlaygamaBridge] Storage save error:', err);
      return false;
    }
  }

  /**
   * Storage: Load player data
   */
  async loadData() {
    try {
      const result = await bridge.storage.get(['neon_merge_data']);
      if (result && result[0]) {
        return JSON.parse(result[0]);
      }
    } catch (err) {
      console.warn('[PlaygamaBridge] Storage load error:', err);
    }
    return null;
  }
}

export const playgamaService = new PlaygamaService();
export default playgamaService;
