/**
 * AssetStore — 全域資源倉庫（型別安全的單例模式）
 *
 * 職責：
 *   1. 持有所有已載入的 PixiJS Texture、JSON 資料與精靈圖集影格
 *   2. 提供型別安全的存取介面（找不到時拋出明確錯誤）
 *   3. 支援批次存入（由 AssetPipeline 呼叫）
 *   4. 提供銷毀方法，釋放所有 GPU 紋理資源
 *
 * 使用方式：
 *   // 存入（由 AssetPipeline 呼叫）
 *   AssetStore.instance.setTexture('Symbol_png', symbolTexture);
 *   AssetStore.instance.setJson('Symbol_json', symbolJson);
 *   AssetStore.instance.setSpriteFrames('Symbol', framesMap);
 *
 *   // 取出（由遊戲邏輯呼叫）
 *   const tex = AssetStore.instance.getTexture('Base_Reel_png');
 *   const frames = AssetStore.instance.getSpriteFrames('Symbol');
 */
import { Texture } from 'pixi.js';

// =====================================================================
// 型別定義
// =====================================================================

/**
 * 精靈圖集的影格映射表
 * 鍵：影格識別字（如 Egret res 鍵 "1", "2" 或動畫名稱 "Game_1"）
 * 值：對應的 PixiJS Texture 子紋理
 */
export type SpriteFrameMap = ReadonlyMap<string, Texture>;

// =====================================================================
// 主要類別
// =====================================================================

/**
 * AssetStore
 *
 * 全域資源倉庫，採用單例模式（Singleton）。
 * 所有資源以 Egret 鍵名（如 Symbol_png）作為索引鍵存入，
 * 確保與 default.res.json 的命名保持一致。
 */
export class AssetStore {
  // ------------------------------------------------------------------
  // 單例
  // ------------------------------------------------------------------

  private static _instance: AssetStore | null = null;

  /** 取得單例實例 */
  static get instance(): AssetStore {
    if (AssetStore._instance === null) {
      AssetStore._instance = new AssetStore();
    }
    return AssetStore._instance;
  }

  /** 禁止直接實例化，強制使用 instance getter */
  private constructor() {}

  // ------------------------------------------------------------------
  // 內部儲存容器（私有，不可從外部直接修改）
  // ------------------------------------------------------------------

  /** Texture 儲存容器：egretKey → Texture */
  private readonly _textures = new Map<string, Texture>();

  /** JSON 資料儲存容器：egretKey → unknown */
  private readonly _jsonData = new Map<string, unknown>();

  /**
   * 精靈圖集影格容器：sheetName → (frameKey → Texture)
   *
   * sheetName 通常為精靈底圖的基礎名稱（如 "Symbol"、"BigWin_SS"），
   * frameKey 則為 Egret res 區段的數字字串或動畫名稱。
   */
  private readonly _spriteFrames = new Map<string, Map<string, Texture>>();

  // ------------------------------------------------------------------
  // Texture 操作
  // ------------------------------------------------------------------

  /**
   * 存入一個 Texture
   *
   * @param key - Egret 鍵名（如 "Symbol_png"、"Base_Reel_png"）
   * @param texture - 已載入的 PixiJS Texture 實例
   */
  setTexture(key: string, texture: Texture): void {
    this._textures.set(key, texture);
  }

  /**
   * 批次存入多個 Texture
   *
   * @param entries - [key, texture] 鍵值對陣列
   */
  setTextures(entries: ReadonlyArray<readonly [string, Texture]>): void {
    for (const [key, texture] of entries) {
      this._textures.set(key, texture);
    }
  }

  /**
   * 取得 Texture
   *
   * 找不到時拋出 Error（快速失敗原則）。
   * 呼叫方應確保資源已載入，若不確定可改用 tryGetTexture()。
   *
   * @param key - Egret 鍵名
   * @throws {Error} 若 key 不存在
   */
  getTexture(key: string): Texture {
    const texture = this._textures.get(key);
    if (texture === undefined) {
      throw new Error(
        `[AssetStore] Texture 不存在：「${key}」。`
        + ` 請確認資源已由 AssetPipeline 載入，且鍵名拼寫正確。`,
      );
    }
    return texture;
  }

  /**
   * 嘗試取得 Texture（不拋出錯誤的安全版本）
   *
   * @param key - Egret 鍵名
   * @returns Texture 實例，若不存在則回傳 undefined
   */
  tryGetTexture(key: string): Texture | undefined {
    return this._textures.get(key);
  }

  /** 檢查 Texture 是否已載入 */
  hasTexture(key: string): boolean {
    return this._textures.has(key);
  }

  // ------------------------------------------------------------------
  // JSON 資料操作
  // ------------------------------------------------------------------

  /**
   * 存入 JSON 資料
   *
   * @param key - Egret 鍵名（如 "Symbol_json"、"BigWin_SS_json"）
   * @param data - 已解析的 JSON 物件
   */
  setJson(key: string, data: unknown): void {
    this._jsonData.set(key, data);
  }

  /**
   * 批次存入多個 JSON 資料
   *
   * @param entries - [key, data] 鍵值對陣列
   */
  setJsonBatch(entries: ReadonlyArray<readonly [string, unknown]>): void {
    for (const [key, data] of entries) {
      this._jsonData.set(key, data);
    }
  }

  /**
   * 取得 JSON 資料（回傳 unknown，呼叫方自行型別斷言）
   *
   * @param key - Egret 鍵名
   * @throws {Error} 若 key 不存在
   */
  getJson(key: string): unknown {
    const data = this._jsonData.get(key);
    if (data === undefined) {
      throw new Error(
        `[AssetStore] JSON 資料不存在：「${key}」。`
        + ` 請確認資源已由 AssetPipeline 載入，且鍵名拼寫正確。`,
      );
    }
    return data;
  }

  /**
   * 取得型別安全的 JSON 資料（使用泛型）
   *
   * 內部使用 unknown 儲存，取出時由泛型參數指定型別。
   * 呼叫方負責確保型別正確性。
   *
   * @param key - Egret 鍵名
   * @template T - 期望的資料型別
   * @throws {Error} 若 key 不存在
   */
  getJsonAs<T>(key: string): T {
    return this.getJson(key) as T;
  }

  /** 嘗試取得 JSON（不拋出錯誤） */
  tryGetJson(key: string): unknown | undefined {
    return this._jsonData.get(key);
  }

  /** 檢查 JSON 資料是否已載入 */
  hasJson(key: string): boolean {
    return this._jsonData.has(key);
  }

  // ------------------------------------------------------------------
  // 精靈圖集影格操作
  // ------------------------------------------------------------------

  /**
   * 存入精靈圖集的影格映射
   *
   * 通常由 AssetPipeline 在解析 Symbol.json 後呼叫：
   *   store.setSpriteFrames('Symbol', parsedResult.spriteTextures);
   *
   * @param sheetName - 精靈圖集名稱（如 "Symbol"、"BigWin_SS"）
   * @param frames - 影格鍵 → Texture 的映射表
   */
  setSpriteFrames(sheetName: string, frames: ReadonlyMap<string, Texture>): void {
    // 複製為可變 Map（保留不可變介面但內部可修改）
    const mutable = new Map<string, Texture>(frames);
    this._spriteFrames.set(sheetName, mutable);
  }

  /**
   * 取得精靈圖集的所有影格
   *
   * @param sheetName - 精靈圖集名稱
   * @throws {Error} 若圖集不存在
   */
  getSpriteFrames(sheetName: string): SpriteFrameMap {
    const frames = this._spriteFrames.get(sheetName);
    if (frames === undefined) {
      throw new Error(
        `[AssetStore] 精靈圖集不存在：「${sheetName}」。`
        + ` 請確認 TextureAtlasParser 已解析並存入此圖集。`,
      );
    }
    return frames as SpriteFrameMap;
  }

  /**
   * 從精靈圖集中取得單一影格 Texture
   *
   * @param sheetName - 精靈圖集名稱
   * @param frameKey - 影格鍵（如 "1"、"2" 或動畫名稱）
   * @throws {Error} 若圖集或影格不存在
   */
  getSpriteFrame(sheetName: string, frameKey: string): Texture {
    const frames = this.getSpriteFrames(sheetName);
    const texture = frames.get(frameKey);
    if (texture === undefined) {
      throw new Error(
        `[AssetStore] 精靈圖集「${sheetName}」中找不到影格「${frameKey}」。`,
      );
    }
    return texture;
  }

  /**
   * 嘗試取得精靈圖集（不拋出錯誤）
   *
   * @param sheetName - 精靈圖集名稱
   */
  tryGetSpriteFrames(sheetName: string): SpriteFrameMap | undefined {
    const frames = this._spriteFrames.get(sheetName);
    return frames as SpriteFrameMap | undefined;
  }

  /** 檢查精靈圖集是否已載入 */
  hasSpriteFrames(sheetName: string): boolean {
    return this._spriteFrames.has(sheetName);
  }

  // ------------------------------------------------------------------
  // 狀態查詢
  // ------------------------------------------------------------------

  /** 取得已載入的 Texture 數量 */
  get textureCount(): number {
    return this._textures.size;
  }

  /** 取得已載入的 JSON 數量 */
  get jsonCount(): number {
    return this._jsonData.size;
  }

  /** 取得已載入的精靈圖集數量 */
  get spriteSheetCount(): number {
    return this._spriteFrames.size;
  }

  /**
   * 取得所有已載入資源的摘要（用於除錯）
   */
  getSummary(): Readonly<{
    textures: readonly string[];
    jsonKeys: readonly string[];
    spriteSheets: readonly string[];
  }> {
    return {
      textures: Array.from(this._textures.keys()),
      jsonKeys: Array.from(this._jsonData.keys()),
      spriteSheets: Array.from(this._spriteFrames.keys()),
    };
  }

  // ------------------------------------------------------------------
  // 資源釋放
  // ------------------------------------------------------------------

  /**
   * 銷毀所有已載入的 Texture 並清空儲存容器
   *
   * 警告：呼叫後所有透過 getTexture() 取得的引用都將失效。
   * 應只在遊戲完全關閉或完整場景重置時使用。
   *
   * @param destroyBaseTexture - 是否同時銷毀底層 GPU 紋理，預設 true
   */
  destroy(destroyBaseTexture = true): void {
    // 銷毀主 Texture 容器
    for (const texture of this._textures.values()) {
      texture.destroy(destroyBaseTexture);
    }
    this._textures.clear();

    // 清空 JSON（純 JS 物件，無需特殊銷毀）
    this._jsonData.clear();

    // 銷毀精靈圖集中的子紋理
    // 子紋理共享底圖，只銷毀 frame 不銷毀 source
    for (const frames of this._spriteFrames.values()) {
      for (const texture of frames.values()) {
        texture.destroy(false);
      }
    }
    this._spriteFrames.clear();
  }

  /**
   * 重置單例（主要供測試使用）
   *
   * 生產環境通常不需要呼叫此方法。
   */
  static resetInstance(): void {
    if (AssetStore._instance !== null) {
      AssetStore._instance.destroy();
      AssetStore._instance = null;
    }
  }
}
