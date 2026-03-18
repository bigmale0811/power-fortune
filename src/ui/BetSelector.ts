import { Container, Graphics, Sprite, Text, TextStyle, Assets } from 'pixi.js';

/**
 * BetSelector — 下注金額選擇器
 *
 * 功能：
 *   - 顯示目前下注金額
 *   - +/- 按鈕循環切換下注選項（預設：[10, 20, 50, 100, 200, 500]）
 *   - 發出 'betChanged' 事件，攜帶新的下注金額
 *
 * 視覺：
 *   - 優先使用 Control_Panel/UiBtn_BetOption.png 作為按鈕圖片
 *   - 優先使用 Control_Panel/UiText_TotalBet_en.png 作為標籤
 *   - 失敗則退回 Graphics + Text fallback
 *
 * 尺寸：180×64（portrait 底部面板左側）
 */

// ── 尺寸與顏色常數 ──────────────────────────────────────────────────────────
const W = 180;
const H = 64;

const COLOR_BG      = 0x0d0820;
const COLOR_BORDER  = 0xd4af37;  // 金色邊框
const COLOR_GOLD    = 0xffd700;
const COLOR_LABEL   = 0xaaaaaa;
const COLOR_HOVER   = 0xffed4a;

// ── 資源路徑 ─────────────────────────────────────────────────────────────────
const PATH_BTN_OPTION = 'assets/Control_Panel/UiBtn_BetOption.png';
const PATH_BTN_SELECT = 'assets/Control_Panel/UiBtn_BetSelect.png';
const PATH_LABEL_TEXT = 'assets/Control_Panel/UiText_TotalBet_en.png';

export class BetSelector extends Container {
    // ── 狀態 ─────────────────────────────────────────────────────────────────
    private readonly _options: readonly number[];
    private _index: number;
    private _enabled: boolean = true;

    // ── 視覺元素 ─────────────────────────────────────────────────────────────
    private readonly _minusBtn: Container;
    private readonly _plusBtn: Container;
    private readonly _valueText: Text;
    private readonly _labelText: Text;

    constructor(options: number[] = [10, 20, 50, 100, 200, 500], initialBet: number = 100) {
        super();

        // 不可變陣列（防止外部修改）
        this._options = Object.freeze([...options]);
        const idx     = this._options.indexOf(initialBet);
        this._index   = idx >= 0 ? idx : 0;

        // 建立 Graphics 元件
        this._buildBackground();

        this._labelText = this._createLabel('TOTAL BET');
        this.addChild(this._labelText);

        this._valueText = this._createValueText(this._formatBet(this.currentBet));
        this.addChild(this._valueText);

        this._minusBtn = this._createSideButton('-');
        this._plusBtn  = this._createSideButton('+');

        // 佈局
        this._labelText.x = W / 2;
        this._labelText.y = 8;

        this._valueText.x = W / 2;
        this._valueText.y = 24;

        this._minusBtn.x = 18;
        this._minusBtn.y = H / 2 + 2;
        this.addChild(this._minusBtn);

        this._plusBtn.x = W - 18;
        this._plusBtn.y = H / 2 + 2;
        this.addChild(this._plusBtn);

        this._bindEvents();
    }

    // ── 非同步初始化（嘗試載入 PNG 資源） ─────────────────────────────────────

    async init(): Promise<void> {
        // 並行載入標籤圖片與按鈕圖片
        const [labelResult, btnResult] = await Promise.allSettled([
            Assets.load(PATH_LABEL_TEXT),
            Assets.load(PATH_BTN_SELECT),
        ]);

        if (labelResult.status === 'fulfilled') {
            // 替換文字標籤為 PNG 圖片
            const sprite = new Sprite(labelResult.value);
            sprite.anchor.set(0.5, 0);
            const targetH = 16;
            sprite.scale.set(targetH / sprite.texture.height);
            sprite.x = W / 2;
            sprite.y = 6;
            this.addChild(sprite);
            // 隱藏文字 fallback
            this._labelText.visible = false;
            console.log('[BetSelector] UiText_TotalBet_en.png 載入成功');
        }

        if (btnResult.status === 'fulfilled') {
            // 為 - / + 按鈕替換為 Sprite（複用同一張圖，左右分別）
            await this._replaceSideBtnSprite(this._minusBtn, PATH_BTN_OPTION, '-');
            await this._replaceSideBtnSprite(this._plusBtn, PATH_BTN_OPTION, '+');
            console.log('[BetSelector] 下注按鈕 PNG 載入成功');
        }
    }

    // ── 私有：背景建立 ──────────────────────────────────────────────────────

    private _buildBackground(): void {
        const bg = new Graphics();
        bg.roundRect(0, 0, W, H, 10);
        bg.fill({ color: COLOR_BG, alpha: 0.88 });
        bg.roundRect(0, 0, W, H, 10);
        bg.stroke({ color: COLOR_BORDER, width: 1.5, alpha: 0.8 });
        // 頂部微弱高光
        bg.roundRect(2, 1, W - 4, H * 0.35, 8);
        bg.fill({ color: 0xffffff, alpha: 0.04 });
        this.addChild(bg);
    }

    // ── 私有：建立文字元素 ──────────────────────────────────────────────────

    private _createLabel(text: string): Text {
        const t = new Text({
            text,
            style: new TextStyle({
                fontFamily: 'Arial',
                fontSize: 11,
                fontWeight: 'bold',
                fill: COLOR_LABEL,
                letterSpacing: 2,
            }),
        });
        t.anchor.set(0.5, 0);
        return t;
    }

    private _createValueText(text: string): Text {
        const t = new Text({
            text,
            style: new TextStyle({
                fontFamily: 'Arial Black',
                fontSize: 20,
                fontWeight: 'bold',
                fill: COLOR_GOLD,
                dropShadow: { color: 0x000000, blur: 4, distance: 1, angle: Math.PI / 4 },
            }),
        });
        t.anchor.set(0.5, 0);
        return t;
    }

    // ── 私有：建立 +/- 按鈕 ─────────────────────────────────────────────────

    private _createSideButton(symbol: '-' | '+'): Container {
        const btn = new Container();
        btn.eventMode = 'static';
        btn.cursor    = 'pointer';

        const g = new Graphics();
        this._drawBtnGraphics(g, false);
        btn.addChild(g);

        const lbl = new Text({
            text: symbol,
            style: new TextStyle({
                fontFamily: 'Arial Black',
                fontSize: 18,
                fontWeight: 'bold',
                fill: COLOR_GOLD,
            }),
        });
        lbl.anchor.set(0.5);
        lbl.y = symbol === '-' ? -1 : 0;
        btn.addChild(lbl);

        // Hover 效果
        btn.on('pointerover', () => {
            this._drawBtnGraphics(g, true);
            (lbl.style as TextStyle).fill = COLOR_HOVER;
        });
        btn.on('pointerout', () => {
            this._drawBtnGraphics(g, false);
            (lbl.style as TextStyle).fill = COLOR_GOLD;
        });

        return btn;
    }

    private _drawBtnGraphics(g: Graphics, hover: boolean): void {
        g.clear();
        g.circle(0, 0, 15);
        g.fill({ color: hover ? 0x2a1a55 : 0x18103a });
        g.circle(0, 0, 15);
        g.stroke({ color: hover ? COLOR_HOVER : COLOR_BORDER, width: hover ? 2 : 1.5 });
    }

    /** 嘗試用 PNG 替換 side button 圖示 */
    private async _replaceSideBtnSprite(
        btn: Container,
        path: string,
        _symbol: '-' | '+',
    ): Promise<void> {
        try {
            const tex = await Assets.load(path);
            const sprite = new Sprite(tex);
            sprite.anchor.set(0.5);
            sprite.width  = 30;
            sprite.height = 30;
            // 在最底層插入（保留文字標籤在上層）
            btn.addChildAt(sprite, 0);
            // 若 PNG 已包含符號圖案，隱藏文字
            if (btn.children.length > 1) {
                // 保持文字顯示（PNG 只是背景）
            }
        } catch {
            // 保持 Graphics fallback
        }
    }

    // ── 私有：事件綁定 ──────────────────────────────────────────────────────

    private _bindEvents(): void {
        this._minusBtn.on('pointerup', () => {
            if (!this._enabled) return;
            // 前一個選項（到底則循環到最大）
            this._index = this._index > 0 ? this._index - 1 : this._options.length - 1;
            this._refresh();
            this.emit('betChanged', this.currentBet);
        });

        this._plusBtn.on('pointerup', () => {
            if (!this._enabled) return;
            // 下一個選項（到頂則循環到最小）
            this._index = this._index < this._options.length - 1 ? this._index + 1 : 0;
            this._refresh();
            this.emit('betChanged', this.currentBet);
        });
    }

    // ── 私有：刷新顯示 ──────────────────────────────────────────────────────

    private _refresh(): void {
        this._valueText.text = this._formatBet(this.currentBet);
    }

    private _formatBet(amount: number): string {
        return amount.toLocaleString('en-US');
    }

    // ── 公開 API ─────────────────────────────────────────────────────────────

    /** 目前下注金額 */
    get currentBet(): number {
        return this._options[this._index] ?? this._options[0] ?? 10;
    }

    /**
     * 強制設定下注金額
     * 若不在選項中，取最接近但不超過的選項
     */
    setBet(amount: number): void {
        const exactIdx = this._options.indexOf(amount);
        if (exactIdx >= 0) {
            this._index = exactIdx;
        } else {
            let best = 0;
            for (let i = 0; i < this._options.length; i++) {
                if ((this._options[i] ?? 0) <= amount) best = i;
            }
            this._index = best;
        }
        this._refresh();
    }

    /**
     * 啟用/停用（旋轉中禁止更改下注）
     */
    setEnabled(enabled: boolean): void {
        this._enabled = enabled;
        this._minusBtn.eventMode = enabled ? 'static' : 'none';
        this._plusBtn.eventMode  = enabled ? 'static' : 'none';
        this._minusBtn.alpha     = enabled ? 1 : 0.4;
        this._plusBtn.alpha      = enabled ? 1 : 0.4;
        this._valueText.alpha    = enabled ? 1 : 0.6;
    }

    /** 取得所有下注選項 */
    get options(): readonly number[] {
        return this._options;
    }
}
