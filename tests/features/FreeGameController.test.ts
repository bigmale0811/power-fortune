/**
 * FreeGameController 單元測試
 * TDD RED：先寫測試
 *
 * Free Game 規則：
 * - Scatter ×3/4/5 觸發，給予 8/12/20 次免費轉
 * - 5 種 Power-Up：Bamboo, Coins, Fortune, Gourd, Fish
 * - 可 re-trigger（免費遊戲中再出現 3+ Scatter）
 * - 使用 FreeGame 符號池（7 種 + Wild + Scatter）
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FreeGameController } from '@/features/FreeGameController';
import type { PowerUpType } from '@/features/FreeGameController';

describe('FreeGameController', () => {
  let ctrl: FreeGameController;

  beforeEach(() => {
    ctrl = new FreeGameController(42); // seeded
  });

  // === 觸發規則 ===
  it('3 Scatter 應觸發 8 次免費轉', () => {
    ctrl.trigger(3);
    expect(ctrl.totalSpins).toBe(8);
    expect(ctrl.remainingSpins).toBe(8);
    expect(ctrl.isActive).toBe(true);
  });

  it('4 Scatter 應觸發 12 次免費轉', () => {
    ctrl.trigger(4);
    expect(ctrl.totalSpins).toBe(12);
  });

  it('5 Scatter 應觸發 20 次免費轉', () => {
    ctrl.trigger(5);
    expect(ctrl.totalSpins).toBe(20);
  });

  it('不足 3 Scatter 不應觸發', () => {
    ctrl.trigger(2);
    expect(ctrl.isActive).toBe(false);
  });

  // === 旋轉管理 ===
  it('spin 應減少剩餘次數', () => {
    ctrl.trigger(3);
    const result = ctrl.spin();
    expect(result).not.toBeNull();
    expect(ctrl.remainingSpins).toBe(7);
  });

  it('耗盡次數後 isActive 應為 false', () => {
    ctrl.trigger(3); // 8 次
    for (let i = 0; i < 8; i++) {
      ctrl.spin();
    }
    expect(ctrl.isActive).toBe(false);
    expect(ctrl.remainingSpins).toBe(0);
  });

  it('未啟動時 spin 應回傳 null', () => {
    expect(ctrl.spin()).toBeNull();
  });

  // === Re-trigger ===
  it('免費遊戲中 3+ Scatter 應追加次數', () => {
    ctrl.trigger(3); // 8 次
    ctrl.spin(); // 剩 7
    ctrl.retrigger(3); // +8
    expect(ctrl.remainingSpins).toBe(7 + 8);
    expect(ctrl.totalSpins).toBe(8 + 8);
  });

  // === Power-Up ===
  it('selectPowerUp 應設定當前增強', () => {
    ctrl.trigger(3);
    ctrl.selectPowerUp('Fortune');
    expect(ctrl.currentPowerUp).toBe('Fortune');
  });

  it('所有 5 種 Power-Up 都應有效', () => {
    const types: PowerUpType[] = ['Bamboo', 'Coins', 'Fortune', 'Gourd', 'Fish'];
    ctrl.trigger(3);
    for (const t of types) {
      ctrl.selectPowerUp(t);
      expect(ctrl.currentPowerUp).toBe(t);
    }
  });

  // === 結算 ===
  it('totalWin 應累計所有免費轉贏分', () => {
    ctrl.trigger(3);
    let expectedTotal = 0;
    for (let i = 0; i < 8; i++) {
      const result = ctrl.spin();
      if (result) expectedTotal += result.totalWin;
    }
    expect(ctrl.totalWin).toBe(expectedTotal);
  });

  it('reset 應清空所有狀態', () => {
    ctrl.trigger(3);
    ctrl.spin();
    ctrl.reset();
    expect(ctrl.isActive).toBe(false);
    expect(ctrl.remainingSpins).toBe(0);
    expect(ctrl.totalWin).toBe(0);
  });
});
