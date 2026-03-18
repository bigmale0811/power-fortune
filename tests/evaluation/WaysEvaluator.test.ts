/**
 * WaysEvaluator 單元測試
 * 覆蓋：1024 Ways 演算法、Wild 替代、ways 計算、win tier
 */
import { describe, it, expect } from 'vitest';
import { evaluateWays, calculateWinTier } from '@/evaluation/WaysEvaluator';
import { WILD_ID, SCATTER_ID } from '@/mock/MockServer';
import type { GridResult } from '@/mock/MockServer';

/** 建立測試用格線的輔助函式 */
function makeGrid(data: number[][]): GridResult {
  return Object.freeze({
    grid: data.map((col) => Object.freeze([...col])),
    cols: data.length,
    rows: data[0].length,
  });
}

describe('WaysEvaluator', () => {
  it('完全沒有 3 連的格線應回傳空', () => {
    // 每列完全不同的符號
    const grid = makeGrid([
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [2, 2, 2, 2],
      [3, 3, 3, 3],
      [4, 4, 4, 4],
    ]);
    const wins = evaluateWays(grid, 1);

    // 每種符號只出現在一列，不可能 3 連
    expect(wins).toHaveLength(0);
  });

  it('前 3 列全部相同符號應中獎', () => {
    const grid = makeGrid([
      [0, 0, 0, 0],  // 4 個符號 0
      [0, 0, 0, 0],  // 4 個符號 0
      [0, 0, 0, 0],  // 4 個符號 0
      [1, 1, 1, 1],  // 不同符號，中斷
      [2, 2, 2, 2],
    ]);
    const wins = evaluateWays(grid, 1);

    const sym0Win = wins.find((w) => w.symbolId === 0);
    expect(sym0Win).toBeDefined();
    expect(sym0Win!.length).toBe(3);
    // ways = 4 × 4 × 4 = 64
    expect(sym0Win!.ways).toBe(64);
  });

  it('5 列全滿應計算 1024 ways', () => {
    const grid = makeGrid([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const wins = evaluateWays(grid, 1);

    const sym0Win = wins.find((w) => w.symbolId === 0);
    expect(sym0Win).toBeDefined();
    expect(sym0Win!.length).toBe(5);
    // 4^5 = 1024
    expect(sym0Win!.ways).toBe(1024);
  });

  it('Wild 應替代一般符號', () => {
    const grid = makeGrid([
      [0, 0, 0, 0],           // 4 個符號 0
      [WILD_ID, WILD_ID, WILD_ID, WILD_ID],  // 4 個 Wild（替代符號 0）
      [0, 0, 0, 0],           // 4 個符號 0
      [1, 1, 1, 1],
      [2, 2, 2, 2],
    ]);
    const wins = evaluateWays(grid, 1);

    const sym0Win = wins.find((w) => w.symbolId === 0);
    expect(sym0Win).toBeDefined();
    expect(sym0Win!.length).toBe(3);
    expect(sym0Win!.ways).toBe(64); // 4 × 4 × 4
  });

  it('Scatter 不參與 Ways 計算', () => {
    const grid = makeGrid([
      [SCATTER_ID, SCATTER_ID, SCATTER_ID, SCATTER_ID],
      [SCATTER_ID, SCATTER_ID, SCATTER_ID, SCATTER_ID],
      [SCATTER_ID, SCATTER_ID, SCATTER_ID, SCATTER_ID],
      [SCATTER_ID, SCATTER_ID, SCATTER_ID, SCATTER_ID],
      [SCATTER_ID, SCATTER_ID, SCATTER_ID, SCATTER_ID],
    ]);
    const wins = evaluateWays(grid, 1);
    // Scatter 不在 Ways 內賠付
    expect(wins).toHaveLength(0);
  });

  it('部分匹配（前 3 行有，第 4 行部分有）', () => {
    const grid = makeGrid([
      [0, 0, 0, 0],  // 4 matches
      [0, 0, 0, 0],  // 4 matches
      [0, 0, 0, 0],  // 4 matches
      [0, 0, 1, 1],  // 2 matches → length extends to 4
      [1, 1, 1, 1],  // no match → stop
    ]);
    const wins = evaluateWays(grid, 1);

    const sym0Win = wins.find((w) => w.symbolId === 0);
    expect(sym0Win).toBeDefined();
    // 應選擇最長路徑：4 列連續（第 4 列有 2 個匹配）
    expect(sym0Win!.length).toBe(4);
    // ways = 4 × 4 × 4 × 2 = 128
    expect(sym0Win!.ways).toBe(128);
  });

  it('payout 應正確計算 = pay × ways × bet', () => {
    const grid = makeGrid([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
    ]);
    const bet = 10;
    const wins = evaluateWays(grid, bet);

    const sym0Win = wins.find((w) => w.symbolId === 0);
    expect(sym0Win).toBeDefined();
    // CaiShen x3 pay = 50, ways = 64, bet = 10
    // payout = 50 × 64 × 10 = 32000
    expect(sym0Win!.payout).toBe(50 * 64 * 10);
  });
});

describe('calculateWinTier', () => {
  it('0 贏分 = NONE', () => {
    expect(calculateWinTier(0, 100)).toBe('NONE');
  });

  it('小贏 = NORMAL', () => {
    expect(calculateWinTier(500, 100)).toBe('NORMAL'); // 5x
  });

  it('15x+ = BIG_WIN', () => {
    expect(calculateWinTier(1500, 100)).toBe('BIG_WIN');
  });

  it('50x+ = MEGA_WIN', () => {
    expect(calculateWinTier(5000, 100)).toBe('MEGA_WIN');
  });

  it('100x+ = SUPER_MEGA_WIN', () => {
    expect(calculateWinTier(10000, 100)).toBe('SUPER_MEGA_WIN');
  });
});
