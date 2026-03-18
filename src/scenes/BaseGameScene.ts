/**
 * BaseGameScene — 基礎遊戲主場景（真實資源版）
 *
 * 版面配置（900×1600 直向）：
 *   Y=0   ~ 80  : JackpotBar（四級頭獎橫列）
 *   Y=80  ~ 200 : Logo 標題區
 *   Y=200 ~ 900 : 轉盤區（5×4，700px 高）
 *                   - Base_Reel.png 轉盤背景
 *                   - ReelEngine（五欄轉盤動畫）
 *                   - BaseFrame.png 覆蓋邊框
 *   Y=900 ~ 990 : WinDisplay 贏分顯示（中央）
 *   Y=990 ~ 1100: BalanceDisplay（左）+ BetSelector（右）
 *   Y=1100~ 1280: SpinButton（中央）
 *   Y=1280~ 1350: 訊息文字
 *   Y=1350~ 1600: 底部預留區
 *
 * 使用的模組：
 *   - AssetStore (getTexture / getSpriteFrames)
 *   - SymbolManager (getTextureMap)
 *   - ReelEngine (spin / update / EVENT_ALL_STOPPED)
 *   - GameController (spin / balance / currentBet / increaseBet / decreaseBet)
 *   - SpinButton / BetSelector / BalanceDisplay / WinDisplay / JackpotBar
 */

import {
  Container,
  Sprite,
  Application,
  Text,
  TextStyle,
  Ticker,
} from 'pixi.js';
import { AssetStore } from '@/assets/AssetStore';
import { symbolManager } from '@/reel/SymbolManager';
import { ReelEngine, EVENT_ALL_STOPPED } from '@/reel/ReelEngine';
import { GameController } from '@/core/GameController';
import { SpinButton } from '@/ui/SpinButton';
import { BetSelector } from '@/ui/BetSelector';
import { BalanceDisplay } from '@/ui/BalanceDisplay';
import { WinDisplay } from '@/ui/WinDisplay';
import { JackpotBar } from '@/ui/JackpotBar';
import { globalEventBus } from '@/core/EventBus';
import type { SpinResult } from '@/core/constants';

// ─────────────────────── 版面常數 ───────────────────────

/** 遊戲畫布寬度 */
const W = 900;

/** JackpotBar 高度 */
const JACKPOT_H = 80;

/** Logo 區域高度 */
const LOGO_AREA_H = 120;

/** 轉盤區頂部 Y */
const REEL_AREA_TOP = JACKPOT_H + LOGO_AREA_H; // 200

/** 轉盤區高度 */
const REEL_AREA_H = 700;

/** 轉盤區底部 Y */
const REEL_AREA_BOTTOM = REEL_AREA_TOP + REEL_AREA_H; // 900

/** WinDisplay 中心 Y */
const WIN_DISPLAY_Y = REEL_AREA_BOTTOM + 10; // 910

/** BalanceDisplay / BetSelector 行 Y */
const PANEL_Y = WIN_DISPLAY_Y + 80; // 990

/** SpinButton 中心 Y */
const SPIN_BTN_Y = PANEL_Y + 130; // 1120

/** 訊息文字 Y */
const MSG_Y = SPIN_BTN_Y + 90; // 1210

// ─────────────────────── BaseGameScene ───────────────────────

export class BaseGameScene extends Container {
  // PixiJS Application（用於掛接 Ticker）
  private readonly _app: Application;

  // 核心引擎
  private _reelEngine!: ReelEngine;
  private _ctrl!: GameController;

  // UI 元件
  private _jackpotBar!: JackpotBar;
  private _spinButton!: SpinButton;
  private _betSelector!: BetSelector;
  private _balanceDisplay!: BalanceDisplay;
  private _winDisplay!: WinDisplay;
  private _messageText!: Text;

  // Ticker 回呼參考（移除時使用）
  private readonly _tickerFn: (ticker: Ticker) => void;

  // ─────────────────────── 建構子 ───────────────────────

  constructor(app: Application) {
    super();
    this._app = app;
    // 將 Ticker 回呼定義為成員屬性，確保 remove 時引用一致
    this._tickerFn = (ticker: Ticker) => {
      this._reelEngine?.update(ticker.deltaMS);
    };
  }

  // ─────────────────────── 公開 API ───────────────────────

  /**
   * 非同步初始化：建立所有子元件、套用資源、綁定事件
   * 必須在 AssetPipeline 完成且 symbolManager.loadSymbols() 呼叫後執行
   */
  async init(): Promise<void> {
    const store = AssetStore.instance;

    // 1. 全畫面背景（Base_BG.jpg）
    this._buildBackground(store);

    // 2. JackpotBar（頂部橫列）
    await this._buildJackpotBar();

    // 3. Logo 標題
    this._buildLogoArea(store);

    // 4. 轉盤區（Base_Reel + ReelEngine + BaseFrame）
    this._buildReelArea(store);

    // 5. 控制面板（WinDisplay / BalanceDisplay / BetSelector / SpinButton）
    await this._buildControlPanel(store);

    // 6. 訊息文字列
    this._buildMessageText();

    // 7. 初始化 GameController
    this._ctrl = new GameController({
      initialBalance: 50000,
      betOptions: [10, 20, 50, 100, 200, 500],
      defaultBetIndex: 3,
    });

    // 8. 同步 UI 初始值
    this._balanceDisplay.setBalance(this._ctrl.balance);
    this._betSelector.setBet(this._ctrl.currentBet);

    // 9. 綁定事件
    this._bindEvents();

    // 10. 掛接 Ticker 驅動 ReelEngine
    this._app.ticker.add(this._tickerFn);

    // 11. 初始化 SpinButton 貼圖（非阻塞）
    this._spinButton.loadTextures().catch(() => {
      // 載入失敗維持 Graphics fallback，不影響遊戲
    });
  }

  // ─────────────────────── 私有：UI 建構 ───────────────────────

  /**
   * 1. 全畫面背景：使用 Base_BG.jpg Sprite
   *    若資源未載入則保持透明（App 本身已設 backgroundColor）
   */
  private _buildBackground(store: AssetStore): void {
    try {
      const bgTex = store.getTexture('Base_BG_jpg');
      const bg    = new Sprite(bgTex);
      bg.width  = W;
      bg.height = 1600;
      bg.x = 0;
      bg.y = 0;
      this.addChild(bg);
    } catch {
      // Base_BG.jpg 鍵名可能因 res.json 而異，容錯處理
      console.warn('[BaseGameScene] Base_BG 貼圖未找到，使用純色背景');
    }
  }

  /**
   * 2. JackpotBar（頂部 0~80px）
   *    初始化後立即 init() 載入等級圖標
   */
  private async _buildJackpotBar(): Promise<void> {
    this._jackpotBar = new JackpotBar();
    this._jackpotBar.x = 0;
    this._jackpotBar.y = 0;
    this.addChild(this._jackpotBar);
    await this._jackpotBar.init();
  }

  /**
   * 3. Logo 標題區（Y=80~200）
   *    嘗試使用 PreLoad/GameLogo_en.png；失敗則文字 fallback
   */
  private _buildLogoArea(store: AssetStore): void {
    // 嘗試使用 GameLogo_en.png（已在 preload 階段載入至 AssetStore）
    const logoTex = store.tryGetTexture('GameLogo_en_png');
    if (logoTex) {
      const logo = new Sprite(logoTex);
      logo.anchor.set(0.5, 0);
      const targetW = 500;
      logo.scale.set(targetW / logo.texture.width);
      logo.x = W / 2;
      logo.y = JACKPOT_H + 10;
      this.addChild(logo);
    } else {
      // 文字 fallback
      const titleText = new Text({
        text: 'POWER FORTUNE',
        style: new TextStyle({
          fontFamily: 'Arial Black',
          fontSize: 44,
          fontWeight: 'bold',
          fill: 0xffd700,
          dropShadow: { color: 0x884400, blur: 10, distance: 3, angle: Math.PI / 4 },
          stroke: { color: 0x7a4000, width: 2 },
        }),
      });
      titleText.anchor.set(0.5, 0);
      titleText.x = W / 2;
      titleText.y = JACKPOT_H + 16;
      this.addChild(titleText);

      const subText = new Text({
        text: '財神報喜 — 1024 Ways to Win',
        style: new TextStyle({
          fontFamily: 'Arial',
          fontSize: 20,
          fill: 0xaaaaaa,
        }),
      });
      subText.anchor.set(0.5, 0);
      subText.x = W / 2;
      subText.y = JACKPOT_H + 72;
      this.addChild(subText);
    }
  }

  /**
   * 4. 轉盤區（Y=200~900）
   *    層次由下到上：Base_Reel（轉盤底圖）→ ReelEngine → BaseFrame（覆蓋邊框）
   *
   * Base_Reel.png 與 BaseFrame.png 的 Egret 鍵名規則：
   *   PNG 鍵 = 不含路徑的檔名，全部以 "_png" 結尾或直接以原名存儲
   *   此處使用 tryGetTexture 降級容錯，確保無資源時不崩潰
   */
  private _buildReelArea(store: AssetStore): void {
    // ── 轉盤底圖（Base_Reel.png）────────────────────────────────
    const reelBgTex = store.tryGetTexture('Base_Reel_png')
                   ?? store.tryGetTexture('Base_Reel');
    if (reelBgTex) {
      const reelBg = new Sprite(reelBgTex);
      reelBg.x = 0;
      reelBg.y = REEL_AREA_TOP;
      reelBg.width  = W;
      reelBg.height = REEL_AREA_H;
      this.addChild(reelBg);
    }

    // ── ReelEngine（轉盤動畫引擎）────────────────────────────────
    // symbolManager.getTextureMap() 提供 id→Texture 映射
    this._reelEngine = new ReelEngine(symbolManager.getTextureMap());
    // ReelEngine 內部已有 REEL_AREA_Y=350 的偏移，
    // 但我們需要配合版面將其位移至 REEL_AREA_TOP（200px）
    // 因此將 ReelEngine 容器 Y 設為版面頂部偏移修正值：
    //   ReelEngine 內部 REEL_AREA_Y = 350，畫面需要 200，差值 = -150
    this._reelEngine.y = REEL_AREA_TOP - 350;
    this.addChild(this._reelEngine);

    // ── 邊框覆蓋（BaseFrame.png）─────────────────────────────────
    const frameTex = store.tryGetTexture('BaseFrame_png')
                  ?? store.tryGetTexture('BaseFrame');
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
   * 5. 控制面板：WinDisplay / BalanceDisplay / BetSelector / SpinButton
   */
  private async _buildControlPanel(_store: AssetStore): Promise<void> {
    // ── WinDisplay（贏分顯示，轉盤下方中央）─────────────────────
    this._winDisplay = new WinDisplay();
    this._winDisplay.x = W / 2 - 100; // WinDisplay 寬 200，以中央對齊
    this._winDisplay.y = WIN_DISPLAY_Y;
    this.addChild(this._winDisplay);
    await this._winDisplay.init();

    // ── BalanceDisplay（餘額，左側）─────────────────────────────
    this._balanceDisplay = new BalanceDisplay(50000);
    this._balanceDisplay.x = 60;
    this._balanceDisplay.y = PANEL_Y;
    this.addChild(this._balanceDisplay);
    await this._balanceDisplay.init();

    // ── BetSelector（下注選擇，右側）────────────────────────────
    this._betSelector = new BetSelector(
      [10, 20, 50, 100, 200, 500],
      100, // 預設下注 100
    );
    this._betSelector.x = W - 60 - 180; // 右對齊，BetSelector 寬 180
    this._betSelector.y = PANEL_Y;
    this.addChild(this._betSelector);
    await this._betSelector.init();

    // ── SpinButton（中央）────────────────────────────────────────
    this._spinButton = new SpinButton();
    this._spinButton.x = W / 2;  // SpinButton 以 (0,0) 為圓心
    this._spinButton.y = SPIN_BTN_Y;
    this.addChild(this._spinButton);
  }

  /**
   * 6. 訊息文字（SpinButton 下方）
   */
  private _buildMessageText(): void {
    this._messageText = new Text({
      text: 'Press SPIN to play!',
      style: new TextStyle({
        fontFamily: 'Arial',
        fontSize: 24,
        fill: 0xffcc00,
        align: 'center',
      }),
    });
    this._messageText.anchor.set(0.5, 0);
    this._messageText.x = W / 2;
    this._messageText.y = MSG_Y;
    this.addChild(this._messageText);
  }

  // ─────────────────────── 私有：事件綁定 ───────────────────────

  /**
   * 綁定所有 UI 元件事件與 ReelEngine 事件
   */
  private _bindEvents(): void {
    // SpinButton → 觸發旋轉
    this._spinButton.on('spin', this._onSpinRequest, this);

    // BetSelector → 同步 GameController 下注額
    this._betSelector.on('betChanged', (newBet: number) => {
      // BetSelector 循環切換時，先找到方向再呼叫 controller
      // 直接以新的 bet 值與 controller 目前值比對
      const current = this._ctrl.currentBet;
      if (newBet > current) {
        this._ctrl.increaseBet();
      } else if (newBet < current) {
        this._ctrl.decreaseBet();
      }
    });

    // ReelEngine → 所有轉盤停止後處理結果
    // EventBus.on 不接受 context 第三參數，故使用箭頭函式綁定
    this._onAllStoppedBound = () => this._onAllStopped();
    globalEventBus.on(EVENT_ALL_STOPPED, this._onAllStoppedBound);
  }

  // ─────────────────────── 私有：旋轉流程 ───────────────────────

  /**
   * SpinButton 'spin' 事件觸發的主流程
   *
   * 流程：
   *   1. 禁用 SpinButton 和 BetSelector
   *   2. 清除上一局的 WinDisplay
   *   3. 向 GameController 請求旋轉結果
   *   4. 以格線結果啟動 ReelEngine
   *   5. 啟動 ReelEngine.stopAll() 傳入目標符號
   */
  private _onSpinRequest(): void {
    // 防止重複觸發
    if (this._reelEngine.spinning) return;

    // 呼叫 GameController 取得旋轉結果
    const result = this._ctrl.spin();
    if (!result) {
      // 餘額不足
      this._setMessage('Insufficient balance!');
      return;
    }

    // 禁用互動元件
    this._spinButton.setSpinning(true);
    this._betSelector.setEnabled(false);
    this._winDisplay.clear();
    this._setMessage('Spinning...');

    // 啟動 ReelEngine（傳入目標格線）
    this._reelEngine.spin(result.gridResult.grid);

    // 以延遲停止指令模擬真實轉盤物理感
    // 最小旋轉時間 800ms，之後觸發停止
    setTimeout(() => {
      this._reelEngine.stopAll();
    }, 800);

    // 將結果暫存，等 ALL_STOPPED 後使用
    this._pendingResult = result;
  }

  /** 暫存旋轉結果（等待 ALL_STOPPED 後顯示） */
  private _pendingResult: SpinResult | null = null;

  /** 綁定後的 ALL_STOPPED 回呼（用於 off 時引用一致） */
  private _onAllStoppedBound!: () => void;

  /**
   * ReelEngine ALL_STOPPED 事件：所有轉盤停止後處理結果
   */
  private _onAllStopped(): void {
    const result = this._pendingResult;
    this._pendingResult = null;

    if (result) {
      this._showResult(result);
    }

    // 恢復互動
    this._spinButton.setSpinning(false);
    this._betSelector.setEnabled(true);

    // 更新餘額
    this._balanceDisplay.setBalance(this._ctrl.balance);
  }

  /**
   * 顯示旋轉結果（贏分 / 訊息）
   */
  private _showResult(result: SpinResult): void {
    const { wins, totalWin, scatterCount, triggerFreeGame } = result;

    if (totalWin > 0) {
      // 啟動跑分動畫
      this._winDisplay.showWin(totalWin);
      const winCount = wins.length;
      this._setMessage(
        `${winCount} winning way${winCount > 1 ? 's' : ''}!`,
      );
    } else {
      this._winDisplay.clear();
      this._setMessage('No win. Try again!');
    }

    // Scatter / FreeGame 提示
    if (scatterCount >= 2) {
      this._setMessage(
        `${this._messageText.text} (${scatterCount} Scatter${scatterCount > 1 ? 's' : ''})`,
      );
    }
    if (triggerFreeGame) {
      this._setMessage(`FREE GAME TRIGGERED! (${scatterCount} Scatters)`);
    }
  }

  /**
   * 設定訊息文字（僅更新，避免直接存取私有屬性）
   */
  private _setMessage(msg: string): void {
    if (this._messageText) {
      this._messageText.text = msg;
    }
  }

  // ─────────────────────── 資源釋放 ───────────────────────

  override destroy(): void {
    // 移除 Ticker 回呼，防止記憶體洩漏
    this._app.ticker.remove(this._tickerFn);
    // 移除全域事件監聽
    if (this._onAllStoppedBound) {
      globalEventBus.off(EVENT_ALL_STOPPED, this._onAllStoppedBound);
    }
    super.destroy({ children: true });
  }
}
