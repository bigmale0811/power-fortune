# 04_test_plan.md — Power Fortune Clone Test Plan

> **FSM Stage**: Stage 5 — QA Review
> **Date**: 2026-03-18
> **QA Reviewer**: Independent QA (black-box, spec-only)
> **Source Spec**: `01_spec.md`

---

## 1. Scope

This test plan covers all 8 Acceptance Criteria (AC) from `01_spec.md` for the Power Fortune (財神報喜) slot game clone. Tests are designed from the user and specification perspective only, without reference to implementation details.

---

## 2. Test Categories

| Category | Code | Description |
|----------|------|-------------|
| Unit Test | UT | Logic tested in isolation via Vitest |
| Integration Test | IT | Multiple modules wired together |
| E2E Browser | E2E | Playwright / browser rendering verification |
| Visual Manual | VM | Human inspection of screenshots or live page |
| Not Covered | NC | No automated test; manual required |

---

## 3. Acceptance Criteria and Test Cases

### AC-1: Visual Fidelity (視覺還原)

| TC# | Test Case | Category | Expected Result |
|-----|-----------|----------|-----------------|
| TC-1.1 | Background images load: Base_BG, Free_BG, Mini_BG | E2E/VM | Backgrounds visible, match original |
| TC-1.2 | All 15 symbol icons render from spritesheet | E2E/VM | 15 distinct symbols displayed correctly |
| TC-1.3 | Control panel UI layout matches original | VM | Buttons/labels positioned per spec |
| TC-1.4 | DragonBones animations play: Wild (SymbolWW) and Scatter (SymbolC1) | E2E/VM | Animation frames cycle on win |
| TC-1.5 | Loading screen matches original | E2E | Loading screen shown before game initializes |
| TC-1.6 | Game canvas is 900x1600 base resolution | E2E | Canvas renders at 900×1600 in portrait |

### AC-2: Reel Spin (基礎轉盤)

| TC# | Test Case | Category | Expected Result |
|-----|-----------|----------|-----------------|
| TC-2.1 | Reel spins at 60fps without drops | E2E/VM | Animation smooth, no jank |
| TC-2.2 | Reels stop in sequence (left to right), with ~100-200ms intervals | E2E/VM | Visual sequential stop order |
| TC-2.3 | Symbols show bounce effect on stop | E2E/VM | Bounce visible after each reel stops |
| TC-2.4 | Blur effect visible during spin | E2E/VM | Motion blur on spinning reels |
| TC-2.5 | Grid is 5 columns × 4 rows | UT | `gridResult.cols === 5`, `gridResult.rows === 4` |
| TC-2.6 | MockServer generates valid symbol IDs (0–14) | UT | All symbols in [0, 14] range |

### AC-3: Payout System (賠付系統)

| TC# | Test Case | Category | Expected Result |
|-----|-----------|----------|-----------------|
| TC-3.1 | 1024 Ways evaluator returns correct way count for 5×4 full match | UT | `ways === 1024` (4^5) |
| TC-3.2 | 3-reel match returns 64 ways (4×4×4) | UT | `ways === 64` |
| TC-3.3 | Wild symbol substitutes for all regular symbols | UT | Win detected when Wild fills a column |
| TC-3.4 | Scatter symbol (ID=14) does not participate in Ways calculation | UT | No win returned for all-Scatter grid |
| TC-3.5 | PayTable has 15 symbol definitions | UT | `PAY_TABLE.length === 15` |
| TC-3.6 | Payout formula: pay × ways × bet | UT | `payout === 50 × 64 × 10 === 32000` |
| TC-3.7 | Win tier classification: NONE / NORMAL / BIG_WIN / MEGA_WIN / SUPER_MEGA_WIN | UT | Correct tier returned per multiplier threshold |
| TC-3.8 | Win animation: score counter animates from 0 to win amount | VM | Countup visible on winning spin |
| TC-3.9 | Win tier overlay (Big Win / Mega Win / Super Mega Win) shown | VM/E2E | Overlay appears for large wins |
| TC-3.10 | Paytable screen shows correct symbol payouts | VM | Paytable display matches spec values |

### AC-4: Free Game (免費遊戲)

| TC# | Test Case | Category | Expected Result |
|-----|-----------|----------|-----------------|
| TC-4.1 | 3 Scatters trigger 8 free spins | UT | `totalSpins === 8` after `trigger(3)` |
| TC-4.2 | 4 Scatters trigger 12 free spins | UT | `totalSpins === 12` after `trigger(4)` |
| TC-4.3 | 5 Scatters trigger 20 free spins | UT | `totalSpins === 20` after `trigger(5)` |
| TC-4.4 | <3 Scatters do not trigger Free Game | UT | `isActive === false` after `trigger(2)` |
| TC-4.5 | Scene transition animation plays (BaseGame → FreeGame) | VM | Transition visible |
| TC-4.6 | Free spin counter counts down correctly | UT | `remainingSpins` decreases each spin |
| TC-4.7 | Re-trigger: 3+ Scatters during Free Game add more spins | UT | `remainingSpins` increases on `retrigger(3)` |
| TC-4.8 | Free Game uses reduced symbol pool (7 symbols, no low-pays 7–12) | IT | All symbols in [0–6, 13, 14] |
| TC-4.9 | Power-Up system: all 5 types selectable (Bamboo/Coins/Fortune/Gourd/Fish) | UT | Each type sets `currentPowerUp` |
| TC-4.10 | FreeGame background (Free_BG) loads correctly | VM | Different background visible |

### AC-5: Mini Game (小遊戲)

| TC# | Test Case | Category | Expected Result |
|-----|-----------|----------|-----------------|
| TC-5.1 | Fortune Ball collection triggers Mini Game when 6 balls collected | UT | `canTrigger === true` at 6 balls |
| TC-5.2 | <6 balls do not trigger Mini Game | UT | `canTrigger === false` at 5 balls |
| TC-5.3 | Door selection (0–2) returns a valid BallType | UT | Result in [Grand, Major, Minor, Mini, Wild, Coin] |
| TC-5.4 | Door selection out of range (< 0 or > 2) throws error | UT | `chooseDoor(3)` throws |
| TC-5.5 | Revealed balls are recorded | UT | `revealedBalls.length === 1` after one pick |
| TC-5.6 | Settling: 3 matching balls produce a settlement result | UT | `settlementResult.prizeTier` defined |
| TC-5.7 | Ball reveal animation plays (6 ball types) | VM | Visual reveal effect per ball type |
| TC-5.8 | Jackpot pool numbers display correctly (Grand/Major/Minor/Mini) | VM | Four tier amounts visible |
| TC-5.9 | Mini Game reset clears all state | UT | All fields zeroed after `reset()` |
| TC-5.10 | Fortune Ball fly-in animation (FortuneBall_ToMini) | VM | Balls animate into mini game |

### AC-6: Audio System (音效系統)

| TC# | Test Case | Category | Expected Result |
|-----|-----------|----------|-----------------|
| TC-6.1 | Spin sound plays on reel start | VM | Audible on click |
| TC-6.2 | Win sound plays on any winning outcome | VM | Audible when win detected |
| TC-6.3 | BGM switches: BaseGame BGM → FreeGame BGM → MiniGame BGM | VM | Different music per scene |
| TC-6.4 | Mute toggle silences all audio | VM | No audio when muted |
| TC-6.5 | Volume control changes audio level | VM | Louder/quieter on control change |
| TC-6.6 | Howler.js is the audio library in use | NC | Verify dependency in package.json |

### AC-7: Responsive Layout and Performance (響應式與效能)

| TC# | Test Case | Category | Expected Result |
|-----|-----------|----------|-----------------|
| TC-7.1 | Portrait mobile (900×1600 base) renders correctly | E2E | Canvas fits without clipping |
| TC-7.2 | Landscape viewport auto-adapts (letterbox with black bars) | UT/E2E | Width constrained, height fills |
| TC-7.3 | Widescreen desktop (1920×1080) shows letterboxed portrait | UT | `calculateFit(1920,1080)` → height=1080, width=608 |
| TC-7.4 | Narrow viewport (360×640) scales down proportionally | UT | `calculateFit(360,640)` → scale ≈ 0.4 |
| TC-7.5 | Extreme wide viewport (2560×600) height-fills | UT | `calculateFit(2560,600)` → height=600 |
| TC-7.6 | Extreme tall/narrow viewport (200×2000) width-fills | UT | `calculateFit(200,2000)` → width=200 |
| TC-7.7 | Fit result is an immutable object | UT | `Object.isFrozen(result) === true` |
| TC-7.8 | Game loads in under 5 seconds on 4G-equivalent | VM | Load time measured <5s |
| TC-7.9 | Game renders at stable 60fps | VM | No dropped frames in normal play |

### AC-8: Deployment (部署)

| TC# | Test Case | Category | Expected Result |
|-----|-----------|----------|-----------------|
| TC-8.1 | GitHub Pages URL is accessible | NC | HTTP 200 from Pages URL |
| TC-8.2 | No CORS errors on asset requests | E2E | No CORS errors in browser console |
| TC-8.3 | All assets load correctly (images, JSON, fonts) | E2E | No 404 or load-failed errors in console |
| TC-8.4 | Game initializes successfully (canvas rendered, no JS errors) | E2E | `[PowerFortune] Game ready!` in console |
| TC-8.5 | `vite build` completes without errors | NC | Build command exits 0 |

---

## 4. Boundary Conditions from Spec

| BC# | Condition | Test Approach |
|-----|-----------|---------------|
| BC-1 | No backend required — mock data only | UT: MockServer returns data without network |
| BC-2 | Demo mode only — no real money | UT: Balance is virtual |
| BC-3 | No login required | E2E: Game loads without authentication |
| BC-4 | Scatter ID=14 does not pay via Ways | UT: TC-3.4 |
| BC-5 | Wild ID=13 substitutes for any non-Scatter symbol | UT: TC-3.3 |
| BC-6 | Balance insufficient — spin blocked | UT: `spin()` returns null, balance unchanged |
| BC-7 | RNG is seeded for reproducibility in tests | UT: Same seed → same sequence |
| BC-8 | Fortune Ball threshold is exactly 6 for trigger | UT: TC-5.1 + TC-5.2 |
| BC-9 | Symbol ID range is 0–14 (15 symbols total) | UT: TC-2.6 |
| BC-10 | PayTable minimum match length is 3 | UT: `getPayForSymbol(0, 2) === 0` |

---

## 5. Test Execution Strategy

1. **Automated unit + integration tests**: `npx vitest run --reporter=verbose`
2. **E2E browser test**: `node e2e-debug.mjs` (requires live `vite preview` server)
3. **Visual/manual tests**: Browser inspection at `http://localhost:4190/power-fortune/`
4. **Audio tests**: Manual playback verification

---

## 6. Coverage Target

| Module | Coverage Target |
|--------|----------------|
| Pure logic (EventBus, StateMachine, WaysEvaluator, PayTable, RNG) | 90%+ |
| Feature controllers (FreeGameController, MiniGameController, GameController) | 85%+ |
| Visual/UI modules | 70%+ (logic only, visual via E2E) |
| Overall | 80%+ |
