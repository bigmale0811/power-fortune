/**
 * SoundManager — Howler.js 音效管理器（單例）
 *
 * 職責：
 *   1. 預載所有音效（遺失檔案靜默跳過，不中斷遊戲）
 *   2. 播放 / 停止個別音效（防止同鍵疊音）
 *   3. BGM 管理：淡出舊 BGM（500ms）→ 淡入新 BGM
 *   4. 三層音量控制：主音量 / SFX 音量 / BGM 音量
 *   5. 全域靜音切換
 *
 * 設計原則：
 *   - Singleton 模式：使用 `SoundManager.getInstance()` 取得唯一實例
 *   - 不可變設定：所有音效設定從 SoundConfig.ts 讀取，執行期不修改
 *   - 失效安全：音效檔不存在時 console.warn 但遊戲正常執行
 */
import { Howl, Howler } from 'howler';
import { SOUND_CONFIG_MAP } from '@/audio/SoundConfig';
import type { SoundEvent } from '@/audio/SoundConfig';

// ─────────────────────── 常數 ───────────────────────

/** BGM 淡出/淡入時間（毫秒） */
const BGM_CROSSFADE_MS = 500;

/** 預設主音量 */
const DEFAULT_MASTER_VOLUME = 0.8;

/** 預設 SFX 音量（相對主音量的乘數） */
const DEFAULT_SFX_VOLUME = 1.0;

/** 預設 BGM 音量（相對主音量的乘數） */
const DEFAULT_BGM_VOLUME = 0.7;

// ─────────────────────── 型別 ───────────────────────

/** Howl 實例加上元資料 */
interface HowlEntry {
  readonly howl: Howl;
  /** 目前播放的 Howl sound ID（用於停止特定實例） */
  currentSoundId: number | null;
}

// ─────────────────────── 單例實作 ───────────────────────

export class SoundManager {
  /** 唯一實例 */
  private static instance: SoundManager | null = null;

  /** Howl 實例池：SoundEvent → HowlEntry */
  private readonly howlPool: Map<SoundEvent, HowlEntry> = new Map();

  /** 目前播放中的 BGM 事件鍵 */
  private currentBgmKey: SoundEvent | null = null;

  /** 主音量（0 ~ 1） */
  private _masterVolume: number = DEFAULT_MASTER_VOLUME;

  /** SFX 分類音量乘數（0 ~ 1） */
  private _sfxVolume: number = DEFAULT_SFX_VOLUME;

  /** BGM 分類音量乘數（0 ~ 1） */
  private _bgmVolume: number = DEFAULT_BGM_VOLUME;

  /** 靜音狀態 */
  private _isMuted: boolean = false;

  /** 是否已完成預載 */
  private _preloaded: boolean = false;

  /** 私有建構子，強制使用 getInstance() */
  private constructor() {}

  /**
   * 取得 SoundManager 單例
   *
   * 第一次呼叫時建立實例，後續呼叫回傳相同實例。
   */
  static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  // ─────────────────────── 預載 ───────────────────────

  /**
   * 預載所有音效
   *
   * 遍歷 SOUND_CONFIG_MAP 並嘗試建立 Howl 實例。
   * 若音效檔不存在（404 / 解碼失敗），發出 warn 並跳過，
   * 不影響其他音效與遊戲流程。
   *
   * 此方法為冪等：多次呼叫只執行一次預載。
   */
  async preload(): Promise<void> {
    // 冪等保護：避免重複建立 Howl 實例
    if (this._preloaded) return;
    this._preloaded = true;

    // 將每個音效的 Howl 初始化包裝成 Promise
    const loadPromises: Promise<void>[] = [];

    for (const [key, entry] of SOUND_CONFIG_MAP) {
      const promise = new Promise<void>((resolve) => {
        // 計算實際播放音量：分類音量 × 設定音量
        const categoryMultiplier =
          entry.category === 'bgm' ? this._bgmVolume : this._sfxVolume;
        const effectiveVolume =
          this._masterVolume * categoryMultiplier * entry.volume;

        const howl = new Howl({
          src: [entry.src],
          volume: effectiveVolume,
          loop: entry.loop,
          // 預載但不立即播放
          preload: true,
          // 音效載入失敗時：記錄警告並繼續（不讓遊戲崩潰）
          onloaderror: (_id: number, error: unknown) => {
            console.warn(
              `[SoundManager] 音效載入失敗，已跳過：${key} (${entry.src})`,
              error,
            );
            resolve(); // 失敗也要 resolve，不阻塞整體預載
          },
          onload: () => {
            resolve();
          },
        });

        this.howlPool.set(key, { howl, currentSoundId: null });
      });

      loadPromises.push(promise);
    }

    // 等待所有音效嘗試載入（成功或失敗都會 resolve）
    await Promise.all(loadPromises);
    console.log(
      `[SoundManager] 預載完成，共 ${this.howlPool.size} 個音效項目`,
    );
  }

  // ─────────────────────── 核心播放 ───────────────────────

  /**
   * 播放音效
   *
   * 若同一事件鍵的音效正在播放，先停止再重播（防止疊音）。
   * 若音效未載入（檔案遺失），靜默跳過。
   *
   * @param event - 音效事件鍵
   */
  play(event: SoundEvent): void {
    const entry = this.howlPool.get(event);
    if (!entry) {
      // 音效未載入（可能是 404），靜默跳過
      return;
    }

    // 防止疊音：停止目前播放的同名音效實例
    if (entry.currentSoundId !== null) {
      entry.howl.stop(entry.currentSoundId);
      entry.currentSoundId = null;
    }

    const soundId = entry.howl.play();
    // soundId 可能為 false（Howl 內部錯誤），做型別守衛
    if (typeof soundId === 'number') {
      entry.currentSoundId = soundId;

      // 音效播放結束後自動清除 soundId 記錄（非 loop 音效）
      entry.howl.once('end', () => {
        if (entry.currentSoundId === soundId) {
          entry.currentSoundId = null;
        }
      }, soundId);
    }
  }

  /**
   * 停止指定音效
   *
   * @param event - 音效事件鍵
   */
  stop(event: SoundEvent): void {
    const entry = this.howlPool.get(event);
    if (!entry) return;

    if (entry.currentSoundId !== null) {
      entry.howl.stop(entry.currentSoundId);
      entry.currentSoundId = null;
    } else {
      // 無追蹤 ID 時停止所有同 Howl 實例的播放
      entry.howl.stop();
    }
  }

  /**
   * 停止所有音效（含 BGM）
   *
   * 常用於場景切換或緊急靜音。
   */
  stopAll(): void {
    for (const key of this.howlPool.keys()) {
      this.stop(key);
    }
    this.currentBgmKey = null;
  }

  // ─────────────────────── BGM 管理 ───────────────────────

  /**
   * 切換背景音樂（交叉淡入淡出）
   *
   * 流程：
   *   1. 若目前有 BGM 正在播放，以 BGM_CROSSFADE_MS 淡出
   *   2. 淡出完成後停止舊 BGM
   *   3. 淡入新 BGM（volume 從 0 升到目標音量）
   *
   * 若新舊 BGM 相同，不做任何操作（防止不必要的重啟）。
   *
   * @param event - BGM 音效事件鍵（category 必須為 'bgm'）
   */
  playBGM(event: SoundEvent): void {
    // 相同 BGM 已在播放中，跳過
    if (this.currentBgmKey === event) return;

    const newEntry = this.howlPool.get(event);
    if (!newEntry) {
      // 新 BGM 音效未載入，靜默跳過
      return;
    }

    const prevKey = this.currentBgmKey;
    this.currentBgmKey = event;

    if (prevKey) {
      // 淡出舊 BGM
      const prevEntry = this.howlPool.get(prevKey);
      if (prevEntry && prevEntry.currentSoundId !== null) {
        const fadingId = prevEntry.currentSoundId;

        prevEntry.howl.fade(
          prevEntry.howl.volume(fadingId) as number,
          0,
          BGM_CROSSFADE_MS,
          fadingId,
        );

        // 淡出完成後停止並播放新 BGM
        prevEntry.howl.once(
          'fade',
          () => {
            prevEntry.howl.stop(fadingId);
            prevEntry.currentSoundId = null;
            this.startBGMFadeIn(event, newEntry);
          },
          fadingId,
        );
        return;
      }
    }

    // 無舊 BGM：直接淡入新 BGM
    this.startBGMFadeIn(event, newEntry);
  }

  /**
   * 停止當前 BGM（帶淡出效果）
   */
  stopBGM(): void {
    if (!this.currentBgmKey) return;

    const entry = this.howlPool.get(this.currentBgmKey);
    const key = this.currentBgmKey;
    this.currentBgmKey = null;

    if (entry && entry.currentSoundId !== null) {
      const fadingId = entry.currentSoundId;
      entry.howl.fade(
        entry.howl.volume(fadingId) as number,
        0,
        BGM_CROSSFADE_MS,
        fadingId,
      );
      entry.howl.once(
        'fade',
        () => {
          entry.howl.stop(fadingId);
          entry.currentSoundId = null;
        },
        fadingId,
      );
    } else if (entry) {
      entry.howl.stop();
      console.debug(`[SoundManager] BGM 已停止：${key}`);
    }
  }

  // ─────────────────────── 音量控制 ───────────────────────

  /**
   * 設定主音量並同步更新所有 Howl 實例
   *
   * @param v - 音量值（0 ~ 1，超出範圍自動截斷）
   */
  setMasterVolume(v: number): void {
    this._masterVolume = clamp(v, 0, 1);
    // Howler 全域音量影響所有 Howl 實例
    Howler.volume(this._masterVolume);
  }

  /**
   * 設定 SFX 分類音量乘數，並重新套用至所有 sfx / ui 類別音效
   *
   * @param v - 音量乘數（0 ~ 1）
   */
  setSfxVolume(v: number): void {
    this._sfxVolume = clamp(v, 0, 1);
    this.applyVolumeToCategory(['sfx', 'ui']);
  }

  /**
   * 設定 BGM 分類音量乘數，並重新套用至所有 bgm 類別音效
   *
   * @param v - 音量乘數（0 ~ 1）
   */
  setBgmVolume(v: number): void {
    this._bgmVolume = clamp(v, 0, 1);
    this.applyVolumeToCategory(['bgm']);
  }

  /**
   * 切換全域靜音
   *
   * 使用 Howler.mute() 統一控制，不影響各 Howl 的 volume 設定值，
   * 解除靜音後音量回到原來的數值。
   *
   * @returns 切換後的靜音狀態（true = 靜音中）
   */
  toggleMute(): boolean {
    this._isMuted = !this._isMuted;
    Howler.mute(this._isMuted);
    return this._isMuted;
  }

  // ─────────────────────── 狀態存取 ───────────────────────

  /** 目前是否靜音 */
  get isMuted(): boolean {
    return this._isMuted;
  }

  /** 目前主音量 */
  get masterVolume(): number {
    return this._masterVolume;
  }

  /** 目前 SFX 分類音量乘數 */
  get sfxVolume(): number {
    return this._sfxVolume;
  }

  /** 目前 BGM 分類音量乘數 */
  get bgmVolume(): number {
    return this._bgmVolume;
  }

  /** 是否已完成預載 */
  get preloaded(): boolean {
    return this._preloaded;
  }

  // ─────────────────────── 私有工具 ───────────────────────

  /**
   * 淡入方式啟動新 BGM
   *
   * 從 0 音量開始播放，再淡入至目標音量，
   * 產生比突然播放更柔和的聽覺效果。
   *
   * @param event - BGM 事件鍵（用於記錄日誌）
   * @param entry - 對應的 HowlEntry
   */
  private startBGMFadeIn(event: SoundEvent, entry: HowlEntry): void {
    const configEntry = SOUND_CONFIG_MAP.get(event);
    if (!configEntry) return;

    // 計算目標音量（主音量 × BGM 乘數 × 設定音量）
    const targetVolume =
      this._masterVolume * this._bgmVolume * configEntry.volume;

    // 從靜音開始播放（避免爆音）
    entry.howl.volume(0);
    const soundId = entry.howl.play();

    if (typeof soundId === 'number') {
      entry.currentSoundId = soundId;
      // 淡入至目標音量
      entry.howl.fade(0, targetVolume, BGM_CROSSFADE_MS, soundId);
    }
  }

  /**
   * 重新計算並套用指定類別的音效音量
   *
   * 當使用者調整分類音量時，動態更新所有相關 Howl 實例的 volume，
   * 讓正在播放的音效即時反映新音量設定。
   *
   * @param categories - 需要更新的音效類別陣列
   */
  private applyVolumeToCategory(
    categories: readonly string[],
  ): void {
    for (const [key, entry] of this.howlPool) {
      const configEntry = SOUND_CONFIG_MAP.get(key);
      if (!configEntry || !categories.includes(configEntry.category)) continue;

      const multiplier =
        configEntry.category === 'bgm' ? this._bgmVolume : this._sfxVolume;
      const newVolume = this._masterVolume * multiplier * configEntry.volume;

      entry.howl.volume(newVolume);
    }
  }
}

// ─────────────────────── 工具函式 ───────────────────────

/**
 * 數值截斷至指定範圍
 *
 * @param value - 輸入值
 * @param min   - 最小值
 * @param max   - 最大值
 * @returns 截斷後的值
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
