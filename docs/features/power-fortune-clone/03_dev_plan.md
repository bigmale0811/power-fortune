# 03_dev_plan.md — Power Fortune（財神報喜）開發計畫

> **FSM Stage**: 🟡 Stage 2 — 規劃與架構
> **產出日期**: 2026-03-18
> **版本**: v1.0
> **前置文件**: `01_spec.md` + `02_architecture.md`

---

## 1. 開發階段總覽

共分 **7 個開發階段 (DEV Phase)**，每個階段獨立可測試、可部署。
預計總工期：**5-7 天**（密集開發）。

```
DEV-1: 專案腳手架 + 建置流程        → AC-8（部署）
DEV-2: 核心引擎 + 轉盤系統          → AC-2（轉盤）
DEV-3: 賠付引擎 + 贏分演出          → AC-3（賠付）
DEV-4: UI 控制面板 + 響應式          → AC-1, AC-7（視覺+響應式）
DEV-5: Free Game 場景               → AC-4（免費遊戲）
DEV-6: Mini Game 場景 + 彩金        → AC-5（小遊戲）
DEV-7: 音效系統 + 動畫整合 + 收尾    → AC-6（音效）
```

---

## 2. DEV-1: 專案腳手架 + 建置流程（Day 1 上午）

**對應 AC**: AC-8（部署）

### 任務清單
| # | 任務 | 測試 |
|---|------|------|
| 1.1 | Vite + TypeScript + PixiJS v8 專案初始化 | `vite build` 成功 |
| 1.2 | `tsconfig.json` strict mode 設定 | `tsc --noEmit` 通過 |
| 1.3 | Vitest 設定 + 第一個 smoke test | `vitest run` 通過 |
| 1.4 | GitHub repo 建立 + Pages 部署設定 | Pages URL 可訪問 |
| 1.5 | `GameApp` 類別：PixiJS Application 900×1600 canvas | 瀏覽器看到黑色畫布 |
| 1.6 | 響應式 letterbox 縮放（ADR-003） | 調整視窗大小正常縮放 |
| 1.7 | 資源目錄結構 `public/assets/` | 資源可被 Vite 正確載入 |

### 產出
- `package.json` + `vite.config.ts` + `tsconfig.json`
- `src/main.ts` → GameApp bootstrap
- `src/core/GameApp.ts` — PixiJS 包裝
- `vitest.config.ts`
- `.github/workflows/deploy.yml`（GitHub Pages CI）

---

## 3. DEV-2: 核心引擎 + 轉盤系統（Day 1 下午 ~ Day 2）

**對應 AC**: AC-2（基礎轉盤）

### 任務清單
| # | 任務 | 測試 |
|---|------|------|
| 2.1 | `EventBus` 發佈/訂閱系統 | 單元測試：emit/on/off |
| 2.2 | `StateMachine` 狀態機 (IDLE→SPINNING→EVALUATING→ANIMATING→IDLE) | 單元測試：狀態轉換 |
| 2.3 | `SceneManager` 場景堆疊管理 + enter/update/exit | 單元測試：push/pop |
| 2.4 | `SymbolManager` 解析 Egret MovieClip JSON → 符號幀 | 單元測試：解析 Symbol.json |
| 2.5 | `SymbolView` 符號視圖（靜態 spritesheet 渲染） | 視覺測試：15 符號正確顯示 |
| 2.6 | `ReelStrip` 單列轉盤動畫（加速→勻速→減速→bounce） | 視覺測試：單列滾動 |
| 2.7 | `ReelEngine` 5 列控制器（依序啟動/停止，100ms/200ms 間隔） | 視覺測試：5 列完整滾動 |
| 2.8 | 旋轉模糊效果 (blur filter) | 視覺測試：模糊可見 |
| 2.9 | `MockServer` 基礎架構 + `RNG` + `MockSpinResult` | 單元測試：產生合法 5×4 grid |
| 2.10 | `LoadingScene` 基礎載入畫面 + 進度條 | 視覺測試：進度條動畫 |

### 產出
- `src/core/EventBus.ts`
- `src/core/StateMachine.ts`
- `src/core/SceneManager.ts`
- `src/reel/ReelEngine.ts`
- `src/reel/ReelStrip.ts`
- `src/reel/SymbolView.ts`
- `src/reel/SymbolManager.ts`
- `src/mock/MockServer.ts`
- `src/mock/RNG.ts`
- `src/scenes/LoadingScene.ts`
- `tests/core/` + `tests/reel/` + `tests/mock/`

---

## 4. DEV-3: 賠付引擎 + 贏分演出（Day 2 ~ Day 3 上午）

**對應 AC**: AC-3（賠付系統）

### 任務清單
| # | 任務 | 測試 |
|---|------|------|
| 3.1 | `PayTable` 賠付表（13 符號 × x3/x4/x5 倍率） | 單元測試：查表正確 |
| 3.2 | `WaysEvaluator` 1024 Ways 演算法（ADR-004） | 單元測試：多種 grid 組合 |
| 3.3 | Wild 替代邏輯（SymbolWW 可替代所有非 Scatter/JP） | 單元測試：Wild 替代 |
| 3.4 | `WinCalculator` 總獎金 + Win Tier 判定 | 單元測試：Normal/Big/Mega/SuperMega |
| 3.5 | 中獎符號高亮動畫 | 視覺測試：中獎位置閃爍 |
| 3.6 | 贏分數字跳動動畫 (countUp) | 視覺測試：數字從 0 增加 |
| 3.7 | `WinTierOverlay` 大獎演出（Big Win / Mega Win / Super Mega Win） | 視覺測試：overlay 動畫 |
| 3.8 | `BaseGameScene` 整合：Spin → MockServer → Reel → Evaluate → Animate | 整合測試：完整一輪流程 |

### 產出
- `src/evaluation/PayTable.ts`
- `src/evaluation/WaysEvaluator.ts`
- `src/evaluation/WinCalculator.ts`
- `src/scenes/BaseGameScene.ts`
- `src/ui/WinDisplay.ts`
- `src/ui/WinTierOverlay.ts`
- `tests/evaluation/`

---

## 5. DEV-4: UI 控制面板 + 響應式（Day 3）

**對應 AC**: AC-1（視覺還原）、AC-7（響應式）

### 任務清單
| # | 任務 | 測試 |
|---|------|------|
| 4.1 | `ControlPanel` 底部面板佈局 | 視覺測試：對照原版截圖 |
| 4.2 | `SpinButton` 按鈕（idle/spinning/disabled 三態） | 視覺測試：三態切換 |
| 4.3 | `BetSelector` 押注選擇器 | 單元測試：押注值切換 |
| 4.4 | `BalanceDisplay` 餘額顯示 | 單元測試：數字格式 |
| 4.5 | `JackpotBar` 四級彩金跑馬燈（Grand/Major/Minor/Mini） | 視覺測試：數字緩慢增長 |
| 4.6 | `AutoSpinPanel` 自動旋轉面板 | 單元測試：次數選擇 |
| 4.7 | 背景圖載入（Base_BG.jpg） | 視覺測試：背景正確顯示 |
| 4.8 | 轉盤框架（Base_Frame） | 視覺測試：框架對齊格線 |
| 4.9 | 多解析度測試（手機直向/橫向/桌面） | 手動測試：三種裝置 |

### 產出
- `src/ui/ControlPanel.ts`
- `src/ui/SpinButton.ts`
- `src/ui/BetSelector.ts`
- `src/ui/BalanceDisplay.ts`
- `src/ui/JackpotBar.ts`
- `src/ui/AutoSpinPanel.ts`

---

## 6. DEV-5: Free Game 場景（Day 4）

**對應 AC**: AC-4（免費遊戲）

### 任務清單
| # | 任務 | 測試 |
|---|------|------|
| 5.1 | Scatter 觸發判定（≥3 觸發） | 單元測試：3/4/5 Scatter |
| 5.2 | Scatter 收集飛行動畫 | 視覺測試：飛入效果 |
| 5.3 | `FreeGameScene` 場景框架 + Free_BG 背景 | 視覺測試：場景切換 |
| 5.4 | 場景轉換動畫（BaseGame → FreeGame） | 視覺測試：過渡效果 |
| 5.5 | `FreeGameController` 免費轉管理（次數倒數） | 單元測試：次數遞減 |
| 5.6 | `PowerUpController` 五種增強（Bamboo/Coins/Fortune/Gourd/Fish） | 單元測試：效果計算 |
| 5.7 | Power-Up 選擇 UI + BianLian 變臉動畫 | 視覺測試：選擇互動 |
| 5.8 | Re-trigger（免費遊戲中再觸發） | 單元測試：追加次數 |
| 5.9 | 免費遊戲結算畫面 | 視覺測試：總贏分顯示 |
| 5.10 | FreeGame 專屬 ReelEngine 設定（7 符號） | 單元測試：符號池切換 |

### 產出
- `src/scenes/FreeGameScene.ts`
- `src/features/FreeGameController.ts`
- `src/features/PowerUpController.ts`
- `tests/features/`

---

## 7. DEV-6: Mini Game 場景 + 彩金（Day 5）

**對應 AC**: AC-5（小遊戲）

### 任務清單
| # | 任務 | 測試 |
|---|------|------|
| 6.1 | Fortune Ball 收集機制 + 觸發判定 | 單元測試：收集計數 |
| 6.2 | `FortuneBall_ToMini` 飛入動畫 | 視覺測試：球飛入效果 |
| 6.3 | `MiniGameScene` 場景框架 + Mini_BG 背景 | 視覺測試：場景載入 |
| 6.4 | `DoorPanel` 門選擇互動 UI | 視覺測試：門可點擊 |
| 6.5 | `BallReveal` 球揭示動畫（6 種球型） | 視覺測試：揭示效果 |
| 6.6 | `JackpotManager` 四級彩金池計算 | 單元測試：金額計算 |
| 6.7 | `MiniGameController` 結算邏輯 | 單元測試：收集→結算 |
| 6.8 | Mini Game 結算畫面 + 返回 BaseGame | 視覺測試：結算後切回 |

### 產出
- `src/scenes/MiniGameScene.ts`
- `src/features/MiniGameController.ts`
- `src/features/JackpotManager.ts`
- `tests/features/`

---

## 8. DEV-7: 音效 + 動畫整合 + 收尾（Day 6 ~ Day 7）

**對應 AC**: AC-6（音效）、AC-1（視覺還原）

### 任務清單
| # | 任務 | 測試 |
|---|------|------|
| 7.1 | `SoundManager` Howler.js 包裝 + BGM crossfade | 手動測試：BGM 切換 |
| 7.2 | `SoundConfig` 97 事件映射 | 單元測試：事件→音檔映射 |
| 7.3 | Phase 1 佔位音效（ADR-007） | 手動測試：有聲音播出 |
| 7.4 | `DragonBonesAdapter` 骨骼動畫載入（ADR-001） | 視覺測試：Wild 動畫 |
| 7.5 | `MovieClipPlayer` Egret MC → PixiJS 序列幀（ADR-002） | 視覺測試：符號動畫 |
| 7.6 | `AssetPipeline` 分階段載入（ADR-005） | 效能測試：載入 < 5s |
| 7.7 | `DemoScenarioRunner` 展示劇本 | 手動測試：自動跑完整流程 |
| 7.8 | 靜音/音量控制 UI | 手動測試：toggle 靜音 |
| 7.9 | 全場景端到端測試 | 手動測試：完整遊戲流程 |
| 7.10 | Production build + GitHub Pages 部署 | `vite build` + 線上訪問 |

### 產出
- `src/audio/SoundManager.ts`
- `src/audio/SoundConfig.ts`
- `src/animation/DragonBonesAdapter.ts`
- `src/animation/MovieClipPlayer.ts`
- `src/assets/AssetPipeline.ts`
- `src/mock/DemoScenarioRunner.ts`

---

## 9. 風險緩解對照

| 風險（from 01_spec.md） | DEV 階段 | 緩解策略 |
|--------------------------|---------|----------|
| DragonBones 兼容性 | DEV-7 (7.4) | 先做 PoC；失敗用 MovieClipPlayer fallback |
| Egret JSON 格式 | DEV-2 (2.4) | 自行撰寫 parser，已分析 `{mc, res}` 結構 |
| main.min.js 混淆 | DEV-3 (3.1) | 賠付表從遊戲觀察 + JS 分析交叉驗證 |
| 直向↔橫向適配 | DEV-4 (4.9) | Portrait-first letterbox（ADR-003） |

---

## 10. 依賴關係圖

```
DEV-1 ─→ DEV-2 ─→ DEV-3 ─→ DEV-4 (可部分平行)
                      │
                      ├──→ DEV-5
                      │
                      └──→ DEV-6
                               │
                               └──→ DEV-7 (整合收尾)
```

- DEV-5 和 DEV-6 可在 DEV-3 完成後**平行開發**
- DEV-7 必須等所有場景完成後才整合

---

## 11. 驗收標準 → DEV 階段 追溯矩陣

| AC | DEV-1 | DEV-2 | DEV-3 | DEV-4 | DEV-5 | DEV-6 | DEV-7 |
|----|-------|-------|-------|-------|-------|-------|-------|
| AC-1 視覺還原 | | | | ✅ | | | ✅ |
| AC-2 轉盤 | | ✅ | | | | | |
| AC-3 賠付 | | | ✅ | | | | |
| AC-4 Free Game | | | | | ✅ | | |
| AC-5 Mini Game | | | | | | ✅ | |
| AC-6 音效 | | | | | | | ✅ |
| AC-7 響應式 | ✅ | | | ✅ | | | |
| AC-8 部署 | ✅ | | | | | | ✅ |

每個 AC 至少被 1 個 DEV 階段覆蓋 ✅

---

## 12. TDD 策略

- **純邏輯模組**（EventBus、StateMachine、WaysEvaluator、PayTable、WinCalculator、RNG）：
  - 嚴格 RED→GREEN→REFACTOR
  - 目標覆蓋率 **90%+**

- **視覺模組**（ReelStrip、SymbolView、Scene 類別）：
  - 單元測試覆蓋狀態邏輯
  - 視覺驗證靠 Playwright 截圖比對
  - 目標覆蓋率 **70%+**

- **整體覆蓋率目標**：**80%+**

---

> 🚦 **等待 CEO 確認開發計畫後，進入 Stage 3&4（TDD 開發）**
> 建議從 **DEV-1（專案腳手架）** 開始，當天即可部署空白畫布到 GitHub Pages。
