import { Container, Graphics, Sprite, Text, TextStyle, Assets, Ticker } from 'pixi.js';

/**
 * WinDisplay — 贏分顯示（含數字跑分動畫）
 *
 * 功能：
 *   - showWin(amount, duration?)  從 0 數到目標金額（easeOut 緩動）
 *   - clear()                     隱藏贏分顯示
 *
 * 視覺：
 *   - "WIN" 標籤（嘗試載入 UiText_Win_en.png，失敗則文字 fallback）
 *   - 金色大數字（~36px），加粗帶陰影
 *   - 隱藏時 visible = false
 *
 * 尺寸：200×70（control panel 上方中央）
 */

// ── 尺寸與顏色常數 ──────────────────────────────────────────────────────────
const W = 320;
const H = 80;

const COLOR_BG      = 0x0d0820;
const COLOR_BORDER  = 0xd4af37;
const COLOR_LABEL   = 0xaaaaaa;
const COLOR_WIN     = 0xffd700;  // 金色贏分

// ── 動畫常數 ─────────────────────────────────────────────────────────────────
const DEFAULT_DURATION_MS = 1500;  // 預設跑分持續時間（ms）

// ── 資源路徑 ─────────────────────────────────────────────────────────────────
const PATH_WIN_LABEL = 'assets/Control_Panel/UiText_Win_en.png';

/**
 * easeOutCubic — 緩速結束（讓數字在接近目標時減速）
 */
function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}

export class WinDisplay extends Container {
    private readonly _labelText: Text;   // fallback 標籤文字
    private readonly _valueText: Text;   // 贏分數字

    // 動畫狀態（不可變快照在每次 showWin 時建立）
    private _animTarget: number  = 0;
    private _animStart: number   = 0;     // DOMHighResTimeStamp
    private _animDuration: number = DEFAULT_DURATION_MS;
    private _isAnimating: boolean = false;

    private readonly _onTick: () => void;

    constructor() {
        super();
        this.visible = false;  // 初始隱藏

        // 背景
        this._buildBackground();

        // "WIN" 標籤（fallback）
        this._labelText = new Text({
            text: 'WIN',
            style: new TextStyle({
                fontFamily: 'Arial',
                fontSize: 12,
                fontWeight: 'bold',
                fill: COLOR_LABEL,
                letterSpacing: 4,
            }),
        });
        this._labelText.anchor.set(0.5, 0);
        this._labelText.x = W / 2;
        this._labelText.y = 6;
        this.addChild(this._labelText);

        // 贏分數字（初始隱藏）
        this._valueText = new Text({
            text: '0',
            style: new TextStyle({
                fontFamily: 'Arial Black',
                fontSize: 40,
                fontWeight: 'bold',
                fill: COLOR_WIN,
                dropShadow: {
                    color: 0x884400,
                    blur: 8,
                    distance: 3,
                    angle: Math.PI / 4,
                },
                stroke: { color: 0x7a4000, width: 2 },
            }),
        });
        this._valueText.anchor.set(0.5, 0);
        this._valueText.x = W / 2;
        this._valueText.y = 22;
        this.addChild(this._valueText);

        // Ticker 回呼（使用 closure 保持 this 綁定）
        this._onTick = () => this._tickAnimate();
    }

    // ── 非同步初始化 ────────────────────────────────────────────────────────

    /**
     * 嘗試載入 UiText_Win_en.png。
     * 須在加入 stage 後呼叫。
     */
    async init(): Promise<void> {
        try {
            const tex = await Assets.load(PATH_WIN_LABEL);
            const sprite = new Sprite(tex);
            sprite.anchor.set(0.5, 0);
            const targetH = 16;
            sprite.scale.set(targetH / sprite.texture.height);
            sprite.x = W / 2;
            sprite.y = 4;
            this.addChild(sprite);
            this._labelText.visible = false;
            console.log('[WinDisplay] UiText_Win_en.png 載入成功');
        } catch {
            // 保持文字 fallback
        }
    }

    // ── 私有：背景 ──────────────────────────────────────────────────────────

    private _buildBackground(): void {
        const bg = new Graphics();
        bg.roundRect(0, 0, W, H, 10);
        bg.fill({ color: COLOR_BG, alpha: 0.88 });
        bg.roundRect(0, 0, W, H, 10);
        bg.stroke({ color: COLOR_BORDER, width: 1.5, alpha: 0.7 });
        // 黃金頂部光條（突顯贏分區域）
        bg.roundRect(2, 0, W - 4, 3, 2);
        bg.fill({ color: COLOR_WIN, alpha: 0.6 });
        this.addChild(bg);
    }

    // ── 動畫 Ticker ──────────────────────────────────────────────────────────

    private _tickAnimate(): void {
        if (!this._isAnimating) return;

        const now      = performance.now();
        const elapsed  = now - this._animStart;
        const progress = Math.min(elapsed / this._animDuration, 1);
        const easedT   = easeOutCubic(progress);

        // 更新顯示數字
        const currentValue = Math.round(this._animTarget * easedT);
        this._valueText.text = this._formatAmount(currentValue);

        if (progress >= 1) {
            // 動畫結束：確保顯示最終值
            this._valueText.text = this._formatAmount(this._animTarget);
            this._isAnimating = false;
            Ticker.shared.remove(this._onTick);
        }
    }

    // ── 私有：格式化 ────────────────────────────────────────────────────────

    private _formatAmount(amount: number): string {
        return amount.toLocaleString('en-US');
    }

    // ── 公開 API ─────────────────────────────────────────────────────────────

    /**
     * 顯示贏分並啟動數字跑分動畫
     * @param amount   目標贏分金額
     * @param duration 動畫持續時間（毫秒，預設 1500ms）
     */
    showWin(amount: number, duration: number = DEFAULT_DURATION_MS): void {
        // 停止舊動畫
        if (this._isAnimating) {
            this._isAnimating = false;
            Ticker.shared.remove(this._onTick);
        }

        if (amount <= 0) {
            this.clear();
            return;
        }

        // 設定動畫參數（不可變快照）
        this._animTarget   = amount;
        this._animDuration = Math.max(200, duration);
        this._animStart    = performance.now();
        this._isAnimating  = true;

        // 初始顯示 0
        this._valueText.text = this._formatAmount(0);
        this.visible = true;

        // 啟動 Ticker
        Ticker.shared.add(this._onTick);
    }

    /**
     * 立即顯示指定金額（無動畫）
     */
    showImmediate(amount: number): void {
        if (this._isAnimating) {
            this._isAnimating = false;
            Ticker.shared.remove(this._onTick);
        }
        this._valueText.text = this._formatAmount(amount);
        this.visible = amount > 0;
    }

    /**
     * 隱藏贏分顯示
     */
    clear(): void {
        if (this._isAnimating) {
            this._isAnimating = false;
            Ticker.shared.remove(this._onTick);
        }
        this.visible = false;
        this._valueText.text = '0';
    }

    /** 是否正在顯示贏分 */
    get isVisible(): boolean {
        return this.visible;
    }

    override destroy(): void {
        if (this._isAnimating) {
            Ticker.shared.remove(this._onTick);
        }
        super.destroy();
    }
}
