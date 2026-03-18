import { Container, Graphics, Ticker } from 'pixi.js';
import type { WinLine } from '@/core/constants';

/**
 * WinHighlight — 贏線高亮顯示
 *
 * 在轉輪格線上，為每條中獎線的所有獲獎格子繪製發光邊框矩形。
 *
 * 動畫效果：
 *   - 邊框透明度在 0.3 ~ 1.0 之間週期性脈動（sine wave）
 *   - 脈動週期約 800ms
 *
 * 視覺規格：
 *   - 金色筆觸（0xffcc00），線寬 3px
 *   - 內部半透明金色填充（低 alpha 凸顯格子）
 *   - 格子尺寸由外部 constructor 傳入
 */

// ── 動畫常數 ──────────────────────────────────────────────────────────────────
/** 透明度脈動週期（ms） */
const PULSE_PERIOD_MS = 800;
/** 最低透明度 */
const ALPHA_MIN = 0.3;
/** 最高透明度 */
const ALPHA_MAX = 1.0;

// ── 視覺常數 ──────────────────────────────────────────────────────────────────
/** 高亮邊框顏色（金色） */
const COLOR_STROKE = 0xffcc00;
/** 高亮填充顏色（偏橙金） */
const COLOR_FILL   = 0xffaa00;
/** 填充最大透明度（比邊框低，避免遮蓋符號） */
const FILL_ALPHA_MAX = 0.2;

/** 邊框線寬（px） */
const LINE_WIDTH_VALUE = 3;

/**
 * 一個高亮格子的位置描述
 * positions 來自 WinLine.positions: readonly (readonly number[])[]
 * 每個元素格式為 [colIndex, rowIndex]
 */
interface HighlightCell {
    readonly col: number;
    readonly row: number;
}

export class WinHighlight extends Container {
    // ── 格線參數（不可變） ────────────────────────────────────────────────────
    private readonly _reelAreaX: number;
    private readonly _reelAreaY: number;
    private readonly _cellW: number;
    private readonly _cellH: number;

    // ── 視覺元素 ─────────────────────────────────────────────────────────────
    /** 所有高亮矩形的 Graphics 列表（每條贏線一個） */
    private _highlights: Graphics[] = [];

    // ── 動畫狀態 ─────────────────────────────────────────────────────────────
    private _timer: number = 0;
    private _isAnimating: boolean = false;

    // ── Ticker 回呼（固定參考以便移除） ─────────────────────────────────────
    private readonly _onTick: () => void;

    /**
     * @param reelAreaX  轉輪格線左上角 X 座標（畫布座標）
     * @param reelAreaY  轉輪格線左上角 Y 座標（畫布座標）
     * @param cellW      每格寬度（px）
     * @param cellH      每格高度（px）
     */
    constructor(
        reelAreaX: number,
        reelAreaY: number,
        cellW: number,
        cellH: number,
    ) {
        super();

        this._reelAreaX = reelAreaX;
        this._reelAreaY = reelAreaY;
        this._cellW     = cellW;
        this._cellH     = cellH;

        this._onTick = () => this._tickAnimate();
    }

    // ── 公開 API ─────────────────────────────────────────────────────────────

    /**
     * 顯示所有中獎線的高亮框。
     *
     * 若傳入空陣列，等同呼叫 clear()。
     *
     * @param wins  WinLine 陣列（來自評估結果）
     */
    showWins(wins: readonly WinLine[]): void {
        // 先清除舊的高亮
        this.clear();

        if (wins.length === 0) return;

        // 收集所有不重複的獲獎格子（避免同一格子被繪製多次）
        const uniqueCells = this._collectUniqueCells(wins);

        // 繪製每個格子的高亮邊框
        for (const cell of uniqueCells) {
            const g = this._drawHighlightRect(cell.col, cell.row);
            this._highlights.push(g);
            this.addChild(g);
        }

        // 啟動脈動動畫
        if (this._highlights.length > 0) {
            this._timer = 0;
            this._isAnimating = true;
            Ticker.shared.add(this._onTick);
        }
    }

    /**
     * 清除所有高亮框並停止動畫。
     */
    clear(): void {
        // 停止 Ticker
        if (this._isAnimating) {
            this._isAnimating = false;
            Ticker.shared.remove(this._onTick);
        }

        // 移除並銷毀所有 Graphics
        for (const g of this._highlights) {
            this.removeChild(g);
            g.destroy();
        }
        this._highlights = [];
    }

    override destroy(): void {
        this.clear();
        super.destroy();
    }

    // ── 私有：收集不重複格子 ─────────────────────────────────────────────────

    /**
     * 從多條 WinLine 收集所有獲獎格子，去除重複位置。
     *
     * WinLine.positions 格式：readonly (readonly number[])[]
     * 每個元素 [col, row]（依照 constants.ts 的定義）
     */
    private _collectUniqueCells(wins: readonly WinLine[]): HighlightCell[] {
        const seen   = new Set<string>();
        const result: HighlightCell[] = [];

        for (const win of wins) {
            for (const pos of win.positions) {
                // pos 格式：[col, row]
                const col = pos[0] ?? 0;
                const row = pos[1] ?? 0;
                const key = `${col},${row}`;

                if (!seen.has(key)) {
                    seen.add(key);
                    result.push({ col, row });
                }
            }
        }

        return result;
    }

    // ── 私有：繪製單一格子高亮 ──────────────────────────────────────────────

    /**
     * 在指定格子位置繪製金色邊框矩形（帶圓角）。
     *
     * @param col  欄索引（0-based）
     * @param row  列索引（0-based）
     * @returns    已繪製的 Graphics 物件
     */
    private _drawHighlightRect(col: number, row: number): Graphics {
        const g = new Graphics();

        const x = this._reelAreaX + col * this._cellW;
        const y = this._reelAreaY + row * this._cellH;
        const w = this._cellW;
        const h = this._cellH;

        // 內部半透明填充（凸顯格子，初始 alpha 由動畫控制）
        g.roundRect(x + 2, y + 2, w - 4, h - 4, 8);
        g.fill({ color: COLOR_FILL, alpha: FILL_ALPHA_MAX });

        // 金色邊框（初始完整透明度，動畫中動態修改 alpha）
        g.roundRect(x + 2, y + 2, w - 4, h - 4, 8);
        g.stroke({ color: COLOR_STROKE, width: LINE_WIDTH_VALUE, alpha: ALPHA_MAX });

        return g;
    }

    // ── Ticker 動畫主迴圈 ─────────────────────────────────────────────────────

    private _tickAnimate(): void {
        if (!this._isAnimating) return;

        // 計時器遞增（約 16ms/幀 @ 60fps）
        this._timer += 16;

        // sine wave：0 ~ 1 之間週期變化，映射到 [ALPHA_MIN, ALPHA_MAX] 區間
        const sinVal = (Math.sin((this._timer / PULSE_PERIOD_MS) * Math.PI * 2) + 1) / 2;
        const alpha  = ALPHA_MIN + sinVal * (ALPHA_MAX - ALPHA_MIN);

        // 更新所有高亮 Graphics 的透明度（填充色透過整體 g.alpha 縮放，無需重繪）
        for (const g of this._highlights) {
            g.alpha = alpha;
        }
    }
}
