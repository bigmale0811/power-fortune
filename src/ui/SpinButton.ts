import { Container, Graphics, Sprite, Texture, Assets, Ticker, Circle, Text, TextStyle } from 'pixi.js';

/**
 * SpinButton — 旋轉按鈕
 *
 * 三種狀態：
 *   IDLE     — 綠色光暈，可點擊
 *   SPINNING — 灰色，禁用（旋轉中）
 *   DISABLED — 暗色，禁用（餘額不足等）
 *
 * 優先使用 Control_Panel/UiBtn_Start.png 作為按鈕圖片；
 * 若載入失敗，退回 Graphics 繪製的金色圓形按鈕。
 *
 * 事件：pointerup 時 emit 'spin'
 */

// ── 狀態型別 ────────────────────────────────────────────────────────────────
type SpinState = 'idle' | 'spinning' | 'disabled';

// ── 視覺常數 ─────────────────────────────────────────────────────────────────
const RADIUS       = 60;   // 按鈕圓形半徑（px）
const RING_WIDTH   = 8;    // 外環寬度
const GLOW_RADIUS  = 72;   // 光暈半徑（hitArea 尺寸）

const COLOR_IDLE_OUTER    = 0x00cc44;  // 綠色外環
const COLOR_IDLE_INNER    = 0x007722;  // 深綠內圓
const COLOR_IDLE_GLOW     = 0x00ff66;  // 光暈色
const COLOR_SPIN_OUTER    = 0x666666;  // 旋轉中：灰色
const COLOR_SPIN_INNER    = 0x444444;
const COLOR_DISABLED_RING = 0x333333;  // 禁用：深暗
const COLOR_DISABLED_FILL = 0x222222;
const COLOR_WHITE         = 0xffffff;

// ── 資源路徑 ─────────────────────────────────────────────────────────────────
const ASSET_PATH = 'assets/Control_Panel/UiBtn_Start.png';

export class SpinButton extends Container {
    // 狀態
    private _state: SpinState = 'idle';
    private _isPressed: boolean = false;
    private _targetScale: number = 1.0;

    // Sprite 模式（PNG 載入成功時）
    private _btnSprite: Sprite | null = null;
    private _usePng: boolean = false;

    // Graphics fallback 圖層
    private _bgGlow: Graphics;
    private _bgCircle: Graphics;
    private _icon: Graphics;
    private _label: Text;

    constructor() {
        super();

        // 建立 Graphics 圖層
        this._bgGlow   = new Graphics();
        this._bgCircle = new Graphics();
        this._icon     = new Graphics();

        // SPIN 文字標籤（fallback 用）
        this._label = new Text({
            text: 'SPIN',
            style: new TextStyle({
                fontFamily: 'Arial Black',
                fontSize: 20,
                fontWeight: 'bold',
                fill: COLOR_WHITE,
                dropShadow: { color: 0x000000, blur: 4, distance: 2, angle: Math.PI / 4 },
            }),
        });
        this._label.anchor.set(0.5);

        this.addChild(this._bgGlow);
        this.addChild(this._bgCircle);
        this.addChild(this._icon);
        this.addChild(this._label);

        // 初始繪製
        this._drawIdle();
        this._drawSpinIcon(COLOR_WHITE);

        // 互動設定
        this.eventMode = 'static';
        this.cursor = 'pointer';
        this.hitArea = new Circle(0, 0, GLOW_RADIUS);

        this.on('pointerover', this._onHover, this);
        this.on('pointerout', this._onOut, this);
        this.on('pointerdown', this._onDown, this);
        this.on('pointerup', this._onUp, this);
        this.on('pointerupoutside', this._onOut, this);

        // 縮放插值動畫
        Ticker.shared.add(this._onTick, this);
    }

    // ── 非同步載入 PNG ──────────────────────────────────────────────────────

    /**
     * 嘗試載入 UiBtn_Start.png；成功則切換到 Sprite 模式。
     * 須在 addChild 加入 stage 後呼叫。
     */
    async loadTextures(): Promise<void> {
        try {
            const tex: Texture = await Assets.load(ASSET_PATH);
            this._btnSprite = new Sprite(tex);
            this._btnSprite.anchor.set(0.5);
            // 縮放至目標直徑（140px）
            const targetSize = (RADIUS + RING_WIDTH) * 2;
            this._btnSprite.width  = targetSize;
            this._btnSprite.height = targetSize;

            // 隱藏 Graphics fallback
            this._bgGlow.visible   = false;
            this._bgCircle.visible = false;
            this._icon.visible     = false;
            this._label.visible    = false;

            this.addChildAt(this._btnSprite, 0);
            this._usePng = true;
            console.log('[SpinButton] UiBtn_Start.png 載入成功，切換 Sprite 模式');
        } catch {
            console.warn('[SpinButton] UiBtn_Start.png 未找到，使用 Graphics fallback');
        }
    }

    // ── 狀態繪製（Graphics fallback） ──────────────────────────────────────

    private _drawIdle(): void {
        // 外光暈
        this._bgGlow.clear();
        this._bgGlow.circle(0, 0, GLOW_RADIUS);
        this._bgGlow.fill({ color: COLOR_IDLE_GLOW, alpha: 0.15 });

        // 按鈕本體：外環 + 內圓
        this._bgCircle.clear();
        this._bgCircle.circle(0, 0, RADIUS);
        this._bgCircle.fill({ color: COLOR_IDLE_OUTER });
        this._bgCircle.circle(0, 0, RADIUS - RING_WIDTH);
        this._bgCircle.fill({ color: COLOR_IDLE_INNER });
        // 頂部高光
        this._bgCircle.circle(0, -(RADIUS - RING_WIDTH) * 0.3, (RADIUS - RING_WIDTH) * 0.4);
        this._bgCircle.fill({ color: COLOR_WHITE, alpha: 0.08 });
    }

    private _drawSpinning(): void {
        this._bgGlow.clear();

        this._bgCircle.clear();
        this._bgCircle.circle(0, 0, RADIUS);
        this._bgCircle.fill({ color: COLOR_SPIN_OUTER });
        this._bgCircle.circle(0, 0, RADIUS - RING_WIDTH);
        this._bgCircle.fill({ color: COLOR_SPIN_INNER });
    }

    private _drawDisabled(): void {
        this._bgGlow.clear();

        this._bgCircle.clear();
        this._bgCircle.circle(0, 0, RADIUS);
        this._bgCircle.fill({ color: COLOR_DISABLED_RING });
        this._bgCircle.circle(0, 0, RADIUS - RING_WIDTH);
        this._bgCircle.fill({ color: COLOR_DISABLED_FILL });
    }

    private _drawHover(): void {
        // Hover 時光暈更強
        this._bgGlow.clear();
        this._bgGlow.circle(0, 0, GLOW_RADIUS + 6);
        this._bgGlow.fill({ color: COLOR_IDLE_GLOW, alpha: 0.25 });
        this._bgGlow.circle(0, 0, GLOW_RADIUS);
        this._bgGlow.fill({ color: COLOR_IDLE_GLOW, alpha: 0.12 });

        this._bgCircle.clear();
        this._bgCircle.circle(0, 0, RADIUS);
        this._bgCircle.fill({ color: 0x00ee55 });
        this._bgCircle.circle(0, 0, RADIUS - RING_WIDTH);
        this._bgCircle.fill({ color: 0x009933 });
    }

    /** 弧形旋轉箭頭圖示（原版風格） */
    private _drawSpinIcon(color: number): void {
        const R = 28;
        this._icon.clear();

        // 270 度弧線
        const segments   = 20;
        const startAngle = -Math.PI * 0.75;
        const endAngle   = Math.PI * 0.75;

        for (let i = 0; i <= segments; i++) {
            const t = startAngle + (endAngle - startAngle) * (i / segments);
            const x = Math.cos(t) * R;
            const y = Math.sin(t) * R;
            if (i === 0) this._icon.moveTo(x, y);
            else this._icon.lineTo(x, y);
        }
        this._icon.stroke({ color, width: 3, cap: 'round' });

        // 箭頭頭部
        const ex = Math.cos(endAngle) * R;
        const ey = Math.sin(endAngle) * R;
        const arrowSize = 6;
        this._icon.moveTo(ex, ey);
        this._icon.lineTo(ex + arrowSize, ey - arrowSize * 1.2);
        this._icon.lineTo(ex - arrowSize * 0.4, ey - arrowSize * 0.4);
        this._icon.closePath();
        this._icon.fill({ color });
    }

    private _applyGraphicsState(state: SpinState, isHover: boolean = false): void {
        if (this._usePng) return;  // Sprite 模式不需要 Graphics 繪製

        if (state === 'spinning') {
            this._drawSpinning();
            this._drawSpinIcon(0x888888);
            this._label.alpha = 0.5;
        } else if (state === 'disabled') {
            this._drawDisabled();
            this._drawSpinIcon(0x555555);
            this._label.alpha = 0.4;
        } else if (isHover) {
            this._drawHover();
            this._drawSpinIcon(COLOR_WHITE);
            this._label.alpha = 1;
        } else {
            this._drawIdle();
            this._drawSpinIcon(COLOR_WHITE);
            this._label.alpha = 1;
        }
    }

    /** 更新 Sprite tint（PNG 模式下的狀態視覺） */
    private _applySpriteTint(state: SpinState): void {
        if (!this._btnSprite) return;
        switch (state) {
            case 'idle':     this._btnSprite.tint = 0xffffff; break;
            case 'spinning': this._btnSprite.tint = 0x999999; break;
            case 'disabled': this._btnSprite.tint = 0x555555; break;
        }
    }

    // ── 指標事件 ─────────────────────────────────────────────────────────────

    private _onHover(): void {
        if (this._state !== 'idle') return;
        this._targetScale = 1.06;
        this._applyGraphicsState('idle', true);
    }

    private _onOut(): void {
        if (this._state !== 'idle') return;
        this._isPressed = false;
        this._targetScale = 1.0;
        this._applyGraphicsState('idle', false);
    }

    private _onDown(): void {
        if (this._state !== 'idle') return;
        this._isPressed = true;
        this._targetScale = 0.93;
        this._applyGraphicsState('idle', false);
    }

    private _onUp(): void {
        if (this._state !== 'idle' || !this._isPressed) return;
        this._isPressed  = false;
        this._targetScale = 1.06;
        this.emit('spin');

        // 短暫停頓後恢復縮放
        setTimeout(() => {
            if (this._state === 'idle') {
                this._targetScale = 1.0;
                this._applyGraphicsState('idle', false);
            }
        }, 150);
    }

    // ── Ticker 縮放插值 ───────────────────────────────────────────────────────

    private _onTick = (): void => {
        const diff = this._targetScale - this.scale.x;
        if (Math.abs(diff) > 0.001) {
            this.scale.set(this.scale.x + diff * 0.18);
        } else {
            this.scale.set(this._targetScale);
        }
    };

    // ── 公開 API ──────────────────────────────────────────────────────────────

    /**
     * 設定按鈕啟用狀態（禁用時不可點擊、顯示暗色）
     */
    setEnabled(enabled: boolean): void {
        this._state = enabled ? 'idle' : 'disabled';
        this.cursor = enabled ? 'pointer' : 'default';
        this._targetScale = 1.0;
        this.scale.set(1.0);
        this._applyGraphicsState(this._state);
        this._applySpriteTint(this._state);
    }

    /**
     * 設定旋轉中狀態（旋轉中灰色禁用，旋轉完成恢復）
     */
    setSpinning(spinning: boolean): void {
        this._state = spinning ? 'spinning' : 'idle';
        this.cursor = spinning ? 'default' : 'pointer';
        this._targetScale = 1.0;
        this.scale.set(1.0);
        this._applyGraphicsState(this._state);
        this._applySpriteTint(this._state);
    }

    /** 取得目前狀態 */
    get state(): SpinState {
        return this._state;
    }

    override destroy(): void {
        Ticker.shared.remove(this._onTick, this);
        super.destroy();
    }
}
