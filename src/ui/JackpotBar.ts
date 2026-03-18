import { Container, Graphics, Sprite, Text, TextStyle, Assets, Ticker } from 'pixi.js';

/**
 * JackpotBar — 四級頭獎顯示列（Power Fortune 財神報喜）
 *
 * 位於畫面頂部，橫跨 900px 寬度。
 * 四個等級（由大到小，左→右）：GRAND → MAJOR → MINOR → MINI
 *
 * 每個等級顯示：
 *   - PNG 標籤圖片（JpPool_Grand/Major/Minor/Mini.png），失敗則彩色徽章 fallback
 *   - 緩慢遞增的假計數器數字（裝飾用）
 *
 * 尺寸：900×48（portrait 畫布頂部）
 */

// ── 面板尺寸 ─────────────────────────────────────────────────────────────────
const BAR_W = 900;
const BAR_H = 48;
const TIER_W = BAR_W / 4;  // 每個等級寬度 = 225px

// ── 頭獎等級設定 ─────────────────────────────────────────────────────────────
interface JackpotTier {
    readonly id:        string;
    readonly label:     string;
    readonly assetPath: string;
    readonly baseValue: number;    // 假計數器起始值
    readonly badgeColor: number;   // fallback 徽章底色
    readonly textColor:  number;   // 數值文字顏色
    readonly increment:  number;   // 每次更新遞增量
}

const TIERS: readonly JackpotTier[] = Object.freeze([
    {
        id: 'grand', label: 'GRAND',
        assetPath: 'assets/Common/Jackpot/Pool/JpPool_Grand.png',
        baseValue: 250000, badgeColor: 0x5a2800, textColor: 0xff4444,
        increment: 0.55,
    },
    {
        id: 'major', label: 'MAJOR',
        assetPath: 'assets/Common/Jackpot/Pool/JpPool_Major.png',
        baseValue: 90000, badgeColor: 0x003366, textColor: 0x44aaff,
        increment: 0.25,
    },
    {
        id: 'minor', label: 'MINOR',
        assetPath: 'assets/Common/Jackpot/Pool/JpPool_Minor.png',
        baseValue: 7500, badgeColor: 0x004422, textColor: 0x44ff88,
        increment: 0.12,
    },
    {
        id: 'mini', label: 'MINI',
        assetPath: 'assets/Common/Jackpot/Pool/JpPool_Mini.png',
        baseValue: 1000, badgeColor: 0x2a0050, textColor: 0xcc88ff,
        increment: 0.06,
    },
]);

export class JackpotBar extends Container {
    // 計數器當前值（每幀更新）
    private _counterValues: number[];
    private _counterTexts: Text[] = [];
    private _tickAccum: number = 0;

    constructor() {
        super();
        // 從各自 base 開始，加入隨機偏移（每次開局略有不同）
        this._counterValues = TIERS.map(t => t.baseValue + Math.random() * t.baseValue * 0.08);
    }

    /**
     * 非同步初始化：嘗試並行載入各等級 PNG 標籤。
     * 須在加入 stage 後呼叫。
     */
    async init(): Promise<void> {
        // 頂部深色背景條
        const barBg = new Graphics();
        barBg.rect(0, 0, BAR_W, BAR_H);
        barBg.fill({ color: 0x050210, alpha: 0.90 });
        // 底部金色分隔線
        barBg.rect(0, BAR_H - 2, BAR_W, 2);
        barBg.fill({ color: 0xd4af37, alpha: 0.5 });
        this.addChild(barBg);

        // 等級間分隔線（3條）
        for (let i = 1; i < TIERS.length; i++) {
            const div = new Graphics();
            div.rect(i * TIER_W - 1, 6, 2, BAR_H - 12);
            div.fill({ color: 0xd4af37, alpha: 0.25 });
            this.addChild(div);
        }

        // 並行載入所有等級的 PNG 圖標
        const loadResults = await Promise.allSettled(
            TIERS.map(t => Assets.load(t.assetPath)),
        );

        // 每個等級區域的中心 X
        const tierCenterXs = TIERS.map((_, i) => i * TIER_W + TIER_W / 2);

        for (let i = 0; i < TIERS.length; i++) {
            const tier     = TIERS[i]!;
            const centerX  = tierCenterXs[i]!;
            const result   = loadResults[i]!;

            // ── 標籤（PNG 或 fallback 徽章） ──────────────────────────────
            if (result.status === 'fulfilled') {
                const sprite = new Sprite(result.value);
                sprite.anchor.set(0.5);
                // 依比例縮放至目標高度 30px
                const targetH = 30;
                const scale   = targetH / sprite.texture.height;
                sprite.scale.set(scale);
                sprite.x = centerX - 38;  // 標籤偏左，右側留給數字
                sprite.y = BAR_H / 2;
                this.addChild(sprite);
            } else {
                // Graphics 徽章 fallback
                this._drawFallbackBadge(centerX - 38, BAR_H / 2, tier);
            }

            // ── 計數器數值文字 ────────────────────────────────────────────
            const valueText = new Text({
                text: this._formatValue(this._counterValues[i] ?? tier.baseValue),
                style: new TextStyle({
                    fontFamily: 'Arial Black',
                    fontSize: 13,
                    fontWeight: 'bold',
                    fill: tier.textColor,
                    dropShadow: { color: 0x000000, blur: 4, distance: 1, angle: Math.PI / 4 },
                }),
            });
            valueText.anchor.set(0, 0.5);
            valueText.x = centerX + 2;   // 數字在標籤右側
            valueText.y = BAR_H / 2;
            this.addChild(valueText);
            this._counterTexts.push(valueText);
        }

        // 啟動計數器動畫
        Ticker.shared.add(this._onTick, this);
    }

    // ── 私有：繪製 fallback 徽章 ─────────────────────────────────────────────

    private _drawFallbackBadge(cx: number, cy: number, tier: JackpotTier): void {
        const bW = 74;
        const bH = 22;

        // 光暈
        const glow = new Graphics();
        glow.roundRect(cx - bW / 2 - 3, cy - bH / 2 - 3, bW + 6, bH + 6, 9);
        glow.fill({ color: tier.textColor, alpha: 0.1 });
        this.addChild(glow);

        // 徽章本體
        const badge = new Graphics();
        badge.roundRect(cx - bW / 2, cy - bH / 2, bW, bH, 6);
        badge.fill({ color: tier.badgeColor, alpha: 0.95 });
        badge.stroke({ color: 0xd4af37, width: 1.2, alpha: 0.75 });
        // 頂部高光
        badge.roundRect(cx - bW / 2 + 2, cy - bH / 2 + 1, bW - 4, bH * 0.3, 3);
        badge.fill({ color: 0xffffff, alpha: 0.06 });
        this.addChild(badge);

        // 標籤文字
        const lbl = new Text({
            text: tier.label,
            style: new TextStyle({
                fontFamily: 'Arial Black',
                fontSize: 10,
                fontWeight: 'bold',
                fill: tier.textColor,
                letterSpacing: 1,
            }),
        });
        lbl.anchor.set(0.5);
        lbl.x = cx;
        lbl.y = cy;
        this.addChild(lbl);
    }

    // ── Ticker：緩慢遞增計數器 ───────────────────────────────────────────────

    private _onTick = (): void => {
        // 每 5 幀更新一次（~12fps，避免數字閃爍太快）
        if (++this._tickAccum < 5) return;
        this._tickAccum = 0;

        for (let i = 0; i < TIERS.length; i++) {
            const tier = TIERS[i]!;
            this._counterValues[i] = (this._counterValues[i] ?? tier.baseValue) + tier.increment;
            if (this._counterTexts[i]) {
                this._counterTexts[i]!.text = this._formatValue(this._counterValues[i] ?? 0);
            }
        }
    };

    // ── 私有：格式化數值 ─────────────────────────────────────────────────────

    /** 格式化為千分位逗號 + 2 位小數 */
    private _formatValue(value: number): string {
        return value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }

    // ── 公開 API ─────────────────────────────────────────────────────────────

    /**
     * 外部更新特定等級的頭獎金額（連接真實遊戲邏輯時使用）
     * @param tierId   'grand' | 'major' | 'minor' | 'mini'
     * @param amount   新金額
     */
    setTierValue(tierId: string, amount: number): void {
        const idx = TIERS.findIndex(t => t.id === tierId);
        if (idx < 0) return;
        this._counterValues[idx] = amount;
        if (this._counterTexts[idx]) {
            this._counterTexts[idx]!.text = this._formatValue(amount);
        }
    }

    override destroy(): void {
        Ticker.shared.remove(this._onTick, this);
        super.destroy();
    }
}
