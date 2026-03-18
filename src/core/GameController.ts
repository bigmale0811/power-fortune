/**
 * GameController — 遊戲控制器（UI 與引擎的中樞）
 *
 * 職責：
 * 1. 管理餘額與投注額
 * 2. 驅動 spin 流程（扣款 → MockServer → 賠付 → 加款）
 * 3. 管理自動旋轉
 * 4. 暴露唯讀狀態給 UI 層
 */
import { MockServer } from '@/mock/MockServer';
import { BASE_SYMBOLS, SCATTER_ID, FORTUNE_BALL_ID } from '@/core/constants';
import type { SpinResult } from '@/core/constants';
import { evaluateWays } from '@/evaluation/WaysEvaluator';

export interface GameControllerConfig {
  readonly initialBalance: number;
  readonly betOptions: readonly number[];
  readonly defaultBetIndex: number;
  readonly seed?: number;
}

export class GameController {
  private _balance: number;
  private readonly _betOptions: readonly number[];
  private _betIndex: number;
  private readonly server: MockServer;
  private _lastResult: SpinResult | null = null;
  private _spinCount = 0;
  private _autoSpinRemaining = 0;
  private _isAutoSpinning = false;

  constructor(config: GameControllerConfig) {
    this._balance = config.initialBalance;
    this._betOptions = config.betOptions;
    this._betIndex = config.defaultBetIndex;
    // seed 傳給 MockServer 以產生可重現的格線
    this.server = new MockServer(config.seed, this.currentBet);
  }

  // === 唯讀狀態 ===

  get balance(): number {
    return this._balance;
  }

  get currentBet(): number {
    return this._betOptions[this._betIndex];
  }

  get lastResult(): SpinResult | null {
    return this._lastResult;
  }

  get spinCount(): number {
    return this._spinCount;
  }

  get autoSpinRemaining(): number {
    return this._autoSpinRemaining;
  }

  get isAutoSpinning(): boolean {
    return this._isAutoSpinning;
  }

  // === 投注管理 ===

  /** 提高一檔投注 */
  increaseBet(): void {
    if (this._betIndex < this._betOptions.length - 1) {
      this._betIndex++;
    }
  }

  /** 降低一檔投注 */
  decreaseBet(): void {
    if (this._betIndex > 0) {
      this._betIndex--;
    }
  }

  // === 旋轉流程 ===

  /**
   * 執行一次旋轉
   * @returns SpinResult 或 null（餘額不足時）
   */
  spin(): SpinResult | null {
    const bet = this.currentBet;

    // 餘額檢查
    if (this._balance < bet) {
      return null;
    }

    // 扣款
    this._balance -= bet;

    // 產生格線
    const gridResult = this.server.generateGrid(BASE_SYMBOLS, 5, 4);

    // 賠付計算（使用當前 bet，而非 MockServer 建構時的 bet）
    const wins = evaluateWays(gridResult, bet);
    const totalWin = wins.reduce((acc, w) => acc + w.payout, 0);

    // 計算特殊符號
    let scatterCount = 0;
    let fortuneBallCount = 0;
    for (const col of gridResult.grid) {
      for (const sym of col) {
        if (sym === SCATTER_ID) scatterCount++;
        if (sym === FORTUNE_BALL_ID) fortuneBallCount++;
      }
    }

    const result: SpinResult = Object.freeze({
      gridResult,
      wins,
      totalWin,
      scatterCount,
      triggerFreeGame: scatterCount >= 3,
      fortuneBallCount,
    });

    // 加入贏分
    this._balance += totalWin;

    // 更新狀態
    this._lastResult = result;
    this._spinCount++;

    // 自動旋轉計數
    if (this._isAutoSpinning) {
      this._autoSpinRemaining--;
      if (this._autoSpinRemaining <= 0) {
        this._isAutoSpinning = false;
        this._autoSpinRemaining = 0;
      }
    }

    return result;
  }

  // === 自動旋轉 ===

  startAutoSpin(count: number): void {
    this._autoSpinRemaining = count;
    this._isAutoSpinning = true;
  }

  stopAutoSpin(): void {
    this._isAutoSpinning = false;
    this._autoSpinRemaining = 0;
  }
}
