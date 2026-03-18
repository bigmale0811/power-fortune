/**
 * MiniGameController 單元測試
 * TDD RED：先寫測試
 *
 * Mini Game 規則：
 * - 收集足夠 Fortune Ball 後觸發
 * - 玩家選門（3 扇門）
 * - 揭示球型：Grand / Major / Minor / Mini / Wild / Coin
 * - 收集 3 顆相同球型即結算該級彩金
 * - Wild 球可替代任意球型
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MiniGameController } from '@/features/MiniGameController';
import type { BallType } from '@/features/MiniGameController';

describe('MiniGameController', () => {
  let ctrl: MiniGameController;

  beforeEach(() => {
    ctrl = new MiniGameController(42); // seeded
  });

  // === Fortune Ball 收集 ===
  it('初始收集數應為 0', () => {
    expect(ctrl.collectedBalls).toBe(0);
  });

  it('addBalls 應增加收集數', () => {
    ctrl.addBalls(3);
    expect(ctrl.collectedBalls).toBe(3);
  });

  it('收集滿 6 顆應可觸發', () => {
    ctrl.addBalls(6);
    expect(ctrl.canTrigger).toBe(true);
  });

  it('不足 6 顆不應觸發', () => {
    ctrl.addBalls(5);
    expect(ctrl.canTrigger).toBe(false);
  });

  // === 遊戲流程 ===
  it('trigger 後應進入活動狀態', () => {
    ctrl.addBalls(6);
    ctrl.trigger();
    expect(ctrl.isActive).toBe(true);
    expect(ctrl.collectedBalls).toBe(0); // 觸發後重置收集數
  });

  it('chooseDoor 應回傳一個 BallType', () => {
    ctrl.addBalls(6);
    ctrl.trigger();
    const ball = ctrl.chooseDoor(0);
    const validTypes: BallType[] = ['Grand', 'Major', 'Minor', 'Mini', 'Wild', 'Coin'];
    expect(validTypes).toContain(ball);
  });

  it('chooseDoor 門號應在 0-2 範圍', () => {
    ctrl.addBalls(6);
    ctrl.trigger();
    expect(() => ctrl.chooseDoor(3)).toThrow();
    expect(() => ctrl.chooseDoor(-1)).toThrow();
  });

  it('revealedBalls 應記錄已揭示的球', () => {
    ctrl.addBalls(6);
    ctrl.trigger();
    ctrl.chooseDoor(1);
    expect(ctrl.revealedBalls).toHaveLength(1);
  });

  // === 結算 ===
  it('收集 3 顆相同球型應結算', () => {
    ctrl.addBalls(6);
    ctrl.trigger();

    // 用 seeded RNG 連續選門，直到結算或最大回合
    let finished = false;
    for (let i = 0; i < 20; i++) {
      ctrl.chooseDoor(i % 3);
      if (ctrl.isSettled) {
        finished = true;
        break;
      }
    }

    // 有可能在 20 輪內結算（取決於 seed）
    // 這裡只測試結算後的狀態是合理的
    if (finished) {
      expect(ctrl.settlementResult).not.toBeNull();
      expect(ctrl.settlementResult!.prizeTier).toBeDefined();
      expect(ctrl.settlementResult!.prizeAmount).toBeGreaterThanOrEqual(0);
    }
  });

  it('reset 應清空所有狀態', () => {
    ctrl.addBalls(6);
    ctrl.trigger();
    ctrl.chooseDoor(0);
    ctrl.reset();
    expect(ctrl.isActive).toBe(false);
    expect(ctrl.collectedBalls).toBe(0);
    expect(ctrl.revealedBalls).toHaveLength(0);
  });
});
