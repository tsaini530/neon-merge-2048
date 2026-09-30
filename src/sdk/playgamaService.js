/**
 * Playgama Bridge SDK Integration Service (v2.x)
 * Handles cross-platform lifecycle, storage, audio sync, and ads.
 */

class PlaygamaService {
  constructor() {
    this.bridge = typeof window !== 'undefined' ? window.bridge : null;
    this.isInitialized = false;
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
    if (this.isInitialized) return true;

    if (typeof window !== 'undefined' && window.bridge) {
      this.bridge = window.bridge;
      try {
        await this.bridge.initialize();
        this.isInitialized = true;
        console.log('[PlaygamaBridge] Initialized successfully. Platform:', this.bridge.platform?.id);

        // Initial audio check
        if (this.bridge.platform && typeof this.bridge.platform.isAudioEnabled !== 'undefined') {
          this.audioEnabled = Boolean(this.bridge.platform.isAudioEnabled);
        }

        // Listen for audio state changes
        if (this.bridge.EVENT_NAME?.AUDIO_STATE_CHANGED) {
          this.bridge.platform.on(this.bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (isEnabled) => {
            console.log('[PlaygamaBridge] Audio state changed:', isEnabled);
            this.audioEnabled = Boolean(isEnabled);
            this._syncPhaserAudio();
            this.audioListeners.forEach((fn) => fn(this.audioEnabled));
          });
        }

        // Listen for pause state changes
        if (this.bridge.EVENT_NAME?.PAUSE_STATE_CHANGED) {
          this.bridge.platform.on(this.bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (isPaused) => {
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
        }

        return true;
      } catch (err) {
        console.warn('[PlaygamaBridge] Initialization error:', err);
        return false;
      }
    } else {
      console.log('[PlaygamaBridge] Running in standalone/fallback mode.');
      return false;
    }
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
   * Signal first frame / gameplay ready
   */
  sendGameReady() {
    if (this.bridge?.platform?.sendMessage) {
      try {
        this.bridge.platform.sendMessage('game_ready')
          .then(() => console.log('[PlaygamaBridge] game_ready message sent'))
          .catch((e) => console.warn('[PlaygamaBridge] game_ready message error:', e));
      } catch (e) {
        console.warn('[PlaygamaBridge] sendGameReady failed:', e);
      }
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
    if (this.bridge?.advertisement?.showInterstitial) {
      try {
        console.log('[PlaygamaBridge] Requesting interstitial ad...');
        this.bridge.advertisement.showInterstitial(placement);
        return true;
      } catch (err) {
        console.warn('[PlaygamaBridge] Interstitial ad error:', err);
        return false;
      }
    }
    return false;
  }

  /**
   * Show Rewarded Ad to revive player
   */
  showRewarded() {
    if (this.bridge?.advertisement?.showRewarded) {
      return new Promise((resolve) => {
        let isRewarded = false;

        const unsubscribe = () => {
          if (this.bridge?.advertisement?.off && this.bridge?.EVENT_NAME?.REWARDED_STATE_CHANGED) {
            this.bridge.advertisement.off(this.bridge.EVENT_NAME.REWARDED_STATE_CHANGED, stateHandler);
          }
        };

        const stateHandler = (state) => {
          console.log('[PlaygamaBridge] Rewarded ad state:', state);
          if (state === 'rewarded') {
            isRewarded = true;
          } else if (state === 'closed' || state === 'failed') {
            unsubscribe();
            resolve(isRewarded);
          }
        };

        if (this.bridge.EVENT_NAME?.REWARDED_STATE_CHANGED) {
          this.bridge.advertisement.on(this.bridge.EVENT_NAME.REWARDED_STATE_CHANGED, stateHandler);
        }

        try {
          this.bridge.advertisement.showRewarded();
        } catch (e) {
          console.warn('[PlaygamaBridge] showRewarded error:', e);
          unsubscribe();
          resolve(false);
        }
      });
    }

    // Fallback simulation
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), 600);
    });
  }

  /**
   * Storage: Save player data
   */
  async saveData(dataObj) {
    if (this.bridge?.storage?.set) {
      try {
        await this.bridge.storage.set(['neon_merge_data'], [JSON.stringify(dataObj)]);
        console.log('[PlaygamaBridge] Storage save successful');
        return true;
      } catch (err) {
        console.warn('[PlaygamaBridge] Storage save error:', err);
      }
    }
    return false;
  }

  /**
   * Storage: Load player data
   */
  async loadData() {
    if (this.bridge?.storage?.get) {
      try {
        const result = await this.bridge.storage.get(['neon_merge_data']);
        if (result && result[0]) {
          return JSON.parse(result[0]);
        }
      } catch (err) {
        console.warn('[PlaygamaBridge] Storage load error:', err);
      }
    }
    return null;
  }
}

export const playgamaService = new PlaygamaService();
export default playgamaService;
