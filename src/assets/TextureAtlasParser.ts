/**
 * TextureAtlasParser — 解析 Egret MovieClip JSON 格式的精靈圖集
 *
 * Egret 的 Symbol.json 結構包含兩個頂層鍵：
 *   - "mc"：MovieClip 動畫定義，每個動畫包含 frameRate 與 frames 序列
 *   - "res"：精靈矩形定義，以數字字串（"1", "2", ...）為鍵
 *
 * 完整的 Symbol.json 格式範例：
 * {
 *   "mc": {
 *     "Game_1": {
 *       "frameRate": 24,
 *       "events": [],
 *       "frames": [
 *         { "res": "1", "x": 0, "y": -37 },
 *         { "res": "2", "x": -34, "y": -30 }
 *       ]
 *     }
 *   },
 *   "res": {
 *     "1": { "x": 1, "y": 362, "w": 224, "h": 221 },
 *     "2": { "x": 227, "y": 362, "w": 292, "h": 254 }
 *   }
 * }
 *
 * 本模組職責：
 *   1. 從 "res" 區段提取精靈矩形，建立 PixiJS Texture 實例
 *   2. 從 "mc" 區段提取動畫定義（幀序列），建立 FrameData
 *   3. 支援已載入的底圖 Texture 作為 baseTexture 來源
 */
import { Texture, Rectangle } from 'pixi.js';

// =====================================================================
// Egret MovieClip JSON 原始資料型別
// =====================================================================

/** Egret res 區段中的單一精靈矩形定義 */
export interface EgretSpriteRect {
  /** 在底圖中的 X 座標（像素） */
  readonly x: number;
  /** 在底圖中的 Y 座標（像素） */
  readonly y: number;
  /** 精靈寬度（像素） */
  readonly w: number;
  /** 精靈高度（像素） */
  readonly h: number;
}

/** Egret mc 區段中的單一影格定義 */
export interface EgretMcFrame {
  /** 對應 res 區段的鍵名（數字字串） */
  readonly res: string;
  /** 影格顯示偏移 X（相對於動畫原點） */
  readonly x: number;
  /** 影格顯示偏移 Y（相對於動畫原點） */
  readonly y: number;
}

/** Egret MovieClip 動畫定義 */
export interface EgretMovieClip {
  readonly frameRate: number;
  readonly events: readonly unknown[];
  readonly frames: readonly EgretMcFrame[];
}

/** Egret Symbol.json 的頂層結構 */
export interface EgretSymbolJson {
  /** MovieClip 動畫映射（名稱 → 動畫定義） */
  readonly mc: Readonly<Record<string, EgretMovieClip>>;
  /** 精靈矩形映射（數字字串 → 矩形定義） */
  readonly res: Readonly<Record<string, EgretSpriteRect>>;
}

// =====================================================================
// 解析後的輸出型別（供 AssetStore / 動畫系統使用）
// =====================================================================

/** 解析後的動畫影格資料 */
export interface FrameData {
  /** 對應的 PixiJS Texture（已裁切的子紋理） */
  readonly texture: Texture;
  /** 影格在動畫原點的偏移 X（用於定位） */
  readonly offsetX: number;
  /** 影格在動畫原點的偏移 Y（用於定位） */
  readonly offsetY: number;
}

/** 解析後的動畫定義 */
export interface AnimationData {
  /** 動畫名稱（如 Game_1、Game_WW） */
  readonly name: string;
  /** 每秒影格數 */
  readonly frameRate: number;
  /** 有序的影格資料陣列 */
  readonly frames: readonly FrameData[];
}

/** TextureAtlasParser 的解析結果 */
export interface ParsedAtlasResult {
  /**
   * 精靈 Texture 映射表（res 鍵 → Texture）
   * 鍵為 Egret res 區段的數字字串，如 "1", "2" 等
   */
  readonly spriteTextures: ReadonlyMap<string, Texture>;
  /**
   * 動畫定義映射表（動畫名稱 → 動畫資料）
   * 鍵為 Egret mc 區段的動畫名稱，如 "Game_1", "Game_WW"
   */
  readonly animations: ReadonlyMap<string, AnimationData>;
}

// =====================================================================
// 主解析器類別
// =====================================================================

/**
 * TextureAtlasParser
 *
 * 解析 Egret MovieClip JSON 格式，將其轉換為 PixiJS 可用的
 * Texture 實例與動畫影格資料。
 *
 * 使用方式：
 *   const baseTexture = await Assets.load('assets/BaseGame/Symbol.png');
 *   const symbolJson = await Assets.load('assets/BaseGame/Symbol.json');
 *   const result = TextureAtlasParser.parse(symbolJson, baseTexture);
 */
export class TextureAtlasParser {
  /**
   * 解析 Egret Symbol JSON 並從底圖建立子紋理
   *
   * 兩個步驟：
   *   1. 解析 res 區段 → 建立精靈 Texture（裁切自底圖）
   *   2. 解析 mc 區段 → 建立動畫影格序列（引用步驟 1 的 Texture）
   *
   * @param symbolJson - 已解析的 Symbol.json 物件（EgretSymbolJson 格式）
   * @param baseTexture - 精靈底圖（對應 Symbol.png 的 PixiJS Texture）
   * @returns 解析結果，含 spriteTextures 與 animations 映射表
   */
  static parse(symbolJson: EgretSymbolJson, baseTexture: Texture): ParsedAtlasResult {
    // 步驟一：從 res 區段建立所有精靈子紋理
    const spriteTextures = TextureAtlasParser.buildSpriteTextures(
      symbolJson.res,
      baseTexture,
    );

    // 步驟二：從 mc 區段建立動畫影格序列
    const animations = TextureAtlasParser.buildAnimations(
      symbolJson.mc,
      spriteTextures,
    );

    return { spriteTextures, animations };
  }

  /**
   * 從 Egret res 區段建立精靈子紋理映射表
   *
   * Egret 的 res 使用左上角座標（x, y）與寬高（w, h）定義矩形，
   * 與 PixiJS 的 Rectangle 格式完全相容。
   *
   * @param resSection - Egret res 區段的原始資料
   * @param baseTexture - 精靈底圖 Texture
   */
  private static buildSpriteTextures(
    resSection: Readonly<Record<string, EgretSpriteRect>>,
    baseTexture: Texture,
  ): ReadonlyMap<string, Texture> {
    const textures = new Map<string, Texture>();

    for (const [resKey, rect] of Object.entries(resSection)) {
      // 使用 Egret 的矩形資料建立 PixiJS Rectangle
      const frame = new Rectangle(rect.x, rect.y, rect.w, rect.h);

      // 從底圖裁切出子紋理（PixiJS v8 API）
      // Texture.from 已在 v8 中棄用，改用 new Texture({ source, frame })
      const subTexture = new Texture({
        source: baseTexture.source,
        frame,
      });

      textures.set(resKey, subTexture);
    }

    return textures;
  }

  /**
   * 從 Egret mc 區段建立動畫影格序列映射表
   *
   * 每個動畫的每一幀都包含：
   *   - texture：引用 spriteTextures 中對應的子紋理
   *   - offsetX/offsetY：影格在動畫原點的偏移，用於精確定位
   *
   * @param mcSection - Egret mc 區段的原始資料
   * @param spriteTextures - 步驟一建立的子紋理映射表
   */
  private static buildAnimations(
    mcSection: Readonly<Record<string, EgretMovieClip>>,
    spriteTextures: ReadonlyMap<string, Texture>,
  ): ReadonlyMap<string, AnimationData> {
    const animations = new Map<string, AnimationData>();

    for (const [animName, mc] of Object.entries(mcSection)) {
      const frames: FrameData[] = [];

      for (const frame of mc.frames) {
        const texture = spriteTextures.get(frame.res);

        if (texture === undefined) {
          // res 鍵不存在時記錄警告並跳過，避免整個動畫解析失敗
          console.warn(
            `[TextureAtlasParser] 動畫「${animName}」的第 ${frames.length + 1} 幀`
            + ` 找不到對應的 res 鍵「${frame.res}」，已跳過`,
          );
          continue;
        }

        frames.push({
          texture,
          offsetX: frame.x,
          offsetY: frame.y,
        });
      }

      const animData: AnimationData = {
        name: animName,
        frameRate: mc.frameRate,
        frames,
      };

      animations.set(animName, animData);
    }

    return animations;
  }

  /**
   * 從解析結果中提取指定動畫的 PixiJS Texture 陣列
   *
   * 便利方法：供 AnimatedSprite 等元件直接使用
   *
   * @param result - parse() 回傳的解析結果
   * @param animName - 動畫名稱，如 "Game_1"
   * @returns Texture 陣列（不含偏移資訊），若動畫不存在則回傳空陣列
   */
  static getAnimationTextures(
    result: ParsedAtlasResult,
    animName: string,
  ): readonly Texture[] {
    const anim = result.animations.get(animName);
    if (anim === undefined) return [];
    return anim.frames.map((f) => f.texture);
  }

  /**
   * 列出解析結果中所有可用的動畫名稱
   *
   * @param result - parse() 回傳的解析結果
   */
  static listAnimationNames(result: ParsedAtlasResult): readonly string[] {
    return Array.from(result.animations.keys());
  }

  /**
   * 安全銷毀解析結果中的所有子紋理
   *
   * 用於場景切換或遊戲關閉時釋放 GPU 記憶體。
   * 注意：底圖 baseTexture 由呼叫方負責銷毀。
   *
   * @param result - parse() 回傳的解析結果
   */
  static destroy(result: ParsedAtlasResult): void {
    for (const texture of result.spriteTextures.values()) {
      // 只銷毀子紋理框架，不銷毀底圖（source）
      texture.destroy(false);
    }
  }
}
