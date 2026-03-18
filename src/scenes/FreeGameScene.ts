/**
 * FreeGameScene — 免費遊戲場景
 *
 * 版面配置（900×1600 直向）：
 *   Y=0   ~ 80  : 旋轉計數器「FREE SPINS: X/Y」
 *   Y=80  ~ 200 : PowerUp 類型指示區
 *   Y=200 ~ 900 : 轉盤區（5×4 格，使用 FREE_SYMBOLS 符號池）
 *   Y=900 ~ 1000: WinDisplay 贏分顯示
 *   Y=1000~ 1200: 自動旋轉狀態 / 累計贏分顯示
 *   Y=1200~ 1600: 底部預留區
 *
 * 流程：
 *   1. start(scatterCount) 被呼叫後，先顯示 PowerUp 選擇 UI
 *   2. 玩家選擇 PowerUp 後，以 1.5s 間隔自動執行所有免費旋轉
 *   3. 旋轉期間如果 retrigger，自動累加次數
 *   4. 全部完成後顯示總贏分摘要，並 emit 'complete' 事件
 */

import {
  Application,
  Container,
  Graphics,
  Text,
  TextStyle,
  Sprite,
  Ticker,
} from 'pixi.js';
import { AssetStore } from '@/assets/AssetStore';
import { symbolManager } from '@/reel/SymbolManager';
import { ReelEngine, EVENT_ALL_STOPPED } from '@/reel/ReelEngine';
import { FreeGameController, PowerUpType } from '@/features/FreeGameController';
import { WinDisplay } from '@/ui/WinDisplay';
import { globalEventBus } from '@/core/EventBus';

// ─────────────────────── 版面常數 ───────────────────────

/** 畫布寬度 */
const W = 900;

/** 旋轉計數器高度 */
const COUNTER_H = 80;

/** PowerUp 指示區高度 */
const POWERUP_H = 120;

/** 轉盤區頂部 Y */
const REEL_AREA_TOP = COUNTER_H + POWERUP_H; // 200

/** 轉盤區高度 */
const REEL_AREA_H = 700;

/** 轉盤區底部 Y */
const REEL_AREA_BOTTOM = REEL_AREA_TOP + REEL_AREA_H; // 900

/** WinDisplay 頂部 Y */
const WIN_DISPLAY_Y = REEL_AREA_BOTTOM + 10; // 910

/** 累計贏分顯示 Y */
const TOTAL_WIN_Y = WIN_DISPLAY_Y + 110; // 1020

/** 旋轉間隔（毫秒） */
const AUTO_SPIN_DELAY_MS = 1500;

/** 轉盤停止前的旋轉持續時間（毫秒） */
const REEL_SPIN_DURATION_MS = 800;

// ─────────────────────── 顏色常數 ───────────────────────

const COLOR_BG_FALLBACK    = 0x0a1a3a; // 深藍（背景備用）
const COLOR_COUNTER_BG     = 0x1a0a3a; // 計數器背景
const COLOR_COUNTER_TEXT   = 0xffd700; // 金色計數文字
const COLOR_POWERUP_SELECT = 0x2a0a4a; // PowerUp 選擇區背景
const COLOR_POWERUP_ACTIVE = 0x7a2a00; // 已選中 PowerUp 按鈕色
const COLOR_POWERUP_IDLE   = 0x3a3a3a; // 未選中 PowerUp 按鈕色
const COLOR_TOTAL_WIN_TEXT = 0xffcc00;
const COLOR_SUMMARY_OVERLAY= 0x000000; // 完成摘要遮罩背景

/** PowerUp 按鈕寬度 */
const POWERUP_BTN_W = 140;
/** PowerUp 按鈕高度 */
const POWERUP_BTN_H = 70;
/** PowerUp 按鈕間距（左邊界起） */
const POWERUP_BTN_GAP = 18;

/** 五種 PowerUp 類型 */
const POWER_UP_TYPES: readonly PowerUpType[] = [
  'Bamboo', 'Coins', 'Fortune', 'Gourd', 'Fish',
];

// ─────────────────────── FreeGameScene ───────────────────────

export class FreeGameScene extends Container {
  // PixiJS Application（掛接 Ticker 用）
  private readonly _app: Application;

  // 核心引擎與控制器
  private _reelEngine!: ReelEngine;
  private _ctrl!: FreeGameController;

  // UI 元件
  private _counterText!: Text;
  private _powerUpLabel!: Text;
  private _powerUpBtns: Graphics[] = [];
  private _powerUpBtnLabels: Text[] = [];
  private _selectedPowerUp: PowerUpType | null = null;
  get selectedPowerUp(): PowerUpType | null { return this._selectedPowerUp; }
  private _winDisplay!: WinDisplay;
  private _totalWinText!: Text;
  private _statusText!: Text;

  // 完成摘要遮罩
  private _summaryOverlay!: Graphics;
  private _summaryText!: Text;

  // 自動旋轉狀態
  private _isRunning = false;
  private _pendingSpinResult = false;

  // Ticker 回呼參考
  private readonly _tickerFn: (ticker: Ticker) => void;

  // ALL_STOPPED 回呼參考
  private _onAllStoppedBound!: () => void;

  // ─────────────────────── 建構子 ───────────────────────

  constructor(app: Application) {
    super();
    this._app = app;

    // 定義為成員屬性，確保 remove 時引用一致
    this._tickerFn = (ticker: Ticker) => {
      this._reelEngine?.update(ticker.deltaMS);
    };
  }

  // ─────────────────────── 公開 API ───────────────────────

  /**
   * 非同步初始化：建立所有子元件
   * 必須在 AssetPipeline 完成後呼叫
   */
  async init(): Promise<void> {
    const store = AssetStore.instance;

    // 1. 背景層
    this._buildBackground(store);

    // 2. 旋轉計數器橫列（Y=0~80）
    this._buildSpinCounter();

    // 3. PowerUp 指示區（Y=80~200）
    this._buildPowerUpArea();

    // 4. 轉盤區（Y=200~900）
    this._buildReelArea(store);

    // 5. WinDisplay（Y=900~1000）
    this._winDisplay = new WinDisplay();
    this._winDisplay.x = W / 2 - 100;
    this._winDisplay.y = WIN_DISPLAY_Y;
    this.addChild(this._winDisplay);
    await this._winDisplay.init();

    // 6. 累計贏分與狀態文字（Y=1000~1200）
    this._buildAccumulatorArea();

    // 7. 完成摘要遮罩（初始隱藏）
    this._buildSummaryOverlay();

    // 8. 初始化控制器
    this._ctrl = new FreeGameController(undefined, 100);

    // 9. 掛接 Ticker 驅動 ReelEngine
    this._app.ticker.add(this._tickerFn);

    // 10. 綁定 ALL_STOPPED 事件
    this._onAllStoppedBound = () => this._onAllStopped();
    globalEventBus.on(EVENT_ALL_STOPPED, this._onAllStoppedBound);
  }

  /**
   * 啟動免費遊戲
   * @param scatterCount 觸發此次免費遊戲的 Scatter 數量（3/4/5）
   */
  start(scatterCount: number): void {
    // 觸發控制器
    this._ctrl.trigger(scatterCount);

    // 更新計數器 UI
    this._updateCounter();

    // 顯示 PowerUp 選擇區，等待玩家選擇
    this._showPowerUpSelection(true);
    this._setStatus(`選擇 Power-Up 開始免費遊戲！`);

    // 隱藏摘要遮罩（若上次殘留）
    this._summaryOverlay.visible = false;
    this._summaryText.visible = false;
  }

  override destroy(): void {
    // 移除 Ticker
    this._app.ticker.remove(this._tickerFn);
    // 移除全域事件監聽
    if (this._onAllStoppedBound) {
      globalEventBus.off(EVENT_ALL_STOPPED, this._onAllStoppedBound);
    }
    super.destroy({ children: true });
  }

  // ─────────────────────── 私有：UI 建構 ───────────────────────

  /**
   * 1. 全畫面背景
   *    嘗試 Free_BG 貼圖，失敗則深藍 Graphics fallback
   */
  private _buildBackground(store: AssetStore): void {
    const bgTex = store.tryGetTexture('Free_BG')
               ?? store.tryGetTexture('Free_BG_png');

    if (bgTex) {
      const bg = new Sprite(bgTex);
      bg.width  = W;
      bg.height = 1600;
      bg.x = 0;
      bg.y = 0;
      this.addChild(bg);
    } else {
      // 深藍 fallback
      const bg = new Graphics();
      bg.rect(0, 0, W, 1600).fill({ color: COLOR_BG_FALLBACK });
      this.addChild(bg);
    }
  }

  /**
   * 2. 旋轉計數器橫列（Y=0~80）
   *    顯示 "FREE SPINS: X/Y"
   */
  private _buildSpinCounter(): void {
    // 背景條
    const counterBg = new Graphics();
    counterBg.rect(0, 0, W, COUNTER_H).fill({ color: COLOR_COUNTER_BG });
    this.addChild(counterBg);

    // 計數文字（使用 PixiJS v8 物件語法）
    this._counterText = new Text({
      text: 'FREE SPINS: 0/0',
      style: new TextStyle({
        fontFamily: 'Arial Black',
        fontSize: 32,
        fontWeight: 'bold',
        fill: COLOR_COUNTER_TEXT,
        align: 'center',
      }),
    });
    this._counterText.anchor.set(0.5, 0.5);
    this._counterText.x = W / 2;
    this._counterText.y = COUNTER_H / 2;
    this.addChild(this._counterText);
  }

  /**
   * 3. PowerUp 指示與選擇區（Y=80~200）
   *    五個按鈕：Bamboo / Coins / Fortune / Gourd / Fish
   */
  private _buildPowerUpArea(): void {
    // 區域背景
    const areaBg = new Graphics();
    areaBg.rect(0, COUNTER_H, W, POWERUP_H).fill({ color: COLOR_POWERUP_SELECT });
    this.addChild(areaBg);

    // 標題標籤
    this._powerUpLabel = new Text({
      text: '選擇 Power-Up',
      style: new TextStyle({
        fontFamily: 'Arial',
        fontSize: 18,
        fill: 0xaaaaaa,
        align: 'center',
      }),
    });
    this._powerUpLabel.anchor.set(0.5, 0);
    this._powerUpLabel.x = W / 2;
    this._powerUpLabel.y = COUNTER_H + 4;
    this.addChild(this._powerUpLabel);

    // 五個 PowerUp 按鈕（水平排列）
    // 整體寬度 = 5 * 140 + 4 * 18 = 700 + 72 = 772，左邊距 = (900 - 772) / 2 = 64
    const totalBtnW = POWER_UP_TYPES.length * POWERUP_BTN_W
                    + (POWER_UP_TYPES.length - 1) * POWERUP_BTN_GAP;
    const btnStartX = (W - totalBtnW) / 2;
    const btnY = COUNTER_H + 28;

    this._powerUpBtns = [];
    this._powerUpBtnLabels = [];

    POWER_UP_TYPES.forEach((type, i) => {
      const x = btnStartX + i * (POWERUP_BTN_W + POWERUP_BTN_GAP);

      // 按鈕 Graphics
      const btn = new Graphics();
      btn.roundRect(0, 0, POWERUP_BTN_W, POWERUP_BTN_H, 8)
        .fill({ color: COLOR_POWERUP_IDLE });
      btn.x = x;
      btn.y = btnY;
      btn.interactive = true;
      btn.cursor = 'pointer';
      btn.on('pointerup', () => this._onSelectPowerUp(type, i));
      this.addChild(btn);
      this._powerUpBtns.push(btn);

      // 按鈕文字標籤
      const label = new Text({
        text: type,
        style: new TextStyle({
          fontFamily: 'Arial',
          fontSize: 16,
          fill: 0xffffff,
          align: 'center',
        }),
      });
      label.anchor.set(0.5, 0.5);
      label.x = x + POWERUP_BTN_W / 2;
      label.y = btnY + POWERUP_BTN_H / 2;
      this.addChild(label);
      this._powerUpBtnLabels.push(label);
    });
  }

  /**
   * 4. 轉盤區（Y=200~900）
   *    層次：Free_Reel 底圖 → ReelEngine → FreeFrame 邊框
   */
  private _buildReelArea(store: AssetStore): void {
    // 轉盤底圖（嘗試 Free_Reel 或 Base_Reel 降級）
    const reelBgTex = store.tryGetTexture('Free_Reel_png')
                   ?? store.tryGetTexture('Free_Reel')
                   ?? store.tryGetTexture('Base_Reel_png')
                   ?? store.tryGetTexture('Base_Reel');
    if (reelBgTex) {
      const reelBg = new Sprite(reelBgTex);
      reelBg.x = 0;
      reelBg.y = REEL_AREA_TOP;
      reelBg.width  = W;
      reelBg.height = REEL_AREA_H;
      this.addChild(reelBg);
    }

    // ReelEngine（使用與 BaseGame 相同的符號貼圖）
    this._reelEngine = new ReelEngine(symbolManager.getTextureMap());
    // ReelEngine 內部 REEL_AREA_Y = 350，需修正至 200
    this._reelEngine.y = REEL_AREA_TOP - 350;
    this.addChild(this._reelEngine);

    // 免費遊戲邊框覆蓋（FreeFrame）
    const frameTex = store.tryGetTexture('FreeFrame')
                  ?? store.tryGetTexture('FreeFrame_png');
    if (frameTex) {
      const frame = new Sprite(frameTex);
      frame.x = 0;
      frame.y = REEL_AREA_TOP;
      frame.width  = W;
      frame.height = REEL_AREA_H;
      this.addChild(frame);
    }
  }

  /**
   * 6. 累計贏分與狀態文字（Y=1000~1200）
   */
  private _buildAccumulatorArea(): void {
    // 總贏分標籤
    const totalLabel = new Text({
      text: 'TOTAL WIN',
      style: new TextStyle({
        fontFamily: 'Arial',
        fontSize: 20,
        fill: 0x888888,
        align: 'center',
      }),
    });
    totalLabel.anchor.set(0.5, 0);
    totalLabel.x = W / 2;
    totalLabel.y = TOTAL_WIN_Y;
    this.addChild(totalLabel);

    // 累計贏分數字
    this._totalWinText = new Text({
      text: '0',
      style: new TextStyle({
        fontFamily: 'Arial Black',
        fontSize: 36,
        fontWeight: 'bold',
        fill: COLOR_TOTAL_WIN_TEXT,
        align: 'center',
      }),
    });
    this._totalWinText.anchor.set(0.5, 0);
    this._totalWinText.x = W / 2;
    this._totalWinText.y = TOTAL_WIN_Y + 30;
    this.addChild(this._totalWinText);

    // 狀態文字
    this._statusText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'Arial',
        fontSize: 22,
        fill: 0xdddddd,
        align: 'center',
      }),
    });
    this._statusText.anchor.set(0.5, 0);
    this._statusText.x = W / 2;
    this._statusText.y = TOTAL_WIN_Y + 90;
    this.addChild(this._statusText);
  }

  /**
   * 7. 完成摘要遮罩（全螢幕半透明黑色 + 文字）
   */
  private _buildSummaryOverlay(): void {
    this._summaryOverlay = new Graphics();
    this._summaryOverlay.rect(0, 0, W, 1600)
      .fill({ color: COLOR_SUMMARY_OVERLAY, alpha: 0.75 });
    this._summaryOverlay.visible = false;
    this.addChild(this._summaryOverlay);

    this._summaryText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'Arial Black',
        fontSize: 42,
        fontWeight: 'bold',
        fill: 0xffd700,
        align: 'center',
        wordWrap: true,
        wordWrapWidth: 700,
      }),
    });
    this._summaryText.anchor.set(0.5, 0.5);
    this._summaryText.x = W / 2;
    this._summaryText.y = 800;
    this._summaryText.visible = false;
    this.addChild(this._summaryText);
  }

  // ─────────────────────── 私有：互動邏輯 ───────────────────────

  /**
   * 玩家選擇 PowerUp 後的回呼
   * @param type 選中的 PowerUp 類型
   * @param idx  按鈕索引（0-4）
   */
  private _onSelectPowerUp(type: PowerUpType, idx: number): void {
    // 防止重複選擇或旋轉中選擇
    if (this._isRunning) return;

    this._selectedPowerUp = type;
    this._ctrl.selectPowerUp(type);

    // 更新按鈕視覺：選中的亮起，其餘變暗
    this._powerUpBtns.forEach((btn, i) => {
      btn.clear();
      btn.roundRect(0, 0, POWERUP_BTN_W, POWERUP_BTN_H, 8)
        .fill({ color: i === idx ? COLOR_POWERUP_ACTIVE : COLOR_POWERUP_IDLE });
    });

    // 禁用所有按鈕互動
    this._powerUpBtns.forEach((btn) => { btn.interactive = false; });

    // 更新標籤文字
    this._powerUpLabel.text = `Power-Up: ${type} 已啟用`;

    // 顯示目前 PowerUp
    this._setStatus(`Power-Up: ${type} — 準備開始！`);

    // 延遲 500ms 後啟動自動旋轉
    setTimeout(() => this._runAutoSpins(), 500);
  }

  /**
   * 顯示或隱藏 PowerUp 選擇按鈕的互動狀態
   * @param show true=可互動，false=隱藏互動
   */
  private _showPowerUpSelection(show: boolean): void {
    this._powerUpBtns.forEach((btn) => {
      btn.interactive = show;
      btn.cursor = show ? 'pointer' : 'default';
    });
  }

  // ─────────────────────── 私有：自動旋轉流程 ───────────────────────

  /**
   * 執行所有免費旋轉（遞迴定時呼叫）
   */
  private _runAutoSpins(): void {
    // 無剩餘次數或未啟動，結束
    if (!this._ctrl.isActive || this._ctrl.remainingSpins <= 0) {
      this._onFreeGameComplete();
      return;
    }

    this._isRunning = true;
    this._updateCounter();

    // 取得旋轉結果
    const result = this._ctrl.spin();
    if (!result) {
      this._onFreeGameComplete();
      return;
    }

    // 顯示目前贏分
    if (result.totalWin > 0) {
      this._winDisplay.showWin(result.totalWin);
    } else {
      this._winDisplay.clear();
    }

    // 更新累計贏分
    this._totalWinText.text = this._ctrl.totalWin.toString();

    // Re-trigger 提示
    if (result.triggerFreeGame && result.scatterCount >= 3) {
      this._ctrl.retrigger(result.scatterCount);
      this._setStatus(`Re-trigger! +${result.scatterCount === 3 ? 8 : result.scatterCount === 4 ? 12 : 20} 次免費轉`);
    } else {
      this._setStatus(`旋轉中... 剩餘 ${this._ctrl.remainingSpins} 次`);
    }

    // 啟動 ReelEngine
    this._reelEngine.spin(result.gridResult.grid);
    this._pendingSpinResult = true;

    // 延遲停止轉盤
    setTimeout(() => {
      this._reelEngine.stopAll();
    }, REEL_SPIN_DURATION_MS);
  }

  /**
   * ReelEngine ALL_STOPPED 回呼：等待轉盤停止後進入下一次旋轉
   */
  private _onAllStopped(): void {
    if (!this._pendingSpinResult) return;
    this._pendingSpinResult = false;

    // 以 AUTO_SPIN_DELAY_MS 間隔執行下一次旋轉
    setTimeout(() => this._runAutoSpins(), AUTO_SPIN_DELAY_MS);
  }

  /**
   * 所有免費旋轉完成後的處理
   */
  private _onFreeGameComplete(): void {
    this._isRunning = false;
    const totalWin = this._ctrl.totalWin;

    // 顯示摘要遮罩
    this._summaryOverlay.visible = true;
    this._summaryText.text = `免費遊戲結束！\n總贏分：${totalWin}`;
    this._summaryText.visible = true;

    this._setStatus('免費遊戲結束！');

    // 3 秒後 emit 'complete' 事件，通知場景管理器切回 BaseGame
    setTimeout(() => {
      this.emit('complete', { totalWin });
    }, 3000);
  }

  // ─────────────────────── 私有：工具方法 ───────────────────────

  /** 更新旋轉計數器文字 */
  private _updateCounter(): void {
    const remaining = this._ctrl.remainingSpins;
    const total     = this._ctrl.totalSpins;
    this._counterText.text = `FREE SPINS: ${remaining}/${total}`;
  }

  /** 更新狀態文字 */
  private _setStatus(msg: string): void {
    if (this._statusText) {
      this._statusText.text = msg;
    }
  }
}
