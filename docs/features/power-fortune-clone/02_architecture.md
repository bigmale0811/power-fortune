# 02_architecture.md -- Power Fortune (財神報喜) 架構設計

> **FSM Stage**: 🟡 Stage 2 -- 規劃與架構
> **產出日期**: 2026-03-18
> **版本**: v1.0

---

## 1. 技術棧

| 層次 | 技術 | 說明 |
|------|------|------|
| 渲染引擎 | PixiJS v8 | WebGL2, 直向 900x1600 |
| 語言 | TypeScript 5.x | strict mode |
| 建置 | Vite 6.x | HMR + GitHub Pages 部署 |
| 測試 | Vitest | 純邏輯單元測試 |
| 骨骼動畫 | @aspect-dev/pixi-dragonbones | DragonBones 5.5 adapter |
| 音效 | Howler.js 2.x | Web Audio API |
| 部署 | GitHub Pages | bigmale0811/power-fortune |

## 2. 系統架構圖

```
┌──────────────────────────────────────────────────────┐
│                    main.ts (bootstrap)                │
│  GameConfig → AssetPipeline → PixiJS Application     │
│                       ↓                              │
│                ┌─── GameApp ───┐                     │
│                │ SceneManager  │                     │
│                └───────────────┘                     │
│         ┌────────────┼────────────┐                  │
│         ↓            ↓            ↓                  │
│  ┌────────────┐ ┌──────────┐ ┌──────────┐           │
│  │BaseGameScene│ │FreeGame  │ │MiniGame  │           │
│  │ ReelEngine │ │ ReelEngine│ │ DoorPanel│           │
│  │ WaysEval   │ │ PowerUp  │ │ BallReveal│          │
│  └────────────┘ └──────────┘ └──────────┘           │
│         ↓            ↓            ↓                  │
│  ┌──────────┐ ┌────────────┐ ┌──────────┐           │
│  │SoundMgr  │ │AnimationMgr│ │ UIManager│           │
│  │Howler.js │ │DragonBones │ │CtrlPanel │           │
│  │97 sounds │ │MovieClip   │ │JackpotBar│           │
│  └──────────┘ └────────────┘ └──────────┘           │
│                       ↓                              │
│                ┌────────────┐                        │
│                │ MockServer │                        │
│                │ RNG + Demo │                        │
│                └────────────┘                        │
└──────────────────────────────────────────────────────┘
```

### Layer Stack (每場景內部)

```
Layer 6: OVERLAY    (WinBoard, 大獎演出)
Layer 5: EFFECT     (特效粒子, FortuneBall)
Layer 4: UI         (ControlPanel, JP Bar)
Layer 3: FRAME      (轉盤框架)
Layer 2: REEL       (5x4 符號格線)
Layer 1: TREE       (裝飾層)
Layer 0: BACKGROUND (場景背景)
```

---

## 3. 模組架構

### 3.1 核心 (src/core/)
| 模組 | 職責 |
|------|------|
| **GameApp** | PixiJS Application 包裝, 900x1600 canvas, 響應式 letterbox 縮放 |
| **SceneManager** | 場景堆疊管理, 切換動畫, 生命週期 (enter/update/exit) |
| **EventBus** | 發佈/訂閱事件系統 |
| **StateMachine** | LOADING→IDLE→SPINNING→EVALUATING→ANIMATING→FEATURE→IDLE |

### 3.2 轉盤引擎 (src/reel/)
| 模組 | 職責 |
|------|------|
| **ReelEngine** | 5 列轉盤控制器, 依序啟動/停止 |
| **ReelStrip** | 單列轉盤動畫 (加速→勻速→減速→bounce), 4+2 symbol 容器 |
| **SymbolView** | 符號視圖 (靜態 spritesheet 或 DragonBones 動態動畫) |
| **SymbolManager** | 從 Egret MovieClip JSON 解析 15 個符號幀 |

### 3.3 賠付引擎 (src/evaluation/)
| 模組 | 職責 |
|------|------|
| **WaysEvaluator** | 1024 Ways-to-Win: 左到右逐列掃描, Wild 替代 |
| **PayTable** | 賠付表查詢 (x3/x4/x5 倍率) |
| **WinCalculator** | 總獎金計算 + Win Tier 判定 (Normal/Big/Mega/SuperMega) |

### 3.4 場景 (src/scenes/)
| 模組 | 職責 |
|------|------|
| **LoadingScene** | Logo + 進度條, 分階段資源載入 |
| **BaseGameScene** | 主遊戲: ReelEngine + WaysEval + UI, 監聽 Scatter/FortuneBall |
| **FreeGameScene** | 免費遊戲: 免費轉管理 + Power-Up 選擇 + Re-trigger |
| **MiniGameScene** | 小遊戲: 門選擇互動 + 球揭示 + 彩金池收集結算 |

### 3.5 特色功能 (src/features/)
| 模組 | 職責 |
|------|------|
| **FreeGameController** | Scatter 3/4/5 觸發判定, 免費轉管理, re-trigger |
| **PowerUpController** | 5 種 Power-Up (Bamboo/Coins/Fortune/Gourd/Fish) + BianLian 動畫 |
| **MiniGameController** | Fortune Ball 收集, 門選擇邏輯, 球隨機 + 彩金結算 |
| **JackpotManager** | 四級彩金池 (Grand/Major/Minor/Mini), demo 靜態值+緩慢增長 |

### 3.6 UI (src/ui/)
ControlPanel / SpinButton / BetSelector / BalanceDisplay / WinDisplay / JackpotBar / WinTierOverlay / AutoSpinPanel

### 3.7 音效 (src/audio/)
SoundManager (Howler.js 包裝, BGM crossfade, SE 觸發) + SoundConfig (97 事件映射)

### 3.8 動畫 (src/animation/)
| 模組 | 職責 |
|------|------|
| **DragonBonesAdapter** | 載入 _ske.json + _tex.json + _tex.png, 建立 Armature |
| **MovieClipPlayer** | 解析 Egret `{mc, res}` JSON, 按 frameRate 播放序列幀 |
| **ParticlePlayer** | CoinSpring 等粒子效果 |

### 3.9 Mock 伺服器 (src/mock/)
MockServer (本地 RNG) / RNG (seedable) / MockSpinResult (結果工廠) / DemoScenarioRunner (展示劇本)

### 3.10 Asset Pipeline (src/assets/)
AssetPipeline (分階段載入) / EgretResParser (res.json→PixiJS) / TextureAtlasParser (MovieClip→Spritesheet)

---

## 4. 資料流: Spin 生命週期

```
Spin 按鈕 → MockServer.spin(bet)
  → RNG 產生 5x4 grid (含 Wild/Scatter/FortuneBall 機率)
  → ReelEngine.spinTo(grid)
    → 5 列依序啟動 (100ms 間隔) + blur
    → 5 列依序停止 (200ms 間隔) + bounce
  → WaysEvaluator.evaluate(grid)
    → 逐列掃描, Wild 替代, 計算 ways
  → WinCalculator.calculate(wins, bet)
    → 總獎金 + Win Tier 判定
  → 動畫演出 (中獎高亮 / BigWin overlay)
  → 檢查特殊功能:
    → Scatter ≥ 3 → push FreeGameScene
    → FortuneBall 達標 → push MiniGameScene
  → 回到 IDLE
```

---

## 5. 關鍵技術決策 (ADR)

### ADR-001: DragonBones → @aspect-dev/pixi-dragonbones
- 36 組骨骼動畫不可能全轉 spritesheet
- 先用 Base_SymbolWW 做 PoC 驗證
- Fallback: spritesheet 序列幀

### ADR-002: Egret MovieClip → PixiJS Spritesheet
- build time 轉譯 `{mc, res}` → PixiJS Spritesheet 格式
- 只需轉 Symbol.json、Base_LineRect.json 等少數檔案

### ADR-003: 響應式 — Portrait-First Letterbox
```typescript
const scale = Math.min(innerWidth / 900, innerHeight / 1600);
stage.scale.set(scale);
stage.position.set((innerWidth - 900 * scale) / 2, (innerHeight - 1600 * scale) / 2);
```

### ADR-004: 1024 Ways-to-Win 演算法
- 左到右逐列, count(symbol|wild) 相乘
- O(13×5×4)=O(260), 極快

### ADR-005: 分階段資源載入
1. preload (Logo/LoadingBar) → 2. game1 (BaseGame 60%) → 3. control-panel (75%) → 4. game2 (FreeGame 90%) → 5. game3 (MiniGame 100%)

### ADR-006: 有限狀態機
LOADING→IDLE→SPINNING→EVALUATING→ANIMATING→{FREE_GAME|MINI_GAME}→IDLE

### ADR-007: 音效分兩階段
Phase 1: 佔位音效 + 完整事件映射; Phase 2: 提取原版 CDN 音效

---

## 6. 核心 TypeScript 介面

```typescript
// 格線
type Grid = ReadonlyArray<ReadonlyArray<string>>; // grid[5][4]

// 符號
interface SymbolDef {
  readonly id: string;           // 'h1','ww','c1','jp'
  readonly type: 'high'|'low'|'wild'|'scatter'|'jp';
  readonly frameIndex: number;   // 0-14 in spritesheet
  readonly payouts: { x3?: number; x4?: number; x5?: number };
  readonly hasAnimation: boolean;
}

// Ways 中獎
interface WaysWin {
  readonly symbolId: string;
  readonly symbolCount: number;  // 3/4/5
  readonly ways: number;
  readonly payout: number;
  readonly positions: ReadonlyArray<{col: number; row: number}>;
}

// Spin 結果
interface SpinResult {
  readonly grid: Grid;
  readonly winResult: { wins: WaysWin[]; totalPayout: number; winTier: string };
  readonly freeGameTrigger?: { scatterCount: number; freeSpins: number };
  readonly miniGameTrigger?: { fortuneBallCount: number };
}

// 場景介面
interface IScene {
  readonly type: string;
  enter(data?: Record<string, unknown>): Promise<void>;
  update(dt: number): void;
  exit(): Promise<void>;
}

// 彩金球
type BallType = 'grand'|'major'|'minor'|'mini'|'wild'|'coin';

// Power-Up
type PowerUpType = 'bamboo'|'coins'|'fortune'|'gourd'|'fish';
```

---

## 7. 與 Storm of Seth 差異

| 面向 | Storm of Seth | Power Fortune |
|------|--------------|---------------|
| 畫布 | 1280x720 橫向 | 900x1600 直向 |
| 賠付 | Cluster (≥8) | 1024 Ways |
| 格線 | 6x5 cascade | 5x4 standard reel |
| 場景 | 1 (BaseGame) | 3 (Base+Free+Mini) |
| 動畫 | 靜態 PNG | DragonBones 36 組 |
| 複雜度 | 中 | **高** |

**結論**: 完全獨立建構，不從 Storm of Seth 繼承。

---

> 🚦 等待 CEO 確認架構後進入開發計畫
