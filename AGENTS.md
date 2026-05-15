# Cube Solver – WeChat Mini Program

> AI coding agent guide for the CubeSolver-WeChat project.

## Project Overview

This is a **WeChat Mini Program (微信小程序)** that solves 3×3 Rubik’s Cubes. Users can either scan the six faces with their camera or manually type a 54-character state string. The app computes a step-by-step solution using the Kociemba two-phase algorithm and visualizes the result with an animated 3-D cube and a 2-D net view.

- **Language / runtime**: JavaScript (ES6), WeChat Mini Program framework
- **Solver engine**: [`cubejs`](https://github.com/ldez/cubejs) (Kociemba two-phase algorithm)
- **Cloud backend**: WeChat Cloud Development (云开发) – single cloud function `solve`
- **Rendering**: Canvas 2D (both 3-D isometric projection and 2-D unfolded net)

## Technology Stack

| Layer | Technology |
|-------|------------|
| UI markup | WXML (WeChat’s dialect of XML) |
| Styling | WXSS (CSS-like, uses `rpx` responsive units) |
| Logic | JavaScript (ES6), CommonJS `require` / `module.exports` |
| Package manager | npm (consumed by WeChat Dev Tools) |
| Cloud runtime | `wx-server-sdk` (WeChat Cloud Functions) |
| Solver library | `cubejs@^1.1.0` |

## Project Structure

```
.
├── app.js                  # Mini-program App() instance; holds globalData { solverReady, solverError }
├── app.json                # Global page routes, window style, camera permission, component map
├── app.wxss                # Global styles (page font, background, .container padding)
├── sitemap.json            # WeChat search sitemap (allows all pages)
├── project.config.json     # WeChat Dev Tools compiler settings
├── package.json            # Root npm dependency: cubejs
│
├── pages/
│   ├── index/              # Home page – navigation cards + one-time solver init UI
│   ├── scan/               # Camera scan page – 6-face photo capture, colour analysis, review, solve
│   └── verify/             # Manual input page – 54-char state string entry + solve
│
├── components/
│   ├── cube3d/             # 3-D isometric cube renderer (Canvas 2D, custom projection math)
│   └── cubePlayer/         # 2-D unfolded-net renderer (Canvas 2D, play / pause / reset controls)
│
├── utils/
│   ├── solver.js           # cubejs wrapper: incremental table init + solve(stateStr)
│   └── colorClassifier.js  # RGB→HSV, trimmed-mean sampling, distance classification, global constraints
│
└── cloudfunctions/
    └── solve/              # WeChat Cloud Function – server-side solver fallback
        ├── index.js
        ├── package.json    # deps: wx-server-sdk, cubejs
        └── config.json     # permissions (empty openapi list)
```

## Build & Development Workflow

### Prerequisites

- **WeChat Dev Tools** (微信开发者工具) – this is the IDE, compiler, and simulator.
- No traditional CLI build tool (webpack, vite, etc.) is used.

### Installing Dependencies

1. Open the project folder in WeChat Dev Tools.
2. In the Dev Tools menu choose **Tools → Build npm** (工具 → 构建 npm).
3. Dev Tools bundles `cubejs` from `node_modules/` into `miniprogram_npm/` so the Mini Program runtime can import it.

> `miniprogram_npm/` and `package-lock.json` are git-ignored.

### Running / Previewing

- Press the **Compile** button in WeChat Dev Tools to start the simulator.
- Use the **Preview** or **Upload** buttons to push to WeChat’s staging / production environments.

### Cloud Function Deployment

- Right-click `cloudfunctions/solve/` in Dev Tools and choose **Create and Deploy: Cloud Function** to push the server-side solver.

## Code Organization & Conventions

### Module System
- All JS files use **CommonJS**: `const X = require('path');` and `module.exports = { ... }`.
- WeChat Mini Program does **not** support native ES modules (`import` / `export`).

### State String Format
- A cube state is a **54-character string** ordered `U R F D L B` (face order), each face 9 stickers row-major.
- Valid characters: `U R F D L B`.
- Each character must appear exactly 9 times.
- Example solved state: `UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB`.

### Solver Initialization (`utils/solver.js`)
- `cubejs` requires pre-computed **move tables** and **pruning tables** before solving.
- Because the tables are large, initialization is **incremental** (12 steps) using `setTimeout(..., 10)` between each chunk so the Mini Program main thread is not blocked.
- Progress is reported via an `onProgress(step, total, msg)` callback.
- `initPromise` is cached so concurrent calls deduplicate.
- `solverReady` is stored in `App.globalData`.

### Colour Recognition Pipeline (`utils/colorClassifier.js`)
1. **Sampling** – For each of the 3×3 cells in a photo, `sampleRegion()` reads a square (or circular) patch of pixels, sorts by brightness, discards the top/bottom 10 %, and returns the trimmed-mean RGB. The centre cell uses a larger radius and more aggressive trim (25 %) because it defines the face’s reference colour.
2. **Reference extraction** – The centre-block HSV of each face becomes the adaptive reference for that face. If the captured centre block is implausible (e.g. white face with high saturation) the code falls back to hard-coded defaults (`REF_COLORS`).
3. **Classification** – `classifyWithReferencesHsv()` converts sample RGB → HSV and compares against the 6 references using a weighted Euclidean distance in HSV space. White detection uses a continuous “white-likelihood” weight instead of a hard saturation threshold.
4. **Global constraint** – After all 54 cells are classified, `enforceGlobalConstraint()` ensures no colour appears more than 9 times. Excess cells (excluding centre blocks) are sorted by distance from their assigned reference and demoted to `?` until the count is 9.

### Canvas Components
- **cube3d** – Custom isometric 3-D engine built on Canvas 2D. It maintains an array of 26 cubies (position + rotation matrix). Each solution step is parsed into axis / layer / angle, applied with a small `setTimeout`-based animation loop (≈ 16 ms frames, 300 ms per turn), and then quantised back to integer coordinates/orientations.
- **cubePlayer** – Simpler 2-D net renderer. Draws the standard U-L-F-R-B-D cross layout. The face affected by the current step is highlighted with a red border.
- Both components query the canvas node with `wx.createSelectorQuery().in(this)` and handle DPR scaling manually (`ctx.scale(dpr, dpr)`).

### Styling Conventions
- **WXSS** files use `rpx` for all dimensions so layouts adapt to screen width (1 rpx = 1/750 screen width).
- Colour palette is consistent across the app:
  - `U` – `#FFD700` (gold)
  - `R` – `#FF0000` (red)
  - `F` – `#0000FF` (blue)
  - `D` – `#FFFFFF` (white)
  - `L` – `#FFA500` (orange)
  - `B` – `#00FF00` (green)
- Cards use white backgrounds, rounded corners (`20rpx`–`24rpx`), and soft shadows.

## Testing Strategy

There is **no automated test suite** in the repository. All validation is manual via the WeChat Dev Tools simulator and real-device preview:

1. **Solver correctness** – Paste known state strings (e.g. from online cube scramblers) into the *Enter State* page and verify the returned move sequence actually solves the cube.
2. **Colour recognition** – Test the *Scan Cube* flow under different lighting conditions; check that centre-block references adapt sensibly and that global constraints demote outliers to `?`.
3. **Animation stability** – Rapidly tap Play / Pause / Reset in both canvas components to ensure `clearTimeout`/`setTimeout` pairs do not leak or crash.
4. **Cloud function** – Trigger the `solve` cloud function from the Dev Tools cloud function debugger with a 54-char payload.

## Deployment Considerations

- **AppID**: `project.config.json` leaves `appid` empty. You must fill in your own WeChat Mini Program AppID before uploading.
- **Cloud environment**: The cloud function calls `cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })`. Ensure the Dev Tools project is bound to a Cloud Development environment.
- **npm packages**: Always run **Build npm** in Dev Tools after running `npm install` or changing `package.json`, otherwise `cubejs` will not be available in the Mini Program runtime.
- **Camera permission**: `app.json` declares `scope.camera` permission with the description "Need camera access to scan cube faces". The first camera invocation will trigger the WeChat permission dialog.

## Security Notes

- No secrets (API keys, database passwords) are stored in the repository.
- The cloud function `config.json` exposes no OpenAPI permissions.
- User images from `wx.chooseImage` are temporary files; they are never uploaded to a remote server unless the cloud function is invoked.
- Input validation (54-character length, character whitelist, exact-9-per-colour check) is performed **both** in `utils/solver.js` and in the cloud function to guard against malformed states.

## Common Pitfalls for Agents

- Do **not** use `import` / `export` syntax; stick to `require` and `module.exports`.
- Do **not** assume `node_modules` is available at runtime. Only packages explicitly built by WeChat Dev Tools into `miniprogram_npm/` work.
- When modifying colour logic, keep `REF_COLORS` (in `colorClassifier.js`) and `COLORS` (in both canvas components and `scan.js`) in sync.
- The 3-D canvas math is hand-written; there is no external 3-D library. Changes to rotation matrices or projection constants must be verified visually in the simulator.
- Solver initialization is asynchronous and idempotent; pages should check `getApp().globalData.solverReady` before calling `solve()` or call `initSolver()` first.
