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
        const initAction = (typeof bridge !== 'undefined' && bridge && typeof bridge.initialize === 'function')
          ? bridge.initialize()
          : Promise.resolve();

        await Promise.race([
          initAction,
          new Promise((resolve) => setTimeout(() => {
            console.warn('[PlaygamaBridge] Initialization timed out (fallback mode)');
            resolve();
          }, 1500))
        ]);
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
   * Active Bridge instance (prefers platform window.bridge if available)
   */
  get activeBridge() {
    if (typeof window !== 'undefined' && window.bridge) {
      return window.bridge;
    }
    return this.bridge || bridge;
  }

  /**
   * Show Interstitial Ad at natural break
   */
  showInterstitial(placement = 'game_over') {
    try {
      const active = this.activeBridge;
      if (active?.advertisement?.isInterstitialSupported) {
        console.log('[PlaygamaBridge] Showing interstitial ad for placement:', placement);
        active.advertisement.showInterstitial(placement);
        return true;
      }
    } catch (err) {
      console.warn('[PlaygamaBridge] Interstitial ad error:', err);
    }
    return false;
  }

  get isRewardedSupported() {
    const active = this.activeBridge;
    return Boolean(active?.advertisement?.isRewardedSupported);
  }

  /**
   * Preload Rewarded Ad
   */
  preloadRewarded(placement = 'bonus') {
    try {
      const active = this.activeBridge;
      if (active?.advertisement && typeof active.advertisement.preloadRewarded === 'function') {
        console.log('[PlaygamaBridge] Preloading rewarded ad for placement:', placement);
        active.advertisement.preloadRewarded(placement);
      }
    } catch (err) {
      console.warn('[PlaygamaBridge] preloadRewarded error:', err);
    }
  }

  /**
   * Show Rewarded Ad (Handles early close, full reward, and sound muting)
   * Resolves to true ONLY if 'rewarded' state was received before 'closed'.
   * Returns false if closed early, failed, or timed out.
   */
  showRewarded(placement = 'bonus') {
    return new Promise((resolve) => {
      let isRewarded = false;
      let isSettled = false;
      const active = this.activeBridge;
      const eventName = active?.EVENT_NAME || EVENT_NAME;
      const eventKey = eventName?.REWARDED_STATE_CHANGED || 'rewarded_state_changed';

      // Both activeBridge and bundled bridge references
      const bridgeList = [active];
      if (bridge && bridge !== active) bridgeList.push(bridge);

      const finish = (result) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timeoutId);

        try {
          bridgeList.forEach((b) => {
            b.advertisement?.off?.(eventKey, stateHandler);
          });
        } catch (_) {}

        // Restore game sound if audio is enabled
        this._syncPhaserAudio();
        console.log(`[PlaygamaBridge] Rewarded ad finished. Result: ${result ? 'SUCCESS (REWARDED)' : 'CLOSED/FAILED (NO REWARD)'}`);
        resolve(result);
      };

      // 60-second safeguard timeout against network stall or hanging ads
      const timeoutId = setTimeout(() => {
        console.warn('[PlaygamaBridge] Rewarded ad timeout safeguard triggered');
        finish(false);
      }, 60000);

      const stateHandler = (state) => {
        console.log('[PlaygamaBridge] Rewarded ad state:', state, 'placement:', placement);
        switch (state) {
          case 'loading':
            break;
          case 'opened':
            // Mute game audio during ad playback so it doesn't clash
            if (this.gameInstance && this.gameInstance.sound) {
              this.gameInstance.sound.mute = true;
            }
            break;
          case 'rewarded':
            // ONLY grant reward if this event is explicitly received!
            isRewarded = true;
            break;
          case 'closed':
            finish(isRewarded);
            break;
          case 'failed':
            finish(false);
            break;
          default:
            break;
        }
      };

      try {
        if (!active?.advertisement || typeof active.advertisement.showRewarded !== 'function') {
          console.warn('[PlaygamaBridge] activeBridge.advertisement.showRewarded not available');
          finish(false);
          return;
        }

        bridgeList.forEach((b) => {
          b.advertisement?.on?.(eventKey, stateHandler);
        });

        console.log('[PlaygamaBridge] Triggering rewarded ad on platform for placement:', placement);
        active.advertisement.showRewarded(placement);
      } catch (e) {
        console.warn('[PlaygamaBridge] showRewarded error:', e);
        finish(false);
      }
    });
  }

  /**
   * Storage: Save player data (Cloud Save)
   */
  async saveData(dataObj) {
    if (!dataObj || typeof dataObj !== 'object') return false;

    // Local fallback persistence
    try {
      localStorage.setItem('neon_merge_2048_data', JSON.stringify(dataObj));
    } catch (_) {}

    try {
      if (!this.isInitialized && this.initPromise) {
        await this.initPromise;
      }

      if (bridge.storage && typeof bridge.storage.set === 'function') {
        const keys = ['neon_merge_data', 'score', 'best_score', 'coins', 'level'];
        const values = [
          JSON.stringify(dataObj),
          Number(dataObj.score) || 0,
          Number(dataObj.bestScore) || 0,
          Number(dataObj.coins) || 0,
          Number(dataObj.nextMilestone) || 128,
        ];
        await bridge.storage.set(keys, values);
        console.log('[PlaygamaBridge] Cloud storage save successful:', {
          score: dataObj.score,
          coins: dataObj.coins,
          bestScore: dataObj.bestScore,
        });
        return true;
      }
    } catch (err) {
      console.warn('[PlaygamaBridge] Storage save error:', err);
    }
    return false;
  }

  /**
   * Storage: Load player data (Cloud Save)
   */
  async loadData() {
    try {
      if (!this.isInitialized && this.initPromise) {
        await Promise.race([
          this.initPromise,
          new Promise((resolve) => setTimeout(resolve, 1500))
        ]);
      }

      if (typeof bridge !== 'undefined' && bridge && bridge.storage && typeof bridge.storage.get === 'function') {
        console.log('[PlaygamaBridge] Fetching saved progress from storage...');
        const keys = ['neon_merge_data', 'score', 'best_score', 'coins', 'level'];
        const result = await Promise.race([
          bridge.storage.get(keys),
          new Promise((resolve) => setTimeout(() => resolve(null), 1500))
        ]);
        console.log('[PlaygamaBridge] Raw storage get result:', result);

        if (result && Array.isArray(result)) {
          let saved = null;
          const raw = result[0];

          // 1. If SDK already parsed it to an Object
          if (raw && typeof raw === 'object') {
            saved = { ...raw };
          } else if (typeof raw === 'string' && raw.trim() !== '') {
            try {
              saved = JSON.parse(raw);
            } catch (parseErr) {
              console.warn('[PlaygamaBridge] Error parsing JSON string:', parseErr);
            }
          }

          // 2. Check individual key fallbacks
          const score = result[1];
          const bestScore = result[2];
          const coins = result[3];
          const level = result[4];

          if (score !== null && score !== undefined && !isNaN(Number(score))) {
            if (!saved) saved = {};
            if (saved.score === undefined) saved.score = Number(score);
          }
          if (bestScore !== null && bestScore !== undefined && !isNaN(Number(bestScore))) {
            if (!saved) saved = {};
            if (saved.bestScore === undefined) saved.bestScore = Number(bestScore);
          }
          if (coins !== null && coins !== undefined && !isNaN(Number(coins))) {
            if (!saved) saved = {};
            if (saved.coins === undefined) saved.coins = Number(coins);
          }
          if (level !== null && level !== undefined && !isNaN(Number(level))) {
            if (!saved) saved = {};
            if (saved.nextMilestone === undefined) saved.nextMilestone = Number(level);
          }

          if (saved && (saved.score !== undefined || saved.coins !== undefined || saved.bestScore !== undefined)) {
            console.log('[PlaygamaBridge] Player progress successfully loaded from cloud storage:', saved);
            return saved;
          }
        }
      }
    } catch (err) {
      console.warn('[PlaygamaBridge] Cloud storage load error:', err);
    }

    // Local fallback
    try {
      const raw = localStorage.getItem('neon_merge_2048_data');
      if (raw) {
        const parsed = JSON.parse(raw);
        console.log('[PlaygamaBridge] Loaded progress from local fallback:', parsed);
        return parsed;
      }
    } catch (_) {}

    return null;
  }
}

export const playgamaService = new PlaygamaService();

if (typeof window !== 'undefined') {
  window.playgamaService = playgamaService;
  window.showRewardedAd = (placement = 'bonus') => playgamaService.showRewarded(placement);
}

export default playgamaService;
