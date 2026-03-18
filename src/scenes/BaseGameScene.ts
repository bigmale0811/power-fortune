/**
 * BaseGameScene — 基礎遊戲主場景（真實資源版）
 *
 * 版面配置（1600×2000 直向 — 對齊原版設計解析度）：
 *   Y=0    ~ 120 : JackpotBar（四級頭獎橫列）
 *   Y=120  ~ 420 : Logo 標題區（GameLogo_en 700×700 縮放）
 *   Y=480  ~ 1120: 轉盤區（5×4，Base_Reel 1202×640 原始尺寸）
 *                    - Base_Reel.png 轉盤背景（x=199, 1202×640）
 *                    - ReelEngine（五欄轉盤動畫）
 *                    - BaseFrame.png 覆蓋邊框（896×716, 置中）
 *   Y=1140~ 1240 : WinDisplay 贏分顯示（中央）
 *   Y=1260~ 1380 : BalanceDisplay（左）+ BetSelector（右）
 *   Y=1420~ 1600 : SpinButton（中央）
 *   Y=1640~ 1720 : 訊息文字
 *   Y=1720~ 2000 : 底部預留區
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
import { WinTierOverlay } from '@/ui/WinTierOverlay';
import { WinHighlight } from '@/ui/WinHighlight';
import { CoinEffect } from '@/ui/CoinEffect';
import { SceneTransition } from '@/scenes/SceneTransition';
import { FreeGameScene } from '@/scenes/FreeGameScene';
import { MiniGameScene } from '@/scenes/MiniGameScene';
import { SoundManager } from '@/audio/SoundManager';
import { globalEventBus } from '@/core/EventBus';
import type { SpinResult } from '@/core/constants';

// ─────────────────────── 版面常數（1600×2000 設計解析度） ───────────────────────

/** 遊戲畫布寬度（對齊 Base_BG.jpg 原始尺寸） */
const W = 1600;

/** JackpotBar 高度 */
const JACKPOT_H = 120;

/** Logo 區域高度（GameLogo_en 700×700 縮放後留空） */
const LOGO_AREA_H = 300;

/** 轉盤區頂部 Y（Jackpot + Logo 之後，留 60px 間距） */
const REEL_AREA_TOP = JACKPOT_H + LOGO_AREA_H + 60; // 480

/** 轉盤區高度（Base_Reel.png 原始高度，不拉伸） */
const REEL_AREA_H = 640;

/** 轉盤區底部 Y */
const REEL_AREA_BOTTOM = REEL_AREA_TOP + REEL_AREA_H; // 1120

/** Base_Reel.png 原始寬度 */
const REEL_W = 1202;

/** Base_Reel.png 水平置中 X = (1600 - 1202) / 2 */
const REEL_X = Math.round((W - REEL_W) / 2); // 199

/** BaseFrame.png 原始尺寸 */
const FRAME_W = 896;
const FRAME_H = 716;

/** BaseFrame.png 水平置中 X = (1600 - 896) / 2 */
const FRAME_X = Math.round((W - FRAME_W) / 2); // 352

/** BaseFrame.png 垂直置中於轉盤區（框比轉盤高 76px，上下各延伸 38px） */
const FRAME_Y = REEL_AREA_TOP - Math.round((FRAME_H - REEL_AREA_H) / 2); // 442

/** WinDisplay 中心 Y（轉盤下方 20px） */
const WIN_DISPLAY_Y = REEL_AREA_BOTTOM + 20; // 1140

/** BalanceDisplay / BetSelector 行 Y */
const PANEL_Y = WIN_DISPLAY_Y + 120; // 1260

/** SpinButton 中心 Y */
const SPIN_BTN_Y = PANEL_Y + 160; // 1420

/** 訊息文字 Y */
const MSG_Y = SPIN_BTN_Y + 120; // 1540

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

  // Phase E: 贏分特效元件
  private _winOverlay!: WinTierOverlay;
  private _winHighlight!: WinHighlight;
  private _coinEffect!: CoinEffect;

  // Ticker 回呼參考（移除時使用）
  private readonly _tickerFn: (ticker: Ticker) => void;

  // ─────────────────────── 建構子 ───────────────────────

  constructor(app: Application) {
    super();
    this._app = app;
    // 將 Ticker 回呼定義為成員屬性，確保 remove 時引用一致
    this._tickerFn = (ticker: Ticker) => {
      this._reelEngine?.update(ticker.deltaMS);
      // Phase E: 驅動金幣粒子物理更新（dt 單位：秒）
      this._coinEffect?.update(ticker.deltaMS / 1000);
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

    // 7. Phase E: 贏分特效（初始化順序：底層 → 頂層）
    // WinHighlight：格線高亮，置於轉盤區上方
    this._winHighlight = new WinHighlight(0, REEL_AREA_TOP, W / 5, REEL_AREA_H / 4);
    this.addChild(this._winHighlight);

    // CoinEffect：金幣噴射粒子
    this._coinEffect = new CoinEffect();
    this.addChild(this._coinEffect);

    // WinTierOverlay：全螢幕大獎覆蓋層（必須在最頂層）
    this._winOverlay = new WinTierOverlay();
    this.addChild(this._winOverlay);
    await this._winOverlay.init();

    // 8. SoundManager：預載音效（非阻塞，失敗不影響遊戲）
    SoundManager.getInstance().preload().catch(() => {
      console.warn('[BaseGameScene] SoundManager 預載失敗，遊戲繼續');
    });

    // 9. 初始化 GameController
    this._ctrl = new GameController({
      initialBalance: 50000,
      betOptions: [10, 20, 50, 100, 200, 500],
      defaultBetIndex: 3,
    });

    // 10. 同步 UI 初始值
    this._balanceDisplay.setBalance(this._ctrl.balance);
    this._betSelector.setBet(this._ctrl.currentBet);

    // 11. 綁定事件
    this._bindEvents();

    // 12. 掛接 Ticker 驅動 ReelEngine + CoinEffect
    this._app.ticker.add(this._tickerFn);

    // 13. 初始化 SpinButton 貼圖（非阻塞）
    this._spinButton.loadTextures().catch(() => {
      // 載入失敗維持 Graphics fallback，不影響遊戲
    });
  }

  // ─────────────────────── 私有：UI 建構 ───────────────────────

  /**
   * 1. 全畫面背景：使用 Base_BG.jpg Sprite（1600×2000 原始尺寸）
   *    原圖即為 1600×2000，直接放置不拉伸
   *    若資源未載入則保持透明（App 本身已設 backgroundColor）
   */
  private _buildBackground(store: AssetStore): void {
    try {
      const bgTex = store.getTexture('Base_BG_jpg');
      const bg    = new Sprite(bgTex);
      // 原圖即為 1600×2000，直接以原始尺寸放置（不拉伸）
      bg.x = 0;
      bg.y = 0;
      this.addChild(bg);
      console.log(`[BaseGameScene] Base_BG 放置完成：` +
        `原始尺寸=${bgTex.width}×${bgTex.height}`);
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
   * 4. 轉盤區（Y=480~1120）
   *    層次由下到上：Base_Reel（轉盤底圖）→ ReelEngine → BaseFrame（金色裝飾邊框）
   *
   *    Base_Reel.png：1202×640，水平置中 x=199
   *    BaseFrame.png：896×716，金色裝飾圓框，置中覆蓋於轉盤區
   *    所有素材使用原始尺寸，不拉伸
   */
  private _buildReelArea(store: AssetStore): void {
    // ── 轉盤底圖（Base_Reel.png：1202×640 原始尺寸）─────────────
    const reelBgTex = store.tryGetTexture('Base_Reel_png')
                   ?? store.tryGetTexture('Base_Reel');
    if (reelBgTex) {
      const reelBg = new Sprite(reelBgTex);
      // 使用原始尺寸，水平置中（不拉伸！）
      reelBg.x = REEL_X;          // 199
      reelBg.y = REEL_AREA_TOP;   // 480
      // 不設定 width/height，讓 Sprite 使用貼圖原始尺寸
      this.addChild(reelBg);
      console.log(`[BaseGameScene] Base_Reel 放置完成：` +
        `pos=(${REEL_X},${REEL_AREA_TOP}), 原始尺寸=${reelBgTex.width}×${reelBgTex.height}`);
    }

    // ── ReelEngine（轉盤動畫引擎）────────────────────────────────
    // symbolManager.getTextureMap() 提供 id→Texture 映射
    this._reelEngine = new ReelEngine(symbolManager.getTextureMap());
    // ReelEngine 內部 REEL_AREA_Y = 350
    // 符號格線 (4行×150px=600px) 需垂直置中於 Base_Reel (640px)：
    //   格線頂部 = REEL_AREA_TOP + (640-600)/2 = 480 + 20 = 500
    //   容器 Y = 格線頂部 - ReelEngine 內部 REEL_AREA_Y = 500 - 350 = 150
    this._reelEngine.y = REEL_AREA_TOP + (REEL_AREA_H - 4 * 150) / 2 - 350; // 150
    this.addChild(this._reelEngine);

    // ── 邊框覆蓋（BaseFrame.png：896×716 金色裝飾圓框）──────────
    // BaseFrame.png 是金色裝飾性邊框（非中文文字），置中覆蓋於轉盤區上方
    const frameTex = store.tryGetTexture('BaseFrame_png')
                  ?? store.tryGetTexture('BaseFrame');
    if (frameTex) {
      const frame = new Sprite(frameTex);
      // 使用原始尺寸，水平+垂直置中於轉盤區
      frame.x = FRAME_X;  // 352
      frame.y = FRAME_Y;  // 442
      // 不設定 width/height，使用原始尺寸
      this.addChild(frame);
      console.log(`[BaseGameScene] BaseFrame 放置完成：` +
        `pos=(${FRAME_X},${FRAME_Y}), 原始尺寸=${frameTex.width}×${frameTex.height}`);
    } else {
      console.warn('[BaseGameScene] BaseFrame 貼圖未找到，跳過邊框');
    }
  }

  /**
   * 5. 控制面板：WinDisplay / BalanceDisplay / BetSelector / SpinButton
   */
  private async _buildControlPanel(_store: AssetStore): Promise<void> {
    // ── WinDisplay（贏分顯示，轉盤下方中央）─────────────────────
    this._winDisplay = new WinDisplay();
    this._winDisplay.x = W / 2 - 160; // WinDisplay 寬 320，水平置中
    this._winDisplay.y = WIN_DISPLAY_Y; // 1140
    this.addChild(this._winDisplay);
    await this._winDisplay.init();

    // ── BalanceDisplay（餘額，左側）─────────────────────────────
    this._balanceDisplay = new BalanceDisplay(50000);
    this._balanceDisplay.x = W / 2 - 400; // 左側（以畫面中心為基準偏左）
    this._balanceDisplay.y = PANEL_Y; // 1260
    this.addChild(this._balanceDisplay);
    await this._balanceDisplay.init();

    // ── BetSelector（下注選擇，右側）────────────────────────────
    this._betSelector = new BetSelector(
      [10, 20, 50, 100, 200, 500],
      100, // 預設下注 100
    );
    this._betSelector.x = W / 2 + 220; // 右側（以畫面中心為基準偏右）
    this._betSelector.y = PANEL_Y; // 1260
    this.addChild(this._betSelector);
    await this._betSelector.init();

    // ── SpinButton（中央）────────────────────────────────────────
    this._spinButton = new SpinButton();
    this._spinButton.x = W / 2;  // SpinButton 以 (0,0) 為圓心，水平置中
    this._spinButton.y = SPIN_BTN_Y; // 1420
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

    // 清除上一局的特效（Phase E）
    this._winHighlight.clear();
    this._coinEffect.clear();

    // 禁用互動元件
    this._spinButton.setSpinning(true);
    this._betSelector.setEnabled(false);
    this._winDisplay.clear();
    this._setMessage('Spinning...');

    // 立即更新餘額顯示（spin() 已完成扣款，讓玩家即時看到餘額變動）
    this._balanceDisplay.setBalance(this._ctrl.balance);

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
   * 顯示旋轉結果（贏分 / 訊息 / 特效 / 場景切換）
   *
   * Phase E 整合：
   *   - WinHighlight：所有贏線格子高亮
   *   - WinTierOverlay：大獎全螢幕覆蓋（>= 10x bet）
   *   - CoinEffect：大獎金幣噴射
   *   - SceneTransition：觸發 FreeGame / MiniGame 場景切換
   */
  private _showResult(result: SpinResult): void {
    const { wins, totalWin, scatterCount, triggerFreeGame, fortuneBallCount } = result;
    const currentBet = this._ctrl.currentBet;

    if (totalWin > 0) {
      // 啟動跑分動畫
      this._winDisplay.showWin(totalWin);
      const winCount = wins.length;
      this._setMessage(
        `WIN ${totalWin.toLocaleString('en-US')}! (${winCount} way${winCount > 1 ? 's' : ''})`,
      );

      // Phase E: 贏線高亮（顯示所有中獎格子）
      this._winHighlight.showWins(wins);

      // Phase E: 判定大獎等級並觸發對應特效
      const ratio = currentBet > 0 ? totalWin / currentBet : 0;

      if (ratio >= 10) {
        // BIG_WIN 以上：顯示全螢幕覆蓋 + 金幣噴射
        // WinTierOverlay.show() 內部計算等級（15x/50x/100x）
        this._winOverlay.show(totalWin, currentBet);

        // 金幣噴射：從畫面中央偏上方發射
        const coinCount = ratio >= 100 ? 80 : ratio >= 30 ? 50 : 30;
        this._coinEffect.burst(W / 2, REEL_AREA_BOTTOM, coinCount);
      }
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

    // Phase F: FreeGame 場景切換
    if (triggerFreeGame) {
      this._setMessage(`FREE GAME TRIGGERED! (${scatterCount} Scatters)`);
      this._transitionToFreeGame(scatterCount);
    }

    // Phase G: MiniGame 場景切換（Fortune Ball Bonus）
    if (fortuneBallCount >= 6) {
      this._transitionToMiniGame();
    }
  }

  /**
   * 延遲後切換到 FreeGameScene
   *
   * 流程：
   *   1. 等待 1.5 秒讓玩家看到觸發訊息
   *   2. SceneTransition.crossFade 切換場景
   *   3. FreeGameScene emit 'complete' 時切回 BaseGameScene
   */
  private _transitionToFreeGame(scatterCount: number): void {
    setTimeout(async () => {
      const freeScene = new FreeGameScene(this._app);
      await freeScene.init();

      // 交叉淡化切換場景
      await SceneTransition.crossFade(this._app, this, freeScene);

      // 啟動免費遊戲
      freeScene.start(scatterCount);

      // 監聽完成事件：切回 BaseGameScene
      freeScene.on('complete', async () => {
        await SceneTransition.crossFade(this._app, freeScene, this);
        freeScene.destroy();

        // 恢復餘額顯示
        this._balanceDisplay.setBalance(this._ctrl.balance);
      });
    }, 1500);
  }

  /**
   * 延遲後切換到 MiniGameScene（Fortune Ball Bonus）
   */
  private _transitionToMiniGame(): void {
    setTimeout(async () => {
      const miniScene = new MiniGameScene(this._app);
      await miniScene.init();

      await SceneTransition.crossFade(this._app, this, miniScene);
      miniScene.start();

      miniScene.on('complete', async () => {
        await SceneTransition.crossFade(this._app, miniScene, this);
        miniScene.destroy();
        this._balanceDisplay.setBalance(this._ctrl.balance);
      });
    }, 1500);
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
    // Phase E: 清理贏分特效元件
    this._winHighlight?.clear();
    this._coinEffect?.clear();
    this._winOverlay?.dismiss();
    super.destroy({ children: true });
  }
}
