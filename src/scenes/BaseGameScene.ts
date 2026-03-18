/**
 * BaseGameScene — 基礎遊戲場景
 *
 * 整合所有模組的視覺入口：
 * - 5×4 轉盤（簡化版：色塊 + 數字代表符號）
 * - 控制面板（Spin 按鈕、投注、餘額）
 * - 贏分顯示
 * - 狀態機驅動流程
 */
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { IScene } from '@/core/SceneManager';
import { GameController } from '@/core/GameController';
import { PAY_TABLE } from '@/evaluation/PayTable';
import type { SpinResult } from '@/mock/MockServer';
import { GAME_WIDTH, GAME_HEIGHT } from '@/core/GameApp';

/** 符號顏色對照（高額=暖色，低額=冷色） */
const SYMBOL_COLORS: readonly number[] = [
  0xff4444, // 0: CaiShen（紅）
  0xffaa00, // 1: GoldIngot（金）
  0xff6600, // 2: Fan（橘）
  0xcc3333, // 3: Seal（深紅）
  0x8b4513, // 4: Scroll（棕）
  0x4488ff, // 5: A（藍）
  0x44aaff, // 6: K（淺藍）
  0x44ccaa, // 7: Q（青）
  0x66cc66, // 8: J（綠）
  0x888888, // 9: 10（灰）
  0x666666, // 10: 9（深灰）
  0xddaa00, // 11: Coin（金幣色）
  0xff00ff, // 12: FortuneBall（紫）
  0x00ff00, // 13: Wild（亮綠）
  0xffff00, // 14: Scatter（黃）
];

/** 格線配置 */
const GRID_COLS = 5;
const GRID_ROWS = 4;
const CELL_WIDTH = 150;
const CELL_HEIGHT = 150;
const GRID_LEFT = (GAME_WIDTH - GRID_COLS * CELL_WIDTH) / 2;
const GRID_TOP = 250;
const CELL_GAP = 4;

export class BaseGameScene implements IScene {
  readonly name = 'BaseGame';
  readonly container = new Container();

  private readonly ctrl: GameController;
  // fsm 將在 DEV-7 整合轉盤動畫時驅動狀態轉換

  // UI 元素
  private readonly cellGraphics: Graphics[][] = [];
  private readonly cellTexts: Text[][] = [];
  private balanceText!: Text;
  private betText!: Text;
  private winText!: Text;
  private spinButton!: Container;
  private spinButtonBg!: Graphics;
  private messageText!: Text;
  private _spinning = false;

  constructor(seed?: number) {
    this.ctrl = new GameController({
      initialBalance: 50000,
      betOptions: [10, 20, 50, 100, 200, 500],
      defaultBetIndex: 3,
      seed,
    });
  }

  async enter(): Promise<void> {
    this.buildBackground();
    this.buildGrid();
    this.buildControlPanel();
    this.buildWinDisplay();
    this.buildTitle();
  }

  update(_delta: number): void {
    // 未來用於轉盤動畫更新
  }

  async exit(): Promise<void> {
    this.container.removeChildren();
  }

  // === UI 建構 ===

  private buildBackground(): void {
    const bg = new Graphics();
    bg.rect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.fill(0x1a0a2e);
    this.container.addChild(bg);

    // 轉盤區域背景
    const reelBg = new Graphics();
    reelBg.rect(
      GRID_LEFT - 10,
      GRID_TOP - 10,
      GRID_COLS * CELL_WIDTH + 20,
      GRID_ROWS * CELL_HEIGHT + 20,
    );
    reelBg.fill(0x0d0520);
    this.container.addChild(reelBg);
  }

  private buildGrid(): void {
    const style = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 20,
      fill: 0xffffff,
      fontWeight: 'bold',
      align: 'center',
    });

    for (let c = 0; c < GRID_COLS; c++) {
      this.cellGraphics[c] = [];
      this.cellTexts[c] = [];
      for (let r = 0; r < GRID_ROWS; r++) {
        const x = GRID_LEFT + c * CELL_WIDTH + CELL_GAP / 2;
        const y = GRID_TOP + r * CELL_HEIGHT + CELL_GAP / 2;
        const w = CELL_WIDTH - CELL_GAP;
        const h = CELL_HEIGHT - CELL_GAP;

        // 符號色塊
        const g = new Graphics();
        g.roundRect(x, y, w, h, 8);
        g.fill(0x333333);
        this.container.addChild(g);
        this.cellGraphics[c][r] = g;

        // 符號名稱
        const t = new Text({ text: '?', style });
        t.anchor.set(0.5);
        t.x = x + w / 2;
        t.y = y + h / 2;
        this.container.addChild(t);
        this.cellTexts[c][r] = t;
      }
    }
  }

  private buildControlPanel(): void {
    const panelY = GRID_TOP + GRID_ROWS * CELL_HEIGHT + 40;
    const labelStyle = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 24,
      fill: 0xcccccc,
    });
    const valueStyle = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 32,
      fill: 0xffffff,
      fontWeight: 'bold',
    });

    // 餘額
    const balLabel = new Text({ text: 'BALANCE', style: labelStyle });
    balLabel.x = 50;
    balLabel.y = panelY;
    this.container.addChild(balLabel);

    this.balanceText = new Text({
      text: this.ctrl.balance.toLocaleString(),
      style: valueStyle,
    });
    this.balanceText.x = 50;
    this.balanceText.y = panelY + 30;
    this.container.addChild(this.balanceText);

    // 投注
    const betLabel = new Text({ text: 'BET', style: labelStyle });
    betLabel.x = 350;
    betLabel.y = panelY;
    this.container.addChild(betLabel);

    this.betText = new Text({
      text: this.ctrl.currentBet.toString(),
      style: valueStyle,
    });
    this.betText.x = 350;
    this.betText.y = panelY + 30;
    this.container.addChild(this.betText);

    // 投注 ＋/－ 按鈕
    this.buildBetButton('-', 300, panelY + 30, () => {
      if (!this._spinning) {
        this.ctrl.decreaseBet();
        this.betText.text = this.ctrl.currentBet.toString();
      }
    });
    this.buildBetButton('+', 450, panelY + 30, () => {
      if (!this._spinning) {
        this.ctrl.increaseBet();
        this.betText.text = this.ctrl.currentBet.toString();
      }
    });

    // SPIN 按鈕
    this.spinButton = new Container();
    this.spinButton.x = GAME_WIDTH / 2;
    this.spinButton.y = panelY + 130;
    this.spinButton.eventMode = 'static';
    this.spinButton.cursor = 'pointer';

    this.spinButtonBg = new Graphics();
    this.spinButtonBg.circle(0, 0, 60);
    this.spinButtonBg.fill(0x00cc44);
    this.spinButton.addChild(this.spinButtonBg);

    const spinLabel = new Text({
      text: 'SPIN',
      style: new TextStyle({
        fontFamily: 'Arial',
        fontSize: 28,
        fill: 0xffffff,
        fontWeight: 'bold',
      }),
    });
    spinLabel.anchor.set(0.5);
    this.spinButton.addChild(spinLabel);

    this.spinButton.on('pointerdown', () => this.onSpinClick());
    this.container.addChild(this.spinButton);

    // 訊息列
    this.messageText = new Text({
      text: 'Press SPIN to play!',
      style: new TextStyle({
        fontFamily: 'Arial',
        fontSize: 22,
        fill: 0xffcc00,
        align: 'center',
      }),
    });
    this.messageText.anchor.set(0.5, 0);
    this.messageText.x = GAME_WIDTH / 2;
    this.messageText.y = panelY + 210;
    this.container.addChild(this.messageText);
  }

  private buildBetButton(label: string, x: number, y: number, onClick: () => void): void {
    const btn = new Container();
    btn.x = x;
    btn.y = y;
    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    const bg = new Graphics();
    bg.roundRect(-20, -5, 40, 40, 6);
    bg.fill(0x555555);
    btn.addChild(bg);

    const txt = new Text({
      text: label,
      style: new TextStyle({ fontFamily: 'Arial', fontSize: 28, fill: 0xffffff }),
    });
    txt.anchor.set(0.5);
    txt.y = 15;
    btn.addChild(txt);

    btn.on('pointerdown', onClick);
    this.container.addChild(btn);
  }

  private buildWinDisplay(): void {
    const winStyle = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 48,
      fill: 0xffdd00,
      fontWeight: 'bold',
      align: 'center',
      dropShadow: {
        color: 0x000000,
        blur: 4,
        distance: 2,
        angle: Math.PI / 4,
      },
    });

    this.winText = new Text({ text: '', style: winStyle });
    this.winText.anchor.set(0.5);
    this.winText.x = GAME_WIDTH / 2;
    this.winText.y = GRID_TOP - 50;
    this.container.addChild(this.winText);
  }

  private buildTitle(): void {
    const titleStyle = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 40,
      fill: 0xffcc00,
      fontWeight: 'bold',
      dropShadow: {
        color: 0x000000,
        blur: 6,
        distance: 3,
        angle: Math.PI / 4,
      },
    });
    const title = new Text({ text: '⚡ POWER FORTUNE ⚡', style: titleStyle });
    title.anchor.set(0.5);
    title.x = GAME_WIDTH / 2;
    title.y = 60;
    this.container.addChild(title);

    // 副標題
    const subStyle = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 20,
      fill: 0xaaaaaa,
    });
    const sub = new Text({ text: '財神報喜 — 1024 Ways to Win', style: subStyle });
    sub.anchor.set(0.5);
    sub.x = GAME_WIDTH / 2;
    sub.y = 110;
    this.container.addChild(sub);
  }

  // === 遊戲邏輯 ===

  private onSpinClick(): void {
    if (this._spinning) return;

    // 嘗試旋轉
    this._spinning = true;
    this.spinButtonBg.clear();
    this.spinButtonBg.circle(0, 0, 60);
    this.spinButtonBg.fill(0x666666); // 灰色表示禁用

    this.winText.text = '';
    this.messageText.text = 'Spinning...';

    // 模擬短暫延遲後顯示結果（模擬轉盤動畫時間）
    setTimeout(() => {
      const result = this.ctrl.spin();
      if (result) {
        this.showResult(result);
      } else {
        this.messageText.text = 'Insufficient balance!';
      }

      // 恢復按鈕
      this._spinning = false;
      this.spinButtonBg.clear();
      this.spinButtonBg.circle(0, 0, 60);
      this.spinButtonBg.fill(0x00cc44);

      // 更新餘額
      this.balanceText.text = this.ctrl.balance.toLocaleString();
    }, 500);
  }

  private showResult(result: SpinResult): void {
    const { gridResult, wins, totalWin, scatterCount, triggerFreeGame } = result;

    // 更新格線顯示
    for (let c = 0; c < GRID_COLS; c++) {
      for (let r = 0; r < GRID_ROWS; r++) {
        const symId = gridResult.grid[c][r];
        const color = SYMBOL_COLORS[symId] ?? 0x333333;
        const name = PAY_TABLE[symId]?.name ?? '?';

        // 重繪色塊
        const x = GRID_LEFT + c * CELL_WIDTH + CELL_GAP / 2;
        const y = GRID_TOP + r * CELL_HEIGHT + CELL_GAP / 2;
        const w = CELL_WIDTH - CELL_GAP;
        const h = CELL_HEIGHT - CELL_GAP;

        const g = this.cellGraphics[c][r];
        g.clear();
        g.roundRect(x, y, w, h, 8);
        g.fill(color);

        // 更新名稱
        this.cellTexts[c][r].text = name;
      }
    }

    // 顯示贏分
    if (totalWin > 0) {
      this.winText.text = `WIN: ${totalWin.toLocaleString()}`;
      const winCount = wins.length;
      this.messageText.text = `${winCount} winning way${winCount > 1 ? 's' : ''}!`;
    } else {
      this.winText.text = '';
      this.messageText.text = 'No win. Try again!';
    }

    // Scatter 提示
    if (scatterCount >= 2) {
      this.messageText.text += ` (${scatterCount} Scatter${scatterCount > 1 ? 's' : ''})`;
    }
    if (triggerFreeGame) {
      this.messageText.text = `🎉 FREE GAME TRIGGERED! (${scatterCount} Scatters)`;
    }
  }
}
