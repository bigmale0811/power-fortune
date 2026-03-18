/**
 * MockServer + WaysEvaluator 整合測試
 * TDD RED：先寫測試，MockServer.spinWithEval() 尚未實作
 */
import { describe, it, expect } from 'vitest';
import { MockServer } from '@/mock/MockServer';
import { evaluateWays } from '@/evaluation/WaysEvaluator';

describe('MockServer + WaysEvaluator 整合', () => {
  it('spinWithEval 應回傳含 wins 和 totalWin 的完整結果', () => {
    const server = new MockServer(42, 10);
    const result = server.spinWithEval();

    // 應有完整結構
    expect(result.gridResult).toBeDefined();
    expect(result.gridResult.cols).toBe(5);
    expect(result.gridResult.rows).toBe(4);
    expect(Array.isArray(result.wins)).toBe(true);
    expect(typeof result.totalWin).toBe('number');
    expect(result.totalWin).toBeGreaterThanOrEqual(0);
  });

  it('totalWin 應等於所有 wins 的 payout 總和', () => {
    const server = new MockServer(42, 10);
    // 跑 50 次確認一致性
    for (let i = 0; i < 50; i++) {
      const result = server.spinWithEval();
      const sumPayouts = result.wins.reduce((acc, w) => acc + w.payout, 0);
      expect(result.totalWin).toBe(sumPayouts);
    }
  });

  it('手動呼叫 evaluateWays 應與 spinWithEval 結果一致', () => {
    const server = new MockServer(100, 5);
    const result = server.spinWithEval();
    const manualWins = evaluateWays(result.gridResult, 5);

    expect(result.wins).toEqual(manualWins);
  });

  it('freeSpinWithEval 應使用 FreeGame 符號池', () => {
    const server = new MockServer(200, 10);
    const result = server.freeSpinWithEval();

    expect(result.gridResult.cols).toBe(5);
    expect(result.gridResult.rows).toBe(4);
    // FreeGame 符號池只有 [0-6, 13, 14]，不包含 7-12
    for (const col of result.gridResult.grid) {
      for (const sym of col) {
        expect([0, 1, 2, 3, 4, 5, 6, 13, 14]).toContain(sym);
      }
    }
  });
});
