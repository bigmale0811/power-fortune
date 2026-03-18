/**
 * 遊戲共用常數 — 斬斷模組間循環依賴
 *
 * MockServer 和 WaysEvaluator 都需要這些常數，
 * 抽到獨立檔案避免 Vite 打包時的 TDZ 問題。
 */

/** 符號 ID 型別 */
export type SymbolId = number;

/** Wild 符號 ID */
export const WILD_ID = 13;

/** Scatter 符號 ID */
export const SCATTER_ID = 14;

/** Fortune Ball 符號 ID */
export const FORTUNE_BALL_ID = 12;

/** BaseGame 符號池（15 種） */
export const BASE_SYMBOLS: readonly SymbolId[] = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
];

/** FreeGame 符號池（9 種） */
export const FREE_SYMBOLS: readonly SymbolId[] = [
  0, 1, 2, 3, 4, 5, 6, 13, 14,
];

/** 遊戲場景類型 */
export type SceneType = 'BaseGame' | 'FreeGame';

/** 5×4 格線結果 */
export interface GridResult {
  readonly grid: readonly (readonly SymbolId[])[];
  readonly cols: number;
  readonly rows: number;
}

/** 單條中獎線 */
export interface WinLine {
  readonly symbolId: SymbolId;
  readonly length: number;
  readonly positions: readonly (readonly number[])[];
  readonly ways: number;
  readonly payout: number;
}

/** 旋轉結果 */
export interface SpinResult {
  readonly gridResult: GridResult;
  readonly wins: readonly WinLine[];
  readonly totalWin: number;
  readonly scatterCount: number;
  readonly triggerFreeGame: boolean;
  readonly fortuneBallCount: number;
}
