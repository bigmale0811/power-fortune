/**
 * MockServer — 本地模擬伺服器
 *
 * 模擬後端 API 回應，產生隨機轉盤結果。
 * Demo 模式下不需要真實伺服器連線。
 */
import { RNG } from '@/mock/RNG';

/** 遊戲場景類型 */
export type SceneType = 'BaseGame' | 'FreeGame';

/** 符號 ID（0-14 對應原版 15 種符號） */
export type SymbolId = number;

/** 5×4 格線結果 */
export interface GridResult {
  /** grid[col][row]：每一列由上到下 */
  readonly grid: readonly (readonly SymbolId[])[];
  /** 格線寬度 */
  readonly cols: number;
  /** 格線高度 */
  readonly rows: number;
}

/** 旋轉結果 */
export interface SpinResult {
  readonly gridResult: GridResult;
  readonly wins: readonly WinLine[];
  readonly totalWin: number;
  readonly scatterCount: number;
  /** 是否觸發 Free Game */
  readonly triggerFreeGame: boolean;
  /** Fortune Ball 數量（觸發 Mini Game 用） */
  readonly fortuneBallCount: number;
}

/** 單條中獎線（Ways-to-Win 模式） */
export interface WinLine {
  /** 中獎符號 ID */
  readonly symbolId: SymbolId;
  /** 連續列數（3/4/5） */
  readonly length: number;
  /** 每列中獎的 row 索引 */
  readonly positions: readonly (readonly number[])[];
  /** ways 數量 */
  readonly ways: number;
  /** 該線贏分 */
  readonly payout: number;
}

/** BaseGame 符號池（13 種 + Wild + Scatter = 15） */
export const BASE_SYMBOLS: readonly SymbolId[] = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
];

/** FreeGame 符號池（7 種 + Wild + Scatter = 9，但高額符號比例高） */
export const FREE_SYMBOLS: readonly SymbolId[] = [
  0, 1, 2, 3, 4, 5, 6, 13, 14,
];

/** Wild 符號 ID */
export const WILD_ID = 13;
/** Scatter 符號 ID */
export const SCATTER_ID = 14;
/** Fortune Ball 符號 ID */
export const FORTUNE_BALL_ID = 12;

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

    // 計算 Scatter 數量
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
      wins: [], // DEV-3 的 WaysEvaluator 會實際計算
      totalWin: 0,
      scatterCount,
      triggerFreeGame: scatterCount >= 3,
      fortuneBallCount,
    });
  }
}
