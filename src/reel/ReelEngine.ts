/**
 * ReelEngine — 五列轉盤協調器
 *
 * 職責：
 * 1. 建立並佈局 5 個 ReelStrip，分配水平位置
 * 2. spin(grid) — 以交錯延遲依序啟動各欄旋轉
 * 3. stopAll() — 以交錯延遲依序傳入目標符號停止各欄
 * 4. 每幀 update() 驅動所有 ReelStrip
 * 5. 發送事件：SPIN_START、REEL_STOP(colIndex)、ALL_STOPPED
 *
 * 事件流程：
 *   spin() → SPIN_START
 *   spinTo(col) 對應 reel 停止 → REEL_STOP(col)
 *   所有 reel 停止 → ALL_STOPPED
 *
 * 注意：grid 參數格式為 grid[col][row]（5 欄 × 4 列）
 */

import { Container, Texture, Graphics } from 'pixi.js';
import { ReelStrip } from '@/reel/ReelStrip';
import { SYMBOL_CELL_W, SYMBOL_CELL_H } from '@/reel/SymbolView';
import type { ReadonlyMap } from '@/reel/types';
import { globalEventBus } from '@/core/EventBus';

// ─────────────────────── 事件名稱常數 ───────────────────────

/** 所有欄開始旋轉 */
export const EVENT_SPIN_START = 'REEL_ENGINE:SPIN_START';

/**
 * 單欄停止
 * payload: colIndex (number)
 */
export const EVENT_REEL_STOP = 'REEL_ENGINE:REEL_STOP';

/** 所有欄已停止 */
export const EVENT_ALL_STOPPED = 'REEL_ENGINE:ALL_STOPPED';

// ─────────────────────── 佈局常數 ───────────────────────

/** 欄數 */
const COLS = 5;
/** 可見列數 */
const ROWS = 4;
/** 欄間距（像素） */
const COL_GAP = 2;
/** 轉盤區左上角 X（在 900px 畫布上置中 750px 區域） */
const REEL_AREA_X = (900 - COLS * SYMBOL_CELL_W) / 2; // 75
/** 轉盤區左上角 Y */
const REEL_AREA_Y = 350;

/** 各欄旋轉開始的交錯延遲（毫秒） */
const STAGGER_START_MS = 100;
/** 各欄停止指令的交錯延遲（毫秒） */
const STAGGER_STOP_MS = 200;

// ─────────────────────── 型別 ───────────────────────

/**
 * 轉盤引擎的不可變設定快照
 * 每次 spin() 建立新快照
 */
interface SpinSession {
  /** 目標格線（spin 啟動時傳入） */
  readonly targetGrid: ReadonlyArray<ReadonlyArray<number>>;
  /** 各欄的停止計時器 ID（允許取消） */
  readonly stopTimers: ReadonlyArray<ReturnType<typeof setTimeout>>;
  /** 已停止的欄數（透過 _stoppedCount 追蹤） */
  readonly startTime: number;
}

// ─────────────────────── ReelEngine 主體 ───────────────────────

export class ReelEngine extends Container {
  /** 5 個 ReelStrip 實例 */
  private readonly _strips: readonly ReelStrip[];

  /** 遮罩容器（用於裁剪轉盤可見區域） */
  private readonly _maskContainer: Container;

  /** 目前旋轉會話（null 表示靜止） */
  private _session: SpinSession | null = null;

  /** 已停止的欄數計數器 */
  private _stoppedCount = 0;

  /** 是否正在旋轉 */
  private _spinning = false;

  /**
   * @param textures - 符號 ID → Texture 映射（由 SymbolManager 提供）
   */
  constructor(textures: ReadonlyMap<number, Texture>) {
    super();

    // 建立遮罩容器，子容器位置相對轉盤區左上角
    this._maskContainer = new Container();
    this._maskContainer.x = REEL_AREA_X;
    this._maskContainer.y = REEL_AREA_Y;
    this.addChild(this._maskContainer);

    // 建立並排列 5 個 ReelStrip
    const strips: ReelStrip[] = [];
    for (let col = 0; col < COLS; col++) {
      const strip = new ReelStrip(textures, col);
      // 每欄 X 位置：col × (CELL_W + GAP)
      strip.x = col * (SYMBOL_CELL_W + COL_GAP);
      strip.y = 0;
      this._maskContainer.addChild(strip);
      strips.push(strip);
    }
    this._strips = Object.freeze(strips);

    // 設定剪裁遮罩（只顯示 ROWS×CELL_H 的可見區域）
    this._applyMask();
  }

  // ─────────────────────── 公開 API ───────────────────────

  /**
   * 轉盤區在舞台上的左上角 X（讓外部可查詢實際位置）
   */
  get reelAreaX(): number {
    return this._maskContainer.x;
  }

  /**
   * 轉盤區在舞台上的左上角 Y
   */
  get reelAreaY(): number {
    return this._maskContainer.y;
  }

  /** 是否正在旋轉 */
  get spinning(): boolean {
    return this._spinning;
  }

  /**
   * 開始旋轉所有轉盤
   *
   * @param grid - 目標格線 grid[col][row]，5 欄 × 4 列
   *               此方法立即啟動所有欄的旋轉，停止時機由 stopAll() 控制，
   *               或可在 spin() 內部設定自動停止延遲。
   *
   * 若要讓旋轉自動停止，呼叫 spin() 後再呼叫 stopAll()，
   * 或設定 autoStopMs 自動延遲（此處不預設，由上層 GameController 控制）。
   */
  spin(grid: ReadonlyArray<ReadonlyArray<number>>): void {
    if (this._spinning) return;

    // 驗證格線維度
    if (grid.length !== COLS) {
      throw new Error(`[ReelEngine] grid 需要 ${COLS} 欄，收到 ${grid.length} 欄`);
    }
    for (let c = 0; c < COLS; c++) {
      if ((grid[c]?.length ?? 0) !== ROWS) {
        throw new Error(
          `[ReelEngine] grid[${c}] 需要 ${ROWS} 列，收到 ${grid[c]?.length ?? 0} 列`,
        );
      }
    }

    this._spinning = true;
    this._stoppedCount = 0;

    // 清除先前殘留的計時器（防止前一局未完成時重複呼叫）
    this._clearSession();

    // 以交錯延遲啟動各欄
    const startTimers: ReturnType<typeof setTimeout>[] = [];
    for (let col = 0; col < COLS; col++) {
      const delay = col * STAGGER_START_MS;
      const timer = setTimeout(() => {
        this._strips[col]?.startSpin();
      }, delay);
      startTimers.push(timer);
    }

    // 記錄旋轉會話（不可變快照）
    this._session = Object.freeze<SpinSession>({
      targetGrid: grid,
      stopTimers: [],
      startTime: performance.now(),
    });

    // 發送旋轉開始事件
    globalEventBus.emit(EVENT_SPIN_START);
  }

  /**
   * 停止所有轉盤（以交錯延遲傳入目標符號）
   *
   * 通常在 spin() 後、伺服器回傳結果時呼叫。
   * 若在旋轉之前呼叫則忽略。
   */
  stopAll(): void {
    if (!this._spinning || !this._session) return;

    const { targetGrid } = this._session;
    const stopTimers: ReturnType<typeof setTimeout>[] = [];

    for (let col = 0; col < COLS; col++) {
      const delay = col * STAGGER_STOP_MS;
      // 閉包捕獲 col
      const capturedCol = col;
      const timer = setTimeout(() => {
        const strip = this._strips[capturedCol];
        if (!strip) return;

        // 取出此欄的 4 個目標符號
        const colSymbols = targetGrid[capturedCol] ?? [];
        strip.spinTo(colSymbols);

        // 監聽此欄停止（輪詢方式，避免複雜的事件鏈）
        this._pollForStop(capturedCol);
      }, delay);

      stopTimers.push(timer);
    }

    // 更新會話（不可變替換）
    this._session = Object.freeze<SpinSession>({
      ...this._session,
      stopTimers,
    });
  }

  /**
   * 每幀更新，由 PixiJS Ticker 呼叫
   * @param dt - 距上幀的毫秒數（PixiJS v8 Ticker 的 deltaMS）
   */
  update(dt: number): void {
    for (const strip of this._strips) {
      strip.update(dt);
    }
  }

  /**
   * 更新所有 ReelStrip 的貼圖映射表
   * 在 SymbolManager 載入完成後呼叫
   */
  setTextures(textures: ReadonlyMap<number, Texture>): void {
    for (const strip of this._strips) {
      strip.setTextures(textures);
    }
  }

  /**
   * 取得指定欄、列的 SymbolView（供贏分高亮用）
   * @param col - 0-4
   * @param row - 0-3
   */
  getSymbolView(col: number, row: number) {
    return this._strips[col]?.getSymbolView(row) ?? null;
  }

  /**
   * 取得目前格線狀態（5×4）
   * 僅在 ALL_STOPPED 後呼叫才有完整意義
   */
  getCurrentGrid(): ReadonlyArray<ReadonlyArray<number>> {
    return this._strips.map((strip) => [...strip.getVisibleSymbols()]);
  }

  // ─────────────────────── 私有工具 ───────────────────────

  /**
   * 套用 PixiJS Graphics 遮罩，裁剪轉盤可見區域
   * 防止緩衝格在可見區域外洩出
   */
  private _applyMask(): void {
    // 在 PixiJS v8 中，使用 Graphics 作為 mask 需要設定在容器父層
    // 此處建立矩形遮罩並附加到 _maskContainer
    const mask = new Graphics();
    mask.rect(0, 0, COLS * SYMBOL_CELL_W + (COLS - 1) * COL_GAP, ROWS * SYMBOL_CELL_H);
    mask.fill(0xffffff);
    this._maskContainer.addChild(mask);
    this._maskContainer.mask = mask;
  }

  /**
   * 輪詢指定欄是否已停止，停止後發送 REEL_STOP 事件
   * 使用 RAF 輪詢而非 Ticker，因為此時間點 Ticker 未必在運行
   */
  private _pollForStop(col: number): void {
    const strip = this._strips[col];
    if (!strip) return;

    const check = (): void => {
      if (strip.isStopped) {
        // 發送單欄停止事件
        globalEventBus.emit(EVENT_REEL_STOP, col);

        this._stoppedCount += 1;
        if (this._stoppedCount >= COLS) {
          this._onAllStopped();
        }
      } else {
        requestAnimationFrame(check);
      }
    };

    check();
  }

  /**
   * 所有欄停止後的收尾處理
   */
  private _onAllStopped(): void {
    this._spinning = false;
    this._session = null;
    globalEventBus.emit(EVENT_ALL_STOPPED);
  }

  /**
   * 清除當前旋轉會話的所有計時器
   */
  private _clearSession(): void {
    if (!this._session) return;
    for (const timer of this._session.stopTimers) {
      clearTimeout(timer);
    }
    this._session = null;
  }
}
