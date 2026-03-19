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
  Graphics,
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

// ─────────────────── EXML 精確版面常數（900×2000 直式畫布，直接使用） ──────────────────

/** 畫布寬度（對齊原版 EXML portrait 解析度） */
const W = 900;
/** 畫布中心 X */
const CENTER_X = 450;

// ── BaseFrame（金色圓框裝飾）── EXML: horizontalCenter=0, y=384, anchor=(448,358)
const FRAME_X = CENTER_X - 448;   // 2
const FRAME_Y = 384 - 358;        // 26

// ── FortuneBall 聚寶盆/金樹 ── EXML: horizontalCenter=0, y=519, anchorOffsetY=226, skin 792×452
const TREE_X = CENTER_X - 396;    // 54 (792/2=396)
const TREE_Y = 519 - 226;         // 293

// ── ReelView ── EXML: horizontalCenter=0, y=971, anchorOffsetY=368, scale=0.75, native 1202×640
const REEL_PIVOT_X = 601;         // 1202/2
const REEL_PIVOT_Y = 368;
const REEL_SCREEN_Y = 971;
const REEL_SCALE = 0.75;

// ── ControlView 底部面板 ── EXML portrait 座標（直接使用）
const PANEL_BG_Y = 1212;          // Ui_Background.png y
const INFO_Y = 1226;              // Balance/Win/Bet 標籤列 y
const BALANCE_X = 4;              // EXML 直接值
const WIN_X = 302;                // EXML 直接值
const BET_X = 600;                // EXML 直接值

// ── 按鈕列 ── EXML portrait 座標（直接使用）
const SPIN_BTN_Y = 1442;          // spinBtnGp y, anchor=(100,100)
const TURBO_X = 51;               // EXML 直接值
const TURBO_Y = 1396;
const AUTO_X = 753;               // EXML 直接值
const AUTO_Y = 1396;

/** 訊息文字 Y（面板下方） */
const MSG_Y = 1560;

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
    // WinHighlight 格子對齊 EXML 符號尺寸 (224×148)，縮放 0.75
    // 轉盤左上角 = (800-601*0.75, 971-368*0.75) = (349, 695)
    const reelScreenX = CENTER_X - REEL_PIVOT_X * REEL_SCALE;
    const reelScreenY = REEL_SCREEN_Y - REEL_PIVOT_Y * REEL_SCALE;
    this._winHighlight = new WinHighlight(
      reelScreenX, reelScreenY,
      224 * REEL_SCALE, 148 * REEL_SCALE,
    );
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
      // Base_BG.jpg 原圖 1600×2000，在 900 寬畫布中置中顯示
      // EXML: horizontalCenter="0" → x = (900 - 1600) / 2 = -350
      bg.x = (W - bgTex.width) / 2;
      bg.y = 0;
      this.addChild(bg);
    } catch {
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
  private _buildLogoArea(_store: AssetStore): void {
    // 原版遊戲畫面中不顯示 Logo（僅在 LoadingScene 中出現）
    // Logo 空間被 JackpotPool + FortuneBall 佔用
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
    // ── 層次（由下到上）：BaseFrame → ReelEngine（含 Base_Reel） ────

    // 1. 邊框裝飾（BaseFrame.png 896×716）— EXML: horizontalCenter=0, y=384
    const frameTex = store.tryGetTexture('BaseFrame_png')
                  ?? store.tryGetTexture('BaseFrame');
    if (frameTex) {
      const frame = new Sprite(frameTex);
      frame.x = FRAME_X;  // 352
      frame.y = FRAME_Y;  // 26
      this.addChild(frame);
    }

    // 2. 聚寶盆/金樹裝飾（TopTree_BG.png 792×452）— EXML: horizontalCenter=0, y=519
    const treeTex = store.tryGetTexture('TopTree_BG_png');
    if (treeTex) {
      const tree = new Sprite(treeTex);
      tree.x = TREE_X;    // 404
      tree.y = TREE_Y;    // 293
      this.addChild(tree);
    }

    // 3. ReelEngine（符號格線 1202×640 native，縮放 0.75x）
    //    EXML: horizontalCenter=0, y=971, anchorOffsetY=368, scale=0.75
    this._reelEngine = new ReelEngine(symbolManager.getTextureMap());
    this._reelEngine.pivot.set(REEL_PIVOT_X, REEL_PIVOT_Y); // (601, 368)
    this._reelEngine.position.set(CENTER_X, REEL_SCREEN_Y);  // (800, 971)
    this._reelEngine.scale.set(REEL_SCALE);                   // 0.75
    this.addChild(this._reelEngine);
  }

  /**
   * 5. 控制面板：WinDisplay / BalanceDisplay / BetSelector / SpinButton
   */
  private async _buildControlPanel(store: AssetStore): Promise<void> {
    // ── 底部面板背景（Ui_Background.png 900×146）── EXML: y=1212
    const panelTex = store.tryGetTexture('Ui_Background_png');
    if (panelTex) {
      const panel = new Sprite(panelTex);
      panel.x = 0;
      panel.y = PANEL_BG_Y;   // 1212
      panel.width = W;         // 900
      panel.height = 146;
      this.addChild(panel);
    }

    // ── BalanceDisplay（餘額，左側）── EXML: x=4, y=1226
    this._balanceDisplay = new BalanceDisplay(50000);
    this._balanceDisplay.x = BALANCE_X; // 354
    this._balanceDisplay.y = INFO_Y;    // 1226
    this.addChild(this._balanceDisplay);
    await this._balanceDisplay.init();

    // ── WinDisplay（贏分，中央）── EXML: x=302, y=1226
    this._winDisplay = new WinDisplay();
    this._winDisplay.x = WIN_X;    // 652
    this._winDisplay.y = INFO_Y;   // 1226
    this.addChild(this._winDisplay);
    await this._winDisplay.init();

    // ── BetSelector（下注，右側）── EXML: x=600, y=1226
    this._betSelector = new BetSelector(
      [10, 20, 50, 100, 200, 500],
      100,
    );
    this._betSelector.x = BET_X;   // 950
    this._betSelector.y = INFO_Y;  // 1226
    this.addChild(this._betSelector);
    await this._betSelector.init();

    // ── SpinButton（中央大按鈕）── EXML: x=450, y=1442, anchor=(100,100)
    this._spinButton = new SpinButton();
    this._spinButton.x = CENTER_X;     // 800
    this._spinButton.y = SPIN_BTN_Y;   // 1442
    this.addChild(this._spinButton);

    // ── Turbo 按鈕（左側）── EXML: x=51, y=1396 → placeholder
    this._buildPlaceholderButton('TURBO', TURBO_X, TURBO_Y, 96, 96, 0x333333);

    // ── Auto 按鈕（右側）── EXML: x=753, y=1396 → placeholder
    this._buildPlaceholderButton('AUTO', AUTO_X, AUTO_Y, 96, 96, 0x333333);
  }

  /**
   * 建立佔位按鈕（尚未有完整圖標時使用）
   */
  private _buildPlaceholderButton(
    label: string, x: number, y: number, w: number, h: number, color: number,
  ): void {
    const btn = new Container();
    const bg = new Graphics();
    bg.roundRect(-w / 2, -h / 2, w, h, 12);
    bg.fill(color);
    bg.stroke({ width: 2, color: 0x666666 });
    btn.addChild(bg);
    const txt = new Text({
      text: label,
      style: new TextStyle({ fontFamily: 'Arial', fontSize: 16, fill: 0xffffff }),
    });
    txt.anchor.set(0.5);
    btn.addChild(txt);
    btn.x = x;
    btn.y = y;
    this.addChild(btn);
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
        this._coinEffect.burst(CENTER_X, 1175, coinCount);
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
