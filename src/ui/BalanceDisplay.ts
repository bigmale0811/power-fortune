import { Container, Graphics, Sprite, Text, TextStyle, Assets } from 'pixi.js';

/**
 * BalanceDisplay — 玩家餘額顯示
 *
 * 功能：
 *   - 上方顯示 "CREDIT" 標籤（或 UiText_Credit_en.png 圖片）
 *   - 下方顯示格式化餘額數字（千分位逗號）
 *   - setBalance(amount) 更新顯示
 *
 * 視覺：
 *   - 深色半透明背景框
 *   - 標籤：淺灰色 12px
 *   - 數字：白色 24px，加粗
 *   - 嘗試載入 Balance_Frame_FX.png 作為裝飾外框
 *
 * 尺寸：160×56（portrait 底部面板左側）
 */

// ── 尺寸與顏色常數 ──────────────────────────────────────────────────────────
const W = 160;
const H = 56;

const COLOR_BG     = 0x0d0820;
const COLOR_BORDER = 0xd4af37;
const COLOR_LABEL  = 0xaaaaaa;
const COLOR_VALUE  = 0xffffff;

// ── 資源路徑 ─────────────────────────────────────────────────────────────────
const PATH_LABEL_IMG  = 'assets/Control_Panel/UiText_Credit_en.png';
const PATH_FRAME_FX   = 'assets/Control_Panel/Balance_Frame_FX.png';

export class BalanceDisplay extends Container {
    private readonly _labelText: Text;   // fallback 文字標籤
    private readonly _valueText: Text;   // 數字顯示
    private _balance: number = 0;

    constructor(initialBalance: number = 0) {
        super();

        this._balance = initialBalance;

        // 背景
        this._buildBackground();

        // "CREDIT" 標籤（fallback 文字）
        this._labelText = new Text({
            text: 'CREDIT',
            style: new TextStyle({
                fontFamily: 'Arial',
                fontSize: 11,
                fontWeight: 'bold',
                fill: COLOR_LABEL,
                letterSpacing: 3,
            }),
        });
        this._labelText.anchor.set(0.5, 0);
        this._labelText.x = W / 2;
        this._labelText.y = 7;
        this.addChild(this._labelText);

        // 餘額數字
        this._valueText = new Text({
            text: this._formatBalance(this._balance),
            style: new TextStyle({
                fontFamily: 'Arial Black',
                fontSize: 22,
                fontWeight: 'bold',
                fill: COLOR_VALUE,
                dropShadow: { color: 0x000000, blur: 4, distance: 1, angle: Math.PI / 4 },
            }),
        });
        this._valueText.anchor.set(0.5, 0);
        this._valueText.x = W / 2;
        this._valueText.y = 24;
        this.addChild(this._valueText);
    }

    // ── 非同步初始化 ────────────────────────────────────────────────────────

    /**
     * 嘗試載入 UiText_Credit_en.png 和 Balance_Frame_FX.png。
     * 須在加入 stage 後呼叫。
     */
    async init(): Promise<void> {
        const [labelResult, frameResult] = await Promise.allSettled([
            Assets.load(PATH_LABEL_IMG),
            Assets.load(PATH_FRAME_FX),
        ]);

        // 替換標籤文字為 PNG 圖片
        if (labelResult.status === 'fulfilled') {
            const sprite = new Sprite(labelResult.value);
            sprite.anchor.set(0.5, 0);
            const targetH = 14;
            sprite.scale.set(targetH / sprite.texture.height);
            sprite.x = W / 2;
            sprite.y = 5;
            this.addChild(sprite);
            this._labelText.visible = false;
            console.log('[BalanceDisplay] UiText_Credit_en.png 載入成功');
        }

        // 裝飾外框 FX
        if (frameResult.status === 'fulfilled') {
            const fx = new Sprite(frameResult.value);
            fx.anchor.set(0.5);
            fx.x = W / 2;
            fx.y = H / 2;
            // 縮放至符合容器大小
            fx.width  = W;
            fx.height = H;
            // 置於最底層
            this.addChildAt(fx, 0);
            console.log('[BalanceDisplay] Balance_Frame_FX.png 載入成功');
        }
    }

    // ── 私有：背景 ──────────────────────────────────────────────────────────

    private _buildBackground(): void {
        const bg = new Graphics();
        bg.roundRect(0, 0, W, H, 8);
        bg.fill({ color: COLOR_BG, alpha: 0.88 });
        bg.roundRect(0, 0, W, H, 8);
        bg.stroke({ color: COLOR_BORDER, width: 1.5, alpha: 0.7 });
        this.addChild(bg);
    }

    // ── 私有：格式化 ────────────────────────────────────────────────────────

    /** 千分位逗號格式（不顯示小數） */
    private _formatBalance(amount: number): string {
        return Math.floor(amount).toLocaleString('en-US');
    }

    // ── 公開 API ─────────────────────────────────────────────────────────────

    /**
     * 更新餘額顯示
     * @param amount 新的餘額（整數）
     */
    setBalance(amount: number): void {
        this._balance = amount;
        this._valueText.text = this._formatBalance(amount);
    }

    /** 取得目前顯示的餘額 */
    get balance(): number {
        return this._balance;
    }
}
