/**
 * EgretResParser — 解析 Egret 引擎的 default.res.json 資源清單
 *
 * Egret 使用下劃線命名法（underscore）來命名資源：
 *   - 圖片鍵：Symbol_png  → url: assets/BaseGame/Symbol.png
 *   - JSON 鍵：Symbol_json → url: assets/BaseGame/Symbol.json
 *   - 字型鍵：Free_SpinNum_fnt → url: assets/FreeGame/Font/Free_SpinNum.fnt
 *
 * 本模組職責：
 *   1. 解析 groups（分組）和 resources（資源列表）
 *   2. 將 Egret 鍵名映射到 PixiJS 載入路徑
 *   3. 按載入階段（stage）分組，供 AssetPipeline 使用
 */

// =====================================================================
// Egret res.json 原始資料型別
// =====================================================================

/** Egret 資源項目原始格式 */
export interface EgretResource {
  readonly url: string;
  /** 資源類型：image / json / font */
  readonly type: 'image' | 'json' | 'font';
  readonly name: string;
}

/** Egret 資源分組原始格式 */
export interface EgretGroup {
  /** 逗號分隔的資源鍵名字串 */
  readonly keys: string;
  readonly name: string;
}

/** default.res.json 頂層結構 */
export interface EgretResJson {
  readonly groups: readonly EgretGroup[];
  readonly resources: readonly EgretResource[];
}

// =====================================================================
// 解析結果型別（供 AssetPipeline 使用）
// =====================================================================

/** 解析後的單一資源條目 */
export interface ParsedResource {
  /** Egret 原始鍵名，如 Symbol_png */
  readonly egretKey: string;
  /** Vite 公共目錄相對路徑，如 assets/BaseGame/Symbol.png */
  readonly url: string;
  /** 資源類型 */
  readonly type: 'image' | 'json' | 'font';
}

/** 按載入階段分組後的資源映射表 */
export type StageResourceMap = ReadonlyMap<string, readonly ParsedResource[]>;

// =====================================================================
// 主解析器類別
// =====================================================================

/**
 * EgretResParser
 *
 * 解析 Egret res.json 並將資源依照 groups 的 name 欄位
 * 歸類至對應的載入階段（stage）。
 *
 * 載入階段優先順序（與 AssetPipeline 對應）：
 *   preload_group → preload_zh/en/pt/ko/es → game1 →
 *   control-panel → game2 → game3 → game_zh/en/...
 */
export class EgretResParser {
  /**
   * 解析 res.json 並建立「階段 → 資源列表」映射
   *
   * @param resJson - 從 fetch 取得的 default.res.json 原始物件
   * @returns 按階段名稱分組的資源映射表（唯讀）
   */
  static parse(resJson: EgretResJson): StageResourceMap {
    // 第一步：建立 egretKey → ParsedResource 的全域映射表
    const resourceByKey = EgretResParser.buildResourceIndex(resJson.resources);

    // 第二步：按照 group 名稱將資源分組
    const stageMap = new Map<string, ParsedResource[]>();

    for (const group of resJson.groups) {
      const stageName = group.name;
      const keys = EgretResParser.splitKeys(group.keys);
      const resources: ParsedResource[] = [];

      for (const key of keys) {
        const resource = resourceByKey.get(key);
        if (resource !== undefined) {
          resources.push(resource);
        }
        // 找不到對應資源時靜默跳過（部分鍵可能跨 group 共用）
      }

      // 合併已有的同名 stage（允許多個 group 對應同一階段）
      const existing = stageMap.get(stageName);
      if (existing !== undefined) {
        existing.push(...resources);
      } else {
        stageMap.set(stageName, resources);
      }
    }

    return stageMap as StageResourceMap;
  }

  /**
   * 建立 egretKey → ParsedResource 索引表
   *
   * 對 Egret 的資源項目進行正規化：
   *   - 保留原始 url（相對於 Vite public/，如 assets/xxx/yyy.png）
   *   - 不加前導斜線，讓 Vite 的 Assets.load() 正確解析
   *
   * @param resources - Egret res.json 的 resources 陣列
   */
  private static buildResourceIndex(
    resources: readonly EgretResource[],
  ): ReadonlyMap<string, ParsedResource> {
    const index = new Map<string, ParsedResource>();

    for (const raw of resources) {
      // Egret url 格式已是相對路徑（如 assets/BaseGame/Symbol.png）
      // 直接使用，不需要轉換
      const parsed: ParsedResource = {
        egretKey: raw.name,
        url: raw.url,
        type: raw.type,
      };
      index.set(raw.name, parsed);
    }

    return index;
  }

  /**
   * 將逗號分隔的鍵名字串切分並修剪空白
   *
   * Egret group.keys 範例：
   *   "Symbol_png,Symbol_json,Base_Reel_png"
   *
   * @param keys - 逗號分隔的鍵名字串
   * @returns 修剪後的鍵名陣列
   */
  private static splitKeys(keys: string): readonly string[] {
    return keys.split(',').map((k) => k.trim()).filter((k) => k.length > 0);
  }

  /**
   * 從 StageResourceMap 中取得指定階段的所有資源
   *
   * 便利方法：當階段不存在時回傳空陣列而非 undefined
   *
   * @param stageMap - parse() 回傳的映射表
   * @param stageName - 要查詢的階段名稱
   */
  static getStageResources(
    stageMap: StageResourceMap,
    stageName: string,
  ): readonly ParsedResource[] {
    return stageMap.get(stageName) ?? [];
  }

  /**
   * 取得所有可用的階段名稱
   *
   * @param stageMap - parse() 回傳的映射表
   */
  static getStageNames(stageMap: StageResourceMap): readonly string[] {
    return Array.from(stageMap.keys());
  }

  /**
   * 將 Egret 鍵名轉換為人類可讀的資源識別字
   *
   * 規則：移除尾部的 _png / _json / _fnt 後綴
   *
   * 範例：
   *   Symbol_png  → Symbol
   *   BigWin_SS_json → BigWin_SS
   *
   * @param egretKey - Egret 鍵名
   */
  static normalizeKey(egretKey: string): string {
    return egretKey.replace(/_(png|json|fnt|jpg)$/i, '');
  }
}
