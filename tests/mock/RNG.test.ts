/**
 * RNG 單元測試
 * 覆蓋：seeded PRNG 可重現性、分佈範圍、pick、shuffle
 */
import { describe, it, expect } from 'vitest';
import { RNG } from '@/mock/RNG';

describe('RNG', () => {
  it('相同 seed 應產生相同序列', () => {
    const rng1 = new RNG(42);
    const rng2 = new RNG(42);

    const seq1 = Array.from({ length: 10 }, () => rng1.next());
    const seq2 = Array.from({ length: 10 }, () => rng2.next());

    expect(seq1).toEqual(seq2);
  });

  it('不同 seed 應產生不同序列', () => {
    const rng1 = new RNG(42);
    const rng2 = new RNG(99);

    const val1 = rng1.next();
    const val2 = rng2.next();

    expect(val1).not.toBe(val2);
  });

  it('next() 應在 [0, 1) 範圍內', () => {
    const rng = new RNG(123);
    for (let i = 0; i < 1000; i++) {
      const val = rng.next();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('int(min, max) 應在 [min, max) 範圍內', () => {
    const rng = new RNG(456);
    for (let i = 0; i < 1000; i++) {
      const val = rng.int(3, 10);
      expect(val).toBeGreaterThanOrEqual(3);
      expect(val).toBeLessThan(10);
    }
  });

  it('pick 應從陣列中選取元素', () => {
    const rng = new RNG(789);
    const items = ['a', 'b', 'c'] as const;

    for (let i = 0; i < 100; i++) {
      const val = rng.pick(items);
      expect(items).toContain(val);
    }
  });

  it('pick 空陣列應拋出錯誤', () => {
    const rng = new RNG(0);
    expect(() => rng.pick([])).toThrow('[RNG] 無法從空陣列挑選');
  });

  it('shuffle 應回傳新陣列（不修改原陣列）', () => {
    const rng = new RNG(101);
    const original = [1, 2, 3, 4, 5];
    const originalCopy = [...original];
    const shuffled = rng.shuffle(original);

    expect(original).toEqual(originalCopy); // 原陣列未被修改
    expect(shuffled).toHaveLength(original.length);
    expect(shuffled.sort()).toEqual(original.sort()); // 包含相同元素
  });
});
