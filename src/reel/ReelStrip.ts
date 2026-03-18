/**
 * ReelStrip — 單列轉盤
 *
 * 職責：
 * 1. 維護 4 個可見格 + 上下各 1 個緩衝格（共 6 個 SymbolView）
 * 2. 控制旋轉動畫的五個階段：
 *    ACCELERATE → SPINNING → DECELERATE → BOUNCE → STOPPED
 * 3. spinTo(targetSymbols) 設定落停符號，在 DECELERATE 階段對齊目標
 * 4. update(dt) 由 PixiJS Ticker 每幀呼叫
 *
 * 座標系統：
 * - 容器左上角 = (0, 0)
 * - 可見區域高度 = VISIBLE_ROWS × CELL_H = 600px
 * - 緩衝格在 -CELL_H（上方）和 VISIBLE_ROWS×CELL_H（下方）
 *
 * 不可變狀態模式：
 * 階段切換透過產出新的 ReelState 物件而非修改現有屬性。
 */

import { Container, Texture } from 'pixi.js';
import { SymbolView, SYMBOL_CELL_H } from '@/reel/SymbolView';
import type { ReadonlyMap } from '@/reel/types';

// ─────────────────────── 常數 ───────────────────────

/** 可見列數 */
const VISIBLE_ROWS = 4;
/** 上下各一個緩衝格 */
const BUFFER_COUNT = 1;
/** 總 SymbolView 數量（含緩衝） */
const TOTAL_SLOTS = VISIBLE_ROWS + BUFFER_COUNT * 2; // 6

/** 動畫速度（像素 / 毫秒） */
const SPEED_MIN = 0.1;         // 初始極慢速
const SPEED_MAX = 3.0;         // 最高轉速
const SPEED_DECEL_TARGET = 0.4; // 減速後對齊速

/** 各階段時長（毫秒） */
const PHASE_ACCELERATE_MS = 200;
const PHASE_DECELERATE_MS = 300;
const PHASE_BOUNCE_MS     = 150;

/** Bounce 偏移量（像素，向下超衝再彈回） */
const BOUNCE_OVERSHOOT = 18;

/** 有效符號 ID 範圍 */
const SYMBOL_COUNT = 15;

// ─────────────────────── 型別 ───────────────────────

/** 旋轉階段列舉 */
export type SpinPhase =
  | 'STOPPED'
  | 'ACCELERATE'
  | 'SPINNING'
  | 'DECELERATE'
  | 'BOUNCE';

/**
 * 不可變的轉盤狀態快照
 * 每次階段切換產生新物件
 */
interface ReelState {
  readonly phase: SpinPhase;
  /** 目前滾動速度（px/ms） */
  readonly speed: number;
  /** 進入當前階段時的時間戳（ms） */
  readonly phaseStart: number;
  /** 目標落停符號（4 個，row 0-3） */
  readonly targetSymbols: readonly number[];
  /** 當前累積的 Y 偏移（每格符號相對其基準位的偏移） */
  readonly offsetY: number;
  /** Bounce 階段的峰值偏移（記錄進入 Bounce 時的 offsetY） */
  readonly bounceStart: number;
}

// ─────────────────────── 工具函式 ───────────────────────

/** 產生 [0, max) 的隨機整數 */
function randSymbol(): number {
  return Math.floor(Math.random() * SYMBOL_COUNT);
}

/** Easing: ease-in（加速時） */
function easeIn(t: number): number {
  return t * t;
}

/** Easing: ease-out（減速時） */
function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** Easing: ease-in-out（Bounce 彈回） */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ─────────────────────── ReelStrip 主體 ───────────────────────

export class ReelStrip extends Container {
  /** 6 個 SymbolView（索引 0 = 最上方緩衝格） */
  private readonly _slots: SymbolView[];

  /** 目前不可變狀態 */
  private _state: ReelState;


  /**
   * @param textures - 符號 ID → Texture 映射
   * @param colIndex - 欄索引（0-4），用於 debug 識別
   */
  constructor(textures: ReadonlyMap<number, Texture>, colIndex = 0) {
    super();
    void textures; // 保留用於未來 dynamic texture 更新
    void colIndex; // 保留用於未來 debug

    // 初始化 6 個 SymbolView，垂直排列
    // 索引 0：上緩衝（y = -CELL_H）
    // 索引 1-4：可見格（y = 0, CELL_H, 2×CELL_H, 3×CELL_H）
    // 索引 5：下緩衝（y = 4×CELL_H）
    this._slots = Array.from({ length: TOTAL_SLOTS }, (_, i) => {
      const view = new SymbolView(textures as Map<number, Texture>, randSymbol());
      view.x = 0;
      view.y = (i - BUFFER_COUNT) * SYMBOL_CELL_H; // i=0 → -CELL_H, i=1 → 0
      this.addChild(view);
      return view;
    });

    // 初始靜止狀態
    this._state = Object.freeze<ReelState>({
      phase: 'STOPPED',
      speed: 0,
      phaseStart: 0,
      targetSymbols: [],
      offsetY: 0,
      bounceStart: 0,
    });
  }

  // ─────────────────────── 公開 API ───────────────────────

  /** 目前旋轉階段 */
  get phase(): SpinPhase {
    return this._state.phase;
  }

  /** 是否已完全停止 */
  get isStopped(): boolean {
    return this._state.phase === 'STOPPED';
  }

  /**
   * 開始旋轉（進入 ACCELERATE 階段）
   * 若已在旋轉中則忽略此呼叫
   */
  startSpin(): void {
    if (this._state.phase !== 'STOPPED') return;

    this._state = Object.freeze<ReelState>({
      ...this._state,
      phase: 'ACCELERATE',
      speed: SPEED_MIN,
      phaseStart: performance.now(),
      targetSymbols: [],
      offsetY: 0,
    });
  }

  /**
   * 設定目標落停符號並觸發減速
   * @param targetSymbols - 4 個符號 ID（row 0-3，由上至下）
   */
  spinTo(targetSymbols: readonly number[]): void {
    // 只有在 SPINNING 或 ACCELERATE 階段才接受目標
    if (
      this._state.phase !== 'SPINNING' &&
      this._state.phase !== 'ACCELERATE'
    ) return;

    this._state = Object.freeze<ReelState>({
      ...this._state,
      phase: 'DECELERATE',
      phaseStart: performance.now(),
      targetSymbols: [...targetSymbols],
    });
  }

  /**
   * 每幀更新（由 ReelEngine 透過 PixiJS Ticker 呼叫）
   * @param dt - 距上一幀的時間（毫秒）
   */
  update(dt: number): void {
    switch (this._state.phase) {
      case 'ACCELERATE':
        this._updateAccelerate(dt);
        break;
      case 'SPINNING':
        this._updateSpinning(dt);
        break;
      case 'DECELERATE':
        this._updateDecelerate(dt);
        break;
      case 'BOUNCE':
        this._updateBounce();
        break;
      case 'STOPPED':
        break;
    }
  }

  /**
   * 更新所有格子的貼圖映射表
   */
  setTextures(textures: ReadonlyMap<number, Texture>): void {
    for (const slot of this._slots) {
      slot.setTextures(textures as Map<number, Texture>);
    }
  }

  // ─────────────────────── 私有：各階段更新邏輯 ───────────────────────

  /**
   * ACCELERATE 階段：速度從 SPEED_MIN 線性加速至 SPEED_MAX
   * 時長 PHASE_ACCELERATE_MS 後自動切換到 SPINNING
   */
  private _updateAccelerate(dt: number): void {
    const elapsed = performance.now() - this._state.phaseStart;
    const t = Math.min(elapsed / PHASE_ACCELERATE_MS, 1);
    const speed = SPEED_MIN + (SPEED_MAX - SPEED_MIN) * easeIn(t);

    this._scrollSlots(speed * dt);

    if (t >= 1) {
      // 自動進入 SPINNING
      this._state = Object.freeze<ReelState>({
        ...this._state,
        phase: 'SPINNING',
        speed: SPEED_MAX,
        phaseStart: performance.now(),
      });
    } else {
      this._state = Object.freeze<ReelState>({ ...this._state, speed });
    }
  }

  /**
   * SPINNING 階段：以最高速持續滾動
   * 在 spinTo() 呼叫後自動退出此階段
   * 若未收到 spinTo，超過 PHASE_SPINNING_MS 後仍持續旋轉（等待 spinTo）
   */
  private _updateSpinning(dt: number): void {
    this._scrollSlots(SPEED_MAX * dt);
  }

  /**
   * DECELERATE 階段：速度從 SPEED_MAX 減速至 SPEED_DECEL_TARGET
   * 時長 PHASE_DECELERATE_MS 後對齊目標符號，進入 BOUNCE
   */
  private _updateDecelerate(dt: number): void {
    const elapsed = performance.now() - this._state.phaseStart;
    const t = Math.min(elapsed / PHASE_DECELERATE_MS, 1);
    const speed =
      SPEED_MAX + (SPEED_DECEL_TARGET - SPEED_MAX) * easeOut(t);

    this._scrollSlots(speed * dt);

    if (t >= 1) {
      // 對齊目標符號後進入 BOUNCE
      this._snapToTarget();
      this._state = Object.freeze<ReelState>({
        ...this._state,
        phase: 'BOUNCE',
        speed: 0,
        phaseStart: performance.now(),
        bounceStart: 0,
        offsetY: 0,
      });
    } else {
      this._state = Object.freeze<ReelState>({ ...this._state, speed });
    }
  }

  /**
   * BOUNCE 階段：
   * 前半段（0 → BOUNCE_OVERSHOOT）：符號向下偏移（超衝）
   * 後半段（BOUNCE_OVERSHOOT → 0）：彈回原位
   * 完成後切換到 STOPPED
   */
  private _updateBounce(): void {
    const elapsed = performance.now() - this._state.phaseStart;
    const t = Math.min(elapsed / PHASE_BOUNCE_MS, 1);

    let offsetY: number;
    if (t < 0.5) {
      // 前半：向下超衝
      const t2 = t / 0.5;
      offsetY = BOUNCE_OVERSHOOT * easeOut(t2);
    } else {
      // 後半：彈回
      const t2 = (t - 0.5) / 0.5;
      offsetY = BOUNCE_OVERSHOOT * (1 - easeInOut(t2));
    }

    // 套用 offset 到所有格子
    this._applyOffsetY(offsetY);

    if (t >= 1) {
      // 確保完全歸位
      this._applyOffsetY(0);
      this._state = Object.freeze<ReelState>({
        ...this._state,
        phase: 'STOPPED',
        offsetY: 0,
      });
    } else {
      this._state = Object.freeze<ReelState>({ ...this._state, offsetY });
    }
  }

  // ─────────────────────── 私有：捲動與對齊 ───────────────────────

  /**
   * 將所有格子向下捲動 dy 像素
   * 超出下方邊界的格子循環至頂部，並指派新的隨機符號
   */
  private _scrollSlots(dy: number): void {
    const bottomBound = VISIBLE_ROWS * SYMBOL_CELL_H; // 600px

    for (const slot of this._slots) {
      slot.y += dy;
    }

    // 檢查是否有格子超出底部，若是則循環到頂
    for (const slot of this._slots) {
      if (slot.y >= bottomBound + SYMBOL_CELL_H) {
        // 找到最高位置的格子，將此格置於其上方
        const minY = Math.min(...this._slots.map((s) => s.y));
        slot.y = minY - SYMBOL_CELL_H;
        slot.setSymbol(randSymbol());
      }
    }
  }

  /**
   * 減速結束後，將目標符號貼齊至正確格子位置
   * 不可變：直接寫入 SymbolView.y（這是 PixiJS 物件的必要變異，
   * 但 ReelState 本身仍為不可變快照）
   */
  private _snapToTarget(): void {
    const { targetSymbols } = this._state;
    if (targetSymbols.length === 0) return;

    // 依 Y 位置排序格子，取中間 4 個作為可見區
    const sorted = [...this._slots].sort((a, b) => a.y - b.y);

    // 可見的 4 個格子：排序後索引 BUFFER_COUNT 到 BUFFER_COUNT+VISIBLE_ROWS-1
    for (let r = 0; r < VISIBLE_ROWS; r++) {
      const slot = sorted[r + BUFFER_COUNT];
      if (slot) {
        // 強制對齊到正確的 Y 位置
        slot.y = r * SYMBOL_CELL_H;
        const symId = targetSymbols[r] ?? randSymbol();
        slot.setSymbol(symId);
      }
    }

    // 重設緩衝格位置
    const topBuffer = sorted[0];
    if (topBuffer) {
      topBuffer.y = -SYMBOL_CELL_H;
      topBuffer.setSymbol(randSymbol());
    }
    const bottomBuffer = sorted[TOTAL_SLOTS - 1];
    if (bottomBuffer) {
      bottomBuffer.y = VISIBLE_ROWS * SYMBOL_CELL_H;
      bottomBuffer.setSymbol(randSymbol());
    }
  }

  /**
   * 套用 Y 偏移到所有格子（Bounce 動畫用）
   * 每格的基準位置 = 其在 snap 後的固定 Y，加上此偏移
   */
  private _applyOffsetY(offsetY: number): void {
    for (const slot of this._slots) {
      // Bounce 期間格子已對齊，直接從基準位置加偏移
      // 基準位 = slot.y - prevOffset（用增量方式）
      const prevOffset = this._state.offsetY;
      slot.y = slot.y - prevOffset + offsetY;
    }
    this._state = Object.freeze<ReelState>({ ...this._state, offsetY });
  }

  /**
   * 取得可見區的符號 ID 陣列（row 0-3，由上至下）
   * 僅在 STOPPED 後呼叫才有意義
   */
  getVisibleSymbols(): readonly number[] {
    const sorted = [...this._slots].sort((a, b) => a.y - b.y);
    return sorted
      .slice(BUFFER_COUNT, BUFFER_COUNT + VISIBLE_ROWS)
      .map((s) => s.symbolId);
  }

  /**
   * 取得指定可見列的 SymbolView（供贏分高亮用）
   * @param row - 0-3
   */
  getSymbolView(row: number): SymbolView | null {
    const sorted = [...this._slots].sort((a, b) => a.y - b.y);
    return sorted[row + BUFFER_COUNT] ?? null;
  }
}
