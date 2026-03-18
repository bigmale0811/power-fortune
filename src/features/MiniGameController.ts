/**
 * MiniGameController — 小遊戲控制器
 *
 * 管理 Fortune Ball 收集、門選擇、球揭示和彩金結算。
 * 6 種球型：Grand / Major / Minor / Mini / Wild / Coin
 * 收集 3 顆相同球型（Wild 可替代）即結算對應彩金。
 */
import { RNG } from '@/mock/RNG';

/** 球型定義 */
export type BallType = 'Grand' | 'Major' | 'Minor' | 'Mini' | 'Wild' | 'Coin';

/** 結算結果 */
export interface SettlementResult {
  readonly prizeTier: BallType;
  readonly prizeAmount: number;
  readonly revealedBalls: readonly BallType[];
}

/** 觸發所需的 Fortune Ball 數量 */
const TRIGGER_THRESHOLD = 6;

/** 各級彩金倍率（×bet） */
const PRIZE_MULTIPLIERS: Readonly<Record<string, number>> = {
  Grand: 1000,
  Major: 200,
  Minor: 50,
  Mini: 10,
  Coin: 5,
};

/** 球型出現權重（加權隨機） */
const BALL_WEIGHTS: readonly { type: BallType; weight: number }[] = [
  { type: 'Mini', weight: 35 },
  { type: 'Coin', weight: 30 },
  { type: 'Minor', weight: 20 },
  { type: 'Wild', weight: 8 },
  { type: 'Major', weight: 5 },
  { type: 'Grand', weight: 2 },
];

const TOTAL_WEIGHT = BALL_WEIGHTS.reduce((acc, b) => acc + b.weight, 0);

export class MiniGameController {
  private readonly rng: RNG;
  private readonly bet: number;
  private _collectedBalls = 0;
  private _isActive = false;
  private _revealedBalls: BallType[] = [];
  private _isSettled = false;
  private _settlementResult: SettlementResult | null = null;

  constructor(seed?: number, bet = 100) {
    this.rng = new RNG(seed);
    this.bet = bet;
  }

  // === 唯讀狀態 ===

  get collectedBalls(): number {
    return this._collectedBalls;
  }

  get canTrigger(): boolean {
    return this._collectedBalls >= TRIGGER_THRESHOLD;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get revealedBalls(): readonly BallType[] {
    return [...this._revealedBalls];
  }

  get isSettled(): boolean {
    return this._isSettled;
  }

  get settlementResult(): SettlementResult | null {
    return this._settlementResult;
  }

  // === Fortune Ball 收集 ===

  addBalls(count: number): void {
    if (count < 0 || !Number.isInteger(count)) {
      throw new Error(`[MiniGame] 無效的球數: ${count}`);
    }
    this._collectedBalls += count;
  }

  // === 觸發 ===

  trigger(): void {
    if (!this.canTrigger) return;
    this._collectedBalls = 0; // 觸發後重置收集數
    this._isActive = true;
    this._revealedBalls = [];
    this._isSettled = false;
    this._settlementResult = null;
  }

  // === 選門 ===

  /**
   * 玩家選擇一扇門（0/1/2）
   * @param doorIndex 門號 0-2
   * @returns 揭示的球型
   */
  chooseDoor(doorIndex: number): BallType {
    if (doorIndex < 0 || doorIndex > 2) {
      throw new Error(`[MiniGame] 門號必須為 0-2，收到 ${doorIndex}`);
    }
    if (!this._isActive || this._isSettled) {
      throw new Error('[MiniGame] 遊戲未啟動或已結算');
    }

    // 加權隨機選球（由 RNG 決定，門號不影響結果）
    const ball = this.randomBall();
    this._revealedBalls = [...this._revealedBalls, ball];

    // 檢查是否結算
    this.checkSettlement();

    return ball;
  }

  // === 重置 ===

  reset(): void {
    this._collectedBalls = 0;
    this._isActive = false;
    this._revealedBalls = [];
    this._isSettled = false;
    this._settlementResult = null;
  }

  // === 私有方法 ===

  /** 加權隨機選球 */
  private randomBall(): BallType {
    const roll = this.rng.next() * TOTAL_WEIGHT;
    let cumulative = 0;
    for (const entry of BALL_WEIGHTS) {
      cumulative += entry.weight;
      if (roll < cumulative) {
        return entry.type;
      }
    }
    return 'Mini'; // fallback
  }

  /** 檢查是否滿足結算條件（3 顆相同，Wild 可替代） */
  private checkSettlement(): void {
    const counts = new Map<BallType, number>();
    let wildCount = 0;

    for (const ball of this._revealedBalls) {
      if (ball === 'Wild') {
        wildCount++;
      } else {
        counts.set(ball, (counts.get(ball) ?? 0) + 1);
      }
    }

    // 檢查每種球型 + Wild 是否 >= 3
    const prizeTypes: BallType[] = ['Grand', 'Major', 'Minor', 'Mini', 'Coin'];
    for (const type of prizeTypes) {
      const count = (counts.get(type) ?? 0) + wildCount;
      if (count >= 3) {
        const multiplier = PRIZE_MULTIPLIERS[type] ?? 0;
        this._settlementResult = Object.freeze({
          prizeTier: type,
          prizeAmount: multiplier * this.bet,
          revealedBalls: Object.freeze([...this._revealedBalls]),
        });
        this._isSettled = true;
        this._isActive = false;
        return;
      }
    }
  }
}
