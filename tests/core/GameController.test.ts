/**
 * GameController 單元測試 — DEV-4 UI 的狀態邏輯核心
 * TDD RED：先寫測試，GameController 尚未實作
 *
 * GameController 是 UI 和遊戲引擎之間的中樞，管理：
 * - 餘額 (balance)
 * - 投注額 (bet)
 * - 旋轉流程（spin → evaluate → animate → idle）
 * - 自動旋轉
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GameController } from '@/core/GameController';

describe('GameController', () => {
  let ctrl: GameController;

  beforeEach(() => {
    ctrl = new GameController({
      initialBalance: 10000,
      betOptions: [10, 20, 50, 100, 200, 500],
      defaultBetIndex: 3, // bet=100
      seed: 42, // 可重現的隨機
    });
  });

  // === 餘額管理 ===
  it('初始餘額應為 10000', () => {
    expect(ctrl.balance).toBe(10000);
  });

  it('spin 後餘額應扣除投注額', () => {
    ctrl.spin();
    expect(ctrl.balance).toBe(10000 - 100);
  });

  it('餘額不足時 spin 應失敗', () => {
    const poorCtrl = new GameController({
      initialBalance: 50,
      betOptions: [100],
      defaultBetIndex: 0,
      seed: 1,
    });
    const result = poorCtrl.spin();
    expect(result).toBeNull();
    expect(poorCtrl.balance).toBe(50); // 餘額不變
  });

  // === 投注管理 ===
  it('初始投注應為預設值', () => {
    expect(ctrl.currentBet).toBe(100);
  });

  it('increaseBet 應切換到下一檔', () => {
    ctrl.increaseBet();
    expect(ctrl.currentBet).toBe(200);
  });

  it('decreaseBet 應切換到上一檔', () => {
    ctrl.decreaseBet();
    expect(ctrl.currentBet).toBe(50);
  });

  it('investBet 在最大時不應超出', () => {
    ctrl.increaseBet(); // 200
    ctrl.increaseBet(); // 500
    ctrl.increaseBet(); // 仍是 500
    expect(ctrl.currentBet).toBe(500);
  });

  it('decreaseBet 在最小時不應低於', () => {
    ctrl.decreaseBet(); // 50
    ctrl.decreaseBet(); // 20
    ctrl.decreaseBet(); // 10
    ctrl.decreaseBet(); // 仍是 10
    expect(ctrl.currentBet).toBe(10);
  });

  // === 旋轉流程 ===
  it('spin 應回傳 SpinResult', () => {
    const result = ctrl.spin();
    expect(result).not.toBeNull();
    expect(result!.gridResult.cols).toBe(5);
    expect(result!.gridResult.rows).toBe(4);
  });

  it('spin 中獎時餘額應增加', () => {
    // 用固定 seed 跑多次，確認有贏的情況餘額增加
    const testCtrl = new GameController({
      initialBalance: 100000,
      betOptions: [10],
      defaultBetIndex: 0,
      seed: 42,
    });

    let foundWin = false;
    for (let i = 0; i < 100; i++) {
      const balanceBefore = testCtrl.balance;
      const result = testCtrl.spin();
      if (result && result.totalWin > 0) {
        expect(testCtrl.balance).toBe(balanceBefore - 10 + result.totalWin);
        foundWin = true;
        break;
      }
    }
    expect(foundWin).toBe(true); // 100 次內至少贏一次
  });

  // === 自動旋轉 ===
  it('autoSpin 應設定剩餘次數', () => {
    ctrl.startAutoSpin(10);
    expect(ctrl.autoSpinRemaining).toBe(10);
    expect(ctrl.isAutoSpinning).toBe(true);
  });

  it('stopAutoSpin 應停止自動旋轉', () => {
    ctrl.startAutoSpin(10);
    ctrl.stopAutoSpin();
    expect(ctrl.isAutoSpinning).toBe(false);
    expect(ctrl.autoSpinRemaining).toBe(0);
  });

  it('autoSpin spin 後剩餘次數應減 1', () => {
    ctrl.startAutoSpin(5);
    ctrl.spin();
    expect(ctrl.autoSpinRemaining).toBe(4);
  });

  it('autoSpin 跑完應自動停止', () => {
    ctrl.startAutoSpin(1);
    ctrl.spin();
    expect(ctrl.isAutoSpinning).toBe(false);
  });

  // === 狀態查詢 ===
  it('lastResult 初始應為 null', () => {
    expect(ctrl.lastResult).toBeNull();
  });

  it('spin 後 lastResult 應有值', () => {
    ctrl.spin();
    expect(ctrl.lastResult).not.toBeNull();
  });

  it('spinCount 應正確計數', () => {
    expect(ctrl.spinCount).toBe(0);
    ctrl.spin();
    expect(ctrl.spinCount).toBe(1);
    ctrl.spin();
    expect(ctrl.spinCount).toBe(2);
  });
});
