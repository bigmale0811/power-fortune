/**
 * FreeGameController — 免費遊戲控制器
 *
 * 管理 Free Game 的觸發、旋轉次數、Power-Up 選擇、Re-trigger 和結算。
 * Scatter ×3/4/5 → 8/12/20 次免費轉。
 */
import { MockServer, FREE_SYMBOLS } from '@/mock/MockServer';
import { evaluateWays } from '@/evaluation/WaysEvaluator';
import type { SpinResult } from '@/mock/MockServer';

/** Power-Up 增強類型（對應原版 5 種） */
export type PowerUpType = 'Bamboo' | 'Coins' | 'Fortune' | 'Gourd' | 'Fish';

/** Scatter 數量 → 免費轉次數對照表 */
const SCATTER_TO_SPINS: Readonly<Record<number, number>> = {
  3: 8,
  4: 12,
  5: 20,
};

export class FreeGameController {
  private readonly server: MockServer;
  private readonly bet: number;
  private _totalSpins = 0;
  private _remainingSpins = 0;
  private _isActive = false;
  private _currentPowerUp: PowerUpType | null = null;
  private _totalWin = 0;

  constructor(seed?: number, bet = 100) {
    this.server = new MockServer(seed, bet);
    this.bet = bet;
  }

  // === 唯讀狀態 ===

  get totalSpins(): number {
    return this._totalSpins;
  }

  get remainingSpins(): number {
    return this._remainingSpins;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get currentPowerUp(): PowerUpType | null {
    return this._currentPowerUp;
  }

  get totalWin(): number {
    return this._totalWin;
  }

  // === 觸發 ===

  /**
   * 嘗試觸發免費遊戲
   * @param scatterCount Scatter 數量（3/4/5 才觸發）
   */
  trigger(scatterCount: number): void {
    const spins = SCATTER_TO_SPINS[scatterCount];
    if (!spins) return; // 不足 3 Scatter，不觸發

    this._totalSpins = spins;
    this._remainingSpins = spins;
    this._isActive = true;
    this._totalWin = 0;
    this._currentPowerUp = null;
  }

  /**
   * Re-trigger：免費遊戲中再觸發
   * @param scatterCount 再次出現的 Scatter 數量
   */
  retrigger(scatterCount: number): void {
    const extraSpins = SCATTER_TO_SPINS[scatterCount];
    if (!extraSpins || !this._isActive) return;

    this._remainingSpins += extraSpins;
    this._totalSpins += extraSpins;
  }

  // === Power-Up ===

  selectPowerUp(type: PowerUpType): void {
    this._currentPowerUp = type;
  }

  // === 旋轉 ===

  /**
   * 執行一次免費旋轉
   * @returns SpinResult 或 null（未啟動/次數耗盡）
   */
  spin(): SpinResult | null {
    if (!this._isActive || this._remainingSpins <= 0) {
      return null;
    }

    // 產生格線（使用 FreeGame 符號池）
    const gridResult = this.server.generateGrid(FREE_SYMBOLS, 5, 4);
    const wins = evaluateWays(gridResult, this.bet);
    const totalWin = wins.reduce((acc, w) => acc + w.payout, 0);

    // 計算特殊符號
    let scatterCount = 0;
    let fortuneBallCount = 0;
    for (const col of gridResult.grid) {
      for (const sym of col) {
        if (sym === 14) scatterCount++;
        if (sym === 12) fortuneBallCount++;
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

    // 累計贏分
    this._totalWin += totalWin;
    this._remainingSpins--;

    // 檢查是否結束
    if (this._remainingSpins <= 0) {
      this._isActive = false;
    }

    return result;
  }

  // === 重置 ===

  reset(): void {
    this._totalSpins = 0;
    this._remainingSpins = 0;
    this._isActive = false;
    this._currentPowerUp = null;
    this._totalWin = 0;
  }
}
