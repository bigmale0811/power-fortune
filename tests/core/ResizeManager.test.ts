/**
 * ResizeManager 單元測試
 * 覆蓋：calculateFit 計算邏輯（letterbox contain-fit）
 */
import { describe, it, expect } from 'vitest';
import { ResizeManager } from '@/core/ResizeManager';

describe('ResizeManager.calculateFit', () => {
  // 使用 mock canvas（jsdom 環境下 HTMLCanvasElement 可能不完整）
  const mockCanvas = {
    style: { width: '', height: '' },
  } as unknown as HTMLCanvasElement;

  const rm = new ResizeManager(mockCanvas, 900, 1600);

  it('完美匹配的視窗應回傳 scale=1', () => {
    const result = rm.calculateFit(900, 1600);
    expect(result.width).toBe(900);
    expect(result.height).toBe(1600);
    expect(result.scale).toBeCloseTo(1.0);
  });

  it('寬視窗（1920×1080）應高度撐滿，左右補黑邊', () => {
    const result = rm.calculateFit(1920, 1080);
    // 高度撐滿 1080，寬度 = 1080 * (900/1600) = 607.5
    expect(result.height).toBe(1080);
    expect(result.width).toBe(608); // Math.round(607.5)
    expect(result.scale).toBeCloseTo(1080 / 1600);
  });

  it('窄視窗（360×640）應等比縮小', () => {
    const result = rm.calculateFit(360, 640);
    // 360/640 = 0.5625, 900/1600 = 0.5625 → 完美匹配
    expect(result.width).toBe(360);
    expect(result.height).toBe(640);
    expect(result.scale).toBeCloseTo(360 / 900);
  });

  it('極寬視窗（2560×600）應高度撐滿', () => {
    const result = rm.calculateFit(2560, 600);
    expect(result.height).toBe(600);
    expect(result.scale).toBeCloseTo(600 / 1600);
  });

  it('極窄視窗（200×2000）應寬度撐滿', () => {
    const result = rm.calculateFit(200, 2000);
    expect(result.width).toBe(200);
    expect(result.scale).toBeCloseTo(200 / 900);
  });

  it('回傳值應為凍結物件（不可變）', () => {
    const result = rm.calculateFit(900, 1600);
    expect(Object.isFrozen(result)).toBe(true);
  });
});
