# Neon Merge 2048: Column Shooter

A high-performance HTML5 hybrid casual puzzle game designed for the **YouTube Playables** platform. The game combines column-aim bubble shooter mechanics with recursive 2048 number-tile merging in an electrifying cyber-neon aesthetic.

---

## 🎮 Gameplay Features

* **5x8 Matrix Grid:** Top-anchored number tile columns with upward gravity compaction.
* **Column-Aim Shooter:** Drag or move finger/mouse horizontally across the 5 columns with real-time laser trajectory beam and ghost tile landing indicator.
* **Tactical Block Swap:** Tap the NEXT slot or the `⇄ SWAP` button to interchange current and next projectile blocks.
* **Recursive 2048 Chain Merges:** When matching blocks connect orthogonally, they fuse into higher powers of 2 ($2 \times, 4 \times, 8 \times$), triggering secondary chain reactions.
* **Combo Multiplier & Scaling Audio:** Chain merges scale the combo counter, multiplier points, and audio chime pitch.
* **Danger Zone & Revive Hook:** When tiles stack dangerously close to the bottom line, warning indicators pulse. Exceeding the grid triggers the Game Over sequence with a YouTube Playables Rewarded Ad revive hook (clearing bottom rows with a laser shockwave).

---

## 🛠️ YouTube Playables (`ytgame` SDK) Compliance

* **Zero External Requests:** All audio synthesis, sprites, and shaders are bundled locally into `dist/` with relative paths (`./`). No external CDNs, fonts, or tracking scripts.
* **Lifecycle Signals:**
  * `firstFrameReady()`: Dispatched during `BootScene` asset loading.
  * `gameReady()`: Dispatched once `MainScene` is loaded and interactive.
* **Audio Synchronization:** Strictly binds to `ytgame.system.isAudioEnabled()` and `ytgame.system.onAudioEnabledChange()`.
* **System Pause / Resume:** Automatically pauses game loop, animations, and sound via `ytgame.system.onPause()`, auto-saving state.
* **Cloud Persistence:** Persists high score and grid state via `ytgame.game.saveData()` / `loadData()`.
* **Monetization Hooks:** Includes `ytgame.ads.requestRewardedAd()` for game revives and `ytgame.ads.requestInterstitialAd()` at game over breakpoints.
* **Local Fallback:** When run outside YouTube (e.g., local development), `ytService.js` automatically simulates all SDK calls and uses `localStorage` for progress persistence.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Build for YouTube Playables Distribution
```bash
npm run build
```
This generates the standalone production bundle in `dist/` ready to upload to YouTube Playables.

---

## 📂 Project Architecture

```text
├── index.html                  # Playables entrypoint (loads ytgame SDK & game canvas)
├── package.json
├── vite.config.js              # Bundler config (base: './', inline assets option)
├── src/
│   ├── main.js                 # Phaser initialization & config
│   ├── sdk/
│   │   └── ytService.js        # YouTube Playables SDK lifecycle, cloud save & audio bridge
│   ├── config/
│   │   ├── constants.js        # Grid dimensions (5x8), block values, colors
│   │   └── gameSettings.js     # Responsive aspect ratio calculations (9:16 portrait)
│   ├── scenes/
│   │   ├── BootScene.js        # Asset preloader & firstFrameReady trigger
│   │   ├── MainScene.js        # Gameplay loop, touch/mouse drag-and-aim, launch physics
│   │   └── GameOverScene.js    # Score recap, high score save, rewarded revive hook
│   └── objects/
│       ├── GridManager.js      # 5x8 matrix logic, raycast drop, recursive 2048 merge
│       ├── Block.js            # Number tile sprite, text label, squish tween & merge VFX
│       └── Shooter.js          # Player launcher, current tile, next tile preview & swap
└── public/
    └── assets/
        ├── sprites/            # WebP/PNG tiles, neon glow textures, particle textures
        └── audio/              # OGG/WAV sound effects (merge, shot, combo scale, game over)
```
