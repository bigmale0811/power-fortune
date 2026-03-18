/**
 * PayTable 單元測試
 * 覆蓋：賠率查表正確性、邊界條件
 */
import { describe, it, expect } from 'vitest';
import { PAY_TABLE, getPayForSymbol } from '@/evaluation/PayTable';

describe('PayTable', () => {
  it('應有 15 個符號定義', () => {
    expect(PAY_TABLE).toHaveLength(15);
  });

  it('CaiShen（ID=0）x5 應為 500', () => {
    expect(getPayForSymbol(0, 5)).toBe(500);
  });

  it('Wild（ID=13）x5 應為 1000', () => {
    expect(getPayForSymbol(13, 5)).toBe(1000);
  });

  it('Scatter（ID=14）不賠付', () => {
    expect(getPayForSymbol(14, 3)).toBe(0);
    expect(getPayForSymbol(14, 5)).toBe(0);
  });

  it('x3 查詢應回傳第一個值', () => {
    expect(getPayForSymbol(0, 3)).toBe(50);
    expect(getPayForSymbol(5, 3)).toBe(5);
  });

  it('不存在的符號 ID 應回傳 0', () => {
    expect(getPayForSymbol(99, 3)).toBe(0);
  });

  it('長度 < 3 應回傳 0', () => {
    expect(getPayForSymbol(0, 2)).toBe(0);
    expect(getPayForSymbol(0, 1)).toBe(0);
  });

  it('長度 > 5 應回傳 0', () => {
    expect(getPayForSymbol(0, 6)).toBe(0);
  });

  it('每個符號 ID 應遞增', () => {
    for (let i = 0; i < PAY_TABLE.length; i++) {
      expect(PAY_TABLE[i].id).toBe(i);
    }
  });
});
