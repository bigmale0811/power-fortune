import { Container, Sprite, Text, TextStyle, Ticker, Assets } from 'pixi.js';
import { AssetStore } from '@/assets/AssetStore';

/**
 * JackpotBar — 四級頭獎顯示（Power Fortune 財神報喜）
 *
 * 依照 EXML JackpotPoolSkin 精確座標（900×2000 portrait）：
 *   GRAND:  horizontalCenter=0, y=155, anchorOffsetY=62  → top=93,  728×124
 *   MAJOR:  horizontalCenter=0, y=287, anchorOffsetY=54  → top=233, 632×108
 *   MINOR:  x=2,   y=361                                 → top=361, 332×64
 *   MINI:   x=566, y=361                                 → top=361, 332×64
 *
 * 總高度：y=93 ~ y=425 ≈ 332px
 */

const W = 900;
const CENTER_X = W / 2; // 450

interface TierConfig {
  readonly id: string;
  /** AssetStore 中的貼圖鍵名（對應 default.res.json） */
  readonly textureKey: string;
  /** 直接載入路徑（AssetStore 找不到時的 fallback） */
  readonly assetPath: string;
  /** EXML 精確 X（左上角），null 表示 horizontalCenter=0 */
  readonly x: number | null;
  /** EXML 精確 Y（頂部，已扣除 anchorOffset） */
  readonly y: number;
  /** 圖片原始寬度（用於置中計算） */
  readonly imgW: number;
  readonly imgH: number;
  /** 金額文字的偏移 */
  readonly textOffsetX: number;
  readonly textOffsetY: number;
  readonly fontSize: number;
  readonly baseValue: number;
  readonly increment: number;
  readonly textColor: number;
}

const TIERS: readonly TierConfig[] = Object.freeze([
  {
    id: 'grand',
    textureKey: 'JpPool_Grand_png',
    assetPath: 'assets/Common/Jackpot/Pool/JpPool_Grand.png',
    x: null, y: 93, imgW: 728, imgH: 124,
    textOffsetX: 107, textOffsetY: 0,
    fontSize: 38,
    baseValue: 1000018.48, increment: 0.55,
    textColor: 0xffd700,
  },
  {
    id: 'major',
    textureKey: 'JpPool_Major_png',
    assetPath: 'assets/Common/Jackpot/Pool/JpPool_Major.png',
    x: null, y: 233, imgW: 632, imgH: 108,
    textOffsetX: 98, textOffsetY: 0,
    fontSize: 28,
    baseValue: 100018.48, increment: 0.25,
    textColor: 0xffd700,
  },
  {
    id: 'minor',
    textureKey: 'JpPool_Minor_png',
    assetPath: 'assets/Common/Jackpot/Pool/JpPool_Minor.png',
    x: 2, y: 361, imgW: 332, imgH: 64,
    textOffsetX: 65, textOffsetY: 0,
    fontSize: 18,
    baseValue: 2000.00, increment: 0.12,
    textColor: 0xffd700,
  },
  {
    id: 'mini',
    textureKey: 'JpPool_Mini_png',
    assetPath: 'assets/Common/Jackpot/Pool/JpPool_Mini.png',
    x: 566, y: 361, imgW: 332, imgH: 64,
    textOffsetX: -62, textOffsetY: 0,
    fontSize: 18,
    baseValue: 1000.00, increment: 0.06,
    textColor: 0xffd700,
  },
]);

export class JackpotBar extends Container {
  private _counterValues: number[];
  private _counterTexts: Text[] = [];
  private _tickAccum = 0;

  constructor() {
    super();
    this._counterValues = TIERS.map(t => t.baseValue + Math.random() * t.baseValue * 0.02);
  }

  async init(): Promise<void> {
    const store = AssetStore.instance;

    // 先嘗試直接載入所有圖片（確保可用）
    const directLoads = await Promise.allSettled(
      TIERS.map(t => Assets.load(t.assetPath)),
    );

    for (let i = 0; i < TIERS.length; i++) {
      const tier = TIERS[i]!;

      // ── 獎池徽章圖片：先試 AssetStore，再試直接載入 ──
      const tex = store.tryGetTexture(tier.textureKey)
        ?? (directLoads[i]?.status === 'fulfilled' ? directLoads[i].value : null);

      if (tex) {
        const sprite = new Sprite(tex);
        sprite.anchor.set(0.5, 0);
        if (tier.x === null) {
          sprite.x = CENTER_X;
        } else {
          sprite.x = tier.x + tier.imgW / 2;
        }
        sprite.y = tier.y;
        this.addChild(sprite);
        console.log(`[JackpotBar] ${tier.id} badge loaded: ${tex.width}×${tex.height}`);
      } else {
        console.warn(`[JackpotBar] ${tier.id} badge NOT found`);
      }

      // ── 金額計數器文字 ──
      const valueText = new Text({
        text: this._formatValue(this._counterValues[i] ?? tier.baseValue),
        style: new TextStyle({
          fontFamily: 'Arial Black',
          fontSize: tier.fontSize,
          fontWeight: 'bold',
          fill: tier.textColor,
          dropShadow: { color: 0x000000, blur: 6, distance: 2, angle: Math.PI / 4 },
        }),
      });
      valueText.anchor.set(0.5, 0.5);

      // 文字放在徽章中央偏右（EXML horizontalCenter 偏移）
      if (tier.x === null) {
        valueText.x = CENTER_X + tier.textOffsetX;
      } else {
        valueText.x = tier.x + tier.imgW / 2 + tier.textOffsetX;
      }
      valueText.y = tier.y + tier.imgH / 2;

      this.addChild(valueText);
      this._counterTexts.push(valueText);
    }

    // 啟動計數器動畫
    Ticker.shared.add(this._onTick, this);
  }

  private _onTick = (): void => {
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

  private _formatValue(value: number): string {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

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
