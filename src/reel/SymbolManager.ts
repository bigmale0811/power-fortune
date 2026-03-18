/**
 * SymbolManager — 符號貼圖管理器
 *
 * 職責：
 * 1. 解析 Egret MovieClip 格式的 Symbol.json，提取 15 個符號的 frame 矩形
 * 2. 從 BaseTexture 切割子貼圖（Texture.from subregion）
 * 3. 提供 getSymbolTexture(id) 和 getSymbolName(id) 查詢介面
 *
 * Symbol.json 格式（Egret MC）：
 * {
 *   "res": {
 *     "1": { "x": 0,   "y": 0,   "w": 150, "h": 150 },
 *     "2": { "x": 150, "y": 0,   "w": 150, "h": 150 },
 *     ...
 *   }
 * }
 * JSON key 使用 1-indexed，我們的符號 ID 使用 0-indexed（key "1" = id 0）。
 *
 * 不可變模式：
 * loadSymbols() 完成後產生新的 ReadonlyMap，不修改既有引用。
 */

import { Texture, Rectangle } from 'pixi.js';

// ─────────────────────── 型別定義 ───────────────────────

/** 單一 frame 的位置與尺寸 */
interface FrameRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * Egret MovieClip JSON 格式
 * res 的 key 為字串數字（"1", "2", ...），value 為 FrameRect
 */
export interface EgretMCData {
  readonly res: Readonly<Record<string, FrameRect>>;
}

/** 符號資訊 */
interface SymbolInfo {
  readonly id: number;
  readonly name: string;
  readonly texture: Texture;
}

// ─────────────────────── 符號名稱對照表 ───────────────────────

/**
 * 符號 ID（0-indexed）→ 顯示名稱
 * 對應原版 Power Fortune (財神報喜) 的符號設計
 */
const SYMBOL_NAMES: Readonly<Record<number, string>> = Object.freeze({
  0:  'Dragon',       // 龍（最高階符號）
  1:  'Phoenix',      // 鳳凰
  2:  'Tiger',        // 虎
  3:  'Koi',          // 錦鯉
  4:  'Turtle',       // 靈龜
  5:  'Coin',         // 金幣
  6:  'Gourd',        // 葫蘆
  7:  'A',            // 牌面符號 A
  8:  'K',            // 牌面符號 K
  9:  'Q',            // 牌面符號 Q
  10: 'J',            // 牌面符號 J
  11: '10',           // 牌面符號 10
  12: 'FortuneBall',  // 福球（特殊功能符號）
  13: 'Wild',         // Wild 萬用符號
  14: 'Scatter',      // Scatter 觸發免費遊戲
});

/** 有效符號 ID 範圍 */
const SYMBOL_COUNT = 15;

// ─────────────────────── 備用貼圖生成器 ───────────────────────

/**
 * 當 JSON 解析失敗或貼圖不存在時，使用純色佔位貼圖
 * 顏色對應 BaseGameScene 的 SYMBOL_COLORS 陣列，確保視覺一致性
 */
const FALLBACK_COLORS: Readonly<Record<number, number>> = Object.freeze({
  0:  0xff4444, // Dragon（紅）
  1:  0xffaa00, // Phoenix（金）
  2:  0xff6600, // Tiger（橘）
  3:  0xcc3333, // Koi（深紅）
  4:  0x8b4513, // Turtle（棕）
  5:  0x4488ff, // Coin（藍）
  6:  0x44aaff, // Gourd（淺藍）
  7:  0x44ccaa, // A（青）
  8:  0x66cc66, // K（綠）
  9:  0x888888, // Q（灰）
  10: 0x666666, // J（深灰）
  11: 0xddaa00, // 10（金幣色）
  12: 0xff00ff, // FortuneBall（紫）
  13: 0x00ff00, // Wild（亮綠）
  14: 0xffff00, // Scatter（黃）
});

/** 備用貼圖邊長（px） */
const FALLBACK_SIZE = 128;

/**
 * 產生指定純色的 Canvas 貼圖（用於資源未載入時的降級顯示）
 * 在 PixiJS v8 中使用 OffscreenCanvas + ImageBitmap 方式創建
 */
function createFallbackTexture(color: number): Texture {
  try {
    // 將 hex 色碼拆解為 RGB 分量
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;

    // 建立 Canvas 並填色
    const canvas = document.createElement('canvas');
    canvas.width = FALLBACK_SIZE;
    canvas.height = FALLBACK_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Texture.EMPTY;

    // 填滿底色
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, FALLBACK_SIZE, FALLBACK_SIZE);

    // 加上圓角邊框增加辨識度
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 4;
    ctx.roundRect(4, 4, FALLBACK_SIZE - 8, FALLBACK_SIZE - 8, 10);
    ctx.stroke();

    return Texture.from(canvas);
  } catch {
    return Texture.EMPTY;
  }
}

// ─────────────────────── SymbolManager 主體 ───────────────────────

export class SymbolManager {
  /** 符號 ID → SymbolInfo 的不可變映射表 */
  private _symbolMap: ReadonlyMap<number, SymbolInfo> = new Map();

  /** 是否已完成載入 */
  private _loaded = false;

  // ─────────────────────── 公開 API ───────────────────────

  /** 是否已完成貼圖載入 */
  get loaded(): boolean {
    return this._loaded;
  }

  /**
   * 解析 Egret MC JSON 並從 BaseTexture 切割 15 個符號貼圖
   *
   * @param baseTexture - Symbol 圖集的完整貼圖
   * @param symbolJson  - Symbol.json 解析結果（EgretMCData 格式）
   *
   * JSON 的 res 鍵為字串 "1"-"15"（1-indexed），
   * 映射至我們的符號 ID 0-14（0-indexed）：id = parseInt(key) - 1
   */
  loadSymbols(baseTexture: Texture, symbolJson: EgretMCData): void {
    const entries = new Map<number, SymbolInfo>();

    for (let id = 0; id < SYMBOL_COUNT; id++) {
      // JSON key 為 1-indexed
      const jsonKey = String(id + 1);
      const frameData = symbolJson.res[jsonKey];

      let texture: Texture;

      if (frameData && baseTexture !== Texture.EMPTY) {
        // 從 BaseTexture 切割子矩形
        texture = this._cropTexture(baseTexture, frameData);
      } else {
        // 備用降級貼圖
        console.warn(
          `[SymbolManager] 符號 ID ${id}（JSON key "${jsonKey}"）無法從圖集載入，使用備用貼圖`,
        );
        texture = createFallbackTexture(FALLBACK_COLORS[id] ?? 0x888888);
      }

      const info: SymbolInfo = Object.freeze({
        id,
        name: SYMBOL_NAMES[id] ?? `Symbol${id}`,
        texture,
      });
      entries.set(id, info);
    }

    // 不可變替換整個映射表
    this._symbolMap = new Map(entries) as ReadonlyMap<number, SymbolInfo>;
    this._loaded = true;
  }

  /**
   * 使用備用降級貼圖初始化所有符號（不需要圖集資源）
   * 在資源載入完成前呼叫，確保遊戲可先渲染
   */
  loadFallbacks(): void {
    const entries = new Map<number, SymbolInfo>();
    for (let id = 0; id < SYMBOL_COUNT; id++) {
      const info: SymbolInfo = Object.freeze({
        id,
        name: SYMBOL_NAMES[id] ?? `Symbol${id}`,
        texture: createFallbackTexture(FALLBACK_COLORS[id] ?? 0x888888),
      });
      entries.set(id, info);
    }
    this._symbolMap = new Map(entries) as ReadonlyMap<number, SymbolInfo>;
    this._loaded = true;
  }

  /**
   * 取得指定符號 ID 的 Texture
   * @param id - 符號 ID（0-14）
   * @returns 對應的 Texture，若未載入或 ID 無效則回傳 Texture.EMPTY
   */
  getSymbolTexture(id: number): Texture {
    return this._symbolMap.get(id)?.texture ?? Texture.EMPTY;
  }

  /**
   * 取得指定符號 ID 的顯示名稱
   * @param id - 符號 ID（0-14）
   * @returns 符號名稱字串
   */
  getSymbolName(id: number): string {
    return this._symbolMap.get(id)?.name ?? `Unknown(${id})`;
  }

  /**
   * 取得所有符號的 id→Texture 映射（供 SymbolView / ReelStrip 注入使用）
   * 回傳 ReadonlyMap 避免外部修改
   */
  getTextureMap(): ReadonlyMap<number, Texture> {
    const result = new Map<number, Texture>();
    for (const [id, info] of this._symbolMap) {
      result.set(id, info.texture);
    }
    return result as ReadonlyMap<number, Texture>;
  }

  // ─────────────────────── 私有工具 ───────────────────────

  /**
   * 從 BaseTexture 切割子矩形，建立新的 Texture 物件
   *
   * PixiJS v8 API：
   *   new Texture({ source: baseTexture.source, frame: new Rectangle(...) })
   *
   * @param base - 完整圖集貼圖
   * @param rect - frame 的位置與尺寸
   * @returns 裁剪後的子貼圖
   */
  private _cropTexture(base: Texture, rect: FrameRect): Texture {
    const frame = new Rectangle(rect.x, rect.y, rect.w, rect.h);

    // PixiJS v8 建立子貼圖的標準方式
    return new Texture({
      source: base.source,
      frame,
    });
  }
}

/** 全域單例（模組載入時建立，延遲初始化貼圖） */
export const symbolManager = new SymbolManager();
