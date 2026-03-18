# 01_spec.md — Power Fortune（財神報喜）全面複製 需求規格書

> **FSM Stage 1** | 狀態：🟢 草稿
> 建立日期：2026-03-18

## 1. 專案概述

將 JI Gaming 平台上的 Power Fortune（財神報喜）老虎機遊戲，以 **PixiJS v8 + TypeScript** 全面複製，達到視覺與行為 100% 還原。

### 原版資訊
| 項目 | 值 |
|------|------|
| 遊戲名稱 | Power Fortune / 財神報喜 |
| Game ID | 1002 |
| 原版引擎 | Egret Engine（白鷺引擎）|
| 骨骼動畫 | DragonBones |
| 通訊協議 | SmartFoxServer (WebSocket) |
| 音效系統 | Howler.js |
| 架構模式 | PureMVC |
| 畫布尺寸 | 900×1600（直向 Portrait）|
| 原版 CDN | `game-staticdev.jigaming.com.tw/games/1/1002/b099fc6e-mock/` |
| 資源總量 | 382 個（288 圖片、83 JSON、10 字型、1 spritesheet）|
| 多語言 | zh、en、pt、ko、es |

### 我們的技術選型
| 項目 | 選擇 |
|------|------|
| 引擎 | **PixiJS v8** |
| 語言 | **TypeScript** |
| 建構 | **Vite** |
| 骨骼動畫 | DragonBones → **PixiJS DragonBones adapter** 或轉換為 Spine |
| 音效 | **Howler.js**（與原版相同）|
| 部署 | **GitHub Pages**（repo: bigmale0811/power-fortune）|
| 專案路徑 | `output/power-fortune/game/` |

---

## 2. 遊戲機制（已從 main.min.js 分析確認）

### 2.1 基礎遊戲（BaseGame）
- **轉盤配置**：**5 列 x 4 行**（screenColumn=5, screenRow=4）
- **賠付方式**：**1024 Ways-to-Win**（非固定賠付線）
- **符號數量**：BaseGame 13 種 / FreeGame 7 種
- **符號類別**：
  - 高賠符號（從 Symbol spritesheet 提取）
  - 低賠符號（撲克牌符號）
  - Wild 符號（SymbolWW — 有 DragonBones 動畫）
  - Scatter/特殊符號（SymbolC1 — 有 DragonBones 動畫）
  - Fortune Ball（財神球）— 觸發 Mini Game

### 2.2 免費遊戲（FreeGame）
- **觸發條件**：Scatter x3（freeGame_03）/ x4（freeGame_02）/ x5（freeGame_01）
- **免費轉次數**：依 Scatter 數量遞增
- **Power-Up 系統**：Bamboo / Coins / Fortune / Gourd / Fish 五種增強道具
- **重觸發**：BonusRetrigger 機制
- **獨立背景**：`Free_BG.jpg`
- **專屬 UI**：`Free_SpinInfoBG`、`Free_SpinNum`

### 2.3 小遊戲（MiniGame）
- **觸發條件**：收集足夠 Fortune Ball
- **機制**：門選擇（Door Selection）— `Mini_DoorBG`、`Mini_DoorMask_H`
- **獎項等級**：
  - 🟡 Grand — 最高獎金池
  - 🔵 Major — 第二獎金池
  - 🟢 Minor — 第三獎金池
  - ⚪ Mini — 最低獎金池
  - 🃏 Wild — 萬用球
  - 🪙 Coin — 金幣獎勵
- **動畫**：`FortuneBall_ToMini`（飛入動畫）、各種收集與揭示特效

### 2.4 彩金系統（Jackpot）
- 四級彩金池：Grand / Major / Minor / Mini
- 與小遊戲門選擇機制連動
- 彩金文字多語言支援

---

## 3. 驗收標準（Acceptance Criteria）

### AC-1：視覺還原
- [ ] 背景圖與原版一致（Base_BG、Free_BG、Mini_BG）
- [ ] 所有符號圖示與原版一致（從 Symbol spritesheet 提取）
- [ ] 控制面板 UI 與原版佈局一致
- [ ] DragonBones 動畫正確播放（Wild、Scatter 中獎動畫）
- [ ] 載入畫面與原版一致

### AC-2：基礎轉盤
- [ ] 轉盤旋轉動畫流暢（60fps）
- [ ] 停輪順序與原版一致
- [ ] 符號掉落/停止有 bounce 效果
- [ ] Blur 模糊效果（旋轉中）

### AC-3：賠付系統
- [ ] Payline/Ways 計算正確
- [ ] 贏分動畫（數字跳動、金幣噴灑）
- [ ] Win 等級分類（Normal Win / Big Win / Mega Win / Super Mega Win）
- [ ] 賠付表資訊正確

### AC-4：Free Game
- [ ] 正確觸發條件
- [ ] 場景轉換動畫
- [ ] 免費轉次數顯示正確
- [ ] Re-trigger 機制正確

### AC-5：Mini Game
- [ ] Fortune Ball 收集觸發正確
- [ ] 門選擇互動正常
- [ ] 球揭示動畫正確
- [ ] 彩金池數字顯示正確
- [ ] 小遊戲結算正確

### AC-6：音效系統
- [ ] 所有音效事件正確觸發
- [ ] BGM 正確切換（BaseGame / FreeGame / MiniGame）
- [ ] 靜音/音量控制正常

### AC-7：響應式與效能
- [ ] 直向手機端正常顯示（900×1600 基準）
- [ ] 橫向自動適配
- [ ] 桌面端正常顯示
- [ ] 載入時間 < 5 秒（4G 網路）
- [ ] 穩定 60fps

### AC-8：部署
- [ ] GitHub Pages 可正常訪問
- [ ] 無 CORS 錯誤
- [ ] 所有素材正確載入

---

## 4. 邊界條件

- 不需要後端伺服器通訊（SmartFoxServer）— 使用本地模擬數據
- 不需要真實金額計算 — demo 模式即可
- 不需要登入系統
- 不需要多語言切換（先做英文版，後續可擴展）

## 5. 不做的事（Out of Scope）

- ❌ 真實伺服器端遊戲邏輯（RNG、賠率計算）
- ❌ 金流系統
- ❌ 帳號系統
- ❌ 即時彩金池（使用靜態數字）
- ❌ 遊戲歷史記錄

## 6. 風險評估

| 風險 | 等級 | 緩解方案 |
|------|------|---------|
| DragonBones → PixiJS 兼容性 | 🟡 中 | 嘗試 pixi-dragonbones adapter，失敗則用 spritesheet fallback |
| Egret 主題 JSON 無法直接使用 | 🟡 中 | 手動解析佈局，重建 UI 元件 |
| 原版 main.min.js 混淆難以分析 | 🟡 中 | 結合資源分析 + 實際遊玩觀察推斷邏輯 |
| 直向排版 ↔ 橫向適配 | 🟢 低 | PixiJS 有成熟的 responsive 解決方案 |

---

> ✅ 遊戲機制分析完成（2026-03-18）
> 素材下載：381/382 完成（1 個葡萄牙語檔案 404，不影響）
> 🚦 等待 CEO 確認規格後進入 Stage 2
