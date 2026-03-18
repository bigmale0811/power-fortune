/**
 * RNG — 偽隨機數產生器
 *
 * 支援 seeded PRNG（可重現結果）和系統隨機。
 * 使用 xorshift128+ 演算法，速度快且分佈良好。
 */

export class RNG {
  private s0: number;
  private s1: number;

  /**
   * @param seed 種子值。undefined 時使用系統隨機
   */
  constructor(seed?: number) {
    if (seed !== undefined) {
      // 用 seed 初始化兩個 state
      this.s0 = seed | 0 || 1;
      this.s1 = (seed * 6364136223846793005 + 1) | 0 || 1;
    } else {
      this.s0 = (Math.random() * 0x7fffffff) | 0;
      this.s1 = (Math.random() * 0x7fffffff) | 0;
    }
  }

  /** 回傳 [0, 1) 的浮點數 */
  next(): number {
    let s1 = this.s0;
    const s0 = this.s1;
    this.s0 = s0;
    s1 ^= s1 << 23;
    s1 ^= s1 >> 17;
    s1 ^= s0;
    s1 ^= s0 >> 26;
    this.s1 = s1;
    return ((this.s0 + this.s1) >>> 0) / 0x100000000;
  }

  /** 回傳 [min, max) 的整數 */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /** 從陣列隨機挑一個元素 */
  pick<T>(array: readonly T[]): T {
    if (array.length === 0) throw new Error('[RNG] 無法從空陣列挑選');
    return array[this.int(0, array.length)];
  }

  /** Fisher-Yates 洗牌（回傳新陣列） */
  shuffle<T>(array: readonly T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}
