/**
 * YouTube Playables SDK Bridge (ytgame)
 * Handles lifecycle events, cloud persistence, audio sync, and rewarded ads.
 * Provides fallback mock for local/standalone execution.
 */

class YTService {
  constructor() {
    this.sdk = typeof window !== 'undefined' ? window.ytgame : null;
    this.isPlayablesEnv = Boolean(this.sdk && this.sdk.IN_PLAYABLES_ENV);
    this.audioEnabled = true;
    this.audioListeners = [];
    this.pauseListeners = [];
    this.resumeListeners = [];
    this.isPaused = false;
    this.gameInstance = null;

    this._setupAudioListener();
    this._setupLifecycleListeners();
  }

  /**
   * Bind the active Phaser Game instance for global sound & loop control
   * @param {Phaser.Game} game 
   */
  bindGame(game) {
    this.gameInstance = game;
    this._syncPhaserAudio();
  }

  /**
   * Internal setup for audio callbacks
   */
  _setupAudioListener() {
    if (this.isPlayablesEnv && this.sdk?.system?.onAudioEnabledChange) {
      try {
        this.audioEnabled = this.sdk.system.isAudioEnabled();
        this.sdk.system.onAudioEnabledChange((enabled) => {
          this.audioEnabled = enabled;
          this._syncPhaserAudio();
          this.audioListeners.forEach((fn) => fn(enabled));
        });
      } catch (err) {
        console.warn('[YTPlayables] Audio listener registration warning:', err);
      }
    } else {
      // Local fallback: default enabled
      this.audioEnabled = true;
    }
  }

  /**
   * Internal setup for system pause & resume callbacks
   */
  _setupLifecycleListeners() {
    if (this.isPlayablesEnv && this.sdk?.system?.onPause && this.sdk?.system?.onResume) {
      try {
        this.sdk.system.onPause(() => {
          console.log('[YTPlayables] System onPause triggered');
          this.isPaused = true;
          if (this.gameInstance && !this.gameInstance.isPaused) {
            this.gameInstance.scene.pause();
            if (this.gameInstance.sound) {
              this.gameInstance.sound.pauseAll();
            }
          }
          this.pauseListeners.forEach((fn) => fn());
        });

        this.sdk.system.onResume(() => {
          console.log('[YTPlayables] System onResume triggered');
          this.isPaused = false;
          if (this.gameInstance) {
            this.gameInstance.scene.resume();
            if (this.gameInstance.sound && this.audioEnabled) {
              this.gameInstance.sound.resumeAll();
            }
          }
          this.resumeListeners.forEach((fn) => fn());
        });
      } catch (err) {
        console.warn('[YTPlayables] Lifecycle listeners warning:', err);
      }
    } else {
      // Fallback for standard browser visibility when running outside YouTube
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            this.isPaused = true;
            this.pauseListeners.forEach((fn) => fn());
          } else {
            this.isPaused = false;
            this.resumeListeners.forEach((fn) => fn());
          }
        });
      }
    }
  }

  /**
   * Synchronize Phaser master sound mute state with platform audio
   */
  _syncPhaserAudio() {
    if (this.gameInstance && this.gameInstance.sound) {
      this.gameInstance.sound.mute = !this.audioEnabled;
    }
  }

  /**
   * Signal to YouTube that the game has rendered its first visual frame (loading screen)
   */
  firstFrameReady() {
    console.log('[YTPlayables] firstFrameReady() invoked');
    if (this.isPlayablesEnv && this.sdk?.game?.firstFrameReady) {
      try {
        this.sdk.game.firstFrameReady();
      } catch (err) {
        console.warn('[YTPlayables] firstFrameReady failed:', err);
      }
    }
  }

  /**
   * Signal to YouTube that the game is interactive and ready for gameplay
   */
  gameReady() {
    console.log('[YTPlayables] gameReady() invoked');
    if (this.isPlayablesEnv && this.sdk?.game?.gameReady) {
      try {
        this.sdk.game.gameReady();
      } catch (err) {
        console.warn('[YTPlayables] gameReady failed:', err);
      }
    }
  }

  /**
   * Check if audio is currently enabled by the host platform
   * @returns {boolean}
   */
  isAudioEnabled() {
    if (this.isPlayablesEnv && this.sdk?.system?.isAudioEnabled) {
      try {
        return this.sdk.system.isAudioEnabled();
      } catch (e) {
        return this.audioEnabled;
      }
    }
    return this.audioEnabled;
  }

  /**
   * Manually toggle or set audio enabled state (useful for local settings menu)
   * @param {boolean} enabled 
   * @returns {boolean}
   */
  setAudioEnabled(enabled) {
    this.audioEnabled = Boolean(enabled);
    this._syncPhaserAudio();
    this.audioListeners.forEach((fn) => fn(this.audioEnabled));
    return this.audioEnabled;
  }

  /**
   * Listen to audio mute/unmute state changes from YouTube
   * @param {Function} callback 
   */
  onAudioEnabledChange(callback) {
    if (typeof callback === 'function') {
      this.audioListeners.push(callback);
    }
  }

  /**
   * Listen to game pause requests
   * @param {Function} callback 
   */
  onPause(callback) {
    if (typeof callback === 'function') {
      this.pauseListeners.push(callback);
    }
  }

  /**
   * Listen to game resume requests
   * @param {Function} callback 
   */
  onResume(callback) {
    if (typeof callback === 'function') {
      this.resumeListeners.push(callback);
    }
  }

  /**
   * Save persistent user progress to YouTube Cloud Storage
   * @param {Object} dataObj 
   * @returns {Promise<boolean>}
   */
  async saveData(dataObj) {
    const jsonString = JSON.stringify(dataObj);
    if (this.isPlayablesEnv && this.sdk?.game?.saveData) {
      try {
        await this.sdk.game.saveData(jsonString);
        console.log('[YTPlayables] Cloud saveData successful');
        return true;
      } catch (err) {
        console.warn('[YTPlayables] Cloud saveData error:', err);
        return false;
      }
    }

    // LocalStorage fallback for dev
    try {
      localStorage.setItem('neon_merge_2048_data', jsonString);
      return true;
    } catch (e) {
      console.warn('[YTPlayables] LocalStorage save error:', e);
      return false;
    }
  }

  /**
   * Load persistent user progress from YouTube Cloud Storage
   * @returns {Promise<Object|null>}
   */
  async loadData() {
    if (this.isPlayablesEnv && this.sdk?.game?.loadData) {
      try {
        const raw = await this.sdk.game.loadData();
        if (raw && typeof raw === 'string') {
          return JSON.parse(raw);
        }
      } catch (err) {
        console.warn('[YTPlayables] Cloud loadData error:', err);
      }
    }

    // LocalStorage fallback for dev
    try {
      const raw = localStorage.getItem('neon_merge_2048_data');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('[YTPlayables] LocalStorage load error:', e);
      return null;
    }
  }

  /**
   * Request a rewarded ad to revive the player
   * @returns {Promise<boolean>} Resolves true if ad watched & rewarded
   */
  async requestRewardedAd() {
    console.log('[YTPlayables] requestRewardedAd() requested');
    if (this.isPlayablesEnv && this.sdk?.ads?.requestRewardedAd) {
      try {
        await this.sdk.ads.requestRewardedAd();
        return true;
      } catch (err) {
        console.warn('[YTPlayables] Rewarded ad error or dismissed:', err);
        return false;
      }
    }

    // Local dev mock: simulate ad watch with slight delay
    console.log('[YTPlayables] Mocking rewarded ad (local dev)...');
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('[YTPlayables] Mock rewarded ad completed!');
        resolve(true);
      }, 750);
    });
  }

  /**
   * Request an interstitial ad (e.g. between game rounds)
   * @returns {Promise<boolean>}
   */
  async requestInterstitialAd() {
    console.log('[YTPlayables] requestInterstitialAd() requested');
    if (this.isPlayablesEnv && this.sdk?.ads?.requestInterstitialAd) {
      try {
        await this.sdk.ads.requestInterstitialAd();
        return true;
      } catch (err) {
        console.warn('[YTPlayables] Interstitial ad error:', err);
        return false;
      }
    }
    return true;
  }
}

export const ytService = new YTService();
export default ytService;
