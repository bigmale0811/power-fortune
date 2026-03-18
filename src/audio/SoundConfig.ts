/**
 * SoundConfig — 遊戲音效事件對應設定表
 *
 * 所有音效事件鍵（SoundEvent）與音效檔案路徑、音量、類別的完整映射。
 *
 * 注意：原始 CDN 資源不含音效檔，所有 src 路徑均為佔位符格式
 * `assets/audio/<key>.mp3`，SoundManager 載入失敗時會靜默跳過。
 *
 * 未來整合真實音效時，只需替換此處的 src 路徑，不需更動遊戲邏輯。
 */

// ─────────────────────── 型別定義 ───────────────────────

/**
 * 遊戲音效事件類型
 *
 * 分組說明：
 *   - 轉盤操作：SPIN_START / REEL_STOP / ALL_REELS_STOPPED
 *   - 中獎回饋：WIN_SMALL / WIN_BIG / WIN_MEGA / WIN_SUPER_MEGA
 *   - Scatter 事件：SCATTER_LAND / SCATTER_TRIGGER
 *   - 免費遊戲：FREE_SPIN_BGM / FREE_SPIN_START / FREE_SPIN_END
 *   - 小遊戲（Fortune Ball 揭示）：MINI_GAME_BGM / DOOR_SELECT / BALL_REVEAL / PRIZE_WIN
 *   - 基礎背景音樂：BASE_BGM
 *   - UI 操作：BUTTON_CLICK / BET_CHANGE
 *   - 計分動畫：COIN_DROP / COUNTUP_TICK / COUNTUP_END
 */
export type SoundEvent =
  // 轉盤操作
  | 'SPIN_START'
  | 'REEL_STOP'
  | 'ALL_REELS_STOPPED'
  // 中獎回饋（四級）
  | 'WIN_SMALL'
  | 'WIN_BIG'
  | 'WIN_MEGA'
  | 'WIN_SUPER_MEGA'
  // Scatter 特殊符號
  | 'SCATTER_LAND'
  | 'SCATTER_TRIGGER'
  // 免費旋轉
  | 'FREE_SPIN_BGM'
  | 'FREE_SPIN_START'
  | 'FREE_SPIN_END'
  // Fortune Ball 小遊戲
  | 'MINI_GAME_BGM'
  | 'DOOR_SELECT'
  | 'BALL_REVEAL'
  | 'PRIZE_WIN'
  // 基礎背景音樂
  | 'BASE_BGM'
  // UI 操作音效
  | 'BUTTON_CLICK'
  | 'BET_CHANGE'
  // 計分動畫音效
  | 'COIN_DROP'
  | 'COUNTUP_TICK'
  | 'COUNTUP_END';

/** 音效類別：背景音樂 / 音效 / UI 互動音 */
export type SoundCategory = 'bgm' | 'sfx' | 'ui';

/**
 * 單條音效設定項
 *
 * 所有欄位均為唯讀，防止執行期意外修改音效設定。
 */
export interface SoundEntry {
  /** 音效事件識別鍵 */
  readonly key: SoundEvent;
  /**
   * 音效檔路徑（相對於 public/ 目錄）
   *
   * 目前為佔位符格式 `assets/audio/<key_lowercase>.mp3`。
   * 音效檔不存在時 SoundManager 會發出 console.warn 並繼續執行。
   */
  readonly src: string;
  /** 預設音量（0.0 ~ 1.0） */
  readonly volume: number;
  /** 是否循環播放（BGM 為 true，SFX 通常為 false） */
  readonly loop: boolean;
  /** 音效類別，供分類音量控制使用 */
  readonly category: SoundCategory;
}

// ─────────────────────── 工具函式 ───────────────────────

/**
 * 根據事件鍵產生佔位符音效路徑
 *
 * 格式：`assets/audio/<key_lowercase>.mp3`
 * 例：'SPIN_START' → 'assets/audio/spin_start.mp3'
 *
 * @param key - SoundEvent 事件鍵
 * @returns 相對於 public/ 的路徑字串
 */
function placeholder(key: SoundEvent): string {
  return `assets/audio/${key.toLowerCase()}.mp3`;
}

// ─────────────────────── 音效設定表 ───────────────────────

/**
 * 完整音效設定表（唯讀陣列）
 *
 * 維護說明：
 *   1. 音效類別（category）決定 SoundManager 的分類音量控制範圍
 *   2. BGM 音效（loop: true）由 SoundManager.playBGM() 管理淡入淡出
 *   3. volume 為該音效相對於所屬類別音量的倍率（SoundManager 內部再乘以類別音量）
 *   4. 替換真實音效時，只需更新 src 欄位，其他欄位按遊戲感設定
 */
export const SOUND_CONFIG: readonly SoundEntry[] = Object.freeze([
  // ══════════════════ 轉盤操作 ══════════════════
  {
    key: 'SPIN_START',
    src: placeholder('SPIN_START'),
    volume: 0.8,
    loop: false,
    category: 'sfx',
  },
  {
    key: 'REEL_STOP',
    src: placeholder('REEL_STOP'),
    volume: 0.7,
    loop: false,
    category: 'sfx',
  },
  {
    key: 'ALL_REELS_STOPPED',
    src: placeholder('ALL_REELS_STOPPED'),
    volume: 0.6,
    loop: false,
    category: 'sfx',
  },

  // ══════════════════ 中獎回饋（四級強度遞增） ══════════════════
  {
    key: 'WIN_SMALL',
    src: placeholder('WIN_SMALL'),
    volume: 0.7,
    loop: false,
    category: 'sfx',
  },
  {
    key: 'WIN_BIG',
    src: placeholder('WIN_BIG'),
    volume: 0.8,
    loop: false,
    category: 'sfx',
  },
  {
    key: 'WIN_MEGA',
    src: placeholder('WIN_MEGA'),
    volume: 0.9,
    loop: false,
    category: 'sfx',
  },
  {
    key: 'WIN_SUPER_MEGA',
    src: placeholder('WIN_SUPER_MEGA'),
    volume: 1.0,
    loop: false,
    category: 'sfx',
  },

  // ══════════════════ Scatter 特殊符號 ══════════════════
  {
    key: 'SCATTER_LAND',
    src: placeholder('SCATTER_LAND'),
    volume: 0.75,
    loop: false,
    category: 'sfx',
  },
  {
    key: 'SCATTER_TRIGGER',
    // Scatter 觸發免費旋轉是關鍵事件，音量略高
    src: placeholder('SCATTER_TRIGGER'),
    volume: 0.9,
    loop: false,
    category: 'sfx',
  },

  // ══════════════════ 免費旋轉 ══════════════════
  {
    key: 'FREE_SPIN_BGM',
    src: placeholder('FREE_SPIN_BGM'),
    volume: 0.6,
    loop: true,
    category: 'bgm',
  },
  {
    key: 'FREE_SPIN_START',
    src: placeholder('FREE_SPIN_START'),
    volume: 0.85,
    loop: false,
    category: 'sfx',
  },
  {
    key: 'FREE_SPIN_END',
    src: placeholder('FREE_SPIN_END'),
    volume: 0.8,
    loop: false,
    category: 'sfx',
  },

  // ══════════════════ Fortune Ball 小遊戲 ══════════════════
  {
    key: 'MINI_GAME_BGM',
    src: placeholder('MINI_GAME_BGM'),
    volume: 0.55,
    loop: true,
    category: 'bgm',
  },
  {
    key: 'DOOR_SELECT',
    // 玩家選門時的點擊/翻轉音效
    src: placeholder('DOOR_SELECT'),
    volume: 0.75,
    loop: false,
    category: 'sfx',
  },
  {
    key: 'BALL_REVEAL',
    // 球型揭示的短促音效
    src: placeholder('BALL_REVEAL'),
    volume: 0.8,
    loop: false,
    category: 'sfx',
  },
  {
    key: 'PRIZE_WIN',
    // 小遊戲結算彩金音效
    src: placeholder('PRIZE_WIN'),
    volume: 1.0,
    loop: false,
    category: 'sfx',
  },

  // ══════════════════ 基礎背景音樂 ══════════════════
  {
    key: 'BASE_BGM',
    src: placeholder('BASE_BGM'),
    volume: 0.5,
    loop: true,
    category: 'bgm',
  },

  // ══════════════════ UI 操作音效 ══════════════════
  {
    key: 'BUTTON_CLICK',
    // 輕量 UI 互動音，音量不宜過高
    src: placeholder('BUTTON_CLICK'),
    volume: 0.5,
    loop: false,
    category: 'ui',
  },
  {
    key: 'BET_CHANGE',
    src: placeholder('BET_CHANGE'),
    volume: 0.5,
    loop: false,
    category: 'ui',
  },

  // ══════════════════ 計分動畫音效 ══════════════════
  {
    key: 'COIN_DROP',
    // 硬幣落地音，配合計分動畫初始落差
    src: placeholder('COIN_DROP'),
    volume: 0.65,
    loop: false,
    category: 'sfx',
  },
  {
    key: 'COUNTUP_TICK',
    // 數字滾動計分時的節拍音，需要快速重複播放
    src: placeholder('COUNTUP_TICK'),
    volume: 0.4,
    loop: false,
    category: 'sfx',
  },
  {
    key: 'COUNTUP_END',
    // 計分結束的收尾音效
    src: placeholder('COUNTUP_END'),
    volume: 0.7,
    loop: false,
    category: 'sfx',
  },
] as const);

// ─────────────────────── 查詢工具 ───────────────────────

/**
 * 由 SoundEvent 鍵快速查詢設定項（O(1) Map 查詢）
 *
 * 供 SoundManager 內部使用，避免每次播放都線性搜尋陣列。
 */
export const SOUND_CONFIG_MAP: ReadonlyMap<SoundEvent, SoundEntry> = new Map(
  SOUND_CONFIG.map((entry) => [entry.key, entry]),
);
