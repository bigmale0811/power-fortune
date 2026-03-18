/**
 * MiniGameScene — 小遊戲場景（Fortune Ball Bonus）
 *
 * 版面配置（900×1600 直向）：
 *   Y=0   ~ 200 : 標題「FORTUNE BALL BONUS」
 *   Y=200 ~ 400 : 頭獎等級顯示（Grand / Major / Minor / Mini 金額）
 *   Y=400 ~ 500 : 已揭示球型顯示（圖示區）
 *   Y=500 ~ 900 : 三扇門選擇區
 *   Y=900 ~ 1100: 球型揭示動畫區
 *   Y=1100~ 1600: 底部 / 結算區
 *
 * 流程：
 *   1. start() 被呼叫，觸發 MiniGameController
 *   2. 玩家點擊三扇門之一 → chooseDoor(index) → 揭示球型
 *   3. 已揭示球列在 Y=400~500 更新
 *   4. 若達到結算條件（3 顆相同），顯示彩金遮罩
 *   5. emit 'complete' with { prizeAmount: number }
 *
 * 球型顏色：
 *   Grand  = 0xffd700（金色）
 *   Major  = 0x4488ff（藍色）
 *   Minor  = 0x44cc44（綠色）
 *   Mini   = 0xaaaaaa（銀色）
 *   Wild   = 0xff44ff（彩色/洋紅）
 *   Coin   = 0xffaa00（黃色）
 */

import {
  Application,
  Container,
  Graphics,
  Text,
  TextStyle,
  Sprite,
} from 'pixi.js';
import { AssetStore } from '@/assets/AssetStore';
import { MiniGameController, BallType, SettlementResult } from '@/features/MiniGameController';

// ─────────────────────── 版面常數 ───────────────────────

/** 畫布寬度 */
const W = 900;

/** 標題區高度 */
const TITLE_H = 200;

/** 頭獎等級區高度 */
const JACKPOT_TIER_H = 200;

/** 已揭示球型區頂部 Y */
const REVEALED_AREA_TOP = TITLE_H + JACKPOT_TIER_H; // 400

/** 已揭示球型區高度 */
const REVEALED_AREA_H = 100;

/** 三扇門選擇區頂部 Y */
const DOORS_AREA_TOP = REVEALED_AREA_TOP + REVEALED_AREA_H; // 500

/** 三扇門選擇區高度 */
const DOORS_AREA_H = 400;

/** 球型揭示區頂部 Y */
const REVEAL_AREA_TOP = DOORS_AREA_TOP + DOORS_AREA_H; // 900


// ─────────────────────── 顏色常數 ───────────────────────

const COLOR_BG_FALLBACK  = 0x0a2a0a; // 深綠（背景備用）
const COLOR_TITLE_BG     = 0x001800; // 標題背景
const COLOR_DOOR_IDLE    = 0x5a3010; // 門（未選中）
const COLOR_DOOR_HOVER   = 0x8a5020; // 門（懸停）
const COLOR_DOOR_OPEN    = 0x2a1a08; // 門（已開啟）
const COLOR_OVERLAY_BG   = 0x000000; // 結算遮罩背景

/** 各級頭獎底色 */
const JACKPOT_COLORS: Readonly<Record<string, number>> = {
  Grand: 0xffd700,
  Major: 0x4488ff,
  Minor: 0x44cc44,
  Mini:  0xaaaaaa,
};

/** 各球型顏色 */
const BALL_COLORS: Readonly<Record<BallType, number>> = {
  Grand: 0xffd700,
  Major: 0x4488ff,
  Minor: 0x44cc44,
  Mini:  0xaaaaaa,
  Wild:  0xff44ff,
  Coin:  0xffaa00,
};

/** 各級頭獎獎金倍率（×bet=100） */
const PRIZE_DISPLAY: Readonly<Record<string, string>> = {
  Grand: '100,000',
  Major: '20,000',
  Minor: '5,000',
  Mini:  '1,000',
};

/** 球型半徑（揭示動畫用） */
const BALL_RADIUS = 36;

/** 門寬度 */
const DOOR_W = 200;
/** 門高度 */
const DOOR_H = 300;
/** 門間距 */
const DOOR_GAP = 50;

// ─────────────────────── MiniGameScene ───────────────────────

export class MiniGameScene extends Container {
  // PixiJS Application
  private readonly _app: Application;
  get app(): Application { return this._app; }

  // 核心控制器
  private _ctrl!: MiniGameController;

  // 已揭示球型顯示容器（動態更新）
  private _revealedContainer!: Container;

  // 三扇門 Graphics 陣列
  private _doorGraphics: Graphics[] = [];
  private _doorLabels: Text[] = [];
  private _doorIsOpen: boolean[] = [false, false, false];

  // 球型揭示區
  private _revealBallGraphic!: Graphics;
  private _revealBallText!: Text;

  // 結算遮罩與文字
  private _prizeOverlay!: Graphics;
  private _prizeTierText!: Text;
  private _prizeAmountText!: Text;

  // 互動鎖（揭示動畫進行中禁止點擊）
  private _isRevealing = false;

  // ─────────────────────── 建構子 ───────────────────────

  constructor(app: Application) {
    super();
    this._app = app;
  }

  // ─────────────────────── 公開 API ───────────────────────

  /**
   * 非同步初始化：建立所有子元件
   */
  async init(): Promise<void> {
    const store = AssetStore.instance;

    // 1. 背景
    this._buildBackground(store);

    // 2. 標題區（Y=0~200）
    this._buildTitleArea();

    // 3. 頭獎等級顯示（Y=200~400）
    this._buildJackpotTierArea();

    // 4. 已揭示球型顯示區（Y=400~500）
    this._buildRevealedArea();

    // 5. 三扇門選擇區（Y=500~900）
    this._buildDoorsArea();

    // 6. 球型揭示動畫區（Y=900~1100）
    this._buildBallRevealArea();

    // 7. 結算遮罩（初始隱藏）
    this._buildPrizeOverlay();

    // 8. 初始化控制器（bet=100，門選後觸發結算）
    this._ctrl = new MiniGameController(undefined, 100);
  }

  /**
   * 啟動小遊戲
   * 必須在 MiniGameController.canTrigger === true 時呼叫
   * 呼叫前需確認 addBalls 已累計 ≥6
   */
  start(): void {
    // 強制觸發（若 collectedBalls 不足，controller 內部會靜默略過）
    // 由場景管理器確保調用時機正確
    this._ctrl.trigger();

    // 重置 UI 狀態
    this._resetDoorsUI();
    this._clearRevealedDisplay();
    this._clearBallReveal();
    this._prizeOverlay.visible = false;
    this._prizeTierText.visible = false;
    this._prizeAmountText.visible = false;
  }

  override destroy(): void {
    super.destroy({ children: true });
  }

  // ─────────────────────── 私有：UI 建構 ───────────────────────

  /**
   * 1. 全畫面背景
   *    嘗試 Mini_BG 貼圖，失敗則深綠 Graphics fallback
   */
  private _buildBackground(store: AssetStore): void {
    const bgTex = store.tryGetTexture('Mini_BG')
               ?? store.tryGetTexture('Mini_BG_png');

    if (bgTex) {
      const bg = new Sprite(bgTex);
      bg.width  = W;
      bg.height = 1600;
      bg.x = 0;
      bg.y = 0;
      this.addChild(bg);
    } else {
      // 深綠 fallback
      const bg = new Graphics();
      bg.rect(0, 0, W, 1600).fill({ color: COLOR_BG_FALLBACK });
      this.addChild(bg);
    }
  }

  /**
   * 2. 標題區（Y=0~200）
   *    「FORTUNE BALL BONUS」大標題
   */
  private _buildTitleArea(): void {
    // 標題背景
    const titleBg = new Graphics();
    titleBg.rect(0, 0, W, TITLE_H).fill({ color: COLOR_TITLE_BG });
    this.addChild(titleBg);

    // 主標題文字
    const titleText = new Text({
      text: 'FORTUNE BALL BONUS',
      style: new TextStyle({
        fontFamily: 'Arial Black',
        fontSize: 44,
        fontWeight: 'bold',
        fill: 0xffd700,
        align: 'center',
        dropShadow: {
          color: 0x004400,
          blur: 12,
          distance: 4,
          angle: Math.PI / 4,
        },
        stroke: { color: 0x005500, width: 2 },
      }),
    });
    titleText.anchor.set(0.5, 0.5);
    titleText.x = W / 2;
    titleText.y = TITLE_H * 0.4;
    this.addChild(titleText);

    // 副標題
    const subTitle = new Text({
      text: '選擇一扇門揭示你的彩球！',
      style: new TextStyle({
        fontFamily: 'Arial',
        fontSize: 22,
        fill: 0xaaffaa,
        align: 'center',
      }),
    });
    subTitle.anchor.set(0.5, 0);
    subTitle.x = W / 2;
    subTitle.y = TITLE_H * 0.65;
    this.addChild(subTitle);
  }

  /**
   * 3. 頭獎等級顯示（Y=200~400）
   *    四個方塊橫向排列，顯示 Grand / Major / Minor / Mini 金額
   */
  private _buildJackpotTierArea(): void {
    const tiers = ['Grand', 'Major', 'Minor', 'Mini'] as const;
    const tierW = W / tiers.length; // 225px 每個

    tiers.forEach((tier, i) => {
      const x = i * tierW;
      const y = TITLE_H;

      // 方塊背景
      const tierBg = new Graphics();
      tierBg.rect(x + 4, y + 4, tierW - 8, JACKPOT_TIER_H - 8)
        .fill({ color: 0x001a00 });
      tierBg.roundRect(x + 4, y + 4, tierW - 8, JACKPOT_TIER_H - 8, 10)
        .stroke({ color: JACKPOT_COLORS[tier] ?? 0xffffff, width: 2 });
      this.addChild(tierBg);

      // 等級名稱
      const tierLabel = new Text({
        text: tier.toUpperCase(),
        style: new TextStyle({
          fontFamily: 'Arial Black',
          fontSize: 20,
          fontWeight: 'bold',
          fill: JACKPOT_COLORS[tier] ?? 0xffffff,
          align: 'center',
        }),
      });
      tierLabel.anchor.set(0.5, 0);
      tierLabel.x = x + tierW / 2;
      tierLabel.y = y + 12;
      this.addChild(tierLabel);

      // 金額
      const amountText = new Text({
        text: PRIZE_DISPLAY[tier] ?? '—',
        style: new TextStyle({
          fontFamily: 'Arial Black',
          fontSize: 28,
          fontWeight: 'bold',
          fill: 0xffffff,
          align: 'center',
        }),
      });
      amountText.anchor.set(0.5, 0.5);
      amountText.x = x + tierW / 2;
      amountText.y = y + JACKPOT_TIER_H / 2 + 20;
      this.addChild(amountText);
    });
  }

  /**
   * 4. 已揭示球型顯示區（Y=400~500）
   *    動態更新的圓圈圖示，顯示每輪已揭示的球型
   */
  private _buildRevealedArea(): void {
    // 區域背景
    const areaBg = new Graphics();
    areaBg.rect(0, REVEALED_AREA_TOP, W, REVEALED_AREA_H)
      .fill({ color: 0x001000 });
    this.addChild(areaBg);

    // 標籤
    const label = new Text({
      text: '已揭示：',
      style: new TextStyle({
        fontFamily: 'Arial',
        fontSize: 18,
        fill: 0x88aa88,
        align: 'left',
      }),
    });
    label.x = 20;
    label.y = REVEALED_AREA_TOP + 10;
    this.addChild(label);

    // 動態容器（球型圖示放入此容器）
    this._revealedContainer = new Container();
    this._revealedContainer.x = 120;
    this._revealedContainer.y = REVEALED_AREA_TOP + 8;
    this.addChild(this._revealedContainer);
  }

  /**
   * 5. 三扇門選擇區（Y=500~900）
   *    三個木門按鈕，側邊排列，帶「?」文字
   */
  private _buildDoorsArea(): void {
    // 區域背景
    const doorsBg = new Graphics();
    doorsBg.rect(0, DOORS_AREA_TOP, W, DOORS_AREA_H)
      .fill({ color: 0x0d1a0d });
    this.addChild(doorsBg);

    // 計算三扇門的水平起始位置（置中）
    const totalDoorsW = 3 * DOOR_W + 2 * DOOR_GAP;
    const startX = (W - totalDoorsW) / 2;
    const doorY  = DOORS_AREA_TOP + (DOORS_AREA_H - DOOR_H) / 2;

    this._doorGraphics = [];
    this._doorLabels   = [];
    this._doorIsOpen   = [false, false, false];

    for (let i = 0; i < 3; i++) {
      const x = startX + i * (DOOR_W + DOOR_GAP);

      // 門 Graphics
      const door = new Graphics();
      this._drawDoor(door, COLOR_DOOR_IDLE);
      door.x = x;
      door.y = doorY;
      door.interactive = true;
      door.cursor = 'pointer';
      door.on('pointerover', () => {
        if (!this._doorIsOpen[i] && !this._isRevealing) {
          this._drawDoor(door, COLOR_DOOR_HOVER);
        }
      });
      door.on('pointerout', () => {
        if (!this._doorIsOpen[i] && !this._isRevealing) {
          this._drawDoor(door, COLOR_DOOR_IDLE);
        }
      });
      door.on('pointerup', () => this._onDoorClick(i));
      this.addChild(door);
      this._doorGraphics.push(door);

      // 門面「?」標籤
      const questionMark = new Text({
        text: '?',
        style: new TextStyle({
          fontFamily: 'Arial Black',
          fontSize: 80,
          fontWeight: 'bold',
          fill: 0xfff0cc,
          align: 'center',
        }),
      });
      questionMark.anchor.set(0.5, 0.5);
      questionMark.x = x + DOOR_W / 2;
      questionMark.y = doorY + DOOR_H / 2;
      this.addChild(questionMark);
      this._doorLabels.push(questionMark);
    }
  }

  /**
   * 繪製門的 Graphics 外觀
   * @param g     目標 Graphics 物件
   * @param color 填色（根據門狀態）
   */
  private _drawDoor(g: Graphics, color: number): void {
    g.clear();
    // 門框
    g.roundRect(0, 0, DOOR_W, DOOR_H, 12)
      .fill({ color: color });
    // 門框邊線
    g.roundRect(0, 0, DOOR_W, DOOR_H, 12)
      .stroke({ color: 0xcc8844, width: 4 });
    // 門把手（小圓）
    g.circle(DOOR_W * 0.75, DOOR_H / 2, 8)
      .fill({ color: 0xffd700 });
  }

  /**
   * 6. 球型揭示動畫區（Y=900~1100）
   *    大圓圈 + 球型名稱文字
   */
  private _buildBallRevealArea(): void {
    // 區域背景
    const revealBg = new Graphics();
    revealBg.rect(0, REVEAL_AREA_TOP, W, 200)
      .fill({ color: 0x050e05 });
    this.addChild(revealBg);

    // 揭示球圓圈（初始隱藏）
    this._revealBallGraphic = new Graphics();
    this._revealBallGraphic.visible = false;
    this.addChild(this._revealBallGraphic);

    // 球型名稱（初始隱藏）
    this._revealBallText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'Arial Black',
        fontSize: 36,
        fontWeight: 'bold',
        fill: 0xffffff,
        align: 'center',
      }),
    });
    this._revealBallText.anchor.set(0.5, 0.5);
    this._revealBallText.x = W / 2;
    this._revealBallText.y = REVEAL_AREA_TOP + 100;
    this._revealBallText.visible = false;
    this.addChild(this._revealBallText);
  }

  /**
   * 7. 彩金結算遮罩（半透明黑色 + 獎級 + 金額文字）
   */
  private _buildPrizeOverlay(): void {
    // 半透明黑色遮罩
    this._prizeOverlay = new Graphics();
    this._prizeOverlay.rect(0, 0, W, 1600)
      .fill({ color: COLOR_OVERLAY_BG, alpha: 0.8 });
    this._prizeOverlay.visible = false;
    this.addChild(this._prizeOverlay);

    // 彩金等級文字
    this._prizeTierText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'Arial Black',
        fontSize: 56,
        fontWeight: 'bold',
        fill: 0xffd700,
        align: 'center',
        dropShadow: {
          color: 0x442200,
          blur: 16,
          distance: 5,
          angle: Math.PI / 4,
        },
      }),
    });
    this._prizeTierText.anchor.set(0.5, 0.5);
    this._prizeTierText.x = W / 2;
    this._prizeTierText.y = 700;
    this._prizeTierText.visible = false;
    this.addChild(this._prizeTierText);

    // 彩金金額文字
    this._prizeAmountText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'Arial Black',
        fontSize: 72,
        fontWeight: 'bold',
        fill: 0xffffff,
        align: 'center',
        stroke: { color: 0x4a3000, width: 3 },
      }),
    });
    this._prizeAmountText.anchor.set(0.5, 0.5);
    this._prizeAmountText.x = W / 2;
    this._prizeAmountText.y = 820;
    this._prizeAmountText.visible = false;
    this.addChild(this._prizeAmountText);
  }

  // ─────────────────────── 私有：互動邏輯 ───────────────────────

  /**
   * 玩家點擊門的回呼
   * @param doorIndex 門號 0-2
   */
  private _onDoorClick(doorIndex: number): void {
    // 揭示中或已開啟則忽略
    if (this._isRevealing || this._doorIsOpen[doorIndex]) return;
    if (!this._ctrl.isActive || this._ctrl.isSettled) return;

    this._isRevealing = true;

    // 標記門為已開啟
    this._doorIsOpen[doorIndex] = true;

    // 向控制器取得球型結果
    const ballType = this._ctrl.chooseDoor(doorIndex);

    // 播放門開啟視覺（改變顏色 + 隱藏「?」）
    const door = this._doorGraphics[doorIndex];
    this._drawDoor(door, COLOR_DOOR_OPEN);
    door.interactive = false;
    this._doorLabels[doorIndex].visible = false;

    // 在門中心顯示揭示球
    this._showBallOnDoor(doorIndex, ballType);

    // 在揭示區顯示大球動畫
    this._showBallReveal(ballType);

    // 更新已揭示球型清單
    this._updateRevealedDisplay(this._ctrl.revealedBalls);

    // 短暫延遲後解鎖（允許繼續選門）
    setTimeout(() => {
      this._isRevealing = false;

      // 檢查是否已結算
      if (this._ctrl.isSettled && this._ctrl.settlementResult) {
        this._onSettlement(this._ctrl.settlementResult);
      }
    }, 800);
  }

  /**
   * 在指定門的中央顯示彩球（替代「?」）
   * @param doorIndex 門號
   * @param ballType  球型
   */
  private _showBallOnDoor(doorIndex: number, ballType: BallType): void {
    const door = this._doorGraphics[doorIndex];
    const ballColor = BALL_COLORS[ballType];

    // 在門容器的中心繪製小球
    const ballG = new Graphics();
    ballG.circle(DOOR_W / 2, DOOR_H / 2, BALL_RADIUS)
      .fill({ color: ballColor });
    ballG.circle(DOOR_W / 2, DOOR_H / 2, BALL_RADIUS)
      .stroke({ color: 0xffffff, width: 2 });
    door.addChild(ballG);

    // 球型文字標籤（小字）
    const label = new Text({
      text: ballType,
      style: new TextStyle({
        fontFamily: 'Arial Black',
        fontSize: 16,
        fill: 0xffffff,
        align: 'center',
      }),
    });
    label.anchor.set(0.5, 0.5);
    label.x = DOOR_W / 2;
    label.y = DOOR_H / 2;
    door.addChild(label);
  }

  /**
   * 在揭示區（Y=900~1100）顯示大球與球型名稱
   * @param ballType 揭示的球型
   */
  private _showBallReveal(ballType: BallType): void {
    const ballColor = BALL_COLORS[ballType];
    const cx = W / 2;
    const cy = REVEAL_AREA_TOP + 100;

    // 繪製大圓
    this._revealBallGraphic.clear();
    this._revealBallGraphic.circle(cx, cy, BALL_RADIUS * 1.6)
      .fill({ color: ballColor });
    this._revealBallGraphic.circle(cx, cy, BALL_RADIUS * 1.6)
      .stroke({ color: 0xffffff, width: 3 });
    this._revealBallGraphic.visible = true;

    // 更新球型文字
    this._revealBallText.text = ballType.toUpperCase();
    this._revealBallText.style.fill = ballColor;
    this._revealBallText.visible = true;
  }

  /**
   * 清除揭示動畫區
   */
  private _clearBallReveal(): void {
    this._revealBallGraphic.clear();
    this._revealBallGraphic.visible = false;
    this._revealBallText.visible    = false;
  }

  /**
   * 更新已揭示球型圖示列表
   * @param balls 目前已揭示的所有球型
   */
  private _updateRevealedDisplay(balls: readonly BallType[]): void {
    // 清空容器後重新繪製
    this._revealedContainer.removeChildren();

    const ballSize = 36; // 小球直徑
    const gap      = 10;

    balls.forEach((ballType, i) => {
      const ballColor = BALL_COLORS[ballType];
      const cx = i * (ballSize + gap) + ballSize / 2;
      const cy = (REVEALED_AREA_H - 20) / 2;

      const g = new Graphics();
      g.circle(cx, cy, ballSize / 2).fill({ color: ballColor });
      g.circle(cx, cy, ballSize / 2).stroke({ color: 0xffffff, width: 1 });
      this._revealedContainer.addChild(g);

      // 小字標籤
      const label = new Text({
        text: ballType.substring(0, 2).toUpperCase(),
        style: new TextStyle({
          fontFamily: 'Arial',
          fontSize: 10,
          fill: 0xffffff,
          align: 'center',
        }),
      });
      label.anchor.set(0.5, 0.5);
      label.x = cx;
      label.y = cy;
      this._revealedContainer.addChild(label);
    });
  }

  /**
   * 清除已揭示球型顯示
   */
  private _clearRevealedDisplay(): void {
    this._revealedContainer.removeChildren();
  }

  /**
   * 重置三扇門視覺狀態（恢復為初始「?」門外觀）
   */
  private _resetDoorsUI(): void {
    this._doorGraphics.forEach((door, i) => {
      // 清除門上的子元件（揭示球等）
      door.removeChildren();
      this._drawDoor(door, COLOR_DOOR_IDLE);
      door.interactive = true;
      door.cursor = 'pointer';
      this._doorIsOpen[i] = false;
    });

    // 恢復「?」標籤可見性
    this._doorLabels.forEach((label) => {
      label.visible = true;
    });
  }

  // ─────────────────────── 私有：結算邏輯 ───────────────────────

  /**
   * 顯示彩金結算遮罩
   * @param result 結算結果（prizeTier / prizeAmount / revealedBalls）
   */
  private _onSettlement(result: SettlementResult): void {
    const { prizeTier, prizeAmount } = result;
    const tierColor = BALL_COLORS[prizeTier] ?? 0xffd700;

    // 顯示遮罩
    this._prizeOverlay.visible = true;

    // 設定等級文字
    this._prizeTierText.text  = `${prizeTier.toUpperCase()} JACKPOT!`;
    this._prizeTierText.style.fill = tierColor;
    this._prizeTierText.visible = true;

    // 設定金額文字
    this._prizeAmountText.text  = `+${prizeAmount.toLocaleString()}`;
    this._prizeAmountText.visible = true;

    // 3 秒後 emit 'complete' 事件
    setTimeout(() => {
      this.emit('complete', { prizeAmount });
    }, 3000);
  }
}
