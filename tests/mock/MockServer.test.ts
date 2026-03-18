/**
 * MockServer 單元測試
 * 覆蓋：格線生成、Scatter 計數、Free Game 觸發
 */
import { describe, it, expect } from 'vitest';
import { MockServer, SCATTER_ID } from '@/mock/MockServer';

describe('MockServer', () => {
  it('spin 應產生 5×4 格線', () => {
    const server = new MockServer(42);
    const result = server.spin();

    expect(result.gridResult.cols).toBe(5);
    expect(result.gridResult.rows).toBe(4);
    expect(result.gridResult.grid).toHaveLength(5);
    for (const col of result.gridResult.grid) {
      expect(col).toHaveLength(4);
    }
  });

  it('generateGrid 應產生指定大小的格線', () => {
    const server = new MockServer(42);
    const result = server.generateGrid([0, 1, 2], 3, 3);

    expect(result.cols).toBe(3);
    expect(result.rows).toBe(3);
    expect(result.grid).toHaveLength(3);
  });

  it('格線內的符號應在合法範圍內', () => {
    const server = new MockServer(42);
    const result = server.spin();

    for (const col of result.gridResult.grid) {
      for (const sym of col) {
        expect(sym).toBeGreaterThanOrEqual(0);
        expect(sym).toBeLessThanOrEqual(14);
      }
    }
  });

  it('相同 seed 應產生相同結果', () => {
    const server1 = new MockServer(100);
    const server2 = new MockServer(100);

    const r1 = server1.spin();
    const r2 = server2.spin();

    expect(r1.gridResult.grid).toEqual(r2.gridResult.grid);
  });

  it('scatterCount 應正確計數', () => {
    // 用多次 spin 統計，確認 scatterCount 和格線一致
    const server = new MockServer(42);
    for (let i = 0; i < 50; i++) {
      const result = server.spin();
      let actualScatters = 0;
      for (const col of result.gridResult.grid) {
        for (const sym of col) {
          if (sym === SCATTER_ID) actualScatters++;
        }
      }
      expect(result.scatterCount).toBe(actualScatters);
    }
  });

  it('triggerFreeGame 應在 scatter >= 3 時為 true', () => {
    const server = new MockServer(42);
    for (let i = 0; i < 100; i++) {
      const result = server.spin();
      expect(result.triggerFreeGame).toBe(result.scatterCount >= 3);
    }
  });

  it('gridResult 應為凍結物件（不可變）', () => {
    const server = new MockServer(42);
    const result = server.spin();
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.gridResult)).toBe(true);
  });
});
