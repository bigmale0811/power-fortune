/**
 * MockServer — 本地模擬伺服器
 *
 * 模擬後端 API 回應，產生隨機轉盤結果。
 * Demo 模式下不需要真實伺服器連線。
 *
 * 型別與常數從 constants.ts 統一匯入，避免與 WaysEvaluator 的循環依賴。
 */
import { RNG } from '@/mock/RNG';
import { evaluateWays } from '@/evaluation/WaysEvaluator';
import {
  type SymbolId,
  type SceneType,
  type GridResult,
  type WinLine,
  type SpinResult,
  SCATTER_ID,
  FORTUNE_BALL_ID,
  BASE_SYMBOLS,
  FREE_SYMBOLS,
} from '@/core/constants';

// Re-export 所有型別與常數，確保現有消費者不用改匯入路徑
export type { SymbolId, SceneType, GridResult, WinLine, SpinResult };
export { WILD_ID, SCATTER_ID, FORTUNE_BALL_ID, BASE_SYMBOLS, FREE_SYMBOLS } from '@/core/constants';

export class MockServer {
  private readonly rng: RNG;
  readonly bet: number;

  constructor(seed?: number, bet = 100) {
    this.rng = new RNG(seed);
    this.bet = bet;
  }

  /** 產生一次 Base Game 旋轉結果 */
  spin(): SpinResult {
    return this.generateSpin('BaseGame', BASE_SYMBOLS);
  }

  /** 產生一次 Free Game 旋轉結果 */
  freeSpin(): SpinResult {
    return this.generateSpin('FreeGame', FREE_SYMBOLS);
  }

  /** 產生 Base Game 旋轉結果（含 WaysEvaluator 賠付計算） */
  spinWithEval(): SpinResult {
    return this.generateSpinWithEval('BaseGame', BASE_SYMBOLS);
  }

  /** 產生 Free Game 旋轉結果（含 WaysEvaluator 賠付計算） */
  freeSpinWithEval(): SpinResult {
    return this.generateSpinWithEval('FreeGame', FREE_SYMBOLS);
  }

  /** 產生隨機格線 */
  generateGrid(symbols: readonly SymbolId[], cols: number, rows: number): GridResult {
    const grid: SymbolId[][] = [];
    for (let c = 0; c < cols; c++) {
      const column: SymbolId[] = [];
      for (let r = 0; r < rows; r++) {
        column.push(this.rng.pick(symbols));
      }
      grid.push(column);
    }
    return Object.freeze({
      grid: grid.map((col) => Object.freeze([...col])),
      cols,
      rows,
    });
  }

  private generateSpin(_scene: SceneType, symbols: readonly SymbolId[]): SpinResult {
    const gridResult = this.generateGrid(symbols, 5, 4);
    return this.buildSpinResult(gridResult);
  }

  /** 產生含賠付計算的旋轉結果 */
  private generateSpinWithEval(_scene: SceneType, symbols: readonly SymbolId[]): SpinResult {
    const gridResult = this.generateGrid(symbols, 5, 4);
    const wins = evaluateWays(gridResult, this.bet);
    const totalWin = wins.reduce((acc, w) => acc + w.payout, 0);
    return this.buildSpinResult(gridResult, wins, totalWin);
  }

  /** 組裝 SpinResult（共用邏輯） */
  private buildSpinResult(
    gridResult: GridResult,
    wins: readonly WinLine[] = [],
    totalWin = 0,
  ): SpinResult {
    let scatterCount = 0;
    let fortuneBallCount = 0;
    for (const col of gridResult.grid) {
      for (const sym of col) {
        if (sym === SCATTER_ID) scatterCount++;
        if (sym === FORTUNE_BALL_ID) fortuneBallCount++;
      }
    }

    return Object.freeze({
      gridResult,
      wins,
      totalWin,
      scatterCount,
      triggerFreeGame: scatterCount >= 3,
      fortuneBallCount,
    });
  }
}
