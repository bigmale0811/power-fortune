/**
 * AssetPipeline — 分階段資源載入管線
 *
 * 職責：
 *   1. 讀取 public/assets/default.res.json（Egret 格式資源清單）
 *   2. 按照預定義的載入階段順序載入資源
 *   3. 透過 onProgress 回呼回報每個階段的進度（0.0 ~ 1.0）
 *   4. 解析特殊格式（Symbol.json Egret MovieClip 圖集）
 *   5. 將所有載入結果存入 AssetStore 單例
 *
 * 載入階段順序（與原版 Egret 遊戲一致）：
 *   1. preload  — 背景、載入畫面、Logo（語系群組合併）
 *   2. game1    — 主遊戲核心資源（Symbol、DragonBones、BigWin）
 *   3. control-panel — 控制面板 UI 資源
 *   4. game2    — 免費遊戲資源（FreeGame）
 *   5. game3    — 小遊戲資源（MiniGame）
 *
 * 語系資源群組（game_zh/en/pt/ko/es）由呼叫方透過 locale 參數控制，
 * 只載入對應語系，避免浪費頻寬。
 *
 * 使用方式：
 *   const pipeline = new AssetPipeline({
 *     locale: 'zh',
 *     onProgress: (stage, progress) => updateLoadingBar(stage, progress),
 *   });
 *   const store = await pipeline.load();
 */

import { Assets } from 'pixi.js';
import type { Texture } from 'pixi.js';
import { EgretResParser } from '@/assets/EgretResParser';
import type { EgretResJson, StageResourceMap, ParsedResource } from '@/assets/EgretResParser';
import { TextureAtlasParser } from '@/assets/TextureAtlasParser';
import type { EgretSymbolJson } from '@/assets/TextureAtlasParser';
import { AssetStore } from '@/assets/AssetStore';

// =====================================================================
// 常數定義
// =====================================================================

/** default.res.json 的路徑（相對於 Vite public/） */
const RES_JSON_URL = 'assets/default.res.json';

/**
 * 主要載入階段名稱（按順序）
 *
 * preload 階段涵蓋 preload_group + 語系 preload_* 兩個群組。
 * 其他語系群組（game_zh 等）在 game1 之後依語系選擇性載入。
 */
const LOAD_STAGES = [
  'preload',
  'game1',
  'control-panel',
  'game2',
  'game3',
] as const;

/** 合法的語系代碼 */
type Locale = 'zh' | 'en' | 'pt' | 'ko' | 'es';

/** 載入階段名稱型別 */
type LoadStageName = (typeof LOAD_STAGES)[number] | string;

/**
 * 需要特殊解析的 Egret MovieClip 圖集定義
 * key：JSON 資源的 Egret 鍵名
 * pngKey：對應底圖的 Egret 鍵名
 * sheetName：存入 AssetStore 時使用的圖集識別名
 */
interface MovieClipAtlasConfig {
  readonly jsonKey: string;
  readonly pngKey: string;
  readonly sheetName: string;
}

/**
 * 需要在載入後自動解析的 Egret MovieClip 圖集列表
 * 目前僅 Symbol.json 為 MovieClip 格式，其他 JSON 為 Spritesheet 或 DragonBones
 */
const MOVIE_CLIP_ATLASES: readonly MovieClipAtlasConfig[] = [
  {
    jsonKey: 'Symbol_json',
    pngKey: 'Symbol_png',
    sheetName: 'Symbol',
  },
];

// =====================================================================
// 設定選項型別
// =====================================================================

/** AssetPipeline 建構子選項 */
export interface AssetPipelineOptions {
  /**
   * 目標語系，用於選擇載入哪個語系的文字資源群組
   * 預設：'zh'
   */
  readonly locale?: Locale;

  /**
   * 進度回呼函式
   *
   * 在每個階段開始前和結束後都會觸發。
   * progress 值域：0.0（開始）~ 1.0（完成）
   *
   * @param stage - 目前的載入階段名稱
   * @param progress - 0.0 ~ 1.0 的進度值
   */
  readonly onProgress?: (stage: LoadStageName, progress: number) => void;

  /**
   * 是否僅載入 preload 階段（用於載入畫面）
   * 預設：false（載入全部階段）
   */
  readonly preloadOnly?: boolean;
}

// =====================================================================
// 主要類別
// =====================================================================

/**
 * AssetPipeline
 *
 * 分階段資源載入管線，負責協調 EgretResParser、TextureAtlasParser
 * 與 AssetStore 三個模組，完成從 res.json 到可用 Texture 的完整流程。
 */
export class AssetPipeline {
  private readonly locale: Locale;
  private readonly onProgress: (stage: LoadStageName, progress: number) => void;
  private readonly preloadOnly: boolean;

  constructor(options: AssetPipelineOptions = {}) {
    this.locale = options.locale ?? 'zh';
    this.onProgress = options.onProgress ?? (() => undefined);
    this.preloadOnly = options.preloadOnly ?? false;
  }

  // ------------------------------------------------------------------
  // 公開 API
  // ------------------------------------------------------------------

  /**
   * 執行完整的資源載入流程
   *
   * 流程：
   *   1. fetch default.res.json
   *   2. 解析為 StageResourceMap（EgretResParser）
   *   3. 依序載入各階段資源
   *   4. 解析 MovieClip 圖集（TextureAtlasParser）
   *   5. 存入 AssetStore
   *
   * @returns AssetStore 單例（已填充所有資源）
   * @throws {Error} 若 res.json 載入失敗或個別資源載入失敗
   */
  async load(): Promise<AssetStore> {
    const store = AssetStore.instance;

    // 步驟一：載入並解析 default.res.json
    this.onProgress('preload', 0);
    const stageMap = await this.fetchAndParseResJson();

    // 步驟二：決定要載入的階段列表
    const stages = this.buildStageLoadList(stageMap);

    // 步驟三：依序載入各階段
    const totalStages = stages.length;
    for (let i = 0; i < stages.length; i++) {
      const [stageName, resources] = stages[i];

      // 每個階段開始時回報進度
      const stageProgress = i / totalStages;
      this.onProgress(stageName, stageProgress);

      // 批次載入此階段的所有資源
      await this.loadStageResources(stageName, resources, store);

      // 每個階段完成時回報完成進度
      const stageComplete = (i + 1) / totalStages;
      this.onProgress(stageName, stageComplete);
    }

    // 步驟四：解析 MovieClip 圖集（在 game1 載入後執行）
    if (!this.preloadOnly) {
      await this.parseMovieClipAtlases(store);
    }

    // 完成
    this.onProgress('complete', 1.0);

    return store;
  }

  // ------------------------------------------------------------------
  // 私有：res.json 取得與解析
  // ------------------------------------------------------------------

  /**
   * 使用 PixiJS Assets API 載入 res.json 並透過 EgretResParser 解析
   *
   * 使用 PixiJS Assets.load() 而非原生 fetch()，確保享有快取機制。
   */
  private async fetchAndParseResJson(): Promise<StageResourceMap> {
    let resJson: unknown;
    try {
      // PixiJS v8 的 Assets.load 會自動根據副檔名（.json）進行 JSON 解析
      resJson = await Assets.load(RES_JSON_URL);
    } catch (err) {
      throw new Error(
        `[AssetPipeline] 無法載入資源清單（${RES_JSON_URL}）：${String(err)}`,
      );
    }

    // 型別檢查：確認取得的 JSON 符合 EgretResJson 格式
    if (!isEgretResJson(resJson)) {
      throw new Error(
        `[AssetPipeline] ${RES_JSON_URL} 格式不符合 EgretResJson。`
        + ` 請確認 JSON 包含 "groups" 與 "resources" 兩個頂層陣列。`,
      );
    }

    return EgretResParser.parse(resJson);
  }

  // ------------------------------------------------------------------
  // 私有：階段列表建構
  // ------------------------------------------------------------------

  /**
   * 根據選項與 stageMap 建立有序的載入任務列表
   *
   * 合併規則：
   *   - preload 階段 = preload_group + preload_{locale}
   *   - game1 ~ game3 = 直接使用 stageMap 中的對應群組
   *   - 語系文字 = game_{locale}（在 game3 之後）
   *
   * @param stageMap - EgretResParser.parse() 的輸出
   */
  private buildStageLoadList(
    stageMap: StageResourceMap,
  ): ReadonlyArray<readonly [string, readonly ParsedResource[]]> {
    const list: Array<readonly [string, readonly ParsedResource[]]> = [];

    // preload 階段：合併 preload_group + preload_{locale}
    const preloadResources = [
      ...EgretResParser.getStageResources(stageMap, 'preload_group'),
      ...EgretResParser.getStageResources(stageMap, `preload_${this.locale}`),
    ];
    if (preloadResources.length > 0) {
      list.push(['preload', preloadResources] as const);
    }

    if (this.preloadOnly) {
      return list;
    }

    // 主要遊戲階段：game1, control-panel, game2, game3
    for (const stageName of ['game1', 'control-panel', 'game2', 'game3'] as const) {
      const resources = EgretResParser.getStageResources(stageMap, stageName);
      if (resources.length > 0) {
        list.push([stageName, resources] as const);
      }
    }

    // 語系文字資源（在 game3 之後）
    const gameLocaleResources = EgretResParser.getStageResources(
      stageMap,
      `game_${this.locale}`,
    );
    if (gameLocaleResources.length > 0) {
      list.push([`game_${this.locale}`, gameLocaleResources] as const);
    }

    return list;
  }

  // ------------------------------------------------------------------
  // 私有：單一階段的資源載入
  // ------------------------------------------------------------------

  /**
   * 批次載入一個階段的所有資源，並存入 AssetStore
   *
   * 策略：
   *   - 圖片（image）與 JSON（json）：使用 PixiJS Assets.load()
   *   - 字型（font）：使用 PixiJS Assets.load()（PixiJS v8 支援 BitmapFont .fnt）
   *   - 去重：已載入的資源不重複載入（Assets API 內建快取）
   *
   * @param stageName - 階段名稱（用於 error log）
   * @param resources - 此階段的資源清單
   * @param store - 目標 AssetStore
   */
  private async loadStageResources(
    stageName: string,
    resources: readonly ParsedResource[],
    store: AssetStore,
  ): Promise<void> {
    // 去除重複 URL（多個群組可能包含相同資源鍵）
    const uniqueResources = deduplicateResources(resources);

    // 為 PixiJS Assets 批次載入準備 alias 映射
    // alias（別名）使用 Egret 鍵名，讓後續 getTexture('Symbol_png') 直接可用
    const loadQueue: Array<Promise<void>> = [];

    for (const resource of uniqueResources) {
      // 已存在於 store 則跳過（避免 stage 間的重複資源重新載入）
      if (resource.type === 'image' && store.hasTexture(resource.egretKey)) {
        continue;
      }
      if (resource.type === 'json' && store.hasJson(resource.egretKey)) {
        continue;
      }

      loadQueue.push(
        this.loadSingleResource(resource, store, stageName),
      );
    }

    // 並行載入此階段的所有資源
    // Promise.allSettled 確保單一資源失敗不阻擋其他資源
    const results = await Promise.allSettled(loadQueue);

    // 收集失敗並輸出警告（不中斷流程，讓遊戲盡量可以執行）
    for (const result of results) {
      if (result.status === 'rejected') {
        console.warn(
          `[AssetPipeline] 階段「${stageName}」有資源載入失敗：`,
          result.reason,
        );
      }
    }
  }

  /**
   * 載入單一資源並存入 AssetStore
   *
   * @param resource - 資源描述（含 url、type、egretKey）
   * @param store - 目標 AssetStore
   * @param stageName - 所屬階段（用於錯誤訊息）
   */
  private async loadSingleResource(
    resource: ParsedResource,
    store: AssetStore,
    stageName: string,
  ): Promise<void> {
    try {
      // PixiJS Assets.load() 根據副檔名自動選擇解析器：
      //   .png / .jpg → Texture
      //   .json       → parsed JSON object
      //   .fnt        → BitmapFont（PixiJS v8 自動安裝）
      const loaded = await Assets.load(resource.url);

      switch (resource.type) {
        case 'image': {
          // loaded 為 Texture 實例
          store.setTexture(resource.egretKey, loaded as Texture);
          break;
        }
        case 'json': {
          // loaded 為已解析的 JS 物件
          store.setJson(resource.egretKey, loaded);
          break;
        }
        case 'font': {
          // BitmapFont 由 PixiJS 自動安裝至全域字型系統
          // 不需要手動存入 store，遊戲可直接透過字型名稱使用
          // 但仍記錄已載入狀態（以 JSON 欄位存儲元資料）
          store.setJson(resource.egretKey, { loaded: true, url: resource.url });
          break;
        }
        default: {
          // TypeScript exhaustive check：確保未來新增 type 時會有編譯警告
          const _exhaustive: never = resource.type;
          console.warn(
            `[AssetPipeline] 未知資源類型：${String(_exhaustive)}，`
            + `鍵名：${resource.egretKey}`,
          );
        }
      }
    } catch (err) {
      throw new Error(
        `[AssetPipeline] 載入失敗（階段：${stageName}，鍵名：${resource.egretKey}，`
        + `URL：${resource.url}）：${String(err)}`,
      );
    }
  }

  // ------------------------------------------------------------------
  // 私有：MovieClip 圖集解析
  // ------------------------------------------------------------------

  /**
   * 解析所有 Egret MovieClip 格式的圖集（如 Symbol.json）
   *
   * 此步驟在 game1 階段完成後執行，確保底圖和 JSON 都已載入。
   * 解析結果存入 AssetStore 的 spriteFrames 容器。
   *
   * @param store - 目標 AssetStore
   */
  private async parseMovieClipAtlases(store: AssetStore): Promise<void> {
    for (const config of MOVIE_CLIP_ATLASES) {
      // 確認底圖和 JSON 都已載入
      if (!store.hasTexture(config.pngKey) || !store.hasJson(config.jsonKey)) {
        console.warn(
          `[AssetPipeline] 跳過圖集解析「${config.sheetName}」：`
          + `底圖（${config.pngKey}）或 JSON（${config.jsonKey}）尚未載入`,
        );
        continue;
      }

      try {
        const baseTexture = store.getTexture(config.pngKey);
        const symbolJson = store.getJsonAs<EgretSymbolJson>(config.jsonKey);

        // 使用 TextureAtlasParser 解析 Egret MovieClip 格式
        const result = TextureAtlasParser.parse(symbolJson, baseTexture);

        // 存入 AssetStore：精靈子紋理映射
        store.setSpriteFrames(config.sheetName, result.spriteTextures);

        // 將動畫影格也以 "SheetName_AnimName" 格式存入（方便動畫系統使用）
        for (const [animName, animData] of result.animations.entries()) {
          const animFrameMap = new Map<string, Texture>(
            animData.frames.map((f, i) => [`frame_${i}`, f.texture] as const),
          );
          store.setSpriteFrames(`${config.sheetName}_${animName}`, animFrameMap);
        }
      } catch (err) {
        console.error(
          `[AssetPipeline] 圖集解析失敗「${config.sheetName}」：`,
          err,
        );
      }
    }
  }
}

// =====================================================================
// 模組級工具函式
// =====================================================================

/**
 * 對 ParsedResource 陣列去重（依 egretKey）
 *
 * 多個 Egret group 可能包含相同資源（如 Base_SymbolC1_ske_json
 * 同時出現在 game1 與 game2 中），去重避免重複載入。
 *
 * @param resources - 可能含重複的資源陣列
 */
function deduplicateResources(
  resources: readonly ParsedResource[],
): readonly ParsedResource[] {
  const seen = new Set<string>();
  return resources.filter((r) => {
    if (seen.has(r.egretKey)) return false;
    seen.add(r.egretKey);
    return true;
  });
}

/**
 * 型別守衛：驗證物件是否符合 EgretResJson 格式
 *
 * 只驗證頂層結構，不深入驗證每個資源項目的型別，
 * 保持效能的同時提供基本安全性。
 *
 * @param value - 待驗證的未知值
 */
function isEgretResJson(value: unknown): value is EgretResJson {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj['groups']) && Array.isArray(obj['resources']);
}
