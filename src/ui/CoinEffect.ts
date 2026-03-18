import { Container, Graphics } from 'pixi.js';

/**
 * CoinEffect — 金幣噴射粒子特效
 *
 * 贏分時在指定位置噴出一批金色圓形粒子，模擬硬幣飛灑效果。
 *
 * 物理模型：
 *   - 每枚金幣以隨機角度向上射出（初速 vx/vy）
 *   - 受重力影響（每幀 vy += GRAVITY）
 *   - 存活 1.5 秒後淡出消失
 *
 * 使用方式：
 *   1. 建立實例並加入 stage
 *   2. 每幀呼叫 update(dt)
 *   3. 觸發時呼叫 burst(x, y, count)
 *   4. 不再需要時呼叫 clear()
 */

// ── 物理常數 ──────────────────────────────────────────────────────────────────
/** 重力加速度（px/幀²，假設 60fps） */
const GRAVITY = 0.35;
/** 初始速度 Y 上限（負值表示向上） */
const INIT_VY_MIN = -12;
const INIT_VY_MAX = -6;
/** 初始速度 X 範圍（左右隨機） */
const INIT_VX_RANGE = 7;
/** 金幣存活時間（秒） */
const COIN_LIFETIME = 1.5;

// ── 視覺常數 ──────────────────────────────────────────────────────────────────
/** 金幣半徑最小值（px） */
const RADIUS_MIN = 8;
/** 金幣半徑最大值（px） */
const RADIUS_MAX = 12;
/** 金幣本體顏色（金色） */
const COLOR_GOLD         = 0xffd700;
/** 金幣高光顏色（淺金色） */
const COLOR_GOLD_HIGHLIGHT = 0xfffaaa;
/** 金幣陰影顏色（深棕色） */
const COLOR_GOLD_SHADOW  = 0x8b5e00;

// ── 型別定義 ──────────────────────────────────────────────────────────────────

/**
 * 單枚金幣的狀態（不可變快照在 burst 時建立，逐幀用可變欄位更新）
 */
interface Coin {
    /** PixiJS Graphics 圓形 */
    readonly gfx: Graphics;
    /** 水平速度（px/幀） */
    vx: number;
    /** 垂直速度（px/幀，負值向上） */
    vy: number;
    /** 已存活時間（秒） */
    age: number;
    /** 最大存活時間（秒，含隨機偏移） */
    readonly maxAge: number;
}

export class CoinEffect extends Container {
    // ── 活躍金幣池 ────────────────────────────────────────────────────────────
    private _coins: Coin[] = [];

    constructor() {
        super();
    }

    // ── 公開 API ─────────────────────────────────────────────────────────────

    /**
     * 在指定位置噴出一批金幣。
     *
     * @param x      噴射起點 X（畫布座標）
     * @param y      噴射起點 Y（畫布座標）
     * @param count  金幣數量
     */
    burst(x: number, y: number, count: number): void {
        for (let i = 0; i < count; i++) {
            const coin = this._createCoin(x, y);
            this._coins.push(coin);
            this.addChild(coin.gfx);
        }
    }

    /**
     * 逐幀更新所有活躍金幣的位置與透明度。
     *
     * @param dt  距上幀的時間差（秒）— 由 Ticker 傳入（elapsed / 60 或直接傳 Ticker.deltaTime）
     */
    update(dt: number): void {
        // 從後往前迭代，方便安全移除已死亡金幣
        for (let i = this._coins.length - 1; i >= 0; i--) {
            const coin = this._coins[i]!;

            // 累計存活時間
            coin.age += dt;

            if (coin.age >= coin.maxAge) {
                // 超過壽命：移除並銷毀
                this.removeChild(coin.gfx);
                coin.gfx.destroy();
                this._coins.splice(i, 1);
                continue;
            }

            // 物理更新：重力影響垂直速度
            coin.vy += GRAVITY;
            coin.gfx.x += coin.vx;
            coin.gfx.y += coin.vy;

            // 透明度淡出（生命週期後半段開始淡出）
            const lifeRatio = coin.age / coin.maxAge;
            coin.gfx.alpha = lifeRatio > 0.5
                ? 1 - (lifeRatio - 0.5) * 2   // 後 50% 線性淡出
                : 1;
        }
    }

    /**
     * 立即清除所有金幣。
     */
    clear(): void {
        for (const coin of this._coins) {
            this.removeChild(coin.gfx);
            coin.gfx.destroy();
        }
        this._coins = [];
    }

    override destroy(): void {
        this.clear();
        super.destroy();
    }

    // ── 私有：建立單枚金幣 ───────────────────────────────────────────────────

    /**
     * 建立一枚金幣 Graphics，設定隨機初速、位置與大小。
     *
     * @param x  起始 X
     * @param y  起始 Y
     * @returns  Coin 狀態物件（不可變欄位已凍結）
     */
    private _createCoin(x: number, y: number): Coin {
        const radius = RADIUS_MIN + Math.random() * (RADIUS_MAX - RADIUS_MIN);

        // 繪製金幣圖形（本體 + 高光 + 陰影弧）
        const gfx = this._drawCoinGraphics(radius);

        // 設定起始位置（加小幅隨機偏移，使噴射更自然）
        gfx.x = x + (Math.random() - 0.5) * 20;
        gfx.y = y + (Math.random() - 0.5) * 10;

        // 隨機初速：往各方向散射
        const vx = (Math.random() - 0.5) * 2 * INIT_VX_RANGE;
        const vy = INIT_VY_MIN + Math.random() * (INIT_VY_MAX - INIT_VY_MIN);

        // 存活時間加小幅隨機偏移（避免所有金幣同時消失）
        const maxAge = COIN_LIFETIME + (Math.random() - 0.5) * 0.4;

        return { gfx, vx, vy, age: 0, maxAge };
    }

    // ── 私有：繪製金幣外形 ───────────────────────────────────────────────────

    /**
     * 繪製一枚帶高光與陰影的金色圓形金幣。
     * 使用 PixiJS v8 API：.circle().fill() / .arc().stroke()
     *
     * @param radius  金幣半徑（px）
     * @returns       已繪製的 Graphics 物件
     */
    private _drawCoinGraphics(radius: number): Graphics {
        const g = new Graphics();

        // 1. 主體（金色圓形）
        g.circle(0, 0, radius);
        g.fill({ color: COLOR_GOLD, alpha: 1 });

        // 2. 頂部高光（偏白的小橢圓，製造立體感）
        const hlW = radius * 0.5;
        const hlH = radius * 0.3;
        g.ellipse(-radius * 0.2, -radius * 0.4, hlW, hlH);
        g.fill({ color: COLOR_GOLD_HIGHLIGHT, alpha: 0.55 });

        // 3. 邊緣陰影線（深棕色輪廓，增加厚度感）
        g.circle(0, 0, radius);
        g.stroke({ color: COLOR_GOLD_SHADOW, width: 1.5, alpha: 0.6 });

        return g;
    }
}
