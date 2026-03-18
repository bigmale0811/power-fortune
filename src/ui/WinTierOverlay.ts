import {
    Container,
    Graphics,
    Sprite,
    Text,
    TextStyle,
    Assets,
    Ticker,
    Texture,
} from 'pixi.js';

/**
 * WinTierOverlay — 大獎全螢幕覆蓋層
 *
 * 根據贏分倍率（totalWin / bet）顯示不同等級的大獎演出：
 *   - NORMAL         : 不顯示（由 WinDisplay 處理）
 *   - BIG_WIN        : 倍率 >= 15x — 金色 "BIG WIN" + 數字跑分
 *   - MEGA_WIN       : 倍率 >= 50x — 更大 "MEGA WIN" + 粒子特效
 *   - SUPER_MEGA_WIN : 倍率 >= 100x — 全螢幕 "SUPER MEGA WIN"
 *
 * 畫布尺寸：900×1600（直向）
 */

// ── 畫布尺寸常數 ──────────────────────────────────────────────────────────────
const CANVAS_W = 900;
const CANVAS_H = 1600;

// ── 贏分等級門檻（以 bet 倍率計算） ──────────────────────────────────────────
const RATIO_BIG_WIN    = 15;
const RATIO_MEGA_WIN   = 50;
const RATIO_SUPER_MEGA = 100;

// ── 動畫參數 ──────────────────────────────────────────────────────────────────
/** 數字跑分持續時間（ms） */
const COUNTUP_DURATION_MS = 2500;
/** 跑分結束後自動關閉延遲（ms） */
const AUTO_DISMISS_DELAY_MS = 1500;
/** 光暈閃動週期（ms） */
const GLOW_PERIOD_MS = 800;

// ── 文字 Y 座標 ───────────────────────────────────────────────────────────────
const TIER_TEXT_Y   = 600;
const AMOUNT_TEXT_Y = 750;

// ── 顏色 ──────────────────────────────────────────────────────────────────────
const COLOR_OVERLAY   = 0x000000;
const COLOR_GOLD      = 0xffd700;
const COLOR_GOLD_DARK = 0x884400;
const COLOR_GLOW      = 0xffaa00;
const COLOR_PARTICLE  = 0xffd700;

// ── 資源路徑 ─────────────────────────────────────────────────────────────────
const PATH_BIGWIN_SS_JSON = 'assets/Common/WinBoard/BigWin_SS.json';
const PATH_BIGWIN_SS_PNG  = 'assets/Common/WinBoard/BigWin_SS.png';

// ── 型別 ──────────────────────────────────────────────────────────────────────

/** 贏分等級 */
type WinTier = 'NORMAL' | 'BIG_WIN' | 'MEGA_WIN' | 'SUPER_MEGA_WIN';

/**
 * 粒子狀態（結構化，避免將動態屬性掛在 Graphics 上）
 */
interface Particle {
    readonly gfx: Graphics;
    vx: number;
    vy: number;
    life: number;
    readonly maxLife: number;
}

// ── 工具函式 ──────────────────────────────────────────────────────────────────

/**
 * easeOutCubic — 緩速結束（讓數字在接近目標時減速）
 */
function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}

/**
 * 根據倍率計算贏分等級
 */
function calcWinTier(totalWin: number, bet: number): WinTier {
    if (bet <= 0) return 'NORMAL';
    const ratio = totalWin / bet;
    if (ratio >= RATIO_SUPER_MEGA) return 'SUPER_MEGA_WIN';
    if (ratio >= RATIO_MEGA_WIN)   return 'MEGA_WIN';
    if (ratio >= RATIO_BIG_WIN)    return 'BIG_WIN';
    return 'NORMAL';
}

export class WinTierOverlay extends Container {
    // ── 視覺元素 ─────────────────────────────────────────────────────────────
    private _overlay!: Graphics;            // 半透明暗色背景
    private _tierText!: Text;               // "BIG WIN" / "MEGA WIN" / "SUPER MEGA WIN"
    private _amountText!: Text;             // 金額跑分文字
    private _glowGraphics!: Graphics;       // 光暈特效
    private _particleContainer!: Container; // MEGA WIN 粒子容器

    // ── 粒子狀態列表 ──────────────────────────────────────────────────────────
    private _particles: Particle[] = [];

    // ── 動畫狀態 ─────────────────────────────────────────────────────────────
    private _countupTarget: number  = 0;
    private _countupStart:  number  = 0;
    private _isCountingUp:  boolean = false;
    private _glowTimer:     number  = 0;
    private _currentTier:   WinTier = 'NORMAL';

    // ── Ticker 回呼（固定參考，方便移除） ────────────────────────────────────
    private readonly _onTick: () => void;

    // ── Promise 控制 ─────────────────────────────────────────────────────────
    private _resolveShow: (() => void) | null = null;
    private _dismissTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        super();
        this.visible = false;
        this._onTick = () => this._tickAnimate();
    }

    // ── 非同步初始化 ─────────────────────────────────────────────────────────

    /**
     * 建立所有視覺子元件。
     * 須在加入 stage 後呼叫。
     */
    async init(): Promise<void> {
        // 1. 半透明黑色覆蓋層（覆蓋整個 900×1600 畫布）
        this._overlay = new Graphics();
        this._overlay.rect(0, 0, CANVAS_W, CANVAS_H);
        this._overlay.fill({ color: COLOR_OVERLAY, alpha: 0.75 });
        this.addChild(this._overlay);

        // 2. 粒子容器（MEGA WIN / SUPER MEGA WIN 使用）
        this._particleContainer = new Container();
        this.addChild(this._particleContainer);

        // 3. 光暈 Graphics（在文字背後）
        this._glowGraphics = new Graphics();
        this.addChild(this._glowGraphics);

        // 4. 等級標題文字（"BIG WIN" 等）
        this._tierText = new Text({
            text: '',
            style: new TextStyle({
                fontFamily: 'Arial Black',
                fontSize: 72,
                fontWeight: 'bold',
                fill: COLOR_GOLD,
                stroke: { color: COLOR_GOLD_DARK, width: 4 },
                dropShadow: {
                    color: 0x000000,
                    blur: 16,
                    distance: 6,
                    angle: Math.PI / 4,
                },
                letterSpacing: 6,
            }),
        });
        this._tierText.anchor.set(0.5, 0.5);
        this._tierText.x = CANVAS_W / 2;
        this._tierText.y = TIER_TEXT_Y;
        this.addChild(this._tierText);

        // 5. 金額跑分文字
        this._amountText = new Text({
            text: '0',
            style: new TextStyle({
                fontFamily: 'Arial Black',
                fontSize: 56,
                fontWeight: 'bold',
                fill: COLOR_GOLD,
                stroke: { color: COLOR_GOLD_DARK, width: 3 },
                dropShadow: {
                    color: 0x000000,
                    blur: 12,
                    distance: 4,
                    angle: Math.PI / 4,
                },
            }),
        });
        this._amountText.anchor.set(0.5, 0.5);
        this._amountText.x = CANVAS_W / 2;
        this._amountText.y = AMOUNT_TEXT_Y;
        this.addChild(this._amountText);

        // 6. 嘗試載入 BigWin_SS 精靈圖作為裝飾（失敗則靜默跳過）
        await this._tryLoadBigWinAsset();
    }

    // ── 私有：載入 BigWin 資源 ───────────────────────────────────────────────

    /**
     * 嘗試從 BigWin_SS.png + BigWin_SS.json 載入並在文字上方放置裝飾圖示。
     * 失敗時靜默降級為純文字模式。
     */
    private async _tryLoadBigWinAsset(): Promise<void> {
        try {
            await Assets.load(PATH_BIGWIN_SS_JSON);
            const tex = await Assets.load(PATH_BIGWIN_SS_PNG) as Texture;

            const decorSprite = new Sprite(tex);
            decorSprite.anchor.set(0.5);
            decorSprite.x     = CANVAS_W / 2;
            decorSprite.y     = TIER_TEXT_Y - 120;
            decorSprite.scale.set(1.2);
            decorSprite.alpha = 0.6;

            // 插入在 glowGraphics 之前（確保在文字層之下）
            this.addChildAt(decorSprite, this.children.indexOf(this._glowGraphics));
        } catch {
            // 靜默忽略：純文字 fallback
        }
    }

    // ── 私有：設定等級樣式 ───────────────────────────────────────────────────

    /**
     * 依等級調整標題文字的內容、字體大小，並決定是否生成粒子。
     */
    private _applyTierStyle(tier: WinTier): void {
        this._currentTier = tier;

        switch (tier) {
            case 'BIG_WIN':
                this._tierText.text = 'BIG WIN';
                (this._tierText.style as TextStyle).fontSize = 72;
                break;

            case 'MEGA_WIN':
                this._tierText.text = 'MEGA WIN';
                (this._tierText.style as TextStyle).fontSize = 84;
                // 中量粒子（增加視覺衝擊）
                this._spawnParticles(20);
                break;

            case 'SUPER_MEGA_WIN':
                this._tierText.text = 'SUPER MEGA WIN';
                (this._tierText.style as TextStyle).fontSize = 90;
                // 大量粒子（全螢幕慶賀）
                this._spawnParticles(40);
                break;

            default:
                this._tierText.text = '';
        }
    }

    // ── 私有：粒子噴射 ───────────────────────────────────────────────────────

    /**
     * 在螢幕上方隨機生成金色粒子，每個粒子狀態獨立管理。
     * @param count  粒子數量
     */
    private _spawnParticles(count: number): void {
        // 清除舊粒子
        for (const p of this._particles) {
            this._particleContainer.removeChild(p.gfx);
            p.gfx.destroy();
        }
        this._particles = [];

        for (let i = 0; i < count; i++) {
            const radius = 4 + Math.random() * 6;

            // 繪製金色圓形粒子
            const gfx = new Graphics();
            gfx.circle(0, 0, radius);
            gfx.fill({ color: COLOR_PARTICLE, alpha: 0.85 });

            // 隨機初始位置（散布在畫面上半部）
            gfx.x = Math.random() * CANVAS_W;
            gfx.y = Math.random() * (CANVAS_H * 0.5);

            const particle: Particle = {
                gfx,
                vx:      (Math.random() - 0.5) * 3,
                vy:      -2 - Math.random() * 4,
                life:    0,
                maxLife: 60 + Math.random() * 60,
            };

            this._particles.push(particle);
            this._particleContainer.addChild(gfx);
        }
    }

    // ── 私有：粒子逐幀更新 ──────────────────────────────────────────────────

    private _updateParticles(): void {
        for (const p of this._particles) {
            p.life++;
            p.vy += 0.1;   // 重力加速度
            p.gfx.x += p.vx;
            p.gfx.y += p.vy;
            p.gfx.alpha = Math.max(0, 1 - p.life / p.maxLife);

            // 超過壽命後循環重置，保持粒子池穩定
            if (p.life >= p.maxLife) {
                p.life    = 0;
                p.gfx.x   = Math.random() * CANVAS_W;
                p.gfx.y   = Math.random() * 200 + TIER_TEXT_Y - 300;
                p.vy      = -2 - Math.random() * 4;
                p.vx      = (Math.random() - 0.5) * 3;
                p.gfx.alpha = 0.85;
            }
        }
    }

    // ── 私有：光暈繪製 ───────────────────────────────────────────────────────

    /**
     * 在等級文字後方繪製動態橢圓光暈。
     * @param intensity  光暈強度 0~1（隨 sine wave 閃動）
     */
    private _drawGlow(intensity: number): void {
        this._glowGraphics.clear();

        const alpha = 0.15 + intensity * 0.35;
        const rx    = 380 + intensity * 40;
        const ry    = 80  + intensity * 20;

        this._glowGraphics.ellipse(CANVAS_W / 2, TIER_TEXT_Y, rx, ry);
        this._glowGraphics.fill({ color: COLOR_GLOW, alpha });
    }

    // ── Ticker 動畫主迴圈 ─────────────────────────────────────────────────────

    private _tickAnimate(): void {
        const now = performance.now();

        // 1. 光暈閃動（sine wave，週期 GLOW_PERIOD_MS）
        this._glowTimer += 16;
        const glowIntensity = (Math.sin((this._glowTimer / GLOW_PERIOD_MS) * Math.PI * 2) + 1) / 2;
        this._drawGlow(glowIntensity);

        // 2. 等級文字輕微縮放脈動（±3%）
        const scalePulse = 1.0 + Math.sin(this._glowTimer / 400) * 0.03;
        this._tierText.scale.set(scalePulse);

        // 3. 數字跑分動畫
        if (this._isCountingUp) {
            const elapsed  = now - this._countupStart;
            const progress = Math.min(elapsed / COUNTUP_DURATION_MS, 1);
            const easedT   = easeOutCubic(progress);
            const current  = Math.round(this._countupTarget * easedT);
            this._amountText.text = this._formatAmount(current);

            if (progress >= 1) {
                // 跑分結束：顯示最終值，排程自動關閉
                this._amountText.text = this._formatAmount(this._countupTarget);
                this._isCountingUp    = false;
                this._scheduleDismiss();
            }
        }

        // 4. 粒子動畫（MEGA WIN 以上才執行）
        if (this._currentTier === 'MEGA_WIN' || this._currentTier === 'SUPER_MEGA_WIN') {
            this._updateParticles();
        }
    }

    // ── 私有：延遲關閉 ───────────────────────────────────────────────────────

    private _scheduleDismiss(): void {
        if (this._dismissTimer !== null) {
            clearTimeout(this._dismissTimer);
        }
        this._dismissTimer = setTimeout(() => {
            this._dismissTimer = null;
            this.dismiss();
        }, AUTO_DISMISS_DELAY_MS);
    }

    // ── 私有：格式化金額 ─────────────────────────────────────────────────────

    private _formatAmount(amount: number): string {
        return amount.toLocaleString('en-US');
    }

    // ── 私有：清除前次動畫殘留 ───────────────────────────────────────────────

    private _cleanupPrevious(): void {
        if (this._dismissTimer !== null) {
            clearTimeout(this._dismissTimer);
            this._dismissTimer = null;
        }
        this._isCountingUp = false;
        Ticker.shared.remove(this._onTick);

        // 清除粒子
        for (const p of this._particles) {
            this._particleContainer.removeChild(p.gfx);
            p.gfx.destroy();
        }
        this._particles = [];

        // Resolve 舊的 Promise（避免懸空）
        if (this._resolveShow) {
            const resolve    = this._resolveShow;
            this._resolveShow = null;
            resolve();
        }
    }

    // ── 公開 API ─────────────────────────────────────────────────────────────

    /**
     * 顯示大獎覆蓋層，並在動畫結束後自動關閉。
     *
     * 若等級為 NORMAL，立即 resolve（不顯示任何東西）。
     *
     * @param totalWin  本次贏得的總金額
     * @param bet       本次下注金額（用於計算倍率等級）
     * @returns         Promise，在覆蓋層關閉後 resolve
     */
    show(totalWin: number, bet: number): Promise<void> {
        return new Promise<void>((resolve) => {
            const tier = calcWinTier(totalWin, bet);

            // NORMAL 等級不顯示覆蓋層
            if (tier === 'NORMAL') {
                resolve();
                return;
            }

            // 清除前次動畫殘留
            this._cleanupPrevious();

            // 儲存 resolve 以供 dismiss() 呼叫
            this._resolveShow = resolve;

            // 設定等級文字、粒子
            this._applyTierStyle(tier);

            // 初始化跑分參數
            this._countupTarget   = totalWin;
            this._countupStart    = performance.now();
            this._isCountingUp    = true;
            this._amountText.text = this._formatAmount(0);
            this._glowTimer       = 0;

            // 顯示覆蓋層並啟動 Ticker
            this.visible = true;
            Ticker.shared.add(this._onTick);
        });
    }

    /**
     * 立即關閉覆蓋層（無論動畫是否完成）。
     * 可由外部點擊事件呼叫，也由 auto-dismiss 觸發。
     */
    dismiss(): void {
        if (this._dismissTimer !== null) {
            clearTimeout(this._dismissTimer);
            this._dismissTimer = null;
        }

        this._isCountingUp = false;
        Ticker.shared.remove(this._onTick);

        this.visible = false;

        // 清除粒子
        for (const p of this._particles) {
            this._particleContainer.removeChild(p.gfx);
            p.gfx.destroy();
        }
        this._particles = [];

        if (this._resolveShow) {
            const resolve    = this._resolveShow;
            this._resolveShow = null;
            resolve();
        }
    }

    override destroy(): void {
        this._cleanupPrevious();
        super.destroy();
    }
}
