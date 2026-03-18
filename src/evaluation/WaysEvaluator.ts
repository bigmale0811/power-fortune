/**
 * WaysEvaluator — 1024 Ways-to-Win 賠付計算引擎
 *
 * 實作 ADR-004：1024 Ways 演算法
 * 5 列 × 4 行 = 4^5 = 1024 種路線組合
 *
 * 計算邏輯：
 * 1. 對每種非 Scatter/FortuneBall 符號，從左到右掃描連續列
 * 2. Wild 可替代任何非特殊符號
 * 3. ways 數 = 各列匹配行數的乘積
 * 4. 贏分 = pay × ways × bet
 */
import { WILD_ID, SCATTER_ID, FORTUNE_BALL_ID } from '@/mock/MockServer';
import { getPayForSymbol } from '@/evaluation/PayTable';
import type { GridResult, WinLine, SymbolId } from '@/mock/MockServer';

/** 不參與 Ways 賠付的特殊符號 */
const EXCLUDED_SYMBOLS = new Set([SCATTER_ID, FORTUNE_BALL_ID]);

/**
 * 評估 5×4 格線的所有 Ways 中獎
 * @param gridResult 格線結果
 * @param bet 投注金額
 * @returns 中獎線列表
 */
export function evaluateWays(gridResult: GridResult, bet: number): readonly WinLine[] {
  const { grid, cols } = gridResult;
  const wins: WinLine[] = [];

  // 收集所有出現的符號（排除特殊符號和 Wild）
  const symbolSet = new Set<SymbolId>();
  for (const col of grid) {
    for (const sym of col) {
      if (!EXCLUDED_SYMBOLS.has(sym) && sym !== WILD_ID) {
        symbolSet.add(sym);
      }
    }
  }

  // 對每種符號檢查 Ways
  for (const targetSymbol of symbolSet) {
    const result = evaluateSymbolWays(grid, targetSymbol, cols, bet);
    if (result !== null) {
      wins.push(result);
    }
  }

  // 純 Wild 也可獨立賠付
  const wildResult = evaluateSymbolWays(grid, WILD_ID, cols, bet);
  if (wildResult !== null) {
    wins.push(wildResult);
  }

  return Object.freeze(wins);
}

/**
 * 計算單個符號的 Ways 中獎
 */
function evaluateSymbolWays(
  grid: readonly (readonly SymbolId[])[],
  targetSymbol: SymbolId,
  cols: number,
  bet: number,
): WinLine | null {
  const isWild = targetSymbol === WILD_ID;
  const positions: number[][] = [];
  let length = 0;

  // 從左到右掃描連續列
  for (let c = 0; c < cols; c++) {
    const matchingRows: number[] = [];
    for (let r = 0; r < grid[c].length; r++) {
      const sym = grid[c][r];
      if (isWild) {
        // 純 Wild 線只匹配 Wild
        if (sym === WILD_ID) matchingRows.push(r);
      } else {
        // 一般符號：匹配自身或 Wild
        if (sym === targetSymbol || sym === WILD_ID) matchingRows.push(r);
      }
    }

    if (matchingRows.length === 0) break; // 連續中斷
    positions.push(matchingRows);
    length++;
  }

  // 至少 3 列連續才賠付
  if (length < 3) return null;

  // ways = 各列匹配行數的乘積
  const ways = positions.reduce((acc, rows) => acc * rows.length, 1);

  // 賠率查表
  const pay = getPayForSymbol(targetSymbol, length);
  if (pay === 0) return null;

  const payout = pay * ways * bet;

  return Object.freeze({
    symbolId: targetSymbol,
    length,
    positions: positions.map((rows) => Object.freeze([...rows])),
    ways,
    payout,
  });
}

/**
 * 計算總贏分與 Win Tier
 */
export type WinTier = 'NONE' | 'NORMAL' | 'BIG_WIN' | 'MEGA_WIN' | 'SUPER_MEGA_WIN';

export function calculateWinTier(totalWin: number, bet: number): WinTier {
  const ratio = totalWin / bet;
  if (ratio <= 0) return 'NONE';
  if (ratio < 15) return 'NORMAL';
  if (ratio < 50) return 'BIG_WIN';
  if (ratio < 100) return 'MEGA_WIN';
  return 'SUPER_MEGA_WIN';
}
